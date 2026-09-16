const pool = require('../config/database');

async function currentEmployee(req) {
  const [[employee]] = await pool.query(`SELECT e.* FROM employees e
    LEFT JOIN users u ON u.employee_id = e.id
    WHERE e.id = ? OR u.id = ? LIMIT 1`, [req.user.employee_id || 0, req.user.id]);
  return employee;
}

async function list(req, res) {
  const search = `%${req.query.search || ''}%`;
  const employee = await currentEmployee(req);
  const scope = req.user.role === 'ADMIN' ? '1=1' : '(t.created_by = ? OR t.assigned_to = ?)';
  const values = req.user.role === 'ADMIN' ? [search, search, search] : [employee?.id || 0, employee?.id || 0, search, search, search];
  const [rows] = await pool.query(`SELECT t.*, creator.name AS creator_name, assignee.name AS assignee_name, d.department_name
    FROM tickets t JOIN employees creator ON creator.id=t.created_by LEFT JOIN employees assignee ON assignee.id=t.assigned_to LEFT JOIN departments d ON d.id=t.department_id
    WHERE ${scope} AND (t.ticket_number LIKE ? OR t.title LIKE ? OR t.status LIKE ?) ORDER BY t.created_at DESC`, values);
  res.json(rows);
}

async function listMine(req, res) {
  const search = `%${req.query.search || ''}%`;
  const employee = await currentEmployee(req);
  const [rows] = await pool.query(`SELECT t.*, creator.name AS creator_name, assignee.name AS assignee_name, d.department_name
    FROM tickets t JOIN employees creator ON creator.id=t.created_by LEFT JOIN employees assignee ON assignee.id=t.assigned_to LEFT JOIN departments d ON d.id=t.department_id
    WHERE t.assigned_to=? AND (t.ticket_number LIKE ? OR t.title LIKE ? OR t.status LIKE ?) ORDER BY t.created_at DESC`, [employee?.id || 0, search, search, search]);
  res.json(rows);
}

async function listDepartment(req, res) {
  const search = `%${req.query.search || ''}%`;
  const employee = await currentEmployee(req);
  const [rows] = await pool.query(`SELECT t.*, creator.name AS creator_name, assignee.name AS assignee_name, d.department_name
    FROM tickets t JOIN employees creator ON creator.id=t.created_by LEFT JOIN employees assignee ON assignee.id=t.assigned_to LEFT JOIN departments d ON d.id=t.department_id
    WHERE t.department_id=? AND (t.ticket_number LIKE ? OR t.title LIKE ? OR t.status LIKE ?) ORDER BY t.created_at DESC`, [employee?.department_id || 0, search, search, search]);
  res.json(rows);
}

async function getById(req, res) {
  const [tickets] = await pool.query(`SELECT t.*, creator.name AS creator_name, creator.email AS creator_email, creator.phone AS creator_phone, assignee.name AS assignee_name, assignee.email AS assignee_email, assignee.phone AS assignee_phone, assignee.designation AS assignee_designation, assignee.department_id AS assignee_department_id, assignee_department.department_name AS assignee_department_name, d.department_name, a.asset_name, a.serial_no, a.asset_type, a.make, a.model, a.year_of_purchase, a.purchased_from, a.price, owner.name AS asset_owner_name, owner.email AS asset_owner_email, owner.phone AS asset_owner_phone, owner.designation AS asset_owner_designation, owner_department.department_name AS asset_owner_department_name
    FROM tickets t JOIN employees creator ON creator.id=t.created_by LEFT JOIN employees assignee ON assignee.id=t.assigned_to LEFT JOIN departments assignee_department ON assignee_department.id=assignee.department_id LEFT JOIN departments d ON d.id=t.department_id LEFT JOIN assets a ON a.id=t.asset_id LEFT JOIN asset_assignments aa ON aa.asset_id=a.id AND aa.assigned_to IS NULL LEFT JOIN employees owner ON owner.id=aa.employee_id LEFT JOIN departments owner_department ON owner_department.id=owner.department_id WHERE t.id=?`, [req.params.id]);
  if (!tickets.length) return res.status(404).json({ message: 'Ticket not found' });
  const [notes] = await pool.query('SELECT c.*, u.username AS added_by FROM ticket_comments c JOIN users u ON u.id=c.user_id WHERE c.ticket_id=? ORDER BY c.created_at DESC', [req.params.id]);
  const [history] = await pool.query(`SELECT h.*, u.username AS changed_by, a.name AS assigned_name FROM ticket_history h JOIN users u ON u.id=h.user_id LEFT JOIN employees a ON a.id=h.assigned_to WHERE h.ticket_id=? ORDER BY h.created_at DESC`, [req.params.id]);
  res.json({ ticket: tickets[0], notes, history });
}

async function close(req, res) {
  const { notes, remarks } = req.body;
  if (!notes && !remarks) return res.status(400).json({ message: 'Closing notes or remarks are required' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[ticket]] = await connection.query('SELECT id, status FROM tickets WHERE id=? FOR UPDATE', [req.params.id]);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (ticket.status === 'CLOSED') return res.status(409).json({ message: 'Ticket is already closed' });
    const text = [notes, remarks].filter(Boolean).join(' | ');
    await connection.query("UPDATE tickets SET status='CLOSED', closed_at=CURRENT_TIMESTAMP WHERE id=?", [req.params.id]);
    await connection.query("INSERT INTO ticket_comments (ticket_id,user_id,comment,note_flag) VALUES (?,? ,?,'UPDATE')", [req.params.id, req.user.id, text]);
    await connection.query("INSERT INTO ticket_history (ticket_id,user_id,event_type,old_status,new_status,remarks) VALUES (?,?,'NOTE',?,'CLOSED',?)", [req.params.id, req.user.id, ticket.status, text]);
    await connection.commit();
    res.json({ message: 'Ticket closed' });
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

async function create(req, res) {
  const { title, description, created_by, assigned_to, department_id, asset_id, priority = 'MEDIUM', due_date } = req.body;
  const creatorId = req.user.employee_id || created_by;
  if (!title || !description || !creatorId) return res.status(400).json({ message: 'Title, description and creator are required' });
  const ticketNumber = `TKT-${Date.now().toString().slice(-8)}`;
  const defaultDueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dueDate = due_date || defaultDueDate;
  if (asset_id) {
    const [[ownedAsset]] = await pool.query('SELECT a.id FROM assets a JOIN asset_assignments aa ON aa.asset_id=a.id WHERE a.id=? AND aa.employee_id=? AND aa.assigned_to IS NULL', [asset_id, creatorId]);
    if (!ownedAsset) return res.status(403).json({ message: 'You can only raise tickets for assets assigned to you' });
  }
  const [result] = await pool.query(`INSERT INTO tickets (ticket_number,title,description,created_by,assigned_to,department_id,asset_id,priority,status,due_date) VALUES (?,?,?,?,?,?,?,?,'NEW',?)`, [ticketNumber, title, description, creatorId, assigned_to || null, department_id || null, asset_id || null, priority, dueDate]);
  await pool.query("INSERT INTO ticket_history (ticket_id,user_id,event_type,assigned_to,remarks) VALUES (?,?,'CREATED',?,?)", [result.insertId, req.user.id, assigned_to || null, 'Ticket created']);
  res.status(201).json({ id: result.insertId, ticket_number: ticketNumber, message: 'Ticket created' });
}

async function update(req, res) {
  const { title, description, assigned_to, department_id, priority, status, due_date, history_event_type } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[current]] = await connection.query('SELECT * FROM tickets WHERE id=? FOR UPDATE', [req.params.id]);
    if (!current) return res.status(404).json({ message: 'Ticket not found' });
    const nextStatus = status || current.status;
    const nextAssignee = assigned_to || current.assigned_to;
    await connection.query(`UPDATE tickets SET title=?, description=?, assigned_to=?, department_id=?, priority=?, status=?, due_date=?, resolved_at=CASE WHEN ?='RESOLVED' THEN CURRENT_TIMESTAMP ELSE resolved_at END, closed_at=CASE WHEN ?='CLOSED' THEN CURRENT_TIMESTAMP ELSE closed_at END WHERE id=?`, [title || current.title, description || current.description, nextAssignee, department_id || current.department_id, priority || current.priority, nextStatus, due_date || current.due_date, nextStatus, nextStatus, req.params.id]);
    if (current.status !== nextStatus) await connection.query("INSERT INTO ticket_history (ticket_id,user_id,event_type,old_status,new_status,remarks) VALUES (?,?,'STATUS',?,?,?)", [req.params.id, req.user.id, current.status, nextStatus, 'Status updated']);
    if (current.assigned_to !== nextAssignee) await connection.query("INSERT INTO ticket_history (ticket_id,user_id,event_type,assigned_to,remarks) VALUES (?,?,?, ?,?)", [req.params.id, req.user.id, history_event_type || (current.assigned_to ? 'REASSIGNED' : 'ASSIGNED'), nextAssignee, history_event_type === 'PICKED' ? 'Ticket picked by department member' : current.assigned_to ? 'Ticket reassigned' : 'Ticket assigned']);
    await connection.commit(); res.json({ message: 'Ticket updated' });
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

async function comment(req, res) {
  const { comment, note_flag = 'MESSAGE' } = req.body;
  if (!comment) return res.status(400).json({ message: 'Notes are required' });
  if (!['IMPORTANT', 'MESSAGE', 'UPDATE', 'WARNING'].includes(note_flag)) return res.status(400).json({ message: 'Invalid note flag' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('INSERT INTO ticket_comments (ticket_id,user_id,comment,note_flag) VALUES (?,?,?,?)', [req.params.id, req.user.id, comment, note_flag]);
    await connection.query("INSERT INTO ticket_history (ticket_id,user_id,event_type,remarks) VALUES (?,?,'NOTE',?)", [req.params.id, req.user.id, `${note_flag}: ${comment}`]);
    await connection.commit();
    res.status(201).json({ message: 'Note added' });
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

async function assign(req, res) {
  const { assigned_to, department_id } = req.body;
  if (!assigned_to && !department_id) return res.status(400).json({ message: 'Select a user or department' });
  const employee = await currentEmployee(req);
  if (req.user.role !== 'ADMIN' && employee?.department_id && department_id && Number(department_id) !== Number(employee.department_id)) return res.status(403).json({ message: 'You can only assign within your department' });
  if (assigned_to) {
    const [[target]] = await pool.query("SELECT id, department_id FROM employees WHERE id=? AND status='ACTIVE'", [assigned_to]);
    if (!target) return res.status(404).json({ message: 'Assignee not found' });
    if (req.user.role !== 'ADMIN' && target.department_id !== employee.department_id) return res.status(403).json({ message: 'You can only assign department members' });
  }
  req.body = { assigned_to, department_id, status: 'ASSIGNED' };
  return update(req, res);
}

async function pick(req, res) {
  const employee = await currentEmployee(req);
  if (!employee) return res.status(403).json({ message: 'Employee profile required' });
  const [[allowed]] = await pool.query(`SELECT 1 FROM employee_privileges ep JOIN special_privileges sp ON sp.id=ep.privilege_id WHERE ep.employee_id=? AND ep.granted=true AND sp.privilege_key='can_assign_ticket'`, [employee.id]);
  if (!allowed && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Can Assign Ticket privilege required' });
  const [[ticket]] = await pool.query('SELECT * FROM tickets WHERE id=? AND assigned_to IS NULL AND department_id=?', [req.params.id, employee.department_id]);
  if (!ticket) return res.status(409).json({ message: 'Ticket is no longer available for pickup' });
  req.body = { assigned_to: employee.id, department_id: employee.department_id, status: 'ASSIGNED', history_event_type: 'PICKED' };
  return update(req, res);
}

module.exports = { list, listMine, listDepartment, getById, close, create, update, comment, assign, pick };
