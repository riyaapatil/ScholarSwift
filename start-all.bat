@echo off
echo ========================================
echo Starting ScholarSwift Application
echo ========================================
echo.

echo Step 1: Starting Backend Server...
start cmd /k "cd C:\Users\HP\OneDrive\Desktop\RIYA\ScholarSwift_02\backend && npm run dev"
timeout /t 5

echo Step 2: Starting Frontend Server...
start cmd /k "cd C:\Users\HP\OneDrive\Desktop\RIYA\ScholarSwift_02\frontend && python -m http.server 3000"
timeout /t 3

echo Step 3: Opening Browser...
start http://localhost:3000

echo.
echo ========================================
echo ✅ Application Started!
echo 📧 Admin: admin@scholarswift.com / admin123
echo ========================================