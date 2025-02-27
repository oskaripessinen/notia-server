require('dotenv').config();

const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const authRoutes = require('./routes/authRoutes');
const authController = require('./controllers/authController');
const cors = require('cors');
const notebookRoutes = require('./routes/notebookRoutes');


const app = express();

// CORS configuration (must be placed high before any routes)
app.use(cors({
  origin: process.env.CLIENT_URL, // Your React app URL
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true, // Allow cookies/session
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204,
}));

app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL)
.then(() => console.log('MongoDB connected'))
.catch(err => console.log(err));

// Session middleware
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false,
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport serialize/deserialize
passport.serializeUser((user, done) => {
  done(null, user._id);
});
passport.deserializeUser(async (id, done) => {
  try {
    const User = require('./models/User'); // Ensure the User model exists
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Configure Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL}/auth/google/callback`,
    proxy: true,
  },
  authController.googleCallback
));

app.use('/auth', authRoutes);
app.use('/notebooks', notebookRoutes);

// Integrate Socket.IO below
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL, // Your client URL
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('New client connected: ', socket.id);

  // You can listen for events from client if needed:
  socket.on('disconnect', () => {
    console.log('Client disconnected: ', socket.id);
  });
});

// Example: When notes are updated, you can emit an event to all clients.
// In your notesRoutes or controllers, after updating data, use:
// io.emit('notesUpdated', updatedData);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
