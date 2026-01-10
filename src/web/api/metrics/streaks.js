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

        const completedDates = await db.execute({
            sql: `SELECT DISTINCT due_date
              FROM tasks
              WHERE user_id = ? AND status = 'done' AND deleted_at IS NULL
              ORDER BY due_date DESC`,
            args: [userId],
        });

        let streak = 0;
        const today = new Date().toISOString().split('T')[0];
        let checkDate = new Date(today);

        for (const row of completedDates.rows) {
            const taskDate = new Date(row.due_date);
            const diffDays = Math.floor((checkDate - taskDate) / (1000 * 60 * 60 * 24));

            if (diffDays <= 1) {
                streak++;
                checkDate = taskDate;
            } else {
                break;
            }
        }

        return sendJson(res, { streak_days: streak });
    } catch (error) {
        console.error('Streaks error:', error);
        return sendJson(res, { error: 'Internal server error' }, 500);
    }
}
