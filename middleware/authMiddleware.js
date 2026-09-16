const crypto = require('crypto');

const authSecret = process.env.AUTH_SECRET || 'local-development-auth-secret-change-me';
const tokenLifetimeSeconds = 8 * 60 * 60;

function sign(value) {
	return crypto.createHmac('sha256', authSecret).update(value).digest('base64url');
}

function createSession(user) {
	const payload = Buffer.from(JSON.stringify({ user, expiresAt: Math.floor(Date.now() / 1000) + tokenLifetimeSeconds })).toString('base64url');
	return `${payload}.${sign(payload)}`;
}

function requireAuth(req, res, next) {
	const token = req.headers.authorization?.replace('Bearer ', '');
	if (!token) return res.status(401).json({ message: 'Authentication required' });
	const [payload, signature] = token.split('.');
	if (!payload || !signature) return res.status(401).json({ message: 'Authentication required' });
	const expectedSignature = sign(payload);
	const isValidSignature = signature.length === expectedSignature.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
	if (!isValidSignature) return res.status(401).json({ message: 'Authentication required' });
	try {
		const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
		if (!session.user || session.expiresAt < Math.floor(Date.now() / 1000)) return res.status(401).json({ message: 'Session expired' });
		req.user = session.user;
	} catch (error) {
		return res.status(401).json({ message: 'Authentication required' });
	}
	next();
}

function removeSession(token) {
	return token;
}

function requireAdmin(req, res, next) {
	if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Administrator access required' });
	next();
}

module.exports = { createSession, requireAuth, requireAdmin, removeSession };
