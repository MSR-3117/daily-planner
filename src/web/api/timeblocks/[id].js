import { db, initializeDatabase } from '../_db.js';
import { validateSession, getSessionToken, sendJson, setCorsHeaders } from '../_auth.js';

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
        const { id: blockId } = req.query;

        if (!blockId || isNaN(blockId)) {
            return sendJson(res, { error: 'Block ID required' }, 400);
        }

        // Verify ownership
        const block = await db.execute({
            sql: 'SELECT * FROM time_blocks WHERE id = ? AND user_id = ?',
            args: [blockId, userId],
        });

        if (block.rows.length === 0) {
            return sendJson(res, { error: 'Time block not found' }, 404);
        }

        if (req.method === 'PUT') {
            const { name, start_time, end_time, color, icon } = req.body;
            const fields = [];
            const values = [];

            if (name !== undefined) {
                fields.push('name = ?');
                values.push(name);
            }
            if (start_time !== undefined) {
                const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
                if (!timeRegex.test(start_time)) {
                    return sendJson(res, { error: 'Invalid start_time format. Use HH:MM' }, 400);
                }
                fields.push('start_time = ?');
                values.push(start_time);
            }
            if (end_time !== undefined) {
                const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
                if (!timeRegex.test(end_time)) {
                    return sendJson(res, { error: 'Invalid end_time format. Use HH:MM' }, 400);
                }
                fields.push('end_time = ?');
                values.push(end_time);
            }
            if (color !== undefined) {
                fields.push('color = ?');
                values.push(color);
            }
            if (icon !== undefined) {
                fields.push('icon = ?');
                values.push(icon);
            }

            if (fields.length > 0) {
                values.push(blockId, userId);
                await db.execute({
                    sql: `UPDATE time_blocks SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
                    args: values,
                });
            }

            const updated = await db.execute({
                sql: 'SELECT * FROM time_blocks WHERE id = ?',
                args: [blockId],
            });

            return sendJson(res, { timeBlock: updated.rows[0] });
        }

        if (req.method === 'DELETE') {
            await db.execute({
                sql: 'DELETE FROM time_blocks WHERE id = ? AND user_id = ?',
                args: [blockId, userId],
            });

            return sendJson(res, { message: 'Time block deleted' });
        }

        return sendJson(res, { error: 'Method not allowed' }, 405);
    } catch (error) {
        console.error('Time block error:', error);
        return sendJson(res, { error: 'Internal server error' }, 500);
    }
}
