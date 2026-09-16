const sessions = new Map();

function createSession(user) {
	const token = require('crypto').randomBytes(32).toString('hex');
	sessions.set(token, user);
	return token;
}

function requireAuth(req, res, next) {
	const token = req.headers.authorization?.replace('Bearer ', '');
	const user = token ? sessions.get(token) : null;
	if (!user) return res.status(401).json({ message: 'Authentication required' });
	req.user = user;
	next();
}

function removeSession(token) {
	sessions.delete(token);
}

function requireAdmin(req, res, next) {
	if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Administrator access required' });
	next();
}

module.exports = { createSession, requireAuth, requireAdmin, removeSession };
