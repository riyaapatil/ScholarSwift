const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const User = require('../models/User');
const { protect, generateToken } = require('../middleware/auth');

// Validation rules for signup
const validateSignup = [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('userType').isIn(['student', 'admin']).withMessage('Invalid user type'),
    body('mobileNumber').notEmpty().withMessage('Mobile number is required')
        .matches(/^[0-9]{10}$/).withMessage('Please enter a valid 10-digit mobile number'),
    
    // Student specific validations
    body('department').if(body('userType').equals('student')).notEmpty().withMessage('Department is required for students'),
    body('currentYear').if(body('userType').equals('student')).notEmpty().withMessage('Current year is required')
        .isIn(['FE', 'SE', 'TE', 'BE']).withMessage('Invalid current year'),
    body('joiningYear').if(body('userType').equals('student')).notEmpty().withMessage('Joining year is required')
        .matches(/^\d{4}$/).withMessage('Joining year must be a valid year (YYYY)'),
    body('grNumber').if(body('userType').equals('student')).notEmpty().withMessage('GR number is required'),
    body('scholarshipType').if(body('userType').equals('student')).notEmpty().withMessage('Scholarship type is required')
        .isIn(['Merit', 'Need-based', 'Sports', 'Research', 'Minority', 'Other']).withMessage('Invalid scholarship type')
];

// Validation rules for login
const validateLogin = [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').notEmpty().withMessage('Password is required')
];

// @route   POST /api/auth/signup
// @desc    Register user
// @access  Public
router.post('/signup', validateSignup, async (req, res) => {
    try {
        console.log('📝 Signup attempt for email:', req.body.email);
        
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('❌ Validation errors:', errors.array());
            return res.status(400).json({ 
                message: 'Validation failed', 
                errors: errors.array() 
            });
        }

        const { 
            name, 
            email, 
            password, 
            userType, 
            mobileNumber,
            department,
            currentYear,
            joiningYear,
            grNumber,
            scholarshipType
        } = req.body;

        // For admin, set default password
        const finalPassword = userType === 'admin' ? 'admin123' : password;

        // Check if user exists with same email or GR number (for students)
        const existingUser = await User.findOne({ 
            $or: [
                { email },
                ...(userType === 'student' && grNumber ? [{ grNumber }] : [])
            ]
        });
        
        if (existingUser) {
            console.log('❌ User already exists:', existingUser.email);
            return res.status(400).json({ 
                message: 'User already exists with this email or GR number' 
            });
        }

        // Generate unique key for display
        const uniqueKey = await User.generateUniqueKey(department, userType);

        // Create user object based on type
        const userData = {
            name,
            email,
            password: finalPassword,
            userType,
            mobileNumber,
            uniqueKey
        };

        // Add student-specific fields
        if (userType === 'student') {
            userData.department = department;
            userData.currentYear = currentYear;
            userData.joiningYear = joiningYear;
            userData.grNumber = grNumber;
            userData.scholarshipType = scholarshipType;
        }

        // Create user
        const user = await User.create(userData);

        // Generate Scholar ID for students (after creation to have _id)
        if (userType === 'student') {
            user.scholarId = await User.generateScholarId(department, joiningYear);
            await user.save();
        }

        console.log('✅ User created successfully:', user.email);

        // Generate token
        const token = generateToken(user._id);

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: userResponse
        });
    } catch (error) {
        console.error('❌ Signup error:', error);
        res.status(500).json({ message: 'Server error during signup: ' + error.message });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', validateLogin, async (req, res) => {
    try {
        console.log('🔐 Login attempt for email:', req.body.email);
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('❌ Validation errors:', errors.array());
            return res.status(400).json({ 
                message: 'Validation failed', 
                errors: errors.array() 
            });
        }

        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        
        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        console.log('✅ User found:', user.email, 'Type:', user.userType);

        // Check password using the model method
        const isMatch = await user.comparePassword(password);
        
        if (!isMatch) {
            console.log('❌ Invalid password for:', email);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check if account is active
        if (!user.isActive) {
            console.log('❌ Account deactivated:', email);
            return res.status(401).json({ message: 'Account deactivated. Contact admin.' });
        }

        // Generate token
        const token = generateToken(user._id);

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;

        console.log('✅ Login successful for:', email);

        res.json({
            message: 'Login successful',
            token,
            user: userResponse
        });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ message: 'Server error during login: ' + error.message });
    }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
    try {
        const userResponse = req.user.toObject();
        delete userResponse.password;
        
        res.json({
            user: userResponse
        });
    } catch (error) {
        console.error('❌ Get user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', protect, (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;