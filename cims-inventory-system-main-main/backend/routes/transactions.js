const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { pool, withTransaction } = require('../utils/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// EXPORT TRANSACTIONS TO CSV
router.get('/export', authenticate, async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (type) {
      whereClause += ` AND t.transaction_type = $${paramIndex++}`;
      params.push(type);
    }

    if (startDate) {
      whereClause += ` AND t.created_at >= $${paramIndex++}`;
      params.push(`${startDate}T00:00:00`);
    }

    if (endDate) {
      whereClause += ` AND t.created_at <= $${paramIndex++}`;
      params.push(`${endDate}T23:59:59`);
    }

    // Get all transactions (no pagination for export)
    const result = await pool.query(
      `SELECT 
        t.*,
        i.name as item_name,
        i.unit_of_measure,
        u.full_name as administered_by_name
      FROM transactions t
      JOIN inventory_items i ON t.item_id = i.id
      LEFT JOIN users u ON t.administered_by = u.id
      ${whereClause}
      ORDER BY t.created_at DESC`,
      params
    );

    const transactions = result.rows;

    // Generate CSV
    const headers = [
      'Date',
      'Time',
      'Type',
      'Item',
      'Quantity',
      'Previous Qty',
      'New Qty',
      'Unit',
      'Student Name',
      'Student ID',
      'Reason',
      'Notes',
      'Administered By'
    ].join(',');

    const escapeCsv = (text) => {
      if (text === null || text === undefined) return '';
      return `"${String(text).replace(/"/g, '""')}"`;
    };

    const rows = transactions.map(t => {
      const date = new Date(t.created_at);
      const dateStr = date.toLocaleDateString();
      const timeStr = date.toLocaleTimeString();

      return [
        dateStr,
        timeStr,
        t.transaction_type,
        escapeCsv(t.item_name),
        t.quantity,
        t.previous_quantity,
        t.new_quantity,
        escapeCsv(t.unit_of_measure),
        escapeCsv(t.student_name),
        escapeCsv(t.student_id),
        escapeCsv(t.reason),
        escapeCsv(t.notes),
        escapeCsv(t.administered_by_name)
      ].join(',');
    }).join('\n');

    const csvContent = headers + '\n' + rows;

    // Set headers for file download
    const filename = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.send(csvContent);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export transactions' });
  }
});

// DISPENSE MEDICINE - Core functionality
router.post('/dispense', authenticate, [
  body('itemId').isUUID().withMessage('Valid item ID is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('studentId').trim().notEmpty().withMessage('Student ID is required'),
  body('studentName').trim().notEmpty().withMessage('Student name is required'),
  body('reason').trim().notEmpty().withMessage('Reason is required')
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { itemId, quantity, studentId, studentName, studentGrade, reason, notes } = req.body;
    const nurseId = req.user.id;

    await client.query('BEGIN');

    // 1. Lock the item row for update (prevents race conditions)
    const itemResult = await client.query(
      `SELECT 
        i.*, c.name as category_name,
        CASE 
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE THEN true
          ELSE false
        END as is_expired
      FROM inventory_items i
      JOIN categories c ON i.category_id = c.id
      WHERE i.id = $1 AND i.is_active = true
      FOR UPDATE`,
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemResult.rows[0];

    // 2. Business rule: Check if medicine is expired
    if (item.is_expired) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Cannot dispense expired medicine',
        details: `This ${item.name} expired on ${item.expiration_date}`
      });
    }

    // 3. Business rule: Check if stock is sufficient
    if (item.current_quantity < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Insufficient stock',
        details: `Available: ${item.current_quantity} ${item.unit_of_measure}, Requested: ${quantity}`
      });
    }

    const previousQuantity = item.current_quantity;
    const newQuantity = previousQuantity - quantity;

    // 4. Update inventory
    await client.query(
      `UPDATE inventory_items 
       SET current_quantity = $1, updated_at = NOW() 
       WHERE id = $2`,
      [newQuantity, itemId]
    );

    // 5. Create transaction record (audit trail)
    const transactionResult = await client.query(
      `INSERT INTO transactions (
        item_id, transaction_type, quantity, previous_quantity, new_quantity,
        reason, notes, student_id, student_name, student_grade, administered_by
      ) VALUES ($1, 'OUT', $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [itemId, quantity, previousQuantity, newQuantity, reason, notes, studentId, studentName, studentGrade, nurseId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Successfully dispensed ${quantity} ${item.unit_of_measure} of ${item.name}`,
      data: {
        transaction: transactionResult.rows[0],
        item: {
          id: item.id,
          name: item.name,
          category: item.category_name,
          previousQuantity,
          newQuantity,
          unitOfMeasure: item.unit_of_measure
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Dispense error:', error);
    res.status(500).json({ error: 'Failed to dispense medicine', details: error.message });
  } finally {
    client.release();
  }
});

// RECEIVE STOCK (Add inventory)
router.post('/receive', authenticate, [
  body('itemId').isUUID().withMessage('Valid item ID is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('reason').trim().notEmpty().withMessage('Reason is required')
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { itemId, quantity, reason, notes, batchNumber, expirationDate } = req.body;
    const nurseId = req.user.id;

    await client.query('BEGIN');

    // Lock and get current item
    const itemResult = await client.query(
      `SELECT * FROM inventory_items WHERE id = $1 AND is_active = true FOR UPDATE`,
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemResult.rows[0];
    const previousQuantity = item.current_quantity;
    const newQuantity = previousQuantity + quantity;

    // Update inventory
    await client.query(
      `UPDATE inventory_items 
       SET current_quantity = $1, 
           updated_at = NOW(),
           batch_number = COALESCE($2, batch_number),
           expiration_date = COALESCE($3, expiration_date)
       WHERE id = $4`,
      [newQuantity, batchNumber, expirationDate, itemId]
    );

    // Create transaction record
    const transactionResult = await client.query(
      `INSERT INTO transactions (
        item_id, transaction_type, quantity, previous_quantity, new_quantity,
        reason, notes, administered_by
      ) VALUES ($1, 'IN', $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [itemId, quantity, previousQuantity, newQuantity, reason, notes, nurseId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Successfully added ${quantity} ${item.unit_of_measure} of ${item.name}`,
      data: {
        transaction: transactionResult.rows[0],
        item: {
          id: item.id,
          name: item.name,
          previousQuantity,
          newQuantity,
          unitOfMeasure: item.unit_of_measure
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Receive stock error:', error);
    res.status(500).json({ error: 'Failed to receive stock' });
  } finally {
    client.release();
  }
});

// ADJUST STOCK (For damaged, lost, or correction)
router.post('/adjust', authenticate, authorize('ADMIN', 'HEAD_NURSE'), [
  body('itemId').isUUID().withMessage('Valid item ID is required'),
  body('newQuantity').isInt({ min: 0 }).withMessage('New quantity must be 0 or greater'),
  body('reason').trim().notEmpty().withMessage('Reason is required')
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { itemId, newQuantity, reason, notes } = req.body;
    const nurseId = req.user.id;

    await client.query('BEGIN');

    const itemResult = await client.query(
      `SELECT * FROM inventory_items WHERE id = $1 AND is_active = true FOR UPDATE`,
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemResult.rows[0];
    const previousQuantity = item.current_quantity;

    // Update inventory
    await client.query(
      `UPDATE inventory_items SET current_quantity = $1, updated_at = NOW() WHERE id = $2`,
      [newQuantity, itemId]
    );

    // Create adjustment transaction
    const transactionResult = await client.query(
      `INSERT INTO transactions (
        item_id, transaction_type, quantity, previous_quantity, new_quantity,
        reason, notes, administered_by
      ) VALUES ($1, 'ADJUSTMENT', $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [itemId, Math.abs(newQuantity - previousQuantity), previousQuantity, newQuantity, reason, notes, nurseId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Stock adjusted from ${previousQuantity} to ${newQuantity}`,
      data: {
        transaction: transactionResult.rows[0],
        item: {
          id: item.id,
          name: item.name,
          previousQuantity,
          newQuantity
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to adjust stock' });
  } finally {
    client.release();
  }
});

// Get transaction history with filters
router.get('/', authenticate, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('itemId').optional().isUUID(),
  query('type').optional().isIn(['IN', 'OUT', 'ADJUSTMENT', 'EXPIRED', 'DAMAGED']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { itemId, type, startDate, endDate } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (itemId) {
      whereClause += ` AND t.item_id = $${paramIndex++}`;
      params.push(itemId);
    }

    if (type) {
      whereClause += ` AND t.transaction_type = $${paramIndex++}`;
      params.push(type);
    }

    if (startDate) {
      whereClause += ` AND t.created_at >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND t.created_at <= $${paramIndex++}`;
      params.push(endDate);
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM transactions t ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get transactions
    const result = await pool.query(
      `SELECT 
        t.*,
        i.name as item_name,
        i.unit_of_measure,
        u.full_name as administered_by_name
      FROM transactions t
      JOIN inventory_items i ON t.item_id = i.id
      LEFT JOIN users u ON t.administered_by = u.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    res.json({
      transactions: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Fetch transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get transaction statistics
router.get('/stats/overview', authenticate, async (req, res) => {
  try {
    // Today's dispenses
    const todayResult = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(quantity), 0) as total_quantity
       FROM transactions 
       WHERE transaction_type = 'OUT' AND DATE(created_at) = CURRENT_DATE`
    );

    // This week's activity
    const weekResult = await pool.query(
      `SELECT 
        DATE(created_at) as date,
        transaction_type,
        COUNT(*) as count,
        SUM(quantity) as total_quantity
       FROM transactions 
       WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY DATE(created_at), transaction_type
       ORDER BY date DESC`
    );

    // Most dispensed items
    const topItemsResult = await pool.query(
      `SELECT 
        i.name,
        SUM(t.quantity) as total_dispensed,
        COUNT(*) as times_dispensed
       FROM transactions t
       JOIN inventory_items i ON t.item_id = i.id
       WHERE t.transaction_type = 'OUT'
         AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY i.id, i.name
       ORDER BY total_dispensed DESC
       LIMIT 10`
    );

    res.json({
      today: todayResult.rows[0],
      weeklyActivity: weekResult.rows,
      topItems: topItemsResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;