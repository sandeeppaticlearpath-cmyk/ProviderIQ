const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db/connection');
const { generateToken, authenticateToken } = require('../middleware/auth');
const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { rows } = await query(
      'SELECT u.*, t.name as tenant_name, t.slug as tenant_slug, t.plan as tenant_plan FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE u.email=$1 AND u.is_active=true',
      [email.toLowerCase()]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    await query('UPDATE users SET last_login=NOW() WHERE id=$1', [user.id]);

    const token = generateToken({ userId: user.id, tenantId: user.tenant_id, role: user.role });
    res.json({
      token, user: {
        id: user.id, email: user.email,
        full_name: `${user.first_name} ${user.last_name}`,
        first_name: user.first_name, last_name: user.last_name,
        role: user.role, avatar_url: user.avatar_url,
        tenant: { id: user.tenant_id, name: user.tenant_name, slug: user.tenant_slug, plan: user.tenant_plan }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT u.*, t.name as tenant_name, t.slug as tenant_slug, t.plan as tenant_plan FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE u.id=$1',
      [req.user.id]
    );
    const u = rows[0];
    res.json({
      id: u.id, email: u.email,
      full_name: `${u.first_name} ${u.last_name}`,
      first_name: u.first_name, last_name: u.last_name,
      role: u.role, avatar_url: u.avatar_url, phone: u.phone,
      tenant: { id: u.tenant_id, name: u.tenant_name, slug: u.tenant_slug, plan: u.tenant_plan }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/users — list users in tenant
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, email, first_name, last_name, role, avatar_url, phone, is_active, created_at FROM users WHERE tenant_id=$1 ORDER BY first_name',
      [req.tenantId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/users — create user (admin only)
router.post('/users', authenticateToken, async (req, res) => {
  try {
    const { email, password, first_name, last_name, role } = req.body;
    const hash = await bcrypt.hash(password || 'Recruiter@2024', 10);
    const { v4: uuidv4 } = require('uuid');
    const { rows } = await query(
      'INSERT INTO users(id,tenant_id,email,password_hash,first_name,last_name,role) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,email,first_name,last_name,role',
      [uuidv4(), req.tenantId, email.toLowerCase(), hash, first_name, last_name, role||'recruiter']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auth/profile — update own profile
router.patch('/profile', authenticateToken, async (req, res) => {
  try {
    const { first_name, last_name, phone, avatar_url } = req.body;
    const { rows } = await query(
      'UPDATE users SET first_name=$1,last_name=$2,phone=$3,avatar_url=$4,updated_at=NOW() WHERE id=$5 RETURNING id,email,first_name,last_name,role,phone,avatar_url',
      [first_name, last_name, phone, avatar_url, req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const { rows } = await query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2', [hash, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
