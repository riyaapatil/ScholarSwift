const mongoose = require('mongoose');

async function checkDatabase() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/scholarswift');
        console.log('✅ Connected to MongoDB successfully');
        
        const db = mongoose.connection.db;
        
        // List all collections
        const collections = await db.listCollections().toArray();
        console.log('\n📚 Collections in database:');
        if (collections.length === 0) {
            console.log('   No collections found - database is empty');
        } else {
            collections.forEach(col => console.log(`   - ${col.name}`));
        }
        
        // Check users collection
        const users = await db.collection('users').find({}).toArray();
        console.log(`\n👥 Users found: ${users.length}`);
        users.forEach(user => {
            console.log(`   - ${user.email} (${user.userType})`);
        });
        
        // Check bookings collection
        const bookings = await db.collection('bookings').find({}).toArray();
        console.log(`\n📅 Bookings found: ${bookings.length}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Database check failed:', error.message);
        process.exit(1);
    }
}

checkDatabase();