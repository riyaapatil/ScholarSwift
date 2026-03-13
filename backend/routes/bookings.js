const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const Booking = require('../models/Booking');
const User = require('../models/User');
const { protect, studentOnly } = require('../middleware/auth');

// Department to day mapping (Friday has multiple departments)
const deptToDay = {
    'DS': 1,      // Monday
    'AIML': 2,    // Tuesday
    'COMP': 3,    // Wednesday
    'IT': 4,      // Thursday
    'MECH': 5,    // Friday
    'CIVIL': 5,   // Friday
    'AUTO': 5     // Friday
};

// Validation rules
const validateBooking = [
    body('slotDate').notEmpty().withMessage('Date is required'),
    body('slotTime').notEmpty().withMessage('Time is required')
];

// @route   POST /api/bookings
// @desc    Create a new booking
// @access  Private (Students only)
router.post('/', protect, studentOnly, validateBooking, async (req, res) => {
    try {
        console.log('📝 Creating booking for user:', req.user.email);
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { slotDate, slotTime } = req.body;

        // Check if student can book on this day
        const bookingDate = new Date(slotDate);
        const dayOfWeek = bookingDate.getDay();
        
        // Check if department is allowed on this day
        if (deptToDay[req.user.department] !== dayOfWeek) {
            return res.status(400).json({ 
                message: `Your department (${req.user.department}) can only book on ${getDayName(deptToDay[req.user.department])}s` 
            });
        }

        // Check if already has an active booking
        const existingBooking = await Booking.findOne({
            userId: req.user._id,
            status: { $in: ['pending', 'current'] }
        });

        if (existingBooking) {
            return res.status(400).json({ 
                message: 'You already have an active booking' 
            });
        }

        // Check if was recently rejected (can rebook)
        const rejectedBooking = await Booking.findOne({
            userId: req.user._id,
            status: 'rejected',
            canRebook: true
        });

        if (rejectedBooking) {
            // Allow rebooking, mark old booking as no-show
            rejectedBooking.canRebook = false;
            await rejectedBooking.save();
        }

        // Generate token number
        const tokenNumber = await Booking.generateTokenNumber(req.user.department, slotDate);

        // Create booking with document checklist based on scholarship type
        const booking = new Booking({
            userId: req.user._id,
            name: req.user.name,
            email: req.user.email,
            department: req.user.department,
            scholarId: req.user.scholarId,
            grNumber: req.user.grNumber,
            currentYear: req.user.currentYear,
            scholarshipType: req.user.scholarshipType,
            uniqueKey: req.user.uniqueKey,
            slotDate,
            slotTime,
            tokenNumber,
            status: 'pending',
            canRebook: true
        });

        // Initialize documents based on scholarship type
        booking.initializeDocuments();

        await booking.save();

        console.log('✅ Booking created:', booking._id);

        // Calculate students before in queue
        const studentsBefore = await Booking.countDocuments({
            department: req.user.department,
            slotDate,
            tokenNumber: { $lt: tokenNumber },
            status: { $in: ['pending', 'current'] }
        });

        res.status(201).json({
            message: 'Booking created successfully',
            booking: {
                id: booking._id,
                token: `${booking.department}-${String(booking.tokenNumber).padStart(3, '0')}`,
                slotDate: booking.slotDate,
                slotTime: booking.slotTime,
                status: booking.status,
                estimatedWaitTime: booking.getEstimatedWaitTime(),
                studentsBefore: studentsBefore
            }
        });
    } catch (error) {
        console.error('❌ Booking error:', error);
        res.status(500).json({ message: 'Server error while creating booking: ' + error.message });
    }
});

// Helper function to get day name
function getDayName(dayNumber) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber];
}

// @route   GET /api/bookings/my-bookings
// @desc    Get current user's bookings
// @access  Private
router.get('/my-bookings', protect, async (req, res) => {
    try {
        const bookings = await Booking.find({ 
            userId: req.user._id 
        }).sort({ createdAt: -1 });

        const formattedBookings = bookings.map(booking => {
            // Calculate students before in queue
            const studentsBefore = 0; // This would need a separate query
            
            return {
                id: booking._id,
                token: `${booking.department}-${String(booking.tokenNumber).padStart(3, '0')}`,
                slotDate: booking.slotDate,
                slotTime: booking.slotTime,
                status: booking.status,
                documents: Object.fromEntries(booking.documents || new Map()),
                estimatedWaitTime: booking.getEstimatedWaitTime(),
                studentsBefore: studentsBefore,
                canRebook: booking.canRebook,
                createdAt: booking.createdAt
            };
        });

        res.json({ bookings: formattedBookings });
    } catch (error) {
        console.error('Fetch bookings error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/bookings/current
// @desc    Get current token for department
// @access  Public
router.get('/current', async (req, res) => {
    try {
        const { department } = req.query;
        
        const query = { status: 'current' };
        if (department) {
            query.department = department;
        }

        const currentBooking = await Booking.findOne(query)
            .sort({ tokenNumber: 1 })
            .populate('userId', 'name scholarId grNumber currentYear');

        if (!currentBooking) {
            return res.json({ 
                currentToken: null,
                message: 'No active token' 
            });
        }

        // Calculate students before in queue
        const studentsBefore = await Booking.countDocuments({
            department: currentBooking.department,
            slotDate: currentBooking.slotDate,
            tokenNumber: { $lt: currentBooking.tokenNumber },
            status: { $in: ['pending', 'current'] }
        });

        res.json({
            currentToken: `${currentBooking.department}-${String(currentBooking.tokenNumber).padStart(3, '0')}`,
            studentName: currentBooking.name,
            department: currentBooking.department,
            scholarId: currentBooking.userId?.scholarId,
            grNumber: currentBooking.userId?.grNumber,
            currentYear: currentBooking.userId?.currentYear,
            estimatedTimeRemaining: 7,
            studentsBefore: studentsBefore
        });
    } catch (error) {
        console.error('Fetch current token error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/bookings/position
// @desc    Get user's position in queue
// @access  Private
router.get('/position', protect, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const userBooking = await Booking.findOne({
            userId: req.user._id,
            slotDate: today,
            status: { $in: ['pending', 'current'] }
        });

        if (!userBooking) {
            return res.json({ 
                hasBooking: false,
                message: 'No active booking for today' 
            });
        }

        // Count students before in queue
        const studentsBefore = await Booking.countDocuments({
            department: userBooking.department,
            slotDate: today,
            tokenNumber: { $lt: userBooking.tokenNumber },
            status: { $in: ['pending', 'current'] }
        });

        // Get current serving token
        const currentToken = await Booking.findOne({
            department: userBooking.department,
            slotDate: today,
            status: 'current'
        });

        res.json({
            hasBooking: true,
            token: `${userBooking.department}-${String(userBooking.tokenNumber).padStart(3, '0')}`,
            studentsBefore: studentsBefore,
            currentToken: currentToken ? 
                `${currentToken.department}-${String(currentToken.tokenNumber).padStart(3, '0')}` : 
                null,
            estimatedWaitTime: userBooking.getEstimatedWaitTime(),
            status: userBooking.status
        });
    } catch (error) {
        console.error('Fetch position error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/bookings/available-slots
// @desc    Get available slots for a date
// @access  Private
router.get('/available-slots', protect, async (req, res) => {
    try {
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({ message: 'Date is required' });
        }

        // Get all bookings for this date and department
        const bookings = await Booking.find({
            department: req.user.department,
            slotDate: date,
            status: { $in: ['pending', 'current', 'verified'] }
        });

        const bookedSlots = bookings.map(b => b.slotTime);

        // Generate all possible slots
        const allSlots = [];
        let hours = 9;
        let minutes = 30;
        const endHours = 17;
        const breakStart = 13 * 60;
        const breakEnd = 14 * 60;

        while (hours < endHours || (hours === endHours && minutes === 0)) {
            const currentMinutes = hours * 60 + minutes;
            
            if (currentMinutes >= breakStart && currentMinutes < breakEnd) {
                hours = 14;
                minutes = 0;
                continue;
            }

            const ampm = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours > 12 ? hours - 12 : hours;
            const displayHoursFormatted = displayHours === 0 ? 12 : displayHours;
            const timeStr = `${displayHoursFormatted}:${String(minutes).padStart(2, '0')} ${ampm}`;

            allSlots.push({
                time: timeStr,
                available: !bookedSlots.includes(timeStr)
            });

            minutes += 7;
            if (minutes >= 60) {
                hours++;
                minutes = minutes % 60;
            }
        }

        res.json({ slots: allSlots });
    } catch (error) {
        console.error('❌ Fetch slots error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

module.exports = router;