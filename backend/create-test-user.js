const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function createTestUser() {
    try {
        await mongoose.connect('mongodb://localhost:27017/scholarswift');
        console.log('✅ Connected to MongoDB');
        
        const db = mongoose.connection.db;
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);
        
        // Create admin user
        const adminUser = {
            name: 'Admin User',
            email: 'admin@scholarswift.com',
            password: hashedPassword,
            userType: 'admin',
            uniqueKey: 'ADMIN-001',
            isActive: true,
            createdAt: new Date()
        };
        
        // Delete if exists
        await db.collection('users').deleteOne({ email: 'admin@scholarswift.com' });
        
        // Insert new user
        const result = await db.collection('users').insertOne(adminUser);
        
        console.log('✅ Admin user created successfully:');
        console.log('   Email: admin@scholarswift.com');
        console.log('   Password: admin123');
        console.log('   User ID:', result.insertedId);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

createTestUser();