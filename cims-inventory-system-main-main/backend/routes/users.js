const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../utils/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/users - Get all users (Admin only)
router.get('/', authenticate, authorize('ADMIN', 'HEAD_NURSE'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, full_name, role, is_active, last_login, created_at 
       FROM users 
       ORDER BY created_at DESC`
    );
    
    const users = result.rows.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role.toLowerCase(),
      isActive: user.is_active,
      lastLogin: user.last_login,
      createdAt: user.created_at
    }));
    
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/users - Create new user (Admin only)
router.post('/', authenticate, authorize('ADMIN', 'HEAD_NURSE'), async (req, res) => {
  try {
    const { username, password, fullName, role, email } = req.body;

    if (!username || !password || !fullName || !role) {
      return res.status(400).json({ error: 'Username, password, full name, and role are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    if (email) {
      const existingEmail = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingEmail.rows.length > 0) {
        return res.status(409).json({ error: 'Email already exists' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const dbRole = role.toUpperCase();
    
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role, email, is_active) 
       VALUES ($1, $2, $3, $4, $5, true) 
       RETURNING id, username, email, full_name, role, is_active, created_at`,
      [username, passwordHash, fullName, dbRole, email || null]
    );

    const newUser = result.rows[0];
    
    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.full_name,
        role: newUser.role.toLowerCase(),
        isActive: newUser.is_active,
        createdAt: newUser.created_at
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', authenticate, authorize('ADMIN', 'HEAD_NURSE'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// PATCH /api/users/:id/toggle - Toggle user active status
router.patch('/:id/toggle', authenticate, authorize('ADMIN', 'HEAD_NURSE'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const result = await pool.query(
      'UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      message: `User ${user.is_active ? 'activated' : 'deactivated'} successfully`,
      user: { id: user.id, isActive: user.is_active }
    });
  } catch (error) {
    console.error('Toggle user error:', error);
    res.status(500).json({ error: 'Failed to toggle user status' });
  }
});

module.exports = router;