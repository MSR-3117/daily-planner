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
            let settings = await db.execute({
                sql: 'SELECT * FROM user_settings WHERE user_id = ?',
                args: [userId],
            });

            if (settings.rows.length === 0) {
                await db.execute({
                    sql: 'INSERT INTO user_settings (user_id, theme) VALUES (?, ?)',
                    args: [userId, 'dark'],
                });
                return sendJson(res, { settings: { user_id: userId, theme: 'dark' } });
            }

            return sendJson(res, { settings: settings.rows[0] });
        }

        if (req.method === 'PUT') {
            const { theme } = req.body;

            const existing = await db.execute({
                sql: 'SELECT user_id FROM user_settings WHERE user_id = ?',
                args: [userId],
            });

            if (existing.rows.length > 0) {
                await db.execute({
                    sql: 'UPDATE user_settings SET theme = ? WHERE user_id = ?',
                    args: [theme || 'dark', userId],
                });
            } else {
                await db.execute({
                    sql: 'INSERT INTO user_settings (user_id, theme) VALUES (?, ?)',
                    args: [userId, theme || 'dark'],
                });
            }

            const settings = await db.execute({
                sql: 'SELECT * FROM user_settings WHERE user_id = ?',
                args: [userId],
            });

            return sendJson(res, { settings: settings.rows[0] });
        }

        return sendJson(res, { error: 'Method not allowed' }, 405);
    } catch (error) {
        console.error('Settings error:', error);
        return sendJson(res, { error: 'Internal server error' }, 500);
    }
}
