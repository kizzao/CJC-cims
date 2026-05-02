const express = require('express');
const { pool } = require('../utils/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get dashboard overview stats
router.get('/overview', authenticate, async (req, res) => {
  try {
    // Total items count
    const totalItemsResult = await pool.query(
      'SELECT COUNT(*) as count FROM inventory_items WHERE is_active = true'
    );

    // Low stock count
    const lowStockResult = await pool.query(
      `SELECT COUNT(*) as count FROM inventory_items 
       WHERE is_active = true AND current_quantity <= minimum_threshold AND current_quantity > 0`
    );

    // Out of stock count
    const outOfStockResult = await pool.query(
      'SELECT COUNT(*) as count FROM inventory_items WHERE is_active = true AND current_quantity = 0'
    );

    // Expiring soon (within 30 days)
    const expiringResult = await pool.query(
      `SELECT COUNT(*) as count FROM inventory_items 
       WHERE is_active = true AND expiration_date IS NOT NULL 
       AND expiration_date <= CURRENT_DATE + INTERVAL '30 days'
       AND expiration_date > CURRENT_DATE
       AND current_quantity > 0`
    );

    // Expired items
    const expiredResult = await pool.query(
      `SELECT COUNT(*) as count FROM inventory_items 
       WHERE is_active = true AND expiration_date IS NOT NULL 
       AND expiration_date <= CURRENT_DATE
       AND current_quantity > 0`
    );

    // Today's transactions
    const todayTransactionsResult = await pool.query(
      `SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN transaction_type = 'OUT' THEN 1 END) as dispense_count,
        COALESCE(SUM(CASE WHEN transaction_type = 'OUT' THEN quantity END), 0) as dispensed_quantity
       FROM transactions 
       WHERE DATE(created_at) = CURRENT_DATE`
    );

    // Recent activity (last 5 transactions)
    const recentActivityResult = await pool.query(
      `SELECT 
        t.*,
        i.name as item_name,
        i.unit_of_measure,
        u.full_name as administered_by_name
       FROM transactions t
       JOIN inventory_items i ON t.item_id = i.id
       LEFT JOIN users u ON t.administered_by = u.id
       ORDER BY t.created_at DESC
       LIMIT 5`
    );

    // Critical alerts
    const alertsResult = await pool.query(
      `SELECT 
        i.id, i.name, i.current_quantity, i.minimum_threshold, i.expiration_date,
        c.name as category_name, c.color_code,
        CASE 
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE THEN 'EXPIRED'
          WHEN i.current_quantity = 0 THEN 'OUT_OF_STOCK'
          ELSE 'LOW_STOCK'
        END as alert_type,
        CASE 
          WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE THEN 1
          WHEN i.current_quantity = 0 THEN 2
          ELSE 3
        END as priority
       FROM inventory_items i
       JOIN categories c ON i.category_id = c.id
       WHERE i.is_active = true
         AND (
           (i.expiration_date IS NOT NULL AND i.expiration_date <= CURRENT_DATE + INTERVAL '30 days')
           OR i.current_quantity <= i.minimum_threshold
         )
       ORDER BY priority, i.expiration_date NULLS LAST
       LIMIT 10`
    );

    res.json({
      stats: {
        totalItems: parseInt(totalItemsResult.rows[0].count),
        lowStock: parseInt(lowStockResult.rows[0].count),
        outOfStock: parseInt(outOfStockResult.rows[0].count),
        expiringSoon: parseInt(expiringResult.rows[0].count),
        expired: parseInt(expiredResult.rows[0].count),
        todayTransactions: {
          count: parseInt(todayTransactionsResult.rows[0].dispense_count),
          quantity: parseInt(todayTransactionsResult.rows[0].dispensed_quantity)
        }
      },
      recentActivity: recentActivityResult.rows,
      alerts: alertsResult.rows
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get inventory by category
router.get('/by-category', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        c.id, c.name, c.color_code, c.icon,
        COUNT(i.id) as item_count,
        SUM(i.current_quantity) as total_quantity,
        COUNT(CASE WHEN i.current_quantity <= i.minimum_threshold THEN 1 END) as low_stock_count
       FROM categories c
       LEFT JOIN inventory_items i ON c.id = i.category_id AND i.is_active = true
       WHERE c.is_active = true
       GROUP BY c.id, c.name, c.color_code, c.icon
       ORDER BY c.name`
    );

    res.json({ categories: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch category data' });
  }
});

module.exports = router;