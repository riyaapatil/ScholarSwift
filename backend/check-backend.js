const http = require('http');

console.log('🔍 Checking if backend is running...');

const req = http.get('http://localhost:5000/api/health', (res) => {
    console.log(`Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Response:', data);
        console.log('\n✅ Backend is RUNNING!');
    });
});

req.on('error', (e) => {
    console.log('❌ Backend is NOT running!');
    console.log('Error:', e.message);
    console.log('\n🔧 To start backend:');
    console.log('   cd backend');
    console.log('   npm run dev');
});

req.end();