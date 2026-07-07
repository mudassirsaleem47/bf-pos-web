const jwt = require('jsonwebtoken');
const userService = require('../services/userService');

const protect = async (req, res, next) => {
  let token;

  // Check if token is present in Authorization header and starts with Bearer
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkeyforinventorymgtapp');

      // Get user from the temporary store
      const user = await userService.findUserById(decoded.id);

      if (!user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      // Attach user to the request object (excluding password)
      const { password, ...userWithoutPassword } = user;
      req.user = userWithoutPassword;

      const { asyncLocalStorage } = require('../utils/storage');
      asyncLocalStorage.run({ userId: userWithoutPassword.id }, () => {
        next();
      });
    } catch (error) {
      console.error('Auth verification error:', error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

module.exports = { protect };
