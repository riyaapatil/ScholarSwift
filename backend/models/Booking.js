const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    department: {
        type: String,
        enum: ['DS', 'AIML', 'COMP', 'IT', 'MECH'],
        required: true
    },
    // REMOVED: currentYear, grNumber, scholarId - these come from User model
    uniqueKey: {
        type: String,
        required: true
    },
    slotDate: {
        type: String,
        required: true
    },
    slotTime: {
        type: String,
        required: true
    },
    tokenNumber: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'current', 'verified', 'rejected', 'no-show'],
        default: 'pending'
    },
    documents: {
        document1: {
            status: {
                type: String,
                enum: ['pending', 'approved', 'rejected'],
                default: 'pending'
            },
            notes: String
        },
        document2: {
            status: {
                type: String,
                enum: ['pending', 'approved', 'rejected'],
                default: 'pending'
            },
            notes: String
        }
    },
    verificationTime: {
        type: Date
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    rejectionReason: String,
    notes: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    weekNumber: {
        type: Number,
        default: function() {
            const date = new Date(this.slotDate);
            const startDate = new Date(date.getFullYear(), 0, 1);
            const days = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
            return Math.ceil((days + startDate.getDay() + 1) / 7);
        }
    },
    monthNumber: {
        type: Number,
        default: function() {
            return new Date(this.slotDate).getMonth() + 1;
        }
    },
    year: {
        type: Number,
        default: function() {
            return new Date(this.slotDate).getFullYear();
        }
    }
});

// Update timestamp on save
bookingSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Generate token number
bookingSchema.statics.generateTokenNumber = async function(department, slotDate) {
    const count = await this.countDocuments({ 
        department, 
        slotDate,
        status: { $ne: 'rejected' }
    });
    return count + 1;
};

// Calculate estimated wait time
bookingSchema.methods.getEstimatedWaitTime = function() {
    const baseTime = 7; // 7 minutes per token
    return this.tokenNumber * baseTime;
};

// Get weekly stats
bookingSchema.statics.getWeeklyStats = async function(weekOffset = 0) {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1 - (weekOffset * 7));
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    const startStr = startOfWeek.toISOString().split('T')[0];
    const endStr = endOfWeek.toISOString().split('T')[0];
    
    const bookings = await this.find({
        slotDate: { $gte: startStr, $lte: endStr }
    });
    
    return {
        weekStart: startStr,
        weekEnd: endStr,
        total: bookings.length,
        byDepartment: {
            DS: bookings.filter(b => b.department === 'DS').length,
            AIML: bookings.filter(b => b.department === 'AIML').length,
            COMP: bookings.filter(b => b.department === 'COMP').length,
            IT: bookings.filter(b => b.department === 'IT').length,
            MECH: bookings.filter(b => b.department === 'MECH').length
        },
        byStatus: {
            pending: bookings.filter(b => b.status === 'pending').length,
            current: bookings.filter(b => b.status === 'current').length,
            verified: bookings.filter(b => b.status === 'verified').length,
            rejected: bookings.filter(b => b.status === 'rejected').length
        },
        byDay: {
            Monday: bookings.filter(b => new Date(b.slotDate).getDay() === 1).length,
            Tuesday: bookings.filter(b => new Date(b.slotDate).getDay() === 2).length,
            Wednesday: bookings.filter(b => new Date(b.slotDate).getDay() === 3).length,
            Thursday: bookings.filter(b => new Date(b.slotDate).getDay() === 4).length,
            Friday: bookings.filter(b => new Date(b.slotDate).getDay() === 5).length
        }
    };
};

// Get monthly stats
bookingSchema.statics.getMonthlyStats = async function(monthOffset = 0) {
    const today = new Date();
    const targetMonth = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
    const year = targetMonth.getFullYear();
    const month = targetMonth.getMonth() + 1;
    
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    
    const bookings = await this.find({
        slotDate: { $regex: `^${monthStr}` }
    });
    
    return {
        year,
        month,
        monthName: targetMonth.toLocaleString('default', { month: 'long' }),
        total: bookings.length,
        byDepartment: {
            DS: bookings.filter(b => b.department === 'DS').length,
            AIML: bookings.filter(b => b.department === 'AIML').length,
            COMP: bookings.filter(b => b.department === 'COMP').length,
            IT: bookings.filter(b => b.department === 'IT').length,
            MECH: bookings.filter(b => b.department === 'MECH').length
        },
        byStatus: {
            pending: bookings.filter(b => b.status === 'pending').length,
            current: bookings.filter(b => b.status === 'current').length,
            verified: bookings.filter(b => b.status === 'verified').length,
            rejected: bookings.filter(b => b.status === 'rejected').length
        }
    };
};

module.exports = mongoose.model('Booking', bookingSchema);