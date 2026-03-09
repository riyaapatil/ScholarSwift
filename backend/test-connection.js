const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
    try {
        console.log('🔍 Testing MongoDB connection...');
        console.log('URI:', process.env.MONGODB_URI || 'mongodb://localhost:27017/scholarswift');
        
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scholarswift');
        console.log('✅ MongoDB connected successfully');
        
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        console.log('📚 Collections:', collections.map(c => c.name));
        
        process.exit(0);
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        process.exit(1);
    }
}

testConnection();