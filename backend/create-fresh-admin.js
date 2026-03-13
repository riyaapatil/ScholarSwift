const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createFreshAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scholarswift');
        console.log('✅ Connected to MongoDB');
        
        const db = mongoose.connection.db;
        
        // Delete existing admin if any
        await db.collection('users').deleteMany({ userType: 'admin' });
        console.log('🗑️ Deleted existing admins');
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);
        
        // Create fresh admin with all required fields
        const admin = {
            name: 'System Admin',
            email: 'admin@scholarswift.com',
            password: hashedPassword,
            userType: 'admin',
            mobileNumber: '9999999999',
            uniqueKey: 'ADMIN-001',
            isActive: true,
            createdAt: new Date(),
            lastLogin: null
        };
        
        await db.collection('users').insertOne(admin);
        
        console.log('\n✅ Fresh admin created successfully!');
        console.log('📧 Email: admin@scholarswift.com');
        console.log('🔑 Password: admin123');
        console.log('📱 Mobile: 9999999999');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

createFreshAdmin();