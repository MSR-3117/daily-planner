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

        if (password.length < 8) {
            return sendJson(res, { error: 'Password must be at least 8 characters' }, 400);
        }

        // Check if user exists
        const existing = await db.execute({
            sql: 'SELECT id FROM users WHERE email = ?',
            args: [email],
        });

        if (existing.rows.length > 0) {
            return sendJson(res, { error: 'Email already registered' }, 409);
        }

        // Hash password using Node.js crypto
        const salt = process.env.PASSWORD_SALT || 'default-salt';
        const passwordHash = crypto.createHash('sha256').update(password + salt).digest('hex');

        // Create user
        const result = await db.execute({
            sql: 'INSERT INTO users (email, password_hash) VALUES (?, ?)',
            args: [email, passwordHash],
        });

        const userId = Number(result.lastInsertRowid);

        // Create session
        const { token, expiresAt } = await createSession(userId);

        return sendJson(
            res,
            { message: 'User created successfully', userId },
            201,
            { 'Set-Cookie': setSessionCookie(token, expiresAt) }
        );
    } catch (error) {
        console.error('Registration error:', error);
        return sendJson(res, { error: 'Internal server error' }, 500);
    }
}
