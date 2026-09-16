const pool = require('../config/database');

async function list(req, res) {
	const search = `%${req.query.search || ''}%`;
	const page = Math.max(Number(req.query.page) || 1, 1);
	const limit = 25;
	const offset = (page - 1) * limit;
	const filters = [search, search, search, search];
	let where = 'WHERE (e.name LIKE ? OR e.employee_code LIKE ? OR e.email LIKE ? OR e.phone LIKE ?)' ;
	if (req.query.designation) { where += ' AND e.designation = ?'; filters.push(req.query.designation); }
	if (req.query.department_id) { where += ' AND e.department_id = ?'; filters.push(req.query.department_id); }
	const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM employees e ${where}`, filters);
	const [rows] = await pool.query(
		`SELECT e.*, d.department_name, m.name AS manager_name
		 FROM employees e LEFT JOIN departments d ON d.id = e.department_id
		 LEFT JOIN employees m ON m.id = e.manager_id
		 ${where} ORDER BY e.id DESC LIMIT ? OFFSET ?`, [...filters, limit, offset]
	);
	res.json({ rows, pagination: { page, limit, total: countRows[0].total, pages: Math.ceil(countRows[0].total / limit) } });
}

async function getById(req, res) {
	const [rows] = await pool.query('SELECT * FROM employees WHERE id = ?', [req.params.id]);
	if (!rows.length) return res.status(404).json({ message: 'Employee not found' });
	res.json(rows[0]);
}

async function create(req, res) {
	const { employee_code, name, dob, email, phone, secondary_phone, qualification, address_line, city, post, state, pin_code, department_id, designation, joining_date, manager_id, image_url, role_id, status = 'ACTIVE' } = req.body;
	if (!employee_code || !name || !email) return res.status(400).json({ message: 'Employee code, name and email are required' });
	if (!role_id) return res.status(400).json({ message: 'Role is required' });
	const connection = await pool.getConnection();
	try {
		await connection.beginTransaction();
		const [[role]] = await connection.query('SELECT id, role_name FROM roles WHERE id = ? AND status = \'ACTIVE\'', [role_id]);
		if (!role) {
			await connection.rollback();
			return res.status(400).json({ message: 'Selected role was not found' });
		}
		const [result] = await connection.query(
			`INSERT INTO employees (employee_code, name, dob, email, phone, secondary_phone, qualification, address_line, city, post, state, pin_code, department_id, designation, joining_date, manager_id, image_url, status)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[employee_code, name, dob || null, email, phone || null, secondary_phone || null, qualification || null, address_line || null, city || null, post || null, state || null, pin_code || null, department_id || null, designation || null, joining_date || null, manager_id || null, image_url || null, status]
		);
		await connection.query('INSERT INTO users (username, password_hash, role, role_id, employee_id) VALUES (?, SHA2(?, 256), ?, ?, ?)', [employee_code, '12345', role.role_name, role.id, result.insertId]);
		await connection.commit();
		res.status(201).json({ id: result.insertId, username: employee_code, message: 'Employee and user created' });
	} catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

async function update(req, res) {
	const { employee_code, name, dob, email, phone, secondary_phone, qualification, address_line, city, post, state, pin_code, department_id, designation, joining_date, manager_id, image_url, role_id, status } = req.body;
	const [[current]] = await pool.query('SELECT status FROM employees WHERE id = ?', [req.params.id]);
	if (!current) return res.status(404).json({ message: 'Employee not found' });
	const [result] = await pool.query(
		`UPDATE employees SET employee_code=?, name=?, dob=?, email=?, phone=?, secondary_phone=?, qualification=?, address_line=?, city=?, post=?, state=?, pin_code=?, department_id=?, designation=?, joining_date=?, manager_id=?, image_url=?, status=? WHERE id=?`,
		[employee_code, name, dob || null, email, phone || null, secondary_phone || null, qualification || null, address_line || null, city || null, post || null, state || null, pin_code || null, department_id || null, designation || null, joining_date || null, manager_id || null, image_url || null, status || current.status, req.params.id]
	);
	if (!result.affectedRows) return res.status(404).json({ message: 'Employee not found' });
	if (role_id) {
		const [[role]] = await pool.query('SELECT role_name FROM roles WHERE id = ? AND status = \'ACTIVE\'', [role_id]);
		if (!role) return res.status(400).json({ message: 'Selected role was not found' });
		await pool.query('UPDATE users SET role=?, role_id=? WHERE employee_id=?', [role.role_name, role_id, req.params.id]);
	}
	res.json({ message: 'Employee updated' });
}

async function remove(req, res) {
	const [result] = await pool.query("UPDATE employees SET status = 'INACTIVE' WHERE id = ?", [req.params.id]);
	if (!result.affectedRows) return res.status(404).json({ message: 'Employee not found' });
	res.json({ message: 'Employee deactivated' });
}

async function departments(req, res) {
	const [rows] = await pool.query("SELECT * FROM departments WHERE status = 'ACTIVE' ORDER BY department_name");
	res.json(rows);
}

async function designations(req, res) {
	const [rows] = await pool.query("SELECT DISTINCT designation FROM employees WHERE designation IS NOT NULL AND designation <> '' ORDER BY designation");
	res.json(rows.map(row => row.designation));
}

async function details(req, res) {
	const [employees] = await pool.query(`SELECT e.*, d.department_name FROM employees e LEFT JOIN departments d ON d.id=e.department_id WHERE e.id=?`, [req.params.id]);
	if (!employees.length) return res.status(404).json({ message: 'Employee not found' });
	const [qualifications] = await pool.query('SELECT * FROM employee_qualifications WHERE employee_id=? ORDER BY year_passed DESC, id DESC', [req.params.id]);
	const [privileges] = await pool.query(`SELECT sp.id, sp.privilege_key, sp.privilege_name, COALESCE(ep.granted, false) AS granted FROM special_privileges sp LEFT JOIN employee_privileges ep ON ep.privilege_id=sp.id AND ep.employee_id=? ORDER BY sp.sort_order`, [req.params.id]);
	res.json({ employee: employees[0], qualifications, privileges });
}

async function addQualification(req, res) {
	const { course_degree, institute_name, year_passed, percentage } = req.body;
	if (!course_degree || !institute_name || !year_passed) return res.status(400).json({ message: 'Course, institute and year passed are required' });
	const [result] = await pool.query('INSERT INTO employee_qualifications (employee_id, course_degree, institute_name, year_passed, percentage) VALUES (?, ?, ?, ?, ?)', [req.params.id, course_degree, institute_name, year_passed, percentage || null]);
	res.status(201).json({ id: result.insertId, message: 'Qualification added' });
}

async function updateQualification(req, res) {
	const { course_degree, institute_name, year_passed, percentage } = req.body;
	const [result] = await pool.query('UPDATE employee_qualifications SET course_degree=?, institute_name=?, year_passed=?, percentage=? WHERE id=? AND employee_id=?', [course_degree, institute_name, year_passed, percentage || null, req.params.qualificationId, req.params.id]);
	if (!result.affectedRows) return res.status(404).json({ message: 'Qualification not found' });
	res.json({ message: 'Qualification updated' });
}

async function deleteQualification(req, res) {
	const [result] = await pool.query('DELETE FROM employee_qualifications WHERE id=? AND employee_id=?', [req.params.qualificationId, req.params.id]);
	if (!result.affectedRows) return res.status(404).json({ message: 'Qualification not found' });
	res.json({ message: 'Qualification deleted' });
}

async function updatePrivileges(req, res) {
	const privilegeIds = Array.isArray(req.body.privilege_ids) ? req.body.privilege_ids : [];
	const connection = await pool.getConnection();
	try {
		await connection.beginTransaction();
		await connection.query('DELETE FROM employee_privileges WHERE employee_id=?', [req.params.id]);
		for (const privilegeId of privilegeIds) await connection.query('INSERT INTO employee_privileges (employee_id, privilege_id, granted) VALUES (?, ?, true)', [req.params.id, privilegeId]);
		await connection.commit();
		res.json({ message: 'Special privileges saved' });
	} catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

module.exports = { list, getById, create, update, remove, departments, designations, details, addQualification, updateQualification, deleteQualification, updatePrivileges };
