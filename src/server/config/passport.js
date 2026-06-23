const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID || 'dummy',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy',
            callbackURL: '/api/auth/google/callback',
            proxy: true, // Required for Vercel/Render to trust X-Forwarded-Proto and use https
            passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                // Check if user already exists
                let user = await User.findOne({ email: profile.emails[0].value });

                if (user) {
                    // Update provider if they previously signed up locally
                    if (user.provider !== 'google') {
                        user.provider = 'google';
                        if (!user.avatar && profile.photos && profile.photos.length > 0) {
                            user.avatar = profile.photos[0].value;
                        }
                        await user.save();
                    }
                    return done(null, user);
                }

                // If not, create a new user
                user = await User.create({
                    email: profile.emails[0].value,
                    name: profile.displayName,
                    avatar: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : '',
                    provider: 'google',
                    // No password needed for Google Auth
                });

                done(null, user);
            } catch (error) {
                done(error, null);
            }
        }
    )
);

module.exports = passport;
