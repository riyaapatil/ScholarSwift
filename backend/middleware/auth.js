const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];
            
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
            
            // Get user from token
            req.user = await User.findById(decoded.id).select('-password');
            
            if (!req.user) {
                return res.status(401).json({ message: 'User not found' });
            }
            
            if (!req.user.isActive) {
                return res.status(401).json({ message: 'Account deactivated' });
            }
            
            next();
        } catch (error) {
            console.error('Auth error:', error);
            return res.status(401).json({ message: 'Not authorized' });
        }
    }
    
    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const adminOnly = (req, res, next) => {
    if (req.user && req.user.userType === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin only.' });
    }
};

const studentOnly = (req, res, next) => {
    if (req.user && req.user.userType === 'student') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Students only.' });
    }
};

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'your_secret_key', {
        expiresIn: process.env.JWT_EXPIRE || '7d'
    });
};

module.exports = { protect, adminOnly, studentOnly, generateToken };