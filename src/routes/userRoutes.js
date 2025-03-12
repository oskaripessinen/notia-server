const express = require('express');
const router = express.Router();
const User = require('../models/User');
const requireAuth = require('../middleware/requireAuth');

// Get user details from array of IDs
router.post('/details', requireAuth, async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ error: 'Invalid user IDs provided' });
    }
    
    const users = await User.find({ 
      _id: { $in: userIds } 
    }, 'email displayName');
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;