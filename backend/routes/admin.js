const express = require('express');
const router = express.Router();

const Booking = require('../models/Booking');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard stats
// @access  Private (Admin only)
router.get('/dashboard', protect, adminOnly, async (req, res) => {
    try {
        console.log('📊 Loading admin dashboard for:', req.user.email);
        
        const today = new Date().toISOString().split('T')[0];
        const dayOfWeek = new Date().getDay();

        // Department for today
        const dayToDept = {
            1: 'DS',
            2: 'AIML',
            3: 'COMP',
            4: 'IT',
            5: 'MECH'
        };
        const todaysDept = dayToDept[dayOfWeek] || null;

        let todayStats = {
            total: 0,
            verified: 0,
            rejected: 0,
            pending: 0,
            current: null
        };

        if (todaysDept) {
            const todayBookings = await Booking.find({
                department: todaysDept,
                slotDate: today
            }).populate('userId', 'name email scholarId grNumber currentYear');

            todayStats = {
                total: todayBookings.length,
                verified: todayBookings.filter(b => b.status === 'verified').length,
                rejected: todayBookings.filter(b => b.status === 'rejected').length,
                pending: todayBookings.filter(b => b.status === 'pending').length,
                current: todayBookings.find(b => b.status === 'current'),
                bookings: todayBookings
            };
        }

        // Get upcoming bookings (next 7 days)
        const nextWeek = [];
        const today_date = new Date();
        
        for (let i = 1; i <= 7; i++) {
            const date = new Date(today_date);
            date.setDate(today_date.getDate() + i);
            
            // Format date as YYYY-MM-DD
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            // Get day of week name
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayName = dayNames[date.getDay()];
            
            // Get department for this day
            const dept = dayToDept[date.getDay()] || 'No Department';
            
            // Count bookings for this date
            const count = await Booking.countDocuments({
                slotDate: dateStr,
                status: { $in: ['pending', 'current', 'verified'] }
            });
            
            nextWeek.push({
                date: dateStr,
                day: dayName,
                department: dept,
                bookings: count
            });
        }

        console.log('📅 Upcoming bookings generated:', nextWeek);

        // Weekly stats
        const weeklyStats = await Booking.getWeeklyStats(0);
        
        // Monthly stats
        const monthlyStats = await Booking.getMonthlyStats(0);

        // Past weeks data (last 4 weeks)
        const pastWeeks = [];
        for (let i = 1; i <= 4; i++) {
            pastWeeks.push(await Booking.getWeeklyStats(i));
        }

        const response = {
            today: {
                department: todaysDept,
                total: todayStats.total,
                verified: todayStats.verified,
                rejected: todayStats.rejected,
                pending: todayStats.pending,
                currentToken: todayStats.current ? 
                    `${todayStats.current.department}-${String(todayStats.current.tokenNumber).padStart(3, '0')}` : 
                    null,
                bookings: todayStats.bookings || []
            },
            upcoming: nextWeek,
            weekly: weeklyStats,
            monthly: monthlyStats,
            pastWeeks: pastWeeks,
            totalStudents: await User.countDocuments({ userType: 'student' }),
            totalAdmins: await User.countDocuments({ userType: 'admin' })
        };
        
        console.log('✅ Dashboard data loaded. Upcoming weeks entries:', response.upcoming.length);
        res.json(response);
        
    } catch (error) {
        console.error('❌ Dashboard error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// @route   GET /api/admin/students/search
// @desc    Search student profiles
// @access  Private (Admin only)
router.get('/students/search', protect, adminOnly, async (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query || query.length < 2) {
            return res.json({ students: [] });
        }

        console.log('🔍 Searching students with query:', query);

        const searchRegex = new RegExp(query, 'i');
        
        const students = await User.find({
            userType: 'student',
            $or: [
                { name: searchRegex },
                { email: searchRegex },
                { scholarId: searchRegex },
                { grNumber: searchRegex },
                { mobileNumber: searchRegex },
                { uniqueKey: searchRegex }
            ]
        }).select('-password').sort({ createdAt: -1 }).limit(50);

        console.log(`✅ Found ${students.length} students`);
        res.json({ students });
        
    } catch (error) {
        console.error('❌ Student search error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// @route   GET /api/admin/students/:id
// @desc    Get student profile by ID
// @access  Private (Admin only)
router.get('/students/:id', protect, adminOnly, async (req, res) => {
    try {
        const student = await User.findOne({
            _id: req.params.id,
            userType: 'student'
        }).select('-password');
        
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Get student's booking history
        const bookings = await Booking.find({ userId: student._id })
            .sort({ slotDate: -1 });

        res.json({
            student,
            bookings
        });
        
    } catch (error) {
        console.error('❌ Fetch student error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// @route   GET /api/admin/users
// @desc    Get all users (students and admins)
// @access  Private (Admin only)
router.get('/users', protect, adminOnly, async (req, res) => {
    try {
        const { type, page = 1, limit = 20 } = req.query;
        
        const query = {};
        if (type && type !== 'all') {
            query.userType = type;
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        res.json({
            users,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('❌ Fetch users error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// @route   GET /api/admin/stats/overview
// @desc    Get detailed statistics overview
// @access  Private (Admin only)
router.get('/stats/overview', protect, adminOnly, async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        
        let stats;
        
        if (period === 'week') {
            stats = await Booking.getWeeklyStats(0);
        } else if (period === 'month') {
            stats = await Booking.getMonthlyStats(0);
        } else if (period === 'year') {
            const year = new Date().getFullYear();
            const bookings = await Booking.find({
                year: year
            });
            
            stats = {
                year,
                total: bookings.length,
                byMonth: {},
                byDepartment: {},
                byStatus: {}
            };
            
            // Group by month
            for (let m = 1; m <= 12; m++) {
                stats.byMonth[m] = bookings.filter(b => b.monthNumber === m).length;
            }
            
            // Department totals
            ['DS', 'AIML', 'COMP', 'IT', 'MECH'].forEach(dept => {
                stats.byDepartment[dept] = bookings.filter(b => b.department === dept).length;
            });
            
            // Status totals
            ['pending', 'current', 'verified', 'rejected'].forEach(status => {
                stats.byStatus[status] = bookings.filter(b => b.status === status).length;
            });
        }

        res.json(stats);
        
    } catch (error) {
        console.error('❌ Stats error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// @route   GET /api/admin/queue
// @desc    Get today's queue with details
// @access  Private (Admin only)
router.get('/queue', protect, adminOnly, async (req, res) => {
    try {
        console.log('📋 Loading admin queue for:', req.user.email);
        
        const today = new Date().toISOString().split('T')[0];
        const { department } = req.query;

        const query = { slotDate: today };
        if (department) {
            query.department = department;
        }

        const queue = await Booking.find(query)
            .sort({ department: 1, tokenNumber: 1 })
            .populate('userId', 'name email uniqueKey scholarId grNumber currentYear');

        const formattedQueue = queue.map(booking => ({
            id: booking._id,
            token: `${booking.department}-${String(booking.tokenNumber).padStart(3, '0')}`,
            name: booking.name,
            email: booking.email,
            department: booking.department,
            scholarId: booking.scholarId,
            grNumber: booking.grNumber,
            currentYear: booking.currentYear,
            uniqueKey: booking.uniqueKey,
            slotTime: booking.slotTime,
            status: booking.status,
            documents: {
                doc1: booking.documents.document1.status,
                doc2: booking.documents.document2.status
            },
            createdAt: booking.createdAt
        }));

        console.log(`✅ Found ${formattedQueue.length} bookings for today`);
        res.json({ queue: formattedQueue });
        
    } catch (error) {
        console.error('❌ Fetch queue error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// @route   PUT /api/admin/queue/next
// @desc    Move to next token
// @access  Private (Admin only)
router.put('/queue/next', protect, adminOnly, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { department } = req.body;

        if (!department) {
            return res.status(400).json({ message: 'Department is required' });
        }

        console.log(`➡️ Moving to next token for ${department}`);

        // Find current token and mark as verified
        const currentToken = await Booking.findOne({
            department,
            slotDate: today,
            status: 'current'
        });

        if (currentToken) {
            currentToken.status = 'verified';
            currentToken.verificationTime = new Date();
            currentToken.verifiedBy = req.user._id;
            await currentToken.save();
            console.log(`✅ Verified token: ${currentToken.tokenNumber}`);
        }

        // Find next pending token and mark as current
        const nextToken = await Booking.findOne({
            department,
            slotDate: today,
            status: 'pending'
        }).sort({ tokenNumber: 1 });

        if (nextToken) {
            nextToken.status = 'current';
            await nextToken.save();
            console.log(`✅ Now serving token: ${nextToken.tokenNumber}`);
        }

        res.json({
            message: nextToken ? 'Moved to next token' : 'Queue completed',
            previousToken: currentToken ? 
                `${currentToken.department}-${String(currentToken.tokenNumber).padStart(3, '0')}` : 
                null,
            currentToken: nextToken ? 
                `${nextToken.department}-${String(nextToken.tokenNumber).padStart(3, '0')}` : 
                null
        });
    } catch (error) {
        console.error('❌ Next token error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// @route   PUT /api/admin/queue/:bookingId/verify
// @desc    Verify a student's documents
// @access  Private (Admin only)
router.put('/queue/:bookingId/verify', protect, adminOnly, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { document1Status, document2Status, notes } = req.body;

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Update document statuses
        if (document1Status) {
            booking.documents.document1.status = document1Status;
        }
        if (document2Status) {
            booking.documents.document2.status = document2Status;
        }

        // Check if both documents are approved
        const bothApproved = booking.documents.document1.status === 'approved' && 
                            booking.documents.document2.status === 'approved';

        if (bothApproved) {
            booking.status = 'verified';
            booking.verificationTime = new Date();
            booking.verifiedBy = req.user._id;
        }

        if (notes) {
            booking.notes = notes;
        }

        await booking.save();

        res.json({
            message: 'Verification updated',
            booking: {
                id: booking._id,
                status: booking.status,
                documents: booking.documents
            }
        });
    } catch (error) {
        console.error('❌ Verify error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// @route   PUT /api/admin/users/:userId/toggle-status
// @desc    Activate/deactivate user
// @access  Private (Admin only)
router.put('/users/:userId/toggle-status', protect, adminOnly, async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.isActive = !user.isActive;
        await user.save();

        res.json({
            message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                isActive: user.isActive
            }
        });
    } catch (error) {
        console.error('❌ Toggle user status error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

module.exports = router;