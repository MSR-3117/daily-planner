import { db, initializeDatabase } from './_db.js';
import { validateSession, getSessionToken, sendJson, setCorsHeaders } from './_auth.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        return res.status(200).end();
    }

    try {
        await initializeDatabase();

        const token = getSessionToken(req);
        const session = await validateSession(token);
        if (!session) {
            return sendJson(res, { error: 'Unauthorized' }, 401);
        }

        const userId = session.userId;

        if (req.method === 'GET') {
            const blocks = await db.execute({
                sql: `SELECT id, name, start_time, end_time, color, icon, created_at
                      FROM time_blocks WHERE user_id = ?
                      ORDER BY start_time ASC`,
                args: [userId],
            });

            return sendJson(res, { timeBlocks: blocks.rows });
        }

        if (req.method === 'POST') {
            const { name, start_time, end_time, color, icon } = req.body;

            if (!name || !start_time || !end_time) {
                return sendJson(res, { error: 'Name, start_time, and end_time are required' }, 400);
            }

            // Validate time format (HH:MM)
            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
                return sendJson(res, { error: 'Invalid time format. Use HH:MM' }, 400);
            }

            // Check for overlapping blocks
            const existing = await db.execute({
                sql: `SELECT id, name FROM time_blocks 
                      WHERE user_id = ? 
                      AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?) OR (start_time >= ? AND end_time <= ?))`,
                args: [userId, start_time, start_time, end_time, end_time, start_time, end_time],
            });

            if (existing.rows.length > 0) {
                return sendJson(res, { error: `Time block overlaps with existing block: ${existing.rows[0].name}` }, 409);
            }

            const result = await db.execute({
                sql: `INSERT INTO time_blocks (user_id, name, start_time, end_time, color, icon)
                      VALUES (?, ?, ?, ?, ?, ?)`,
                args: [userId, name, start_time, end_time, color || '#6366f1', icon || '📚'],
            });

            const block = await db.execute({
                sql: 'SELECT * FROM time_blocks WHERE id = ?',
                args: [result.lastInsertRowid],
            });

            return sendJson(res, { timeBlock: block.rows[0] }, 201);
        }

        return sendJson(res, { error: 'Method not allowed' }, 405);
    } catch (error) {
        console.error('Time blocks error:', error);
        return sendJson(res, { error: 'Internal server error' }, 500);
    }
}
