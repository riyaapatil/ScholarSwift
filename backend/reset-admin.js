const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function resetAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scholarswift');
        console.log('✅ Connected to MongoDB');
        
        const db = mongoose.connection.db;
        
        // Delete existing admin
        await db.collection('users').deleteOne({ email: 'admin@scholarswift.com' });
        console.log('🗑️ Deleted existing admin');
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);
        
        // Create new admin with all required fields
        const newAdmin = {
            name: 'System Admin',
            email: 'admin@scholarswift.com',
            password: hashedPassword,
            userType: 'admin',
            mobileNumber: '9999999999',  // Added required mobile number
            uniqueKey: 'ADMIN-001',
            isActive: true,
            createdAt: new Date(),
            lastLogin: null
        };
        
        await db.collection('users').insertOne(newAdmin);
        console.log('✅ New admin created with all required fields');
        console.log('📧 Email: admin@scholarswift.com');
        console.log('🔑 Password: admin123');
        console.log('📱 Mobile: 9999999999');
        
        // Verify the admin was created
        const verifyAdmin = await db.collection('users').findOne({ email: 'admin@scholarswift.com' });
        if (verifyAdmin) {
            console.log('✅ Verification: Admin exists with fields:');
            console.log('   - Name:', verifyAdmin.name);
            console.log('   - Email:', verifyAdmin.email);
            console.log('   - Mobile:', verifyAdmin.mobileNumber);
            console.log('   - Type:', verifyAdmin.userType);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

resetAdmin();