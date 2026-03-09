const fetch = require('node-fetch');

async function testSignup() {
    try {
        const response = await fetch('http://localhost:5000/api/auth/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: 'Test Student',
                email: 'test.student@example.com',
                password: 'password123',
                userType: 'student',
                department: 'DS',
                mobileNumber: '9876543210',
                currentYear: 'TE',
                joiningYear: '2022',
                grNumber: 'GR2022001',
                scholarshipType: 'Merit',
                scholarId: 'SCH2022001'
            })
        });
        
        const data = await response.json();
        console.log('Signup response:', JSON.stringify(data, null, 2));
        
        if (response.ok) {
            console.log('✅ Test signup successful!');
        } else {
            console.log('❌ Test signup failed:', data.message);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testSignup();