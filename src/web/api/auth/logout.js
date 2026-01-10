import { deleteSession, getSessionToken, sendJson, clearSessionCookie, setCorsHeaders } from '../_auth.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        return res.status(200).end();
    }

    try {
        const token = getSessionToken(req);
        if (token) {
            await deleteSession(token);
        }

        return sendJson(
            res,
            { message: 'Logged out successfully' },
            200,
            { 'Set-Cookie': clearSessionCookie() }
        );
    } catch (error) {
        console.error('Logout error:', error);
        return sendJson(res, { error: 'Internal server error' }, 500);
    }
}
