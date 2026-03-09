const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    // Basic Auth Info
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    userType: {
        type: String,
        enum: ['student', 'admin'],
        required: true
    },
    
    // Mobile Number (for both students and admins)
    mobileNumber: {
        type: String,
        required: true,
        trim: true,
        validate: {
            validator: function(v) {
                return /^[0-9]{10}$/.test(v);
            },
            message: 'Please enter a valid 10-digit mobile number'
        }
    },
    
    // Student Profile Fields (only for students)
    department: {
        type: String,
        enum: ['DS', 'AIML', 'COMP', 'IT', 'MECH'],
        required: function() {
            return this.userType === 'student';
        }
    },
    currentYear: {
        type: String,
        enum: ['FE', 'SE', 'TE', 'BE'],
        required: function() {
            return this.userType === 'student';
        }
    },
    joiningYear: {
        type: String,
        required: function() {
            return this.userType === 'student';
        },
        validate: {
            validator: function(v) {
                return this.userType === 'admin' || /^\d{4}$/.test(v);
            },
            message: 'Joining year must be a valid year (YYYY)'
        }
    },
    grNumber: {
        type: String,
        required: function() {
            return this.userType === 'student';
        },
        unique: true,
        sparse: true,
        trim: true
    },
    scholarshipType: {
        type: String,
        required: function() {
            return this.userType === 'student';
        },
        enum: ['Merit', 'Need-based', 'Sports', 'Research', 'Minority', 'Other']
    },
    scholarId: {
        type: String,
        unique: true,
        sparse: true,
        trim: true
    },
    
    // System Fields
    uniqueKey: {
        type: String,
        unique: true,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Generate unique key for display (like DS-001)
userSchema.statics.generateUniqueKey = async function(department, userType) {
    if (userType === 'admin') {
        const adminCount = await this.countDocuments({ userType: 'admin' });
        return `ADMIN-${String(adminCount + 1).padStart(3, '0')}`;
    } else {
        const deptCount = await this.countDocuments({ 
            department, 
            userType: 'student' 
        });
        return `${department}-${String(deptCount + 1).padStart(3, '0')}`;
    }
};

// Generate unique Scholar ID
userSchema.statics.generateScholarId = async function(department, joiningYear) {
    const year = joiningYear || new Date().getFullYear();
    const count = await this.countDocuments({ 
        userType: 'student',
        joiningYear: year,
        department 
    });
    
    // Format: DS-2024-001, AIML-2024-001, etc.
    return `${department}-${year}-${String(count + 1).padStart(3, '0')}`;
};

module.exports = mongoose.model('User', userSchema);