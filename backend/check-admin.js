const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function checkAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scholarswift');
        console.log('✅ Connected to MongoDB');
        
        const db = mongoose.connection.db;
        
        // Check if admin exists
        const admin = await db.collection('users').findOne({ email: 'admin@scholarswift.com' });
        
        if (admin) {
            console.log('✅ Admin user found:');
            console.log('Name:', admin.name);
            console.log('Email:', admin.email);
            console.log('User Type:', admin.userType);
            console.log('Has Password:', !!admin.password);
            
            // Test password
            const User = require('./models/User');
            const userDoc = new User(admin);
            const isValid = await userDoc.comparePassword('admin123');
            console.log('Password "admin123" is valid:', isValid);
            
        } else {
            console.log('❌ Admin user not found!');
            
            // Create admin if not exists
            console.log('Creating admin user...');
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
            console.log('✅ Admin user created successfully');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkAdmin();