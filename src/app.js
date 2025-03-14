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
const userRoutes = require('./routes/userRoutes');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
const socketAuth = require('./middleware/socketAuth');
const setupNotebookSockets = require('./sockets/notebookSocket');

const app = express();
const server = http.createServer(app);

// Trust proxy for correct cookie handling in Render
app.set("trust proxy", 1);

// CORS configuration (must be placed high before any routes)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204,
}));

app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Session middleware with MongoDB storage
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'notia-default-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URL,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60, // 14 days
    autoRemove: 'native'
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", 
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 14 // 14 days
  },
  name: 'notia.sid' // Give the cookie a specific name
});

app.use(sessionMiddleware);

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
app.use('/users', userRoutes);

// Configure Socket.IO - place this right before server.listen
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  transports: ['websocket', 'polling'] // Support both transports
});

// Debug socket connections
io.engine.on("connection_error", (err) => {
  console.log("Connection error:", err.req, err.code, err.message, err.context);
});

// Apply socket authentication middleware
io.use(socketAuth(sessionMiddleware));

// Set up socket handlers
setupNotebookSockets(io);

// Make io instance available to routes
app.set('io', io);

console.log('Socket.IO server initialized');

io.on('connection', (socket) => {
  console.log('New client connected: ', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected: ', socket.id);
  });
});

// Add this route before server.listen()

// Debug route to check session and auth status
app.get('/debug/auth', (req, res) => {
  res.json({
    session: {
      id: req.session?.id,
      passport: req.session?.passport,
      expires: req.session?.cookie?.expires
    },
    user: req.user ? {
      id: req.user._id,
      email: req.user.email
    } : null,
    authenticated: req.isAuthenticated()
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
