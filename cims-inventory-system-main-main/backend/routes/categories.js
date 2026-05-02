const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../utils/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all categories
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM categories WHERE is_active = true ORDER BY name'
      
    );
    res.json({ categories: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get single category
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM categories WHERE id = $1 AND is_active = true',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ category: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// Create category (Admin only)
router.post('/', authenticate, authorize('ADMIN', 'HEAD_NURSE'), [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('colorCode').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Invalid color code')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, colorCode, icon } = req.body;

    const result = await pool.query(
      `INSERT INTO categories (name, description, color_code, icon)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, description, colorCode || '#3B82F6', icon || 'box']
    );

    res.status(201).json({
      message: 'Category created successfully',
      category: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Category name already exists' });
    }
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update category
router.put('/:id', authenticate, authorize('ADMIN', 'HEAD_NURSE'), async (req, res) => {
  try {
    const { name, description, colorCode, icon } = req.body;

    const result = await pool.query(
      `UPDATE categories 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           color_code = COALESCE($3, color_code),
           icon = COALESCE($4, icon)
       WHERE id = $5 AND is_active = true
       RETURNING *`,
      [name, description, colorCode, icon, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({
      message: 'Category updated successfully',
      category: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete category (soft delete)
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    // Check if category has items
    const itemsCheck = await pool.query(
      'SELECT COUNT(*) FROM inventory_items WHERE category_id = $1 AND is_active = true',
      [req.params.id]
    );
    
    if (parseInt(itemsCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category with existing items. Please reassign or delete items first.' 
      });
    }

    const result = await pool.query(
      'UPDATE categories SET is_active = false WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;