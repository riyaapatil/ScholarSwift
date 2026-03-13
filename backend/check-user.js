const mongoose = require('mongoose');
require('dotenv').config();

async function checkUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scholarswift');
        console.log('✅ Connected to MongoDB');
        
        const db = mongoose.connection.db;
        
        // List all users
        const users = await db.collection('users').find({}).toArray();
        
        console.log(`\n📊 Total users: ${users.length}`);
        console.log('\n👥 All users:');
        users.forEach(user => {
            console.log(`\n---`);
            console.log(`Name: ${user.name}`);
            console.log(`Email: ${user.email}`);
            console.log(`Type: ${user.userType}`);
            console.log(`Has password: ${!!user.password}`);
            console.log(`Scholar ID: ${user.scholarId || 'N/A'}`);
            console.log(`GR Number: ${user.grNumber || 'N/A'}`);
            console.log(`Department: ${user.department || 'N/A'}`);
            console.log(`Current Year: ${user.currentYear || 'N/A'}`);
            console.log(`Scholarship Type: ${user.scholarshipType || 'N/A'}`);
            console.log(`Mobile Number: ${user.mobileNumber || 'N/A'}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkUser();