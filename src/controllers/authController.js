const User = require('../models/User');
const jwt = require('jsonwebtoken');

exports.googleCallback = async (accessToken, refreshToken, profile, done) => {
  try {
    // Verify valid Google profile data
    if (!profile || !profile.id || !profile.emails || !profile.emails[0].value) {
      return done(new Error('Invalid Google profile data'), null);
    }

    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
      user = await User.create({
        googleId: profile.id,
        displayName: profile.displayName || 'Anonymous',
        email: profile.emails[0].value,
      });
    }

    if (!user) {
      return done(new Error('Failed to create/find user'), null);
    }

    // Generate a JWT token for the authenticated user
    const token = jwt.sign(
      {
        _id: user._id,
        email: user.email,
        displayName: user.displayName,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Set token as HttpOnly cookie
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // use true in production with HTTPS
      maxAge: 3600000 // 1 hour in milliseconds
    });
    res.redirect(process.env.CLIENT_URL);

    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
};
