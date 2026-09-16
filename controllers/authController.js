const pool = require('../config/database');
const { createSession, removeSession } = require('../middleware/authMiddleware');

async function login(req, res) {
	const { username, password } = req.body;
	if (!username || !password) return res.status(400).json({ message: 'Username and password are required' });
	const [rows] = await pool.query(
		`SELECT u.id, u.username, COALESCE(r.role_name, u.role) AS role, u.role_id, u.employee_id, e.name AS employee_name
		 FROM users u LEFT JOIN employees e ON e.id = u.employee_id LEFT JOIN roles r ON r.id = u.role_id
		 WHERE u.username = ? AND u.password_hash = SHA2(?, 256) AND u.status = 'ACTIVE'`,
		[username, password]
	);
	if (!rows.length) return res.status(401).json({ message: 'Invalid username or password' });
	const user = rows[0];
	res.json({ token: createSession(user), user });
}

function logout(req, res) {
	const token = req.headers.authorization?.replace('Bearer ', '');
	if (token) removeSession(token);
	res.json({ message: 'Logged out' });
}

module.exports = { login, logout };
