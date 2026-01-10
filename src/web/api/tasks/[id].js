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
        const { id: taskId } = req.query;

        if (!taskId || isNaN(taskId)) {
            return sendJson(res, { error: 'Task ID required' }, 400);
        }

        // Verify ownership
        const task = await db.execute({
            sql: 'SELECT * FROM tasks WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
            args: [taskId, userId],
        });

        if (task.rows.length === 0) {
            return sendJson(res, { error: 'Task not found' }, 404);
        }

        if (req.method === 'PUT') {
            const updates = req.body;
            const fields = [];
            const values = [];

            if (updates.status !== undefined) {
                fields.push('status = ?');
                values.push(updates.status);
                if (updates.status === 'done') {
                    fields.push('completed_at = ?');
                    values.push(new Date().toISOString());
                }
            }
            if (updates.scheduled_time !== undefined) {
                fields.push('scheduled_time = ?');
                values.push(updates.scheduled_time);
            }
            if (updates.category !== undefined) {
                fields.push('category = ?');
                values.push(updates.category);
            }
            if (updates.priority !== undefined) {
                fields.push('priority = ?');
                values.push(updates.priority);
            }
            if (updates.notes !== undefined) {
                fields.push('notes = ?');
                values.push(updates.notes);
            }

            if (fields.length > 0) {
                values.push(taskId, userId);
                await db.execute({
                    sql: `UPDATE tasks SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
                    args: values,
                });
            }

            const updated = await db.execute({
                sql: 'SELECT * FROM tasks WHERE id = ?',
                args: [taskId],
            });

            return sendJson(res, { task: updated.rows[0] });
        }

        if (req.method === 'DELETE') {
            await db.execute({
                sql: 'UPDATE tasks SET deleted_at = ? WHERE id = ? AND user_id = ?',
                args: [new Date().toISOString(), taskId, userId],
            });

            return sendJson(res, { message: 'Task deleted' });
        }

        return sendJson(res, { error: 'Method not allowed' }, 405);
    } catch (error) {
        console.error('Task error:', error);
        return sendJson(res, { error: 'Internal server error' }, 500);
    }
}
