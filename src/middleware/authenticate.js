const jwt = require('jsonwebtoken');

function authenticateJWT(req, res, next) {
  // Retrieve token from Authorization header: "Bearer <token>"
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return res.sendStatus(403); // Forbidden if token is invalid
      }
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401); // Unauthorized: no token provided
  }
}

module.exports = authenticateJWT;
