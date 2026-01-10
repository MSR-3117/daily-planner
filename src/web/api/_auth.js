import { db } from './_db.js';
import crypto from 'crypto';

// Generate session token
export function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Create session
export async function createSession(userId) {
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.execute({
        sql: 'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
        args: [token, userId, expiresAt.toISOString()],
    });

    return { token, expiresAt };
}

// Validate session
export async function validateSession(token) {
    if (!token) return null;

    const result = await db.execute({
        sql: 'SELECT user_id, expires_at FROM sessions WHERE id = ?',
        args: [token],
    });

    if (result.rows.length === 0) return null;

    const session = result.rows[0];
    if (new Date(session.expires_at) < new Date()) {
        await db.execute({ sql: 'DELETE FROM sessions WHERE id = ?', args: [token] });
        return null;
    }

    return { userId: session.user_id };
}

// Delete session
export async function deleteSession(token) {
    await db.execute({ sql: 'DELETE FROM sessions WHERE id = ?', args: [token] });
}

// Get session from request (Node.js format)
export function getSessionToken(req) {
    const cookie = req.headers.cookie || '';
    const match = cookie.match(/session=([^;]+)/);
    return match ? match[1] : null;
}

// Set session cookie header
export function setSessionCookie(token, expiresAt) {
    return `session=${token}; Path=/; HttpOnly; SameSite=Strict; Secure; Expires=${expiresAt.toUTCString()}`;
}

// Clear session cookie header
export function clearSessionCookie() {
    return 'session=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0';
}

// CORS headers helper for Node.js
export function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// JSON response helper for Node.js
export function sendJson(res, data, status = 200, extraHeaders = {}) {
    setCorsHeaders(res);
    Object.entries(extraHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });
    res.status(status).json(data);
}
