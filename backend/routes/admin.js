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

        // Department for today (Friday has multiple departments)
        const dayToDept = {
            1: ['DS'],
            2: ['AIML'],
            3: ['COMP'],
            4: ['IT'],
            5: ['MECH', 'CIVIL', 'AUTO']
        };
        
        const todaysDepts = dayToDept[dayOfWeek] || [];

        let todayStats = {
            total: 0,
            verified: 0,
            rejected: 0,
            pending: 0,
            current: null,
            byDepartment: {}
        };

        // Initialize department stats
        todaysDepts.forEach(dept => {
            todayStats.byDepartment[dept] = {
                total: 0,
                verified: 0,
                rejected: 0,
                pending: 0
            };
        });

        if (todaysDepts.length > 0) {
            const todayBookings = await Booking.find({
                department: { $in: todaysDepts },
                slotDate: today
            }).populate('userId', 'name email scholarId grNumber currentYear scholarshipType');

            todayStats.total = todayBookings.length;
            todayStats.verified = todayBookings.filter(b => b.status === 'verified').length;
            todayStats.rejected = todayBookings.filter(b => b.status === 'rejected').length;
            todayStats.pending = todayBookings.filter(b => b.status === 'pending').length;
            todayStats.current = todayBookings.find(b => b.status === 'current');

            // Calculate per department stats
            todayBookings.forEach(booking => {
                if (todayStats.byDepartment[booking.department]) {
                    todayStats.byDepartment[booking.department].total++;
                    if (booking.status === 'verified') todayStats.byDepartment[booking.department].verified++;
                    else if (booking.status === 'rejected') todayStats.byDepartment[booking.department].rejected++;
                    else if (booking.status === 'pending') todayStats.byDepartment[booking.department].pending++;
                }
            });
        }

        // Get weekly stats (all departments)
        const weeklyStats = await Booking.getWeeklyStats(0);
        
        // Get monthly stats (all departments)
        const monthlyStats = await Booking.getMonthlyStats(0);

        const response = {
            today: {
                departments: todaysDepts,
                total: todayStats.total,
                verified: todayStats.verified,
                rejected: todayStats.rejected,
                pending: todayStats.pending,
                currentToken: todayStats.current ? 
                    `${todayStats.current.department}-${String(todayStats.current.tokenNumber).padStart(3, '0')}` : 
                    null,
                currentBooking: todayStats.current,
                byDepartment: todayStats.byDepartment
            },
            weekly: weeklyStats,
            monthly: monthlyStats,
            totalStudents: await User.countDocuments({ userType: 'student' }),
            totalAdmins: await User.countDocuments({ userType: 'admin' })
        };
        
        console.log('✅ Dashboard data loaded');
        res.json(response);
        
    } catch (error) {
        console.error('❌ Dashboard error:', error);
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
        const { department, date } = req.query;

        const queryDate = date || today;
        const query = { slotDate: queryDate };
        
        if (department) {
            query.department = department;
        }

        console.log(`🔍 Fetching bookings for date: ${queryDate}`);

        const queue = await Booking.find(query)
            .sort({ department: 1, tokenNumber: 1 })
            .populate('userId', 'name email uniqueKey scholarId grNumber currentYear mobileNumber scholarshipType');

        console.log(`✅ Found ${queue.length} bookings for ${queryDate}`);

        const formattedQueue = queue.map(booking => ({
            id: booking._id,
            token: `${booking.department}-${String(booking.tokenNumber).padStart(3, '0')}`,
            name: booking.name,
            email: booking.email,
            department: booking.department,
            scholarId: booking.scholarId,
            grNumber: booking.grNumber,
            currentYear: booking.currentYear,
            scholarshipType: booking.scholarshipType,
            mobileNumber: booking.userId?.mobileNumber || 'N/A',
            uniqueKey: booking.uniqueKey,
            slotTime: booking.slotTime,
            slotDate: booking.slotDate,
            status: booking.status,
            documents: Object.fromEntries(booking.documents || new Map()),
            canRebook: booking.canRebook,
            createdAt: booking.createdAt
        }));

        res.json({ queue: formattedQueue });
        
    } catch (error) {
        console.error('❌ Fetch queue error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// @route   GET /api/admin/queue/:bookingId
// @desc    Get specific booking details for verification
// @access  Private (Admin only)
router.get('/queue/:bookingId', protect, adminOnly, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId)
            .populate('userId', 'name email mobileNumber department currentYear joiningYear grNumber scholarshipType scholarId uniqueKey');
        
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Get required documents based on scholarship type
        const requiredDocs = booking.getRequiredDocuments();
        
        // Format documents with display names
        const documents = {};
        requiredDocs.forEach(docId => {
            const docName = getDocumentName(docId);
            documents[docId] = {
                name: docName,
                status: booking.documents?.get(docId)?.status || 'pending',
                verifiedAt: booking.documents?.get(docId)?.verifiedAt,
                notes: booking.documents?.get(docId)?.notes
            };
        });

        res.json({
            booking: {
                id: booking._id,
                token: `${booking.department}-${String(booking.tokenNumber).padStart(3, '0')}`,
                student: booking.userId,
                slotDate: booking.slotDate,
                slotTime: booking.slotTime,
                status: booking.status,
                documents,
                scholarshipType: booking.scholarshipType
            }
        });
        
    } catch (error) {
        console.error('❌ Fetch booking error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Helper function to get document display names
function getDocumentName(docId) {
    const names = {
        'aadhar': 'Aadhar Card',
        'domicile': 'Domicile Certificate',
        'income': 'Income Certificate',
        'ssc': 'SSC Marksheet',
        'hsc': 'HSC Marksheet',
        'previousYear': 'Previous Year/Semester Marksheet',
        'feeReceipt': 'College Fee Receipt',
        'capLetter': 'CAP Allotment Letter',
        'bankPassbook': 'Bank Passbook',
        'bonafide': 'College Bonafide Certificate',
        'leaving': 'Leaving Certificate',
        'selfDeclaration': 'Self Declaration',
        'caste': 'Caste Certificate',
        'casteValidity': 'Caste Validity Certificate',
        'nonCreamy': 'Non-Creamy Layer Certificate'
    };
    return names[docId] || docId;
}

// @route   PUT /api/admin/queue/:bookingId/verify
// @desc    Verify documents for a student
// @access  Private (Admin only)
router.put('/queue/:bookingId/verify', protect, adminOnly, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { documents, status, notes } = req.body;

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Update document statuses
        if (documents) {
            Object.keys(documents).forEach(docId => {
                const docStatus = documents[docId];
                if (!booking.documents) {
                    booking.documents = new Map();
                }
                booking.documents.set(docId, {
                    name: getDocumentName(docId),
                    status: docStatus,
                    verifiedAt: docStatus === 'approved' || docStatus === 'rejected' ? new Date() : null,
                    verifiedBy: docStatus === 'approved' || docStatus === 'rejected' ? req.user._id : null
                });
            });
        }

        // Check if all required documents are approved
        const requiredDocs = booking.getRequiredDocuments();
        let allApproved = true;
        let anyRejected = false;

        requiredDocs.forEach(docId => {
            const doc = booking.documents?.get(docId);
            if (!doc || doc.status !== 'approved') {
                allApproved = false;
            }
            if (doc && doc.status === 'rejected') {
                anyRejected = true;
            }
        });

        // Update booking status based on document verification
        if (status) {
            booking.status = status;
            booking.verificationTime = new Date();
            booking.verifiedBy = req.user._id;
            
            // If rejected, allow rebooking
            if (status === 'rejected') {
                booking.canRebook = true;
            } else if (status === 'verified') {
                booking.canRebook = false;
            }
        } else if (allApproved) {
            booking.status = 'verified';
            booking.verificationTime = new Date();
            booking.verifiedBy = req.user._id;
            booking.canRebook = false;
        } else if (anyRejected) {
            booking.status = 'rejected';
            booking.verificationTime = new Date();
            booking.verifiedBy = req.user._id;
            booking.canRebook = true;
        }

        if (notes) {
            booking.notes = notes;
        }

        await booking.save();

        res.json({
            message: 'Verification updated successfully',
            booking: {
                id: booking._id,
                status: booking.status,
                documents: Object.fromEntries(booking.documents || new Map()),
                canRebook: booking.canRebook
            }
        });
        
    } catch (error) {
        console.error('❌ Verify error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// @route   GET /api/admin/stats
// @desc    Get statistics with department filter
// @access  Private (Admin only)
router.get('/stats', protect, adminOnly, async (req, res) => {
    try {
        const { department = 'all', period = 'week' } = req.query;

        let stats;
        if (period === 'week') {
            stats = await Booking.getWeeklyStats(0, department);
        } else if (period === 'month') {
            stats = await Booking.getMonthlyStats(0, department);
        }

        // Get department-wise breakdown for the period
        const query = {};
        if (period === 'week') {
            const today = new Date();
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay() + 1);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            
            const startStr = startOfWeek.toISOString().split('T')[0];
            const endStr = endOfWeek.toISOString().split('T')[0];
            
            query.slotDate = { $gte: startStr, $lte: endStr };
        } else if (period === 'month') {
            const today = new Date();
            const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
            query.slotDate = { $regex: `^${monthStr}` };
        }

        const allBookings = await Booking.find(query);
        
        const departmentStats = {};
        const departments = ['DS', 'AIML', 'COMP', 'IT', 'MECH', 'CIVIL', 'AUTO'];
        
        departments.forEach(dept => {
            const deptBookings = allBookings.filter(b => b.department === dept);
            departmentStats[dept] = {
                total: deptBookings.length,
                verified: deptBookings.filter(b => b.status === 'verified').length,
                rejected: deptBookings.filter(b => b.status === 'rejected').length,
                pending: deptBookings.filter(b => b.status === 'pending').length,
                current: deptBookings.filter(b => b.status === 'current').length
            };
        });

        res.json({
            period,
            department,
            stats,
            departmentStats
        });
        
    } catch (error) {
        console.error('❌ Stats error:', error);
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
            status: 'pending',
            canRebook: true
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

module.exports = router;