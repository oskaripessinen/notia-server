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
const MongoStore = require('connect-mongo');

const app = express();

// Trust proxy for correct cookie handling in Render
app.set("trust proxy", 1);

// CORS configuration (must be placed high before any routes)
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

// Session middleware with MongoDB storage
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URL,
    collectionName: 'sessions'
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Only HTTPS in production
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // "none" for production, "lax" for development
    maxAge: 1000 * 60 * 60
  }
}));

// Initialize Passport (AFTER session middleware)
app.use(passport.initialize());
app.use(passport.session());

// Passport serialize/deserialize
passport.serializeUser((user, done) => {
  done(null, user._id);
});
passport.deserializeUser(async (id, done) => {
  try {
    const User = require('./models/User');
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

// Routes
app.use('/auth', authRoutes);
app.use('/notebooks', notebookRoutes);

// Integrate Socket.IO below
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('New client connected: ', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected: ', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
