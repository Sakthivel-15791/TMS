const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
	connectionString,
	ssl: connectionString ? { rejectUnauthorized: false } : undefined,
	max: Number(process.env.DB_POOL_SIZE) || 5,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 10000
});

function postgresQuery(sql, values = []) {
	let index = 0;
	return sql.replace(/\?/g, () => `$${++index}`);
}

function isInsertReturningId(sql) {
	return /^\s*INSERT\s+INTO\s+(employees|users|employee_qualifications|roles|assets|tickets)\b/i.test(sql) && !/\bRETURNING\b/i.test(sql);
}

async function query(sql, values = []) {
	const translatedSql = sql.replace(/SHA2\(\?,\s*256\)/gi, "encode(digest(?, 'sha256'), 'hex')");
	const finalSql = isInsertReturningId(translatedSql) ? `${translatedSql} RETURNING id` : translatedSql;
	const result = await pool.query(postgresQuery(finalSql, values));
	if (/^\s*SELECT\b/i.test(finalSql) || /\bRETURNING\b/i.test(finalSql)) {
		if (/^\s*INSERT\b/i.test(finalSql)) return [{ insertId: result.rows[0]?.id, affectedRows: result.rowCount }];
		return [result.rows];
	}
	return [{ affectedRows: result.rowCount }];
}

async function getConnection() {
	const client = await pool.connect();
	return {
		query: (sql, values) => queryWithClient(client, sql, values),
		beginTransaction: () => client.query('BEGIN'),
		commit: () => client.query('COMMIT'),
		rollback: () => client.query('ROLLBACK'),
		release: () => client.release()
	};
}

async function queryWithClient(client, sql, values = []) {
	const translatedSql = sql.replace(/SHA2\(\?,\s*256\)/gi, "encode(digest(?, 'sha256'), 'hex')");
	const finalSql = isInsertReturningId(translatedSql) ? `${translatedSql} RETURNING id` : translatedSql;
	const result = await client.query(postgresQuery(finalSql, values));
	if (/^\s*SELECT\b/i.test(finalSql)) return [result.rows];
	if (/\bRETURNING\b/i.test(finalSql)) return [{ insertId: result.rows[0]?.id, affectedRows: result.rowCount }];
	return [{ affectedRows: result.rowCount }];
}

module.exports = { query, getConnection };
