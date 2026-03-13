const fetch = require('node-fetch');

async function testSignup() {
    const testUser = {
        name: 'Test Student',
        email: 'test.student@example.com',
        password: 'password123',
        userType: 'student',
        mobileNumber: '9876543210',
        department: 'DS',
        currentYear: 'TE',
        joiningYear: '2023',
        grNumber: 'GR2024001',
        scholarshipType: 'SC'  // Using one of the new types
    };
    
    console.log('📝 Testing signup with:', testUser);
    
    try {
        const response = await fetch('http://localhost:5000/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });
        
        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));
        
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

testSignup();