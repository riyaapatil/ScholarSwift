const mongoose = require('mongoose');

// Document verification schema
const documentSchema = new mongoose.Schema({
    name: String,
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'not_required'],
        default: 'pending'
    },
    verifiedAt: Date,
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    notes: String
}, { _id: false });

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
        enum: ['DS', 'AIML', 'COMP', 'IT', 'MECH', 'CIVIL', 'AUTO'],
        required: true
    },
    scholarId: {
        type: String,
        required: true
    },
    grNumber: {
        type: String,
        required: true
    },
    currentYear: {
        type: String,
        enum: ['FE', 'SE', 'TE', 'BE'],
        required: true
    },
    scholarshipType: {
        type: String,
        enum: ['SC', 'ST', 'OBC', 'EBC', 'Other'],
        required: true
    },
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
    
    // Document verification
    documents: {
        type: Map,
        of: documentSchema,
        default: new Map()
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
    
    // Track if student was rejected (to allow rebooking)
    canRebook: {
        type: Boolean,
        default: true
    },
    
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
        status: { $nin: ['rejected', 'no-show'] }
    });
    return count + 1;
};

// Calculate estimated wait time
bookingSchema.methods.getEstimatedWaitTime = function() {
    const baseTime = 7;
    return this.tokenNumber * baseTime;
};

// Get document checklist based on scholarship type
bookingSchema.methods.getRequiredDocuments = function() {
    const baseDocuments = [
        'aadhar', 'domicile', 'income', 'ssc', 'hsc', 'previousYear',
        'feeReceipt', 'capLetter', 'bankPassbook', 'bonafide', 'leaving', 'selfDeclaration'
    ];

    if (this.scholarshipType === 'SC' || this.scholarshipType === 'ST') {
        return [...baseDocuments, 'caste', 'casteValidity'];
    } else if (this.scholarshipType === 'OBC') {
        return [...baseDocuments, 'caste', 'casteValidity', 'nonCreamy'];
    } else {
        return baseDocuments;
    }
};

// Initialize documents for a booking
bookingSchema.methods.initializeDocuments = function() {
    const requiredDocs = this.getRequiredDocuments();
    const documents = new Map();
    
    requiredDocs.forEach(docId => {
        documents.set(docId, {
            name: getDocumentName(docId),
            status: 'pending'
        });
    });
    
    this.documents = documents;
};

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

// Get weekly stats
bookingSchema.statics.getWeeklyStats = async function(weekOffset = 0, department = null) {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1 - (weekOffset * 7));
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    const startStr = startOfWeek.toISOString().split('T')[0];
    const endStr = endOfWeek.toISOString().split('T')[0];
    
    const query = {
        slotDate: { $gte: startStr, $lte: endStr }
    };
    
    if (department && department !== 'all') {
        query.department = department;
    }
    
    const bookings = await this.find(query);
    
    return {
        weekStart: startStr,
        weekEnd: endStr,
        total: bookings.length,
        verified: bookings.filter(b => b.status === 'verified').length,
        rejected: bookings.filter(b => b.status === 'rejected').length,
        pending: bookings.filter(b => b.status === 'pending').length,
        current: bookings.filter(b => b.status === 'current').length
    };
};

// Get monthly stats
bookingSchema.statics.getMonthlyStats = async function(monthOffset = 0, department = null) {
    const today = new Date();
    const targetMonth = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
    const year = targetMonth.getFullYear();
    const month = targetMonth.getMonth() + 1;
    
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    
    const query = {
        slotDate: { $regex: `^${monthStr}` }
    };
    
    if (department && department !== 'all') {
        query.department = department;
    }
    
    const bookings = await this.find(query);
    
    return {
        year,
        month,
        monthName: targetMonth.toLocaleString('default', { month: 'long' }),
        total: bookings.length,
        verified: bookings.filter(b => b.status === 'verified').length,
        rejected: bookings.filter(b => b.status === 'rejected').length,
        pending: bookings.filter(b => b.status === 'pending').length,
        current: bookings.filter(b => b.status === 'current').length
    };
};

module.exports = mongoose.model('Booking', bookingSchema);