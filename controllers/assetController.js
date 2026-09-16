const pool = require('../config/database');

async function list(req, res) {
  const search = `%${req.query.search || ''}%`;
  const [rows] = await pool.query(`SELECT a.*, e.name AS owner_name, aa.assigned_from, aa.assigned_to
    FROM assets a LEFT JOIN asset_assignments aa ON aa.asset_id=a.id AND aa.assigned_to IS NULL
    LEFT JOIN employees e ON e.id=aa.employee_id
    WHERE a.asset_name LIKE ? OR a.serial_no LIKE ? OR a.asset_type LIKE ? ORDER BY a.id DESC`, [search, search, search]);
  res.json(rows);
}

async function getById(req, res) {
  const [assets] = await pool.query('SELECT * FROM assets WHERE id=?', [req.params.id]);
  if (!assets.length) return res.status(404).json({ message: 'Asset not found' });
  const [assignments] = await pool.query(`SELECT aa.*, e.name AS employee_name, d.department_name, u.username AS assigned_by_name
    FROM asset_assignments aa JOIN employees e ON e.id=aa.employee_id LEFT JOIN departments d ON d.id=e.department_id JOIN users u ON u.id=aa.assigned_by
    WHERE aa.asset_id=? ORDER BY aa.assigned_from DESC`, [req.params.id]);
  const [tickets] = await pool.query(`SELECT t.*, e.name AS assignee_name FROM tickets t LEFT JOIN employees e ON e.id=t.assigned_to WHERE t.asset_id=? ORDER BY t.created_at DESC`, [req.params.id]);
  res.json({ asset: assets[0], assignments, tickets });
}

async function listMine(req, res) {
  const [[employee]] = await pool.query(`SELECT e.id FROM employees e LEFT JOIN users u ON u.employee_id=e.id WHERE e.id=? OR u.id=? LIMIT 1`, [req.user.employee_id || 0, req.user.id]);
  const employeeId = employee?.id || 0;
  const [rows] = await pool.query(`SELECT a.*, aa.assigned_from, aa.assigned_to FROM assets a JOIN asset_assignments aa ON aa.asset_id=a.id
    WHERE aa.employee_id=? AND aa.assigned_to IS NULL ORDER BY a.asset_name`, [employeeId]);
  res.json(rows);
}

async function create(req, res) {
  const { asset_name, serial_no, asset_type, make, model, year_of_purchase, purchased_from, price } = req.body;
  if (!asset_name || !serial_no || !asset_type) return res.status(400).json({ message: 'Asset name, serial number and type are required' });
  const [result] = await pool.query('INSERT INTO assets (asset_name,serial_no,asset_type,make,model,year_of_purchase,purchased_from,price) VALUES (?,?,?,?,?,?,?,?)', [asset_name, serial_no, asset_type, make || null, model || null, year_of_purchase || null, purchased_from || null, price || null]);
  res.status(201).json({ id: result.insertId, message: 'Asset created' });
}

async function assign(req, res) {
  const { employee_id, assigned_from } = req.body;
  if (!employee_id) return res.status(400).json({ message: 'Employee is required' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[asset]] = await connection.query("SELECT id FROM assets WHERE id=? AND status <> 'RETIRED' FOR UPDATE", [req.params.id]);
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    await connection.query('UPDATE asset_assignments SET assigned_to=COALESCE(assigned_to, ?) WHERE asset_id=? AND assigned_to IS NULL', [assigned_from || new Date(), req.params.id]);
    await connection.query('INSERT INTO asset_assignments (asset_id,employee_id,assigned_from,assigned_by) VALUES (?,?,?,?)', [req.params.id, employee_id, assigned_from || new Date(), req.user.id]);
    await connection.query("UPDATE assets SET status='ASSIGNED' WHERE id=?", [req.params.id]);
    await connection.commit(); res.json({ message: 'Asset assigned' });
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

async function employees(req, res) {
  const [rows] = await pool.query("SELECT e.id,e.name,e.employee_code,d.department_name FROM employees e LEFT JOIN departments d ON d.id=e.department_id WHERE e.status='ACTIVE' ORDER BY e.name");
  res.json(rows);
}

module.exports = { list, getById, listMine, create, assign, employees };
