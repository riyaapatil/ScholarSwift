const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const Booking = require('../models/Booking');
const User = require('../models/User');
const { protect, studentOnly } = require('../middleware/auth');

// Helper function to convert time string to minutes
function convertTimeToMinutes(timeStr) {
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return hours * 60 + minutes;
}

// Helper function to get day name
function getDayName(dayNumber) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber];
}

// @route   PUT /api/bookings/cancel/:bookingId
// @desc    Cancel a booking
// @access  Private
router.put('/cancel/:bookingId', protect, async (req, res) => {
    try {
        const { bookingId } = req.params;
        
        const booking = await Booking.findOne({
            _id: bookingId,
            userId: req.user._id
        });
        
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }
        
        // Can only cancel pending bookings
        if (booking.status !== 'pending') {
            return res.status(400).json({ 
                message: 'Cannot cancel a booking that is already in progress or completed' 
            });
        }
        
        booking.status = 'cancelled';
        booking.canRebook = true;
        await booking.save();
        
        res.json({ 
            message: 'Booking cancelled successfully',
            canRebook: true 
        });
        
    } catch (error) {
        console.error('❌ Cancel booking error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Department to day mapping (Friday has multiple departments, includes weekends)
const deptToDay = {
    'DS': 1,      // Monday
    'AIML': 2,    // Tuesday
    'COMP': 3,    // Wednesday
    'IT': 4,      // Thursday
    'MECH': 5,    // Friday
    'CIVIL': 5,   // Friday
    'AUTO': 5,    // Friday
    'SAT': 6,     // Saturday
    'SUN': 0      // Sunday
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
        console.log('Request body:', req.body);
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('❌ Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { slotDate, slotTime } = req.body;

        // Check if student can book on this day
        const bookingDate = new Date(slotDate);
        const dayOfWeek = bookingDate.getDay();
        
        console.log('Department:', req.user.department, 'Day of week:', dayOfWeek);
        
        // Check if department is allowed on this day
        if (deptToDay[req.user.department] !== dayOfWeek) {
            console.log('❌ Wrong day for department');
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
            console.log('❌ User already has active booking:', existingBooking._id);
            return res.status(400).json({ 
                message: 'You already have an active booking' 
            });
        }

        // Generate token number based on time
        console.log('Generating token number for:', slotDate, slotTime);
        const tokenNumber = await Booking.generateTokenNumber(req.user.department, slotDate, slotTime);
        console.log('Generated token number:', tokenNumber);

        // Create booking
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
        console.log('✅ Booking saved with ID:', booking._id);

        // Calculate students before based on time
        const allBookings = await Booking.find({
            department: req.user.department,
            slotDate,
            status: { $in: ['pending', 'current'] }
        });

        const convertTimeToMinutes = (timeStr) => {
            const [time, period] = timeStr.split(' ');
            let [hours, minutes] = time.split(':').map(Number);
            if (period === 'PM' && hours !== 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;
            return hours * 60 + minutes;
        };

        const sortedBookings = allBookings.sort((a, b) => 
            convertTimeToMinutes(a.slotTime) - convertTimeToMinutes(b.slotTime)
        );

        const position = sortedBookings.findIndex(b => b._id.toString() === booking._id.toString()) + 1;
        const studentsBefore = position - 1;

        res.status(201).json({
            message: 'Booking created successfully',
            booking: {
                id: booking._id,
                token: `${booking.department}-${String(booking.tokenNumber).padStart(3, '0')}`,
                slotDate: booking.slotDate,
                slotTime: booking.slotTime,
                status: booking.status,
                estimatedWaitTime: studentsBefore * 7,
                studentsBefore: studentsBefore,
                queuePosition: position
            }
        });
    } catch (error) {
        console.error('❌ Booking error:', error);
        res.status(500).json({ message: 'Server error while creating booking: ' + error.message });
    }
});

// @route   GET /api/bookings/my-bookings
// @desc    Get current user's bookings
// @access  Private
router.get('/my-bookings', protect, async (req, res) => {
    try {
        const bookings = await Booking.find({ 
            userId: req.user._id 
        }).sort({ createdAt: -1 });

        const formattedBookings = bookings.map(booking => {
            return {
                id: booking._id,
                token: `${booking.department}-${String(booking.tokenNumber).padStart(3, '0')}`,
                slotDate: booking.slotDate,
                slotTime: booking.slotTime,
                status: booking.status,
                documents: booking.documents instanceof Map ? Object.fromEntries(booking.documents) : (booking.documents || {}),
                estimatedWaitTime: booking.getEstimatedWaitTime(),
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

        // Calculate students before in queue based on time
        const allBookings = await Booking.find({
            department: currentBooking.department,
            slotDate: currentBooking.slotDate,
            status: { $in: ['pending', 'current'] }
        });

        const sortedBookings = allBookings.sort((a, b) => 
            convertTimeToMinutes(a.slotTime) - convertTimeToMinutes(b.slotTime)
        );

        const position = sortedBookings.findIndex(b => b._id.toString() === currentBooking._id.toString()) + 1;
        const studentsBefore = position - 1;

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
// @desc    Get user's position in queue (based on time)
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

        // Get all bookings for today sorted by time
        const allBookings = await Booking.find({
            department: userBooking.department,
            slotDate: today,
            status: { $in: ['pending', 'current'] }
        });

        // Helper to convert time to minutes
        const convertTimeToMinutes = (timeStr) => {
            const [time, period] = timeStr.split(' ');
            let [hours, minutes] = time.split(':').map(Number);
            if (period === 'PM' && hours !== 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;
            return hours * 60 + minutes;
        };

        // Sort by time (earliest first)
        const sortedBookings = allBookings.sort((a, b) => 
            convertTimeToMinutes(a.slotTime) - convertTimeToMinutes(b.slotTime)
        );

        // Find user's position
        const position = sortedBookings.findIndex(b => b._id.toString() === userBooking._id.toString()) + 1;
        const studentsBefore = position - 1;

        // Get current serving token
        const currentToken = sortedBookings.find(b => b.status === 'current');

        // ✅ FIXED: Calculate dynamic wait time (7 min per student before)
        // This will be updated in real-time as students are served
        const estimatedWaitTime = studentsBefore * 7;

        res.json({
            hasBooking: true,
            token: `${userBooking.department}-${String(userBooking.tokenNumber).padStart(3, '0')}`,
            studentsBefore: studentsBefore,
            queuePosition: position,
            totalInQueue: sortedBookings.length,
            currentToken: currentToken ? 
                `${currentToken.department}-${String(currentToken.tokenNumber).padStart(3, '0')}` : 
                null,
            estimatedWaitTime: estimatedWaitTime,
            status: userBooking.status,
            slotTime: userBooking.slotTime
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

        // ✅ FIXED: Generate all possible slots from 9:30 AM to 7:00 PM
        const allSlots = [];
        let hours = 9;
        let minutes = 30;
        const endHours = 19; // 7:00 PM
        const breakStart = 13 * 60; // 1:00 PM
        const breakEnd = 14 * 60;    // 2:00 PM

        while (hours < endHours || (hours === endHours && minutes === 0)) {
            const currentMinutes = hours * 60 + minutes;
            
            // Skip lunch break
            if (currentMinutes >= breakStart && currentMinutes < breakEnd) {
                hours = 14;
                minutes = 0;
                continue;
            }

            const ampm = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours > 12 ? hours - 12 : hours;
            const displayHoursFormatted = displayHours === 0 ? 12 : displayHours;
            const timeStr = `${displayHoursFormatted}:${String(minutes).padStart(2, '0')} ${ampm}`;

            // Check if this is a future slot (for today)
            const today = new Date().toISOString().split('T')[0];
            const isToday = date === today;
            
            let isAvailable = !bookedSlots.includes(timeStr);
            
            // If it's today, also check if slot time is in the future
            if (isToday) {
                const now = new Date();
                const currentMinutesTotal = now.getHours() * 60 + now.getMinutes();
                if (currentMinutes > currentMinutesTotal) {
                    isAvailable = isAvailable && true;
                } else {
                    isAvailable = false;
                }
            }

            allSlots.push({
                time: timeStr,
                available: isAvailable
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