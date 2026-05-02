const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { pool, withTransaction } = require('../utils/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all inventory items with filters
router.get('/', authenticate, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('category').optional().isUUID(),
  query('status').optional().isIn(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'EXPIRED', 'EXPIRING_SOON']),
  query('search').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { category, status, search } = req.query;

    let whereClause = 'WHERE i.is_active = true';
    const params = [];
    let paramIndex = 1;

    if (category) {
      whereClause += ` AND i.category_id = $${paramIndex++}`;
      params.push(category);
    }

    if (status) {
      whereClause += ` AND (
        CASE 
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE THEN 'EXPIRED'
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'EXPIRING_SOON'
          WHEN i.current_quantity = 0 THEN 'OUT_OF_STOCK'
          WHEN i.current_quantity <= i.minimum_threshold THEN 'LOW_STOCK'
          ELSE 'IN_STOCK'
        END
      ) = $${paramIndex++}`;
      params.push(status);
    }

    if (search) {
      whereClause += ` AND (
        to_tsvector('english', i.name || ' ' || COALESCE(i.generic_name, '')) @@ plainto_tsquery('english', $${paramIndex++})
        OR i.name ILIKE $${paramIndex++}
        OR i.sku ILIKE $${paramIndex++}
      )`;
      params.push(search, `%${search}%`, `%${search}%`);
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM inventory_items i ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get items with status calculation
    const itemsResult = await pool.query(
      `SELECT 
        i.*,
        c.name as category_name,
        c.color_code,
        c.icon,
        CASE 
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE THEN 'EXPIRED'
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'EXPIRING_SOON'
          WHEN i.current_quantity = 0 THEN 'OUT_OF_STOCK'
          WHEN i.current_quantity <= i.minimum_threshold THEN 'LOW_STOCK'
          ELSE 'IN_STOCK'
        END as status,
        CASE 
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE THEN 4
          WHEN i.current_quantity = 0 THEN 3
          WHEN i.current_quantity <= i.minimum_threshold THEN 2
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 1
          ELSE 0
        END as priority_level
      FROM inventory_items i
      JOIN categories c ON i.category_id = c.id
      ${whereClause}
      ORDER BY priority_level DESC, i.name ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    res.json({
      items: itemsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Fetch inventory error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Get single item with full details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        i.*,
        c.name as category_name,
        c.color_code,
        c.icon,
        u.full_name as created_by_name,
        CASE 
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE THEN 'EXPIRED'
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'EXPIRING_SOON'
          WHEN i.current_quantity = 0 THEN 'OUT_OF_STOCK'
          WHEN i.current_quantity <= i.minimum_threshold THEN 'LOW_STOCK'
          ELSE 'IN_STOCK'
        END as status
      FROM inventory_items i
      JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.id = $1 AND i.is_active = true`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Get recent transactions
    const transactions = await pool.query(
      `SELECT 
        t.*,
        u.full_name as administered_by_name
      FROM transactions t
      LEFT JOIN users u ON t.administered_by = u.id
      WHERE t.item_id = $1
      ORDER BY t.created_at DESC
      LIMIT 10`,
      [req.params.id]
    );

    res.json({
      item: result.rows[0],
      recentTransactions: transactions.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch item details' });
  }
});

// Create new inventory item
router.post('/', authenticate, [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('categoryId').isUUID().withMessage('Valid category is required'),
  body('unitOfMeasure').trim().notEmpty().withMessage('Unit of measure is required'),
  body('currentQuantity').isInt({ min: 0 }).withMessage('Quantity must be 0 or greater'),
  body('minimumThreshold').optional().isInt({ min: 0 }),
  body('expirationDate').optional().isISO8601().toDate()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      categoryId,
      sku,
      genericName,
      brandName,
      description,
      dosageInfo,
      usageInstructions,
      indications,
      contraindications,
      sideEffects,
      storageConditions,
      unitOfMeasure,
      currentQuantity,
      minimumThreshold,
      reorderPoint,
      expirationDate,
      batchNumber,
      supplierInfo,
      location
    } = req.body;

    const result = await pool.query(
      `INSERT INTO inventory_items (
        category_id, sku, name, generic_name, brand_name, description,
        dosage_info, usage_instructions, indications, contraindications, side_effects,
        storage_conditions, unit_of_measure, current_quantity, minimum_threshold, reorder_point,
        expiration_date, batch_number, supplier_info, location, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *`,
      [
        categoryId, sku, name, genericName, brandName, description,
        dosageInfo, usageInstructions, indications, contraindications, sideEffects,
        storageConditions, unitOfMeasure, currentQuantity, minimumThreshold || 10, reorderPoint || 20,
        expirationDate, batchNumber, supplierInfo ? JSON.stringify(supplierInfo) : null, location,
        req.user.id
      ]
    );

    // Log the initial stock addition
    if (currentQuantity > 0) {
      await pool.query(
        `INSERT INTO transactions (item_id, transaction_type, quantity, previous_quantity, new_quantity, reason, administered_by)
         VALUES ($1, 'IN', $2, 0, $2, 'Initial stock', $3)`,
        [result.rows[0].id, currentQuantity, req.user.id]
      );
    }

    res.status(201).json({
      message: 'Item created successfully',
      item: result.rows[0]
    });
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// Update inventory item
// UPDATE inventory item - COMPLETE EDIT
router.put('/:id', authenticate, [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('category_id').isUUID().withMessage('Valid category is required'),
  body('unit_of_measure').trim().notEmpty().withMessage('Unit of measure is required'),
  body('minimum_threshold').isInt({ min: 0 }).withMessage('Minimum threshold must be 0 or greater'),
  body('current_quantity').isInt({ min: 0 }).withMessage('Current quantity must be 0 or greater')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const {
      name,
      generic_name,
      brand_name,
      category_id,
      unit_of_measure,
      description,
      current_quantity,
      minimum_threshold,
      reorder_point,
      expiration_date,
      batch_number,
      storage_conditions,
      location,
      dosage_info
    } = req.body;

    // Check if item exists
    const existingItem = await pool.query(
      'SELECT * FROM inventory_items WHERE id = $1 AND is_active = true',
      [id]
    );

    if (existingItem.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Update item with ALL fields (direct values, not COALESCE)
    const result = await pool.query(
      `UPDATE inventory_items SET
        name = $1,
        generic_name = $2,
        brand_name = $3,
        category_id = $4,
        unit_of_measure = $5,
        description = $6,
        current_quantity = $7,
        minimum_threshold = $8,
        reorder_point = $9,
        expiration_date = $10,
        batch_number = $11,
        storage_conditions = $12,
        location = $13,
        dosage_info = $14,
        updated_at = NOW()
      WHERE id = $15 AND is_active = true
      RETURNING *`,
      [
        name,
        generic_name || null,
        brand_name || null,
        category_id,
        unit_of_measure,
        description || null,
        current_quantity || 0,
        minimum_threshold,
        reorder_point || null,
        expiration_date || null,
        batch_number || null,
        storage_conditions || 'Room Temperature',
        location || null,
        dosage_info || null,
        id
      ]
    );

    res.json({
      success: true,
      message: 'Item updated successfully',
      item: result.rows[0]
    });

  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete item (soft delete)
router.delete('/:id', authenticate, authorize('ADMIN', 'HEAD_NURSE'), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE inventory_items SET is_active = false WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Search items (for quick dispense)
router.get('/search/quick', authenticate, [
  query('q').trim().notEmpty().withMessage('Search query is required')
], async (req, res) => {
  try {
    const { q } = req.query;
    
    const result = await pool.query(
      `SELECT 
        i.id, i.name, i.generic_name, i.current_quantity, i.unit_of_measure,
        i.expiration_date, c.name as category_name, c.color_code,
        CASE 
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE THEN 'EXPIRED'
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'EXPIRING_SOON'
          WHEN i.current_quantity = 0 THEN 'OUT_OF_STOCK'
          WHEN i.current_quantity <= i.minimum_threshold THEN 'LOW_STOCK'
          ELSE 'IN_STOCK'
        END as status
      FROM inventory_items i
      JOIN categories c ON i.category_id = c.id
      WHERE i.is_active = true
        AND (
          i.name ILIKE $1 OR
          i.generic_name ILIKE $1 OR
          i.sku ILIKE $1
        )
        AND i.current_quantity > 0
      ORDER BY 
        CASE WHEN i.name ILIKE $2 THEN 0 ELSE 1 END,
        i.name
      LIMIT 10`,
      [`%${q}%`, `${q}%`]
    );

    res.json({ items: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;