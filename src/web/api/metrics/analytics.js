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

        // Category breakdown
        const categories = await db.execute({
            sql: `SELECT COALESCE(category, 'general') as category, COUNT(*) as total,
              SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed
              FROM tasks WHERE user_id = ? AND deleted_at IS NULL GROUP BY category`,
            args: [userId],
        });

        // Summary stats
        const summary = await db.execute({
            sql: `SELECT COUNT(*) as total_tasks,
              SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed_tasks,
              COUNT(DISTINCT due_date) as active_days,
              COUNT(DISTINCT CASE WHEN status = 'done' THEN due_date END) as productive_days
              FROM tasks WHERE user_id = ? AND deleted_at IS NULL`,
            args: [userId],
        });

        return sendJson(res, {
            categories: categories.rows,
            summary: summary.rows[0] || { total_tasks: 0, completed_tasks: 0 },
            hourlyStats: [],
            heatmapData: [],
            weeklyTrend: [],
            bestHours: [],
            comparison: { thisWeek: { total: 0, completed: 0 }, lastWeek: { total: 0, completed: 0 }, change: 0 }
        });
    } catch (error) {
        console.error('Analytics error:', error);
        return sendJson(res, { error: 'Internal server error' }, 500);
    }
}
