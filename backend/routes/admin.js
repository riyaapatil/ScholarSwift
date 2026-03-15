const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

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
            5: ['MECH', 'CIVIL', 'AUTO'],
            6: ['SAT'],
            0: ['SUN']
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
            documents: booking.documents instanceof Map ? Object.fromEntries(booking.documents) : (booking.documents || {}),
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
            const docData = booking.documents instanceof Map 
                ? booking.documents.get(docId) 
                : (booking.documents ? booking.documents[docId] : null);
                
            documents[docId] = {
                name: docName,
                status: docData?.status || 'pending',
                verifiedAt: docData?.verifiedAt,
                notes: docData?.notes
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

        // Initialize documents Map if needed
        if (!booking.documents) {
            booking.documents = new Map();
        }

        // Update document statuses
        if (documents) {
            Object.keys(documents).forEach(docId => {
                const docStatus = documents[docId];
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
            const doc = booking.documents.get(docId);
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

        // Convert Map to object for response
        const documentsObj = {};
        booking.documents.forEach((value, key) => {
            documentsObj[key] = value;
        });

        res.json({
            message: 'Verification updated successfully',
            booking: {
                id: booking._id,
                status: booking.status,
                documents: documentsObj,
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
        const departments = ['DS', 'AIML', 'COMP', 'IT', 'MECH', 'CIVIL', 'AUTO', 'SAT', 'SUN'];
        
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

// ==================== STUDENT ROUTES - ORDER MATTERS! ====================

// @route   GET /api/admin/students/all - THIS MUST COME FIRST (before /students/:id)
router.get('/students/all', protect, adminOnly, async (req, res) => {
    try {
        const { department, page = 1, limit = 50 } = req.query;
        
        console.log('📥 Students all request - Query params:', { department, page, limit });
        
        // Build query - filter by userType
        const query = { userType: 'student' };
        
        // Add department filter ONLY if it's a valid department code
        const validDepartments = ['DS', 'AIML', 'COMP', 'IT', 'MECH', 'CIVIL', 'AUTO', 'SAT', 'SUN'];
        
        if (department && department !== 'all' && department !== 'undefined' && department !== 'null') {
            if (validDepartments.includes(department)) {
                query.department = department;
                console.log('🔍 Filtering by department:', department);
            }
        }
        
        console.log('📊 Final MongoDB query:', JSON.stringify(query));
        
        // Get students with pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const students = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        console.log(`✅ Found ${students.length} students`);
        
        // Get total count for pagination
        const total = await User.countDocuments(query);
        
        // For each student, get their booking history and document status
        const studentsWithDetails = await Promise.all(students.map(async (student) => {
            const bookings = await Booking.find({ userId: student._id })
                .sort({ createdAt: -1 });
            
            // Get the most recent booking's document status
            const latestBooking = bookings.length > 0 ? bookings[0] : null;
            
            // Compile document status from all bookings
            const documentStatus = {};
            
            bookings.forEach(booking => {
                if (booking.documents) {
                    // Handle both Map and regular object
                    let docs = booking.documents;
                    if (docs instanceof Map) {
                        docs = Object.fromEntries(docs);
                    }
                    
                    if (typeof docs === 'object') {
                        Object.keys(docs).forEach(key => {
                            if (!documentStatus[key] || 
                                (docs[key].status === 'approved' && documentStatus[key] !== 'approved')) {
                                documentStatus[key] = docs[key].status;
                            }
                        });
                    }
                }
            });
            
            return {
                id: student._id,
                name: student.name,
                email: student.email,
                mobileNumber: student.mobileNumber,
                department: student.department,
                currentYear: student.currentYear,
                joiningYear: student.joiningYear,
                grNumber: student.grNumber,
                scholarshipType: student.scholarshipType,
                scholarId: student.scholarId,
                uniqueKey: student.uniqueKey,
                isActive: student.isActive,
                createdAt: student.createdAt,
                lastLogin: student.lastLogin,
                totalBookings: bookings.length,
                latestBooking: latestBooking ? {
                    date: latestBooking.slotDate,
                    time: latestBooking.slotTime,
                    token: `${latestBooking.department}-${String(latestBooking.tokenNumber).padStart(3, '0')}`,
                    status: latestBooking.status
                } : null,
                documentStatus: documentStatus
            };
        }));
        
        res.json({
            students: studentsWithDetails,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('❌ Fetch all students error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// @route   GET /api/admin/students/search - THIS COMES SECOND
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

// @route   GET /api/admin/students/:id - THIS COMES LAST
router.get('/students/:id', protect, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Validate that id is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid student ID format' });
        }

        const student = await User.findOne({
            _id: id,
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

// @route   PUT /api/admin/students/:id
// @desc    Update student record
// @access  Private (Admin only)
router.put('/students/:id', protect, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Validate that id is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid student ID format' });
        }
        
        const updates = req.body;
        
        // Remove fields that shouldn't be updated
        delete updates._id;
        delete updates.id;
        delete updates.password;
        delete updates.scholarId;
        delete updates.uniqueKey;
        delete updates.userType;
        delete updates.createdAt;
        
        const student = await User.findOneAndUpdate(
            { _id: id, userType: 'student' },
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-password');
        
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }
        
        res.json({
            message: 'Student updated successfully',
            student
        });
        
    } catch (error) {
        console.error('❌ Update student error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

module.exports = router;