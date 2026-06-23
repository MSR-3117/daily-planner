const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const metricsRoutes = require('./routes/metrics');
const settingsRoutes = require('./routes/settings');
const timeblocksRoutes = require('./routes/timeblocks');
const debugRoutes = require('./routes/debug');

const app = express();

// Trust reverse proxy (Vercel) for rate limiting and OAuth HTTPS detection
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS for React frontend
const allowedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, Vercel same-origin, etc.)
        if (!origin) return callback(null, true);
        // Allow configured origins and local network IPs
        const isAllowed = allowedOrigins.includes(origin) ||
            /^http:\/\/192\.168\.\d+\.\d+:5173$/.test(origin) ||
            /^http:\/\/10\.\d+\.\d+\.\d+:5173$/.test(origin);
        callback(null, isAllowed);
    },
    credentials: true,
}));

// Body parsing & cookies
app.use(express.json());
app.use(cookieParser());

// Initialize Passport
require('./config/passport');
app.use(require('passport').initialize());

// Clear legacy session cookie (from Phase 1 express-session)
app.use((req, res, next) => {
    if (req.cookies['connect.sid']) {
        res.clearCookie('connect.sid');
    }
    next();
});

// Routes — all under /api prefix for Vercel compatibility
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/timeblocks', timeblocksRoutes);

// Debug routes only in development
if (process.env.NODE_ENV !== 'production') {
    app.use('/api/debug', debugRoutes);
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = app;
