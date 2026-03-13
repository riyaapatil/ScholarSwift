const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function testLogin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scholarswift');
        console.log('✅ Connected to MongoDB');
        
        const db = mongoose.connection.db;
        
        // Find admin
        const admin = await db.collection('users').findOne({ email: 'admin@scholarswift.com' });
        
        if (!admin) {
            console.log('❌ Admin not found in database');
            process.exit(1);
        }
        
        console.log('✅ Admin found:', admin.email);
        console.log('Stored password hash:', admin.password);
        
        // Test password
        const testPassword = 'admin123';
        const isValid = await bcrypt.compare(testPassword, admin.password);
        
        console.log(`\n🔐 Password test: "${testPassword}"`);
        console.log(`Result: ${isValid ? '✅ CORRECT' : '❌ INCORRECT'}`);
        
        if (!isValid) {
            // Create new admin with proper password
            console.log('\n🔄 Creating new admin with fresh password...');
            
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);
            
            await db.collection('users').deleteOne({ email: 'admin@scholarswift.com' });
            
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
            console.log('✅ Fresh admin created with proper password hash');
            
            // Test again
            const testAgain = await bcrypt.compare('admin123', hashedPassword);
            console.log(`New password test: ${testAgain ? '✅ CORRECT' : '❌ INCORRECT'}`);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

testLogin();