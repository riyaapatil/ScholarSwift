const mongoose = require('mongoose');
require('dotenv').config();

async function clearDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scholarswift');
        console.log('✅ Connected to MongoDB');
        
        const db = mongoose.connection.db;
        
        // Drop all collections
        const collections = await db.listCollections().toArray();
        
        for (const collection of collections) {
            await db.collection(collection.name).drop();
            console.log(`🗑️ Dropped collection: ${collection.name}`);
        }
        
        console.log('\n✅ All collections dropped successfully!');
        console.log('📝 Database is now clean. You can restart your application.');
        console.log('\n🔧 Next steps:');
        console.log('1. Restart your backend: npm run dev');
        console.log('2. Create a new admin user');
        console.log('3. Register new students with updated scholarship types');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error clearing database:', error);
        process.exit(1);
    }
}

clearDatabase();