import { validateSession, getSessionToken, sendJson, setCorsHeaders } from '../_auth.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        return res.status(200).end();
    }

    try {
        const token = getSessionToken(req);
        const session = await validateSession(token);

        if (session) {
            return sendJson(res, { authenticated: true, userId: session.userId });
        }

        return sendJson(res, { authenticated: false }, 200);
    } catch (error) {
        console.error('Auth check error:', error);
        return sendJson(res, { error: 'Internal server error' }, 500);
    }
}
