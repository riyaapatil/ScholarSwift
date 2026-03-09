const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scholarswift', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        
        // Create indexes.
        
        await createIndexes();
        
        return conn;
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
};

const createIndexes = async () => {
    try {
        const db = mongoose.connection;
        
        // Create unique indexes
        await db.collection('users').createIndex({ email: 1 }, { unique: true });
        await db.collection('users').createIndex({ uniqueKey: 1 }, { unique: true });
        await db.collection('bookings').createIndex({ tokenNumber: 1, department: 1, slotDate: 1 }, { unique: true });
        
        console.log('📊 Database indexes created');
    } catch (error) {
        console.error('Error creating indexes:', error);
    }
};

module.exports = connectDB;