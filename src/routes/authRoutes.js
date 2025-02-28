const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User'); // Import User model
const verifyGoogleToken = require('../utils/googleVerify'); // Ensure the path is correct

router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: process.env.CLIENT_URL + '/login' }),
  (req, res) => {
    res.redirect(`${process.env.CLIENT_URL}/notes?auth=success&t=${Date.now()}`);
  }
);

router.get('/status', (req, res) => {
  res.json({ 
    authenticated: req.isAuthenticated(),
    user: req.user 
  });
});

// Logout route
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

// Updated Google token verification route
router.post('/google/verify', async (req, res) => {
  console.log('Received verification request:', req.body); // Debug logging
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'No credential provided' });
    }
    

    console.log('Type of verifyGoogleToken:', typeof verifyGoogleToken);
    
    // Verify and decode Google token
    const payload = await verifyGoogleToken(credential);
    console.log('Decoded payload:', payload);
    
    let user = await User.findOne({ googleId: payload.sub });
    if (!user) {
      user = await User.create({
        googleId: payload.sub,
        displayName: payload.name,
        email: payload.email,
      });
      console.log('Created new user:', user);
    } else {
      console.log('Found existing user:', user);
    }
    
    req.login(user, (err) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Login failed' });
      }
      return res.json({ success: true, user });
    });
  } catch (error) {
    console.error('Verification error:', error.message, error.stack);
    res.status(500).json({ error: 'Token verification failed' });
  }
});

module.exports = router;
