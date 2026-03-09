const mongoose = require('mongoose');
require('dotenv').config();

async function updateAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scholarswift');
        console.log('✅ Connected to MongoDB');
        
        const db = mongoose.connection.db;
        
        // Find the admin
        const admin = await db.collection('users').findOne({ email: 'admin@scholarswift.com' });
        
        if (admin) {
            console.log('📝 Found admin:', admin.email);
            
            // Add mobile number if missing
            if (!admin.mobileNumber) {
                await db.collection('users').updateOne(
                    { email: 'admin@scholarswift.com' },
                    { $set: { mobileNumber: '9999999999' } }
                );
                console.log('✅ Added mobile number to admin');
            } else {
                console.log('✅ Admin already has mobile number');
            }
            
            // Check if password is correct
            console.log('📝 Admin credentials:');
            console.log('Email: admin@scholarswift.com');
            console.log('Password: admin123');
            console.log('Mobile: 9999999999');
            
        } else {
            console.log('❌ Admin not found, creating new one...');
            
            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);
            
            const newAdmin = {
                name: 'System Admin',
                email: 'admin@scholarswift.com',
                password: hashedPassword,
                userType: 'admin',
                mobileNumber: '9999999999',
                uniqueKey: 'ADMIN-001',
                isActive: true,
                createdAt: new Date()
            };
            
            await db.collection('users').insertOne(newAdmin);
            console.log('✅ New admin created');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

updateAdmin();