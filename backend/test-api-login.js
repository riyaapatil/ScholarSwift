const fetch = require('node-fetch');

async function testAPILogin() {
    console.log('🔍 Testing API login endpoint...');
    
    try {
        const response = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@scholarswift.com',
                password: 'admin123'
            })
        });
        
        const data = await response.json();
        
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));
        
        if (response.ok) {
            console.log('✅ API login successful!');
        } else {
            console.log('❌ API login failed:', data.message);
        }
    } catch (error) {
        console.log('❌ Network error:', error.message);
    }
}

testAPILogin();