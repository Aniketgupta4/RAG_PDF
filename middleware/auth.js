import jwt from 'jsonwebtoken';

// Guard 1: Check if user is logged in
export const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1]; // Extract token from "Bearer <token>"
  
  if (!token) return res.status(401).json({ error: 'Access Denied. Please login.' });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified; // Save user data (id, role) to the request
    next(); // Let the user pass
  } catch (error) {
    res.status(400).json({ error: 'Invalid or Expired Token.' });
  }
};

// Guard 2: Check if user is an Admin
export const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access Denied. Only Admins can perform this action.' });
  }
  next();
};