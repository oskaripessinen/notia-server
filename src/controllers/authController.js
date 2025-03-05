const User = require('../models/User');

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

    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
};
