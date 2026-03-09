const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const Booking = require('../models/Booking');
const User = require('../models/User');
const { protect, studentOnly } = require('../middleware/auth');

// Department to day mapping
const deptToDay = {
    'DS': 1,      // Monday
    'AIML': 2,    // Tuesday
    'COMP': 3,    // Wednesday
    'IT': 4,      // Thursday
    'MECH': 5     // Friday
};

// Validation rules
const validateBooking = [
    body('slotDate').notEmpty().withMessage('Date is required'),
    body('slotTime').notEmpty().withMessage('Time is required')
];


// CREATE BOOKING
router.post('/', protect, studentOnly, validateBooking, async (req, res) => {
    try {

        console.log('📝 Creating booking for user:', req.user.email);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { slotDate, slotTime } = req.body;

        const bookingDate = new Date(slotDate);

        if (isNaN(bookingDate)) {
            return res.status(400).json({ message: 'Invalid date format' });
        }

        const dayOfWeek = bookingDate.getDay();

        if (!deptToDay.hasOwnProperty(req.user.department)) {
            return res.status(400).json({ message: 'Invalid department' });
        }

        if (deptToDay[req.user.department] !== dayOfWeek) {
            return res.status(400).json({
                message: `Your department (${req.user.department}) can only book on ${
                    ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][deptToDay[req.user.department]]
                }`
            });
        }

        // Check existing booking
        const existingBooking = await Booking.findOne({
            userId: req.user._id,
            slotDate,
            status: { $in: ['pending','current'] }
        });

        if (existingBooking) {
            return res.status(400).json({
                message: 'You already have an active booking for this date'
            });
        }

        // Generate token
        const tokenNumber = await Booking.generateTokenNumber(req.user.department, slotDate);

        // Create booking
        const booking = await Booking.create({
            userId: req.user._id,
            name: req.user.name,
            email: req.user.email,
            department: req.user.department,
            uniqueKey: req.user.uniqueKey,
            slotDate,
            slotTime,
            tokenNumber,
            status: 'pending',
            documents: {
                document1: { status: 'pending' },
                document2: { status: 'pending' }
            }
        });

        console.log('✅ Booking created:', booking._id);

        res.status(201).json({
            message: 'Booking created successfully',
            booking: {
                id: booking._id,
                token: `${booking.department}-${String(booking.tokenNumber).padStart(3,'0')}`,
                slotDate: booking.slotDate,
                slotTime: booking.slotTime,
                status: booking.status,
                estimatedWaitTime: booking.getEstimatedWaitTime()
            }
        });

    } catch (error) {
        console.error('❌ Booking error:', error);
        res.status(500).json({
            message: 'Server error while creating booking: ' + error.message
        });
    }
});


// GET MY BOOKINGS
router.get('/my-bookings', protect, async (req, res) => {
    try {

        const bookings = await Booking.find({
            userId: req.user._id
        }).sort({ createdAt: -1 });

        const formattedBookings = bookings.map(booking => ({
            id: booking._id,
            token: `${booking.department}-${String(booking.tokenNumber).padStart(3,'0')}`,
            slotDate: booking.slotDate,
            slotTime: booking.slotTime,
            status: booking.status,
            documents: booking.documents,
            estimatedWaitTime: booking.getEstimatedWaitTime(),
            createdAt: booking.createdAt
        }));

        res.json({ bookings: formattedBookings });

    } catch (error) {
        console.error('Fetch bookings error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// CURRENT TOKEN
router.get('/current', async (req, res) => {
    try {

        const { department } = req.query;

        const query = { status: 'current' };

        if (department) {
            query.department = department;
        }

        const currentBooking = await Booking.findOne(query)
            .sort({ tokenNumber: 1 })
            .populate('userId', 'name');

        if (!currentBooking) {
            return res.json({
                currentToken: null,
                message: 'No active token'
            });
        }

        res.json({
            currentToken: `${currentBooking.department}-${String(currentBooking.tokenNumber).padStart(3,'0')}`,
            studentName: currentBooking.name,
            department: currentBooking.department,
            estimatedTimeRemaining: 7
        });

    } catch (error) {
        console.error('Fetch current token error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// AVAILABLE SLOTS
router.get('/available-slots', protect, async (req, res) => {
    try {

        const { date } = req.query;

        if (!date) {
            return res.status(400).json({ message: 'Date is required' });
        }

        console.log(`🔍 Checking slots for ${req.user.department} on ${date}`);

        const bookings = await Booking.find({
            department: req.user.department,
            slotDate: date,
            status: { $in: ['pending','current','verified'] }
        });

        const bookedSlots = bookings.map(b => b.slotTime);

        const allSlots = [];

        let hours = 9;
        let minutes = 30;

        const endHours = 17;
        const endMinutes = 0;

        const breakStart = 13 * 60;
        const breakEnd = 14 * 60;

        while (hours < endHours || (hours === endHours && minutes < endMinutes)) {

            const currentMinutes = hours * 60 + minutes;

            if (currentMinutes >= breakStart && currentMinutes < breakEnd) {
                hours = 14;
                minutes = 0;
                continue;
            }

            const ampm = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours > 12 ? hours - 12 : hours;
            const displayHoursFormatted = displayHours === 0 ? 12 : displayHours;

            const timeStr = `${displayHoursFormatted}:${String(minutes).padStart(2,'0')} ${ampm}`;

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

        console.log(`✅ ${allSlots.length} slots generated`);

        res.json({ slots: allSlots });

    } catch (error) {
        console.error('❌ Slot fetch error:', error);
        res.status(500).json({
            message: 'Server error: ' + error.message
        });
    }
});


// DEPARTMENT QUEUE
router.get('/queue/:department', async (req, res) => {
    try {

        const { department } = req.params;
        const { date } = req.query;

        const queryDate = date || new Date().toISOString().split('T')[0];

        const queue = await Booking.find({
            department,
            slotDate: queryDate,
            status: { $in: ['pending','current'] }
        })
        .sort({ tokenNumber: 1 })
        .select('name tokenNumber status slotTime documents');

        const current = queue.find(b => b.status === 'current');
        const pending = queue.filter(b => b.status === 'pending');

        res.json({
            department,
            date: queryDate,

            currentToken: current ? {
                token: `${department}-${String(current.tokenNumber).padStart(3,'0')}`,
                name: current.name,
                slotTime: current.slotTime
            } : null,

            queueLength: pending.length,
            estimatedWaitTime: pending.length * 7,

            queue: pending.map(b => ({
                token: `${department}-${String(b.tokenNumber).padStart(3,'0')}`,
                name: b.name,
                slotTime: b.slotTime,
                position: b.tokenNumber - (current?.tokenNumber || 0)
            }))
        });

    } catch (error) {
        console.error('Fetch queue error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;