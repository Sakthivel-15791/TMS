const pool = require('../config/database');

async function dashboard(req, res) {
	const [[employees]] = await pool.query("SELECT COUNT(*) AS total_employees, COUNT(*) FILTER (WHERE status='ACTIVE') AS active_employees FROM employees");
	const [[tickets]] = await pool.query("SELECT COUNT(*) AS total_tickets, COUNT(*) FILTER (WHERE status='NEW') AS new_tickets, COUNT(*) FILTER (WHERE status='IN_PROGRESS') AS in_progress, COUNT(*) FILTER (WHERE status='RESOLVED') AS resolved, COUNT(*) FILTER (WHERE status='CLOSED') AS closed FROM tickets");
	const [recent] = await pool.query('SELECT id, ticket_number, title, priority, status, created_at FROM tickets ORDER BY created_at DESC LIMIT 8');
	res.json({ employees, tickets, recent });
}

async function reports(req, res) {
	const [byStatus] = await pool.query('SELECT status, COUNT(*) AS count FROM tickets GROUP BY status');
	const [byDepartment] = await pool.query('SELECT d.department_name, COUNT(e.id) AS count FROM departments d LEFT JOIN employees e ON e.department_id=d.id GROUP BY d.id');
	res.json({ byStatus, byDepartment });
}

module.exports = { dashboard, reports };
