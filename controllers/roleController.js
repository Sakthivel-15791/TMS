const pool = require('../config/database');

async function listRoles(req, res) {
  const [rows] = await pool.query(`SELECT r.id, r.role_name, r.status, COUNT(DISTINCT u.id) AS user_count, COUNT(DISTINCT rp.page_id) AS page_count
    FROM roles r LEFT JOIN users u ON u.role_id = r.id LEFT JOIN role_pages rp ON rp.role_id = r.id
    GROUP BY r.id ORDER BY r.role_name`);
  res.json(rows);
}

async function createRole(req, res) {
  const roleName = String(req.body.role_name || '').trim();
  if (!roleName) return res.status(400).json({ message: 'Role name is required' });
  const [result] = await pool.query('INSERT INTO roles (role_name) VALUES (?)', [roleName]);
  res.status(201).json({ id: result.insertId, role_name: roleName });
}

async function updateRole(req, res) {
  const roleName = String(req.body.role_name || '').trim();
  if (!roleName) return res.status(400).json({ message: 'Role name is required' });
  const [result] = await pool.query('UPDATE roles SET role_name = ? WHERE id = ?', [roleName, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: 'Role not found' });
  await pool.query('UPDATE users SET role = ? WHERE role_id = ?', [roleName, req.params.id]);
  res.json({ message: 'Role updated' });
}

async function listPages(req, res) {
  const [rows] = await pool.query('SELECT * FROM pages ORDER BY sort_order, page_name');
  res.json(rows);
}

async function getRolePages(req, res) {
  const [rows] = await pool.query('SELECT page_id FROM role_pages WHERE role_id = ?', [req.params.id]);
  res.json(rows.map(row => row.page_id));
}

async function updateRolePages(req, res) {
  const pageIds = Array.isArray(req.body.page_ids) ? req.body.page_ids : [];
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM role_pages WHERE role_id = ?', [req.params.id]);
    for (const pageId of pageIds) await connection.query('INSERT INTO role_pages (role_id, page_id) VALUES (?, ?)', [req.params.id, pageId]);
    await connection.commit();
    res.json({ message: 'Role permissions updated' });
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

async function listUsers(req, res) {
  const [rows] = await pool.query(`SELECT u.id, u.username, u.role, u.role_id, u.status, u.employee_id, e.name AS employee_name
    FROM users u LEFT JOIN employees e ON e.id = u.employee_id ORDER BY u.username`);
  res.json(rows);
}

async function createUser(req, res) {
  const { username, password, role_id, employee_id } = req.body;
  if (!username || !password || !role_id) return res.status(400).json({ message: 'Username, password and role are required' });
  const [[role]] = await pool.query('SELECT role_name FROM roles WHERE id = ?', [role_id]);
  if (!role) return res.status(400).json({ message: 'Selected role was not found' });
  const [result] = await pool.query('INSERT INTO users (username, password_hash, role, role_id, employee_id) VALUES (?, SHA2(?, 256), ?, ?, ?)', [username, password, role.role_name, role_id, employee_id || null]);
  res.status(201).json({ id: result.insertId, message: 'User created' });
}

async function updateUser(req, res) {
  const { username, password, role_id, employee_id, status } = req.body;
  const [[role]] = await pool.query('SELECT role_name FROM roles WHERE id = ?', [role_id]);
  if (!role) return res.status(400).json({ message: 'Selected role was not found' });
  const fields = password ? 'username=?, password_hash=SHA2(?, 256), role=?, role_id=?, employee_id=?, status=?' : 'username=?, role=?, role_id=?, employee_id=?, status=?';
  const values = password ? [username, password, role.role_name, role_id, employee_id || null, status || 'ACTIVE', req.params.id] : [username, role.role_name, role_id, employee_id || null, status || 'ACTIVE', req.params.id];
  const [result] = await pool.query(`UPDATE users SET ${fields} WHERE id=?`, values);
  if (!result.affectedRows) return res.status(404).json({ message: 'User not found' });
  res.json({ message: 'User updated' });
}

module.exports = { listRoles, createRole, updateRole, listPages, getRolePages, updateRolePages, listUsers, createUser, updateUser };