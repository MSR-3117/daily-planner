const bcrypt = require('bcryptjs');
const User = require('../models/User');
const {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
} = require('../utils/jwt');

/**
 * Register a new user
 */
async function registerUser(email, password, name) {
    const existing = await User.findOne({ email });
    if (existing) {
        throw new Error('Email already registered');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
        email,
        passwordHash,
        name: name || '',
        provider: 'local',
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    return { user, accessToken, refreshToken };
}

/**
 * Login an existing user
 */
async function loginUser(email, password) {
    const user = await User.findOne({ email });
    if (!user || !user.passwordHash) {
        throw new Error('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
        throw new Error('Invalid email or password');
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    return { user, accessToken, refreshToken };
}

/**
 * Refresh tokens using a refresh token
 */
async function refreshTokens(token) {
    if (!token) {
        throw new Error('Refresh token required');
    }

    let decoded;
    try {
        decoded = verifyRefreshToken(token);
    } catch (error) {
        throw new Error('Invalid refresh token');
    }

    const user = await User.findById(decoded.userId);

    if (!user || user.refreshToken !== token) {
        if (user) {
            user.refreshToken = null;
            await user.save();
        }
        throw new Error('Token reuse detected. Please login again.');
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    user.refreshToken = newRefreshToken;
    await user.save();

    return { newAccessToken, newRefreshToken };
}

/**
 * Handle Google OAuth user sign in or creation
 * Passport has already found or created the user document
 */
async function handleGoogleOAuth(user) {
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    return { user, accessToken, refreshToken };
}

/**
 * Get user by ID
 */
async function getUserById(userId) {
    return await User.findById(userId);
}

/**
 * Logout user by clearing refresh token in DB
 */
async function logoutUser(token) {
    if (token) {
        try {
            const decoded = verifyRefreshToken(token);
            await User.findByIdAndUpdate(decoded.userId, { refreshToken: null });
        } catch (e) {
            // Ignore invalid token
        }
    }
}

module.exports = {
    registerUser,
    loginUser,
    refreshTokens,
    handleGoogleOAuth,
    getUserById,
    logoutUser
};
