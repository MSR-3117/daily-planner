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

        // Get monthly metrics
        const metrics = await db.execute({
            sql: `SELECT 
                strftime('%Y-%m', due_date) as month_year,
                COUNT(*) as total_tasks,
                SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed_tasks,
                ROUND(100.0 * SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) / COUNT(*), 1) as completion_rate
              FROM tasks
              WHERE user_id = ? AND deleted_at IS NULL
              GROUP BY month_year
              ORDER BY month_year DESC`,
            args: [userId],
        });

        return sendJson(res, { metrics: metrics.rows });
    } catch (error) {
        console.error('Monthly metrics error:', error);
        return sendJson(res, { error: 'Internal server error' }, 500);
    }
}
