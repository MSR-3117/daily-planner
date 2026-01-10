import { db, initializeDatabase } from '../_db.js';
import { createSession, sendJson, setSessionCookie, setCorsHeaders } from '../_auth.js';
import crypto from 'crypto';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        return res.status(200).end();
    }

    try {
        await initializeDatabase();

        const { email, password } = req.body;

        if (!email || !password) {
            return sendJson(res, { error: 'Email and password are required' }, 400);
        }

        // Find user
        const result = await db.execute({
            sql: 'SELECT id, password_hash FROM users WHERE email = ?',
            args: [email],
        });

        if (result.rows.length === 0) {
            return sendJson(res, { error: 'Invalid email or password' }, 401);
        }

        const user = result.rows[0];

        // Verify password using Node.js crypto
        const salt = process.env.PASSWORD_SALT || 'default-salt';
        const passwordHash = crypto.createHash('sha256').update(password + salt).digest('hex');

        if (passwordHash !== user.password_hash) {
            return sendJson(res, { error: 'Invalid email or password' }, 401);
        }

        // Create session
        const { token, expiresAt } = await createSession(user.id);

        return sendJson(
            res,
            { message: 'Login successful', userId: user.id },
            200,
            { 'Set-Cookie': setSessionCookie(token, expiresAt) }
        );
    } catch (error) {
        console.error('Login error:', error);
        return sendJson(res, { error: 'Internal server error' }, 500);
    }
}
