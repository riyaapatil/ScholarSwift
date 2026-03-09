const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scholarswift');
        console.log('✅ Connected to MongoDB');
        
        const db = mongoose.connection.db;
        
        // Check if admin exists
        const adminExists = await db.collection('users').findOne({ email: 'admin@scholarswift.com' });
        
        if (!adminExists) {
            // Hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);
            
            // Create admin
            const admin = {
                name: 'System Admin',
                email: 'admin@scholarswift.com',
                password: hashedPassword,
                userType: 'admin',
                uniqueKey: 'ADMIN-001',
                isActive: true,
                createdAt: new Date()
            };
            
            await db.collection('users').insertOne(admin);
            console.log('✅ Admin user created successfully');
            console.log('Email: admin@scholarswift.com');
            console.log('Password: admin123');
        } else {
            console.log('✅ Admin user already exists');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

createAdmin();