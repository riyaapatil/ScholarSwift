/**
 * ScholarSwift Main Application Logic
 * Smart Queue Management System
 * Full Backend Integration
 */

// ==================== CONFIG & STATE ====================
const API_BASE_URL = 'http://localhost:5000/api';
let token = localStorage.getItem('token');
let currentUser = null;
let userType = 'student';
let authMode = 'login';
let isPaused = false;

// Department to day mapping
const deptToDay = {
    'DS': { day: 1, name: 'Monday', fullName: 'Data Science' },
    'AIML': { day: 2, name: 'Tuesday', fullName: 'AI & Machine Learning' },
    'COMP': { day: 3, name: 'Wednesday', fullName: 'Computer Engineering' },
    'IT': { day: 4, name: 'Thursday', fullName: 'Information Technology' },
    'MECH': { day: 5, name: 'Friday', fullName: 'Mechanical Engineering' }
};

// ==================== API HELPER FUNCTIONS ====================
async function apiRequest(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'API request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ==================== SDK INITIALIZATION ====================
async function initApp() {
    // Initialize Element SDK
    if (window.elementSdk) {
        window.elementSdk.init({
            defaultConfig: {
                app_title: 'ScholarSwift',
                tagline: 'Smart Queue Management System'
            },
            onConfigChange: async (newConfig) => {
                applyConfig(newConfig);
            }
        });
    }
    
    // Initialize Data SDK (optional, can be removed if not needed)
    if (window.dataSdk) {
        await window.dataSdk.init({
            onDataChanged(data) {
                console.log('Data changed:', data);
            }
        });
    }
    
    // Check for saved session
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    
    if (savedUser && savedToken) {
        try {
            token = savedToken;
            const response = await apiRequest('/auth/me');
            currentUser = response.user;
            
            if (currentUser.userType === 'student') {
                showStudentDashboard();
            } else {
                showAdminDashboard();
            }
        } catch (error) {
            // Token expired or invalid
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            token = null;
        }
    }
    
    // Generate initial time slots
    generateTimeSlots();
    setMinDate();
    applyConfig();
    
    console.log('🚀 ScholarSwift initialized with backend');
}

function applyConfig(config) {
    const titleEl = document.getElementById('appTitle');
    const taglineEl = document.getElementById('appTagline');
    
    if (titleEl) titleEl.textContent = config?.app_title || 'ScholarSwift';
    if (taglineEl) taglineEl.textContent = config?.tagline || 'Smart Queue Management System';
}

// ==================== AUTH FUNCTIONS ====================
function setUserType(type) {
    userType = type;
    const studentBtn = document.getElementById('studentToggle');
    const adminBtn = document.getElementById('adminToggle');
    
    if (type === 'student') {
        studentBtn.className = 'flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 bg-emerald-500 text-white';
        adminBtn.className = 'flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 text-slate-400 hover:text-white';
    } else {
        adminBtn.className = 'flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 bg-violet-500 text-white';
        studentBtn.className = 'flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 text-slate-400 hover:text-white';
    }
    updateFormFields();
}

function setAuthMode(mode) {
    authMode = mode;
    const loginTab = document.getElementById('loginTab');
    const signupTab = document.getElementById('signupTab');
    const submitBtn = document.getElementById('authSubmit');
    
    if (mode === 'login') {
        loginTab.className = 'flex-1 py-2.5 rounded-md font-medium transition-all bg-white shadow text-slate-800';
        signupTab.className = 'flex-1 py-2.5 rounded-md font-medium transition-all text-slate-500';
        submitBtn.textContent = 'Sign In';
    } else {
        signupTab.className = 'flex-1 py-2.5 rounded-md font-medium transition-all bg-white shadow text-slate-800';
        loginTab.className = 'flex-1 py-2.5 rounded-md font-medium transition-all text-slate-500';
        submitBtn.textContent = 'Create Account';
    }
    updateFormFields();
}

function updateFormFields() {
    const deptField = document.getElementById('deptField');
    const nameField = document.getElementById('nameField');
    const studentProfileFields = document.getElementById('studentProfileFields');
    
    if (authMode === 'signup') {
        nameField.classList.remove('hidden');
        if (userType === 'student') {
            deptField.classList.remove('hidden');
            studentProfileFields.classList.remove('hidden');
            // Make sure password field is visible and required for students
            document.getElementById('passwordInput').required = true;
            document.getElementById('passwordInput').placeholder = '•••••••• (min 6 characters)';
        } else {
            deptField.classList.add('hidden');
            studentProfileFields.classList.add('hidden');
            // For admin, show that default password will be used
            document.getElementById('passwordInput').required = false;
            document.getElementById('passwordInput').placeholder = 'Optional - default: admin123';
            document.getElementById('passwordInput').value = '';
        }
    } else {
        nameField.classList.add('hidden');
        deptField.classList.add('hidden');
        studentProfileFields.classList.add('hidden');
        document.getElementById('passwordInput').required = true;
        document.getElementById('passwordInput').placeholder = '••••••••';
    }
}

async function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    const name = document.getElementById('nameInput').value;
    const deptSelect = document.getElementById('deptSelect');
    const dept = deptSelect ? deptSelect.value : '';
    
    // Mobile number (required for both)
    const mobileNumber = document.getElementById('mobileNumber')?.value || '';
    
    // Student fields
    const currentYear = document.getElementById('currentYear')?.value || '';
    const joiningYear = document.getElementById('joiningYear')?.value || '';
    const grNumber = document.getElementById('grNumber')?.value || '';
    const scholarshipType = document.getElementById('scholarshipType')?.value || '';
    // Scholar ID is NOT collected - will be auto-generated
    
    const errorDiv = document.getElementById('authError');
    
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        errorDiv.textContent = 'Please enter a valid email address';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    // Mobile number validation for both
    if (!mobileNumber) {
        errorDiv.textContent = 'Please enter mobile number';
        errorDiv.classList.remove('hidden');
        return;
    }
    if (!/^[0-9]{10}$/.test(mobileNumber)) {
        errorDiv.textContent = 'Please enter a valid 10-digit mobile number';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    if (authMode === 'signup') {
        if (!name) {
            errorDiv.textContent = 'Please enter your name';
            errorDiv.classList.remove('hidden');
            return;
        }
        
        if (userType === 'student') {
            if (!dept) {
                errorDiv.textContent = 'Please select your department';
                errorDiv.classList.remove('hidden');
                return;
            }
            if (!currentYear) {
                errorDiv.textContent = 'Please select current year';
                errorDiv.classList.remove('hidden');
                return;
            }
            if (!joiningYear) {
                errorDiv.textContent = 'Please select joining year';
                errorDiv.classList.remove('hidden');
                return;
            }
            if (!grNumber) {
                errorDiv.textContent = 'Please enter GR number';
                errorDiv.classList.remove('hidden');
                return;
            }
            if (!scholarshipType) {
                errorDiv.textContent = 'Please select scholarship type';
                errorDiv.classList.remove('hidden');
                return;
            }
            
            // Student must set their own password
            if (password.length < 6) {
                errorDiv.textContent = 'Password must be at least 6 characters';
                errorDiv.classList.remove('hidden');
                return;
            }
        } else {
            // Admin - password is optional (defaults to admin123)
            // No password validation needed
        }
    } else {
        // Login mode - password required
        if (!password) {
            errorDiv.textContent = 'Please enter your password';
            errorDiv.classList.remove('hidden');
            return;
        }
    }
    
    errorDiv.classList.add('hidden');
    
    try {
        let response;
        
        if (authMode === 'signup') {
            const userData = {
                name,
                email,
                userType,
                mobileNumber
            };
            
            // Only add password for students (admins get default)
            if (userType === 'student') {
                userData.password = password;
            }
            
            if (userType === 'student') {
                userData.department = dept;
                userData.currentYear = currentYear;
                userData.joiningYear = joiningYear;
                userData.grNumber = grNumber;
                userData.scholarshipType = scholarshipType;
                // Scholar ID will be auto-generated by backend
            }
            
            response = await apiRequest('/auth/signup', {
                method: 'POST',
                body: JSON.stringify(userData)
            });
        } else {
            response = await apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
        }
        
        // Save token and user data
        token = response.token;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(response.user));
        
        currentUser = response.user;
        
        showToast(`Welcome, ${currentUser.name}!`);
        
        if (currentUser.userType === 'student') {
            showStudentDashboard();
        } else {
            showAdminDashboard();
        }
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.classList.remove('hidden');
    }
}
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    token = null;
    currentUser = null;
    document.getElementById('authPage').classList.remove('hidden');
    document.getElementById('studentDashboard').classList.add('hidden');
    document.getElementById('adminDashboard').classList.add('hidden');
    document.getElementById('emailInput').value = '';
    document.getElementById('passwordInput').value = '';
    document.getElementById('nameInput').value = '';
    if (document.getElementById('deptSelect')) {
        document.getElementById('deptSelect').value = '';
    }
    showToast('Logged out successfully');
}

// ==================== STUDENT FUNCTIONS ====================
async function showStudentDashboard() {
    document.getElementById('authPage').classList.add('hidden');
    document.getElementById('studentDashboard').classList.remove('hidden');
    document.getElementById('studentName').textContent = currentUser.name;
    document.getElementById('studentKey').textContent = `KEY: ${currentUser.uniqueKey}`;
    
    const deptInfo = deptToDay[currentUser.department];
    document.getElementById('bookingDayDisplay').textContent = `${deptInfo.name} (${deptInfo.fullName})`;
    
    restrictDateToDepartmentDay();
    await updateLiveQueue();
    await loadAvailableSlots();
    await checkExistingBooking();
    
    // Add event listener for date change
    document.getElementById('slotDate').addEventListener('change', loadAvailableSlots);
}

function restrictDateToDepartmentDay() {
    const dateInput = document.getElementById('slotDate');
    const today = new Date();
    const deptInfo = deptToDay[currentUser.department];
    
    let targetDate = new Date(today);
    const dayOfWeek = targetDate.getDay();
    const daysUntilTarget = (deptInfo.day - dayOfWeek + 7) % 7;
    
    if (daysUntilTarget === 0 && today.getHours() >= 17) {
        targetDate.setDate(targetDate.getDate() + 7);
    } else if (daysUntilTarget === 0) {
        // Today is the booking day
    } else {
        targetDate.setDate(targetDate.getDate() + daysUntilTarget);
    }
    
    dateInput.value = targetDate.toISOString().split('T')[0];
    dateInput.min = targetDate.toISOString().split('T')[0];
    
    let maxDate = new Date(targetDate);
    maxDate.setDate(maxDate.getDate() + 28);
    dateInput.max = maxDate.toISOString().split('T')[0];
}

async function updateLiveQueue() {
    try {
        // Get current token from backend
        const response = await apiRequest(`/bookings/current?department=${currentUser.department}`);
        
        if (response.currentToken) {
            document.getElementById('currentToken').textContent = response.currentToken;
        } else {
            document.getElementById('currentToken').textContent = 'No active token';
        }
        
        // Also get user's bookings to show their token
        const myBookings = await apiRequest('/bookings/my-bookings');
        
        // Find today's booking for this user
        const today = new Date().toISOString().split('T')[0];
        const todaysBooking = myBookings.bookings.find(b => b.slotDate === today);
        
        if (todaysBooking) {
            document.getElementById('yourToken').textContent = todaysBooking.token;
            document.getElementById('waitTime').textContent = `${todaysBooking.estimatedWaitTime} min`;
            
            // Check if token is within first 9
            const tokenNumber = parseInt(todaysBooking.token.split('-')[1]);
            if (tokenNumber <= 9) {
                document.getElementById('reminderBanner').classList.remove('hidden');
            }
        }
        
    } catch (error) {
        console.error('Failed to fetch queue data:', error);
    }
}

// ==================== TIME SLOT FUNCTIONS ====================
function generateTimeSlots() {
    const select = document.getElementById('slotTime');
    if (!select) {
        console.error('❌ Slot time select element not found');
        return;
    }
    
    console.log('⏰ Generating time slots...');
    select.innerHTML = '<option value="">Select a time slot</option>';
    
    let hours = 9;
    let minutes = 30;
    const endHours = 17;
    const breakStart = 13 * 60; // 1:00 PM in minutes
    const breakEnd = 14 * 60;    // 2:00 PM in minutes
    
    let slotCount = 0;
    
    while (hours < endHours || (hours === endHours && minutes === 0)) {
        const currentMinutes = hours * 60 + minutes;
        
        // Skip break period
        if (currentMinutes >= breakStart && currentMinutes < breakEnd) {
            hours = 14;
            minutes = 0;
            continue;
        }
        
        // Format time
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours > 12 ? hours - 12 : hours;
        const displayHoursFormatted = displayHours === 0 ? 12 : displayHours;
        const timeStr = `${displayHoursFormatted}:${String(minutes).padStart(2, '0')} ${ampm}`;
        
        const option = document.createElement('option');
        option.value = timeStr;
        option.textContent = timeStr;
        select.appendChild(option);
        slotCount++;
        
        // Add 7 minutes
        minutes += 7;
        if (minutes >= 60) {
            hours++;
            minutes = minutes % 60;
        }
    }
    
    console.log(`✅ Generated ${slotCount} time slots`);
}

async function loadAvailableSlots() {
    const date = document.getElementById('slotDate').value;
    const select = document.getElementById('slotTime');
    
    if (!date || !select) {
        console.error('❌ Missing date or select element');
        return;
    }
    
    try {
        // Generate all slots first
        generateTimeSlots();
        
        // Get booked slots from backend
        console.log(`🔍 Checking availability for date: ${date}`);
        const response = await apiRequest(`/bookings/available-slots?date=${date}`);
        
        // Mark booked slots as disabled
        let bookedCount = 0;
        Array.from(select.options).forEach(option => {
            if (option.value) { // Skip the first/default option
                const slot = response.slots.find(s => s.time === option.value);
                if (slot && !slot.available) {
                    option.disabled = true;
                    option.textContent = `${option.value} - Booked`;
                    option.classList.add('text-slate-400', 'line-through');
                    bookedCount++;
                }
            }
        });
        
        const totalSlots = select.options.length - 1; // -1 for default option
        console.log(`📊 Available: ${totalSlots - bookedCount}/${totalSlots} slots`);
        
        if (bookedCount === totalSlots) {
            showToast('No slots available for this date');
        }
        
    } catch (error) {
        console.error('❌ Failed to load slots:', error);
        // If API fails, at least show all slots as available
        showToast('Using default slots - booking availability may not be accurate');
    }
}

function setMinDate() {
    const dateInput = document.getElementById('slotDate');
    if (dateInput) {
        const today = new Date();
        dateInput.min = today.toISOString().split('T')[0];
    }
}

// ==================== BOOKING FUNCTIONS ====================
async function bookSlot() {
    const date = document.getElementById('slotDate').value;
    const time = document.getElementById('slotTime').value;
    
    if (!date || !time) {
        showToast('Please select both date and time');
        return;
    }
    
    const btn = document.getElementById('bookSlotBtn');
    btn.disabled = true;
    btn.innerHTML = 'Booking...';
    
    try {
        const response = await apiRequest('/bookings', {
            method: 'POST',
            body: JSON.stringify({ 
                slotDate: date, 
                slotTime: time 
            })
        });
        
        // Show success message with real data from backend
        document.getElementById('yourToken').textContent = response.booking.token;
        document.getElementById('waitTime').textContent = `${response.booking.estimatedWaitTime} min`;
        
        const successDiv = document.getElementById('bookingSuccess');
        successDiv.innerHTML = `✅ Slot Booked Successfully!<br>Token: ${response.booking.token}<br>Time: ${time}<br>Date: ${new Date(date).toLocaleDateString()}`;
        successDiv.classList.remove('hidden');
        
        // Show reminder if token number is within first 9
        const tokenNumber = parseInt(response.booking.token.split('-')[1]);
        if (tokenNumber <= 9) {
            document.getElementById('reminderBanner').classList.remove('hidden');
        } else {
            document.getElementById('reminderBanner').classList.add('hidden');
        }
        
        showToast('Slot booked successfully!');
        await loadAvailableSlots(); // Refresh available slots
        await updateLiveQueue(); // Refresh queue data
        await checkExistingBooking(); // Check and disable form if needed
        
    } catch (error) {
        showToast(error.message || 'Failed to book slot');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Book Slot';
    }
}

async function checkExistingBooking() {
    try {
        const response = await apiRequest('/bookings/my-bookings');
        const today = new Date().toISOString().split('T')[0];
        const todaysBooking = response.bookings.find(b => b.slotDate === today);
        
        if (todaysBooking) {
            document.getElementById('yourToken').textContent = todaysBooking.token;
            document.getElementById('waitTime').textContent = `${todaysBooking.estimatedWaitTime} min`;
            
            const successDiv = document.getElementById('bookingSuccess');
            successDiv.innerHTML = `📌 You have an existing booking!<br>Token: ${todaysBooking.token}<br>Time: ${todaysBooking.slotTime}`;
            successDiv.classList.remove('hidden');
            
            // Disable booking form if already booked
            document.getElementById('slotDate').disabled = true;
            document.getElementById('slotTime').disabled = true;
            document.getElementById('bookSlotBtn').disabled = true;
            document.getElementById('bookSlotBtn').innerHTML = 'Already Booked';
            
            // Show reminder if token is within first 9
            const tokenNumber = parseInt(todaysBooking.token.split('-')[1]);
            if (tokenNumber <= 9) {
                document.getElementById('reminderBanner').classList.remove('hidden');
            }
            
            return true;
        } else {
            // Enable booking form
            document.getElementById('slotDate').disabled = false;
            document.getElementById('slotTime').disabled = false;
            document.getElementById('bookSlotBtn').disabled = false;
            document.getElementById('bookSlotBtn').innerHTML = 'Book Slot';
            document.getElementById('bookingSuccess').classList.add('hidden');
            document.getElementById('reminderBanner').classList.add('hidden');
            
            return false;
        }
    } catch (error) {
        console.error('Failed to check existing booking:', error);
        return false;
    }
}

// ==================== ADMIN FUNCTIONS ====================
function getDeptForDay(dayOfWeek) {
    const dayToDept = {
        1: 'DS',
        2: 'AIML',
        3: 'COMP',
        4: 'IT',
        5: 'MECH'
    };
    return dayToDept[dayOfWeek] || null;
}

// ==================== ENHANCED ADMIN FUNCTIONS ====================

// Update loadAdminDashboard to include new data
async function loadAdminDashboard() {
    try {
        const response = await apiRequest('/admin/dashboard');
        
        // Today's info
        document.getElementById('todaysDept').textContent = `Today: ${response.today.department || 'No Department'}`;
        document.getElementById('totalToday').textContent = response.today.total;
        document.getElementById('verifiedCount').textContent = response.today.verified;
        document.getElementById('rejectedCount').textContent = response.today.rejected;
        document.getElementById('adminCurrentToken').textContent = response.today.currentToken || '---';
        
        // Stats
        document.getElementById('totalStudents').textContent = response.totalStudents;
        document.getElementById('totalAdmins').textContent = response.totalAdmins;
        document.getElementById('weeklyTotal').textContent = response.weekly.total;
        document.getElementById('monthlyTotal').textContent = response.monthly.total;
        
        // Weekly stats details
        document.getElementById('weeklyTotalStats').textContent = response.weekly.total;
        document.getElementById('weeklyVerified').textContent = response.weekly.byStatus.verified;
        document.getElementById('weeklyRejected').textContent = response.weekly.byStatus.rejected;
        document.getElementById('weeklyPending').textContent = response.weekly.byStatus.pending;
        document.getElementById('weeklyCurrent').textContent = response.weekly.byStatus.current;
        
        // Monthly stats details
        document.getElementById('monthlyTotalStats').textContent = response.monthly.total;
        document.getElementById('monthlyVerified').textContent = response.monthly.byStatus.verified;
        document.getElementById('monthlyRejected').textContent = response.monthly.byStatus.rejected;
        document.getElementById('monthlyPending').textContent = response.monthly.byStatus.pending;
        document.getElementById('monthlyCurrent').textContent = response.monthly.byStatus.current;
        
        // Upcoming bookings
        renderUpcomingBookings(response.upcoming);
        
        // Past weeks
        renderPastWeeks(response.pastWeeks);
        
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        showToast('Failed to load dashboard data');
    }
}

// Render upcoming bookings
function renderUpcomingBookings(upcoming) {
    const tbody = document.getElementById('upcomingBookingsBody');
    if (!tbody) {
        console.error('❌ Upcoming bookings table body not found');
        return;
    }
    
    console.log('📅 Rendering upcoming bookings:', upcoming);
    
    if (!upcoming || upcoming.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-center text-slate-500">No upcoming bookings</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    upcoming.forEach(day => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-50';
        
        // Format date for display
        const dateObj = new Date(day.date);
        const formattedDate = dateObj.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
        
        // Determine badge color based on department
        const deptBadgeClass = day.department !== 'No Department' 
            ? 'bg-violet-100 text-violet-700' 
            : 'bg-slate-100 text-slate-500';
        
        row.innerHTML = `
            <td class="px-4 py-3 text-sm">${formattedDate}</td>
            <td class="px-4 py-3 text-sm">${day.day}</td>
            <td class="px-4 py-3 text-sm">
                <span class="px-2 py-1 ${deptBadgeClass} rounded-full text-xs font-medium">
                    ${day.department}
                </span>
            </td>
            <td class="px-4 py-3 text-sm font-medium">
                <span class="px-2 py-1 ${day.bookings > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'} rounded-full text-xs font-medium">
                    ${day.bookings} ${day.bookings === 1 ? 'booking' : 'bookings'}
                </span>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    console.log('✅ Upcoming bookings rendered');
}

// Render past weeks data
function renderPastWeeks(pastWeeks) {
    const tbody = document.getElementById('pastWeeksBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    pastWeeks.forEach((week, index) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-50';
        
        const weekStart = new Date(week.weekStart);
        const weekEnd = new Date(week.weekEnd);
        const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        
        row.innerHTML = `
            <td class="px-4 py-3 text-sm">${weekLabel}</td>
            <td class="px-4 py-3 text-sm font-medium">${week.total}</td>
            <td class="px-4 py-3 text-sm text-emerald-600">${week.byStatus.verified}</td>
            <td class="px-4 py-3 text-sm text-red-600">${week.byStatus.rejected}</td>
            <td class="px-4 py-3 text-sm text-amber-600">${week.byStatus.pending}</td>
            <td class="px-4 py-3 text-sm">${week.byDepartment.DS}</td>
            <td class="px-4 py-3 text-sm">${week.byDepartment.AIML}</td>
            <td class="px-4 py-3 text-sm">${week.byDepartment.COMP}</td>
            <td class="px-4 py-3 text-sm">${week.byDepartment.IT}</td>
            <td class="px-4 py-3 text-sm">${week.byDepartment.MECH}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// Search students
let searchTimeout;
function setupStudentSearch() {
    const searchInput = document.getElementById('studentSearch');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (e.target.value.length >= 2) {
                searchStudents();
            } else {
                document.getElementById('searchResults').classList.add('hidden');
            }
        }, 500);
    });
}

async function searchStudents() {
    const query = document.getElementById('studentSearch').value;
    if (!query || query.length < 2) return;
    
    const resultsDiv = document.getElementById('searchResults');
    const resultsBody = document.getElementById('searchResultsBody');
    
    resultsDiv.classList.remove('hidden');
    resultsBody.innerHTML = '<div class="text-center py-4 text-slate-500">Searching...</div>';
    
    try {
        const response = await apiRequest(`/admin/students/search?query=${encodeURIComponent(query)}`);
        
        if (response.students.length === 0) {
            resultsBody.innerHTML = '<div class="text-center py-4 text-slate-500">No students found</div>';
            return;
        }
        
        resultsBody.innerHTML = '';
        
        response.students.forEach(student => {
            const studentCard = document.createElement('div');
            studentCard.className = 'p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all cursor-pointer';
            studentCard.onclick = () => viewStudentProfile(student._id);
            
            studentCard.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-semibold text-slate-800">${student.name}</h4>
                        <p class="text-sm text-slate-600">${student.email}</p>
                        <div class="flex gap-3 mt-2 text-xs">
                            <span class="px-2 py-1 bg-violet-100 text-violet-700 rounded-full">${student.scholarId}</span>
                            <span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">${student.grNumber}</span>
                            <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">${student.department} - ${student.currentYear}</span>
                        </div>
                    </div>
                    <button class="text-violet-600 hover:text-violet-800 text-sm font-medium">View →</button>
                </div>
            `;
            
            resultsBody.appendChild(studentCard);
        });
        
    } catch (error) {
        resultsBody.innerHTML = '<div class="text-center py-4 text-red-500">Error searching students</div>';
        console.error('Search error:', error);
    }
}

async function viewStudentProfile(studentId) {
    try {
        const response = await apiRequest(`/admin/students/${studentId}`);
        
        // Create modal or expand view
        const profileHtml = `
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                    <div class="p-6 border-b sticky top-0 bg-white flex justify-between items-center">
                        <h2 class="text-2xl font-bold text-slate-800">Student Profile</h2>
                        <button onclick="this.closest('.fixed').remove()" class="text-slate-500 hover:text-slate-700">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    <div class="p-6">
                        <!-- Profile content here -->
                        <pre>${JSON.stringify(response, null, 2)}</pre>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', profileHtml);
        
    } catch (error) {
        showToast('Failed to load student profile');
    }
}

// Update updateFormFields function to show/hide student profile fields
function updateFormFields() {
    const deptField = document.getElementById('deptField');
    const nameField = document.getElementById('nameField');
    const studentProfileFields = document.getElementById('studentProfileFields');
    
    if (authMode === 'signup') {
        nameField.classList.remove('hidden');
        if (userType === 'student') {
            deptField.classList.remove('hidden');
            studentProfileFields.classList.remove('hidden');
        } else {
            deptField.classList.add('hidden');
            studentProfileFields.classList.add('hidden');
        }
    } else {
        nameField.classList.add('hidden');
        deptField.classList.add('hidden');
        studentProfileFields.classList.add('hidden');
    }
}

// Update handleAuth function to include new fields
async function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    const name = document.getElementById('nameInput').value;
    const deptSelect = document.getElementById('deptSelect');
    const dept = deptSelect ? deptSelect.value : '';
    
    // New fields
    const mobileNumber = document.getElementById('mobileNumber')?.value || '';
    const currentYear = document.getElementById('currentYear')?.value || '';
    const joiningYear = document.getElementById('joiningYear')?.value || '';
    const grNumber = document.getElementById('grNumber')?.value || '';
    const scholarshipType = document.getElementById('scholarshipType')?.value || '';
    const scholarId = document.getElementById('scholarId')?.value || '';
    
    const errorDiv = document.getElementById('authError');
    
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        errorDiv.textContent = 'Please enter a valid email address';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    if (authMode === 'signup' && userType === 'student' && !dept) {
        errorDiv.textContent = 'Please select your department';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    if (authMode === 'signup' && !name) {
        errorDiv.textContent = 'Please enter your name';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    if (password.length < 6) {
        errorDiv.textContent = 'Password must be at least 6 characters';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    // Validate student fields
    if (authMode === 'signup' && userType === 'student') {
        if (!mobileNumber) {
            errorDiv.textContent = 'Please enter mobile number';
            errorDiv.classList.remove('hidden');
            return;
        }
        if (!currentYear) {
            errorDiv.textContent = 'Please select current year';
            errorDiv.classList.remove('hidden');
            return;
        }
        if (!joiningYear) {
            errorDiv.textContent = 'Please select joining year';
            errorDiv.classList.remove('hidden');
            return;
        }
        if (!grNumber) {
            errorDiv.textContent = 'Please enter GR number';
            errorDiv.classList.remove('hidden');
            return;
        }
        if (!scholarshipType) {
            errorDiv.textContent = 'Please select scholarship type';
            errorDiv.classList.remove('hidden');
            return;
        }
        if (!scholarId) {
            errorDiv.textContent = 'Please enter Scholar ID';
            errorDiv.classList.remove('hidden');
            return;
        }
    }
    
    errorDiv.classList.add('hidden');
    
    try {
        let response;
        
        if (authMode === 'signup') {
            const userData = {
                name,
                email,
                password,
                userType
            };
            
            if (userType === 'student') {
                userData.department = dept;
                userData.mobileNumber = mobileNumber;
                userData.currentYear = currentYear;
                userData.joiningYear = joiningYear;
                userData.grNumber = grNumber;
                userData.scholarshipType = scholarshipType;
                userData.scholarId = scholarId;
            }
            
            response = await apiRequest('/auth/signup', {
                method: 'POST',
                body: JSON.stringify(userData)
            });
        } else {
            response = await apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
        }
        
        // Save token and user data
        token = response.token;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(response.user));
        
        currentUser = response.user;
        
        showToast(`Welcome, ${currentUser.name}!`);
        
        if (currentUser.userType === 'student') {
            showStudentDashboard();
        } else {
            showAdminDashboard();
        }
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.classList.remove('hidden');
    }
}

// Initialize search on admin dashboard load
function showAdminDashboard() {
    document.getElementById('authPage').classList.add('hidden');
    document.getElementById('adminDashboard').classList.remove('hidden');
    document.getElementById('adminName').textContent = currentUser.name;
    
    loadAdminDashboard();
    renderAdminTable();
    setupStudentSearch(); // Add this line
    
    // Refresh data every 30 seconds
    setInterval(async () => {
        if (currentUser && currentUser.userType === 'admin') {
            await loadAdminDashboard();
            await renderAdminTable();
        }
    }, 30000);
}

async function loadAdminDashboard() {
    try {
        console.log('📊 Loading admin dashboard...');
        const response = await apiRequest('/admin/dashboard');
        
        console.log('📊 Dashboard response:', response);
        
        // Today's department info
        document.getElementById('todaysDept').textContent = `Today: ${response.today.department || 'No Department'}`;
        document.getElementById('totalToday').textContent = response.today.total || 0;
        document.getElementById('verifiedCount').textContent = response.today.verified || 0;
        document.getElementById('rejectedCount').textContent = response.today.rejected || 0;
        document.getElementById('adminCurrentToken').textContent = response.today.currentToken || '---';
        
        // Statistics Cards
        document.getElementById('totalStudents').textContent = response.totalStudents || 0;
        document.getElementById('totalAdmins').textContent = response.totalAdmins || 0;
        document.getElementById('weeklyTotal').textContent = response.weekly?.total || 0;
        document.getElementById('monthlyTotal').textContent = response.monthly?.total || 0;
        
        // Weekly Stats Details
        if (response.weekly) {
            document.getElementById('weeklyTotalStats').textContent = response.weekly.total || 0;
            document.getElementById('weeklyVerified').textContent = response.weekly.byStatus?.verified || 0;
            document.getElementById('weeklyRejected').textContent = response.weekly.byStatus?.rejected || 0;
            document.getElementById('weeklyPending').textContent = response.weekly.byStatus?.pending || 0;
            document.getElementById('weeklyCurrent').textContent = response.weekly.byStatus?.current || 0;
        }
        
        // Monthly Stats Details
        if (response.monthly) {
            document.getElementById('monthlyTotalStats').textContent = response.monthly.total || 0;
            document.getElementById('monthlyVerified').textContent = response.monthly.byStatus?.verified || 0;
            document.getElementById('monthlyRejected').textContent = response.monthly.byStatus?.rejected || 0;
            document.getElementById('monthlyPending').textContent = response.monthly.byStatus?.pending || 0;
            document.getElementById('monthlyCurrent').textContent = response.monthly.byStatus?.current || 0;
        }
        
        // Upcoming Bookings
        if (response.upcoming && response.upcoming.length > 0) {
            renderUpcomingBookings(response.upcoming);
        } else {
            // Show empty state
            const tbody = document.getElementById('upcomingBookingsBody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-center text-slate-500">No upcoming bookings</td></tr>';
            }
        }
        
        // Past Weeks Data
        if (response.pastWeeks && response.pastWeeks.length > 0) {
            renderPastWeeks(response.pastWeeks);
        } else {
            const tbody = document.getElementById('pastWeeksBody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="10" class="px-4 py-4 text-center text-slate-500">No past weeks data</td></tr>';
            }
        }
        
        console.log('✅ Admin dashboard loaded successfully');
        
    } catch (error) {
        console.error('❌ Failed to load dashboard:', error);
        showToast('Failed to load dashboard data');
    }
}
async function renderAdminTable() {
    const tbody = document.getElementById('queueTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-8 text-center text-slate-500">Loading queue data...</td></tr>';
    
    try {
        // Get real queue data from backend
        const response = await apiRequest('/admin/queue');
        
        if (response.queue.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-8 text-center text-slate-500">No students in queue for today.</td></tr>';
            return;
        }
        
        tbody.innerHTML = ''; // Clear loading message
        
        response.queue.forEach(booking => {
            const row = document.createElement('tr');
            row.className = booking.status === 'current' ? 'bg-emerald-50' : 'hover:bg-slate-50';
            row.dataset.id = booking.id;
            
            let statusBadge;
            switch (booking.status) {
                case 'verified':
                    statusBadge = '<span class="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">Verified</span>';
                    break;
                case 'rejected':
                    statusBadge = '<span class="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">Rejected</span>';
                    break;
                case 'current':
                    statusBadge = '<span class="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium animate-pulse">In Progress</span>';
                    break;
                default:
                    statusBadge = '<span class="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">Pending</span>';
            }
            
            let actionBtns = '';
            if (booking.status === 'current') {
                actionBtns = `
                    <div class="flex gap-2">
                        <button onclick="verifyStudent('${booking.id}')" class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-all">Accept</button>
                        <button onclick="rejectStudent('${booking.id}')" class="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-all">Reject</button>
                    </div>
                `;
            } else if (booking.status === 'pending') {
                actionBtns = '<span class="text-xs text-slate-400">Waiting</span>';
            } else {
                actionBtns = '<span class="text-xs text-slate-400">Completed</span>';
            }
            
            row.innerHTML = `
                <td class="px-6 py-4">
                    <span class="font-mono font-bold ${booking.status === 'current' ? 'text-emerald-600' : 'text-slate-800'}">${booking.token}</span>
                </td>
                <td class="px-6 py-4">
                    <div class="font-medium text-slate-800">${booking.name}</div>
                </td>
                <td class="px-6 py-4">
                    <span class="text-sm text-slate-600">${booking.email}</span>
                </td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium">${booking.department}</span>
                </td>
                <td class="px-6 py-4">
                    <span class="text-xs px-2 py-1 rounded ${booking.documents.doc1 === 'approved' ? 'bg-emerald-100 text-emerald-700' : booking.documents.doc1 === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}">${booking.documents.doc1}</span>
                </td>
                <td class="px-6 py-4">
                    <span class="text-xs px-2 py-1 rounded ${booking.documents.doc2 === 'approved' ? 'bg-emerald-100 text-emerald-700' : booking.documents.doc2 === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}">${booking.documents.doc2}</span>
                </td>
                <td class="px-6 py-4">
                    <span class="text-sm text-slate-600">${booking.slotTime}</span>
                </td>
                <td class="px-6 py-4">${statusBadge}</td>
                <td class="px-6 py-4">${actionBtns}</td>
            `;
            
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Failed to render queue:', error);
        tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-8 text-center text-slate-500">Failed to load queue data. Please try again.</td></tr>';
    }
}

async function nextToken() {
    try {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const dayToDept = {1: 'DS', 2: 'AIML', 3: 'COMP', 4: 'IT', 5: 'MECH'};
        const department = dayToDept[dayOfWeek];
        
        if (!department) {
            showToast('No department scheduled for today');
            return;
        }
        
        const response = await apiRequest('/admin/queue/next', {
            method: 'PUT',
            body: JSON.stringify({ department })
        });
        
        showToast(response.message);
        await loadAdminDashboard();
        await renderAdminTable();
    } catch (error) {
        showToast(error.message || 'Failed to move to next token');
    }
}

async function togglePause() {
    isPaused = !isPaused;
    const btn = document.getElementById('pauseBtn');
    const statusDot = document.getElementById('queueStatusDot');
    const statusText = document.getElementById('queueStatusText');
    
    if (isPaused) {
        btn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Resume Queue
        `;
        btn.className = 'px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 transition-all flex items-center gap-2';
        statusDot.className = 'w-3 h-3 rounded-full bg-amber-500';
        statusText.textContent = 'Paused';
        statusText.className = 'text-sm text-amber-600 font-medium';
        showToast('Queue paused');
    } else {
        btn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Pause Queue
        `;
        btn.className = 'px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/30 transition-all flex items-center gap-2';
        statusDot.className = 'pulse-dot w-3 h-3 rounded-full bg-emerald-500';
        statusText.textContent = 'Active';
        statusText.className = 'text-sm text-emerald-600 font-medium';
        showToast('Queue resumed');
    }
}

function addExtraTime() {
    showToast('Added 5 minutes extra time for current token');
}

async function verifyStudent(bookingId) {
    try {
        const response = await apiRequest(`/admin/queue/${bookingId}/verify`, {
            method: 'PUT',
            body: JSON.stringify({
                document1Status: 'approved',
                document2Status: 'approved'
            })
        });
        
        showToast('Student verified successfully');
        await loadAdminDashboard();
        await renderAdminTable();
    } catch (error) {
        showToast(error.message || 'Failed to verify student');
    }
}

async function rejectStudent(bookingId) {
    const reason = prompt('Please enter rejection reason:');
    if (!reason) return;
    
    try {
        const response = await apiRequest(`/admin/queue/${bookingId}/reject`, {
            method: 'PUT',
            body: JSON.stringify({ reason })
        });
        
        showToast('Student rejected');
        await loadAdminDashboard();
        await renderAdminTable();
    } catch (error) {
        showToast(error.message || 'Failed to reject student');
    }
}

// ==================== UTILITY FUNCTIONS ====================
function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMessage');
    
    if (toastMsg) {
        toastMsg.textContent = message;
    }
    
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
        toast.classList.remove('translate-y-0', 'opacity-100');
    }, 3000);
}

// Check authentication status on page load
async function checkAuth() {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
        try {
            token = savedToken;
            const response = await apiRequest('/auth/me');
            currentUser = response.user;
            return true;
        } catch (error) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            token = null;
            currentUser = null;
            return false;
        }
    }
    return false;
}

// Render upcoming bookings
function renderUpcomingBookings(upcoming) {
    const tbody = document.getElementById('upcomingBookingsBody');
    if (!tbody) {
        console.error('❌ Upcoming bookings table body not found');
        return;
    }
    
    console.log('📅 Rendering upcoming bookings:', upcoming);
    
    if (!upcoming || upcoming.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-center text-slate-500">No upcoming bookings</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    upcoming.forEach(day => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-50';
        
        // Format date for display
        const dateObj = new Date(day.date);
        const formattedDate = dateObj.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
        
        // Determine badge color based on department
        const deptBadgeClass = day.department !== 'No Department' 
            ? 'bg-violet-100 text-violet-700' 
            : 'bg-slate-100 text-slate-500';
        
        row.innerHTML = `
            <td class="px-4 py-3 text-sm">${formattedDate}</td>
            <td class="px-4 py-3 text-sm">${day.day}</td>
            <td class="px-4 py-3 text-sm">
                <span class="px-2 py-1 ${deptBadgeClass} rounded-full text-xs font-medium">
                    ${day.department}
                </span>
            </td>
            <td class="px-4 py-3 text-sm font-medium">
                <span class="px-2 py-1 ${day.bookings > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'} rounded-full text-xs font-medium">
                    ${day.bookings} ${day.bookings === 1 ? 'booking' : 'bookings'}
                </span>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    console.log('✅ Upcoming bookings rendered');
}

// Render past weeks data
function renderPastWeeks(pastWeeks) {
    const tbody = document.getElementById('pastWeeksBody');
    if (!tbody) return;
    
    console.log('📚 Rendering past weeks:', pastWeeks);
    
    if (!pastWeeks || pastWeeks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="px-4 py-4 text-center text-slate-500">No past weeks data</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    pastWeeks.forEach((week, index) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-50';
        
        const weekStart = new Date(week.weekStart);
        const weekEnd = new Date(week.weekEnd);
        const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        
        row.innerHTML = `
            <td class="px-4 py-3 text-sm">${weekLabel}</td>
            <td class="px-4 py-3 text-sm font-medium">${week.total || 0}</td>
            <td class="px-4 py-3 text-sm text-emerald-600">${week.byStatus?.verified || 0}</td>
            <td class="px-4 py-3 text-sm text-red-600">${week.byStatus?.rejected || 0}</td>
            <td class="px-4 py-3 text-sm text-amber-600">${week.byStatus?.pending || 0}</td>
            <td class="px-4 py-3 text-sm">${week.byDepartment?.DS || 0}</td>
            <td class="px-4 py-3 text-sm">${week.byDepartment?.AIML || 0}</td>
            <td class="px-4 py-3 text-sm">${week.byDepartment?.COMP || 0}</td>
            <td class="px-4 py-3 text-sm">${week.byDepartment?.IT || 0}</td>
            <td class="px-4 py-3 text-sm">${week.byDepartment?.MECH || 0}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    console.log('✅ Past weeks rendered');
}

// ==================== EXPORT FUNCTIONS TO GLOBAL SCOPE ====================
window.setUserType = setUserType;
window.setAuthMode = setAuthMode;
window.handleAuth = handleAuth;
window.logout = logout;
window.bookSlot = bookSlot;
window.nextToken = nextToken;
window.togglePause = togglePause;
window.addExtraTime = addExtraTime;
window.verifyStudent = verifyStudent;
window.rejectStudent = rejectStudent;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);

// Handle online/offline status
window.addEventListener('online', () => {
    showToast('Back online - Syncing data...');
    if (currentUser) {
        if (currentUser.userType === 'student') {
            updateLiveQueue();
            loadAvailableSlots();
        } else {
            loadAdminDashboard();
            renderAdminTable();
        }
    }
});

window.addEventListener('offline', () => {
    showToast('You are offline - Some features may be unavailable');
});

console.log('✅ Main.js loaded with backend integration');