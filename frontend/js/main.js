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

// Department to day mapping - Updated for Friday multiple departments
const deptToDay = {
    'DS': { day: 1, name: 'Monday', fullName: 'Data Science' },
    'AIML': { day: 2, name: 'Tuesday', fullName: 'AI & Machine Learning' },
    'COMP': { day: 3, name: 'Wednesday', fullName: 'Computer Engineering' },
    'IT': { day: 4, name: 'Thursday', fullName: 'Information Technology' },
    'MECH': { day: 5, name: 'Friday', fullName: 'Mechanical Engineering' },
    'CIVIL': { day: 5, name: 'Friday', fullName: 'Civil Engineering' },
    'AUTO': { day: 5, name: 'Friday', fullName: 'Automobile Engineering' }
};

// Department display names
const departmentNames = {
    'DS': 'Data Science',
    'AIML': 'AI & Machine Learning',
    'COMP': 'Computer Engineering',
    'IT': 'Information Technology',
    'MECH': 'Mechanical Engineering',
    'CIVIL': 'Civil Engineering',
    'AUTO': 'Automobile Engineering'
};

// Day to departments mapping (for admin)
const dayToDepts = {
    1: ['DS'],
    2: ['AIML'],
    3: ['COMP'],
    4: ['IT'],
    5: ['MECH', 'CIVIL', 'AUTO']
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
            headers,
            mode: 'cors',
            credentials: 'include'
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
    
    // Initialize Data SDK (optional)
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
    
    // Populate department select
    populateDepartmentSelect();
    
    // Render department schedule
    renderDepartmentSchedule();
    
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
    const mobileField = document.getElementById('mobileField');
    const studentProfileFields = document.getElementById('studentProfileFields');
    const passwordInput = document.getElementById('passwordInput');
    const passwordHint = document.getElementById('passwordHint');
    
    if (authMode === 'signup') {
        // Show name field for signup
        nameField.classList.remove('hidden');
        
        // Show mobile field for all signups
        mobileField.classList.remove('hidden');
        
        if (userType === 'student') {
            // Student signup - show all fields
            deptField.classList.remove('hidden');
            studentProfileFields.classList.remove('hidden');
            
            // Password is required for students
            passwordInput.required = true;
            passwordInput.placeholder = '•••••••• (min 6 characters)';
            passwordHint.textContent = 'Password must be at least 6 characters';
            
        } else {
            // Admin signup - hide student-specific fields
            deptField.classList.add('hidden');
            studentProfileFields.classList.add('hidden');
            
            // Password is optional for admin (defaults to admin123)
            passwordInput.required = false;
            passwordInput.placeholder = 'Optional - default: admin123';
            passwordHint.textContent = 'Leave blank to use default password: admin123';
            passwordInput.value = '';
        }
    } else {
        // Login mode - hide all extra fields
        nameField.classList.add('hidden');
        deptField.classList.add('hidden');
        mobileField.classList.add('hidden');
        studentProfileFields.classList.add('hidden');
        
        // Password is required for login
        passwordInput.required = true;
        passwordInput.placeholder = '••••••••';
        passwordHint.textContent = '';
    }
}

// Populate department select options
function populateDepartmentSelect() {
    const deptSelect = document.getElementById('deptSelect');
    if (!deptSelect) return;
    
    const departments = [
        { value: 'DS', label: 'Data Science (DS) - Monday' },
        { value: 'AIML', label: 'AI & Machine Learning (AIML) - Tuesday' },
        { value: 'COMP', label: 'Computer Engineering (COMP) - Wednesday' },
        { value: 'IT', label: 'Information Technology (IT) - Thursday' },
        { value: 'MECH', label: 'Mechanical Engineering (MECH) - Friday' },
        { value: 'CIVIL', label: 'Civil Engineering (CIVIL) - Friday' },
        { value: 'AUTO', label: 'Automobile Engineering (AUTO) - Friday' }
    ];
    
    deptSelect.innerHTML = '<option value="">Select Department</option>';
    departments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.value;
        option.textContent = dept.label;
        deptSelect.appendChild(option);
    });
}

// Render department schedule
function renderDepartmentSchedule() {
    const scheduleContainer = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-7');
    if (!scheduleContainer) return;
    
    // Clear existing
    scheduleContainer.innerHTML = '';
    
    // Monday to Thursday (single departments)
    const weekdays = [
        { day: 'Monday', dept: 'DS', name: 'Data Science' },
        { day: 'Tuesday', dept: 'AIML', name: 'AI & ML' },
        { day: 'Wednesday', dept: 'COMP', name: 'Computer Eng.' },
        { day: 'Thursday', dept: 'IT', name: 'Information Tech' }
    ];
    
    weekdays.forEach(day => {
        scheduleContainer.innerHTML += `
            <div class="glass-card rounded-xl p-4 text-center">
                <p class="text-xs text-slate-500 mb-1">${day.day}</p>
                <p class="font-bold text-slate-800">${day.name}</p>
                <p class="text-xs text-emerald-600 mt-1">${day.dept}</p>
            </div>
        `;
    });
    
    // Friday - Multiple departments
    const fridayDepts = [
        { dept: 'MECH', name: 'Mechanical', code: 'MECH' },
        { dept: 'CIVIL', name: 'Civil', code: 'CIVIL' },
        { dept: 'AUTO', name: 'Automobile', code: 'AUTO' }
    ];
    
    fridayDepts.forEach(dept => {
        scheduleContainer.innerHTML += `
            <div class="glass-card rounded-xl p-4 text-center">
                <p class="text-xs text-slate-500 mb-1">Friday</p>
                <p class="font-bold text-slate-800">${dept.name}</p>
                <p class="text-xs text-emerald-600 mt-1">${dept.code}</p>
            </div>
        `;
    });
}

async function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    const name = document.getElementById('nameInput').value;
    const deptSelect = document.getElementById('deptSelect');
    const dept = deptSelect ? deptSelect.value : '';
    
    // Mobile number (required for signup)
    const mobileNumber = document.getElementById('mobileNumber')?.value || '';
    
    // Student fields
    const currentYear = document.getElementById('currentYear')?.value || '';
    const joiningYear = document.getElementById('joiningYear')?.value || '';
    const grNumber = document.getElementById('grNumber')?.value || '';
    const scholarshipType = document.getElementById('scholarshipType')?.value || '';
    
    const errorDiv = document.getElementById('authError');
    
    // Email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        errorDiv.textContent = 'Please enter a valid email address';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    if (authMode === 'signup') {
        // Name validation for signup
        if (!name) {
            errorDiv.textContent = 'Please enter your name';
            errorDiv.classList.remove('hidden');
            return;
        }
        
        // Mobile number validation for all signups
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
        
        if (userType === 'student') {
            // Student validations
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
    
    // Fix: Add this element to your HTML if missing
    const scholarIdEl = document.getElementById('studentScholarId');
    if (scholarIdEl) {
        scholarIdEl.textContent = `Scholar ID: ${currentUser.scholarId || 'Not assigned'}`;
    }
    
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
                document.getElementById('studentsBeforeYou').textContent = tokenNumber - 1;
            }
        }
        
    } catch (error) {
        console.error('Failed to fetch queue data:', error);
    }
}

// Close student profile modal (for admin viewing students)
function closeStudentProfile() {
    const modal = document.getElementById('studentProfileModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Close student's own profile modal (alias for the same function)
function closeStudentProfileModal() {
    closeStudentProfile(); // Just call the same function
}

// Make sure both are exported
window.closeStudentProfile = closeStudentProfile;
window.closeStudentProfileModal = closeStudentProfileModal;

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
        
        // Fix: Add booking confirmation element if missing
        const confirmationDiv = document.getElementById('bookingConfirmation');
        if (confirmationDiv) {
            confirmationDiv.classList.remove('hidden');
            document.getElementById('confirmationMessage').innerHTML = 
                `Token: ${response.booking.token}<br>Time: ${time}<br>Date: ${new Date(date).toLocaleDateString()}`;
        }
        
        // Show reminder if token number is within first 9
        const tokenNumber = parseInt(response.booking.token.split('-')[1]);
        if (tokenNumber <= 9) {
            document.getElementById('reminderBanner').classList.remove('hidden');
            document.getElementById('studentsBeforeYou').textContent = tokenNumber - 1;
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
            
            // Fix: Check if successDiv exists
            const successDiv = document.getElementById('bookingSuccess');
            if (successDiv) {
                successDiv.innerHTML = `📌 You have an existing booking!<br>Token: ${todaysBooking.token}<br>Time: ${todaysBooking.slotTime}`;
                successDiv.classList.remove('hidden');
            }
            
            // Disable booking form if already booked
            document.getElementById('slotDate').disabled = true;
            document.getElementById('slotTime').disabled = true;
            document.getElementById('bookSlotBtn').disabled = true;
            document.getElementById('bookSlotBtn').innerHTML = 'Already Booked';
            
            // Show reminder if token is within first 9
            const tokenNumber = parseInt(todaysBooking.token.split('-')[1]);
            if (tokenNumber <= 9) {
                document.getElementById('reminderBanner').classList.remove('hidden');
                document.getElementById('studentsBeforeYou').textContent = tokenNumber - 1;
            }
            
            return true;
        } else {
            // Enable booking form
            document.getElementById('slotDate').disabled = false;
            document.getElementById('slotTime').disabled = false;
            document.getElementById('bookSlotBtn').disabled = false;
            document.getElementById('bookSlotBtn').innerHTML = 'Book Slot';
            
            // Fix: Hide success div if exists
            const successDiv = document.getElementById('bookingSuccess');
            if (successDiv) {
                successDiv.classList.add('hidden');
            }
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
        5: ['MECH', 'CIVIL', 'AUTO']
    };
    return dayToDept[dayOfWeek] || null;
}

// ==================== DOCUMENT CHECKLIST FUNCTIONS ====================

// Get document display name
function getDocumentDisplayName(docId) {
    const names = {
        'aadhar': 'Aadhar Card',
        'domicile': 'Domicile Certificate',
        'income': 'Income Certificate',
        'ssc': 'SSC Marksheet',
        'hsc': 'HSC Marksheet',
        'previousYear': 'Previous Year/Semester Marksheet',
        'feeReceipt': 'College Fee Receipt',
        'capLetter': 'CAP Allotment Letter',
        'bankPassbook': 'Bank Passbook',
        'bonafide': 'College Bonafide Certificate',
        'leaving': 'Leaving Certificate',
        'selfDeclaration': 'Self Declaration',
        'caste': 'Caste Certificate',
        'casteValidity': 'Caste Validity Certificate',
        'nonCreamy': 'Non-Creamy Layer Certificate'
    };
    return names[docId] || docId;
}

// Get document checklist based on scholarship type
function getDocumentChecklist(scholarshipType) {
    // Base documents for all scholarships
    const baseDocuments = [
        { id: 'aadhar', name: 'Aadhar Card', required: true },
        { id: 'domicile', name: 'Domicile Certificate', required: true },
        { id: 'income', name: 'Income Certificate', required: true },
        { id: 'ssc', name: 'SSC Marksheet', required: true },
        { id: 'hsc', name: 'HSC Marksheet', required: true },
        { id: 'previousYear', name: 'Previous Year/Previous Semester Marksheet', required: true },
        { id: 'feeReceipt', name: 'College Fee Receipt', required: true },
        { id: 'capLetter', name: 'CAP Allotment Letter', required: true },
        { id: 'bankPassbook', name: 'Bank Passbook', required: true },
        { id: 'bonafide', name: 'College Bonafide Certificate', required: true },
        { id: 'leaving', name: 'Leaving Certificate', required: true },
        { id: 'selfDeclaration', name: 'Self Declaration', required: true }
    ];

    // Additional documents based on scholarship type
    if (scholarshipType === 'SC' || scholarshipType === 'ST') {
        return [
            ...baseDocuments,
            { id: 'caste', name: 'Caste Certificate', required: true },
            { id: 'casteValidity', name: 'Caste Validity Certificate', required: true }
        ];
    } else if (scholarshipType === 'OBC') {
        return [
            ...baseDocuments,
            { id: 'caste', name: 'Caste Certificate', required: true },
            { id: 'casteValidity', name: 'Caste Validity Certificate', required: true },
            { id: 'nonCreamy', name: 'Non-Creamy Layer Certificate', required: true }
        ];
    } else {
        return baseDocuments;
    }
}

// Update document checklist when scholarship type changes (for signup)
function updateDocumentChecklist() {
    const scholarshipType = document.getElementById('scholarshipType')?.value;
    if (!scholarshipType) return;
    
    console.log('📋 Selected scholarship type:', scholarshipType);
    // This can be used to show additional info during signup
    const documents = getDocumentChecklist(scholarshipType);
    console.log('📄 Required documents:', documents.map(d => d.name));
}

// Render document checklist for verification modal
function renderDocumentChecklist(documents, scholarshipType) {
    const checklist = getDocumentChecklist(scholarshipType);
    
    let html = '<div class="space-y-4">';
    
    checklist.forEach(doc => {
        const status = documents[doc.id]?.status || 'pending';
        const statusClass = {
            'approved': 'bg-emerald-100 text-emerald-700 border-emerald-300',
            'rejected': 'bg-red-100 text-red-700 border-red-300',
            'pending': 'bg-slate-100 text-slate-600 border-slate-300'
        }[status] || 'bg-slate-100 text-slate-600 border-slate-300';
        
        html += `
            <div class="flex items-center justify-between p-3 border rounded-lg ${statusClass}">
                <div class="flex items-center gap-3">
                    <input type="checkbox" 
                           id="doc-${doc.id}" 
                           data-doc-id="${doc.id}"
                           ${status === 'approved' ? 'checked' : ''}
                           class="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500">
                    <label for="doc-${doc.id}" class="text-sm font-medium">${doc.name}</label>
                </div>
                <select id="status-${doc.id}" class="text-xs border rounded-lg px-2 py-1 ${statusClass}">
                    <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="approved" ${status === 'approved' ? 'selected' : ''}>Approved</option>
                    <option value="rejected" ${status === 'rejected' ? 'selected' : ''}>Rejected</option>
                </select>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

// Collect document statuses from verification modal
function collectDocumentStatuses() {
    const documents = {};
    const checkboxes = document.querySelectorAll('[id^="doc-"]');
    
    checkboxes.forEach(checkbox => {
        const docId = checkbox.dataset.docId;
        const statusSelect = document.getElementById(`status-${docId}`);
        
        if (statusSelect) {
            // If checkbox is checked but status is pending, set to approved
            if (checkbox.checked && statusSelect.value === 'pending') {
                documents[docId] = 'approved';
            } else {
                documents[docId] = statusSelect.value;
            }
        }
    });
    
    return documents;
}

// ==================== DEPARTMENT HELPER FUNCTIONS ====================

// Get department for a given day
function getDepartmentsForDay(dayOfWeek) {
    return dayToDepts[dayOfWeek] || [];
}

// Check if a department can book on a given day
function canDepartmentBookOnDay(department, dayOfWeek) {
    return deptToDay[department]?.day === dayOfWeek;
}

// Get all departments that book on a specific day
function getDepartmentsByDay(dayOfWeek) {
    const departments = [];
    Object.keys(deptToDay).forEach(dept => {
        if (deptToDay[dept].day === dayOfWeek) {
            departments.push(dept);
        }
    });
    return departments;
}

// Format department display for Friday (multiple departments)
function formatDepartmentDisplay(department) {
    const info = deptToDay[department];
    if (!info) return department;
    
    if (info.day === 5) {
        return `${info.fullName} (Friday)`;
    }
    return `${info.fullName} (${info.name})`;
}

// Get scholarship type display name
function getScholarshipDisplayName(type) {
    const names = {
        'SC': 'Scheduled Caste (SC)',
        'ST': 'Scheduled Tribe (ST)',
        'OBC': 'OBC/SBC/VJNT',
        'EBC': 'Economically Backward Class (EBC)',
        'Other': 'Other'
    };
    return names[type] || type;
}

// Get status badge class
function getStatusBadgeClass(status) {
    switch (status) {
        case 'verified':
            return 'bg-emerald-100 text-emerald-700';
        case 'rejected':
            return 'bg-red-100 text-red-700';
        case 'current':
            return 'bg-blue-100 text-blue-700 animate-pulse';
        case 'pending':
            return 'bg-slate-100 text-slate-600';
        default:
            return 'bg-slate-100 text-slate-600';
    }
}

// Get status display text
function getStatusDisplayText(status) {
    switch (status) {
        case 'verified':
            return 'Verified';
        case 'rejected':
            return 'Rejected';
        case 'current':
            return 'In Progress';
        case 'pending':
            return 'Pending';
        default:
            return status;
    }
}

// ==================== ADMIN DASHBOARD FUNCTIONS ====================

// Show admin dashboard
async function showAdminDashboard() {
    document.getElementById('authPage').classList.add('hidden');
    document.getElementById('adminDashboard').classList.remove('hidden');
    document.getElementById('adminName').textContent = currentUser.name;
    
    await loadAdminDashboard();
    await renderAdminTable();
    setupStudentSearch();
    await loadOngoingStudent();
    
    // Refresh data every 30 seconds
    setInterval(async () => {
        if (currentUser && currentUser.userType === 'admin') {
            await loadAdminDashboard();
            await renderAdminTable();
            await loadOngoingStudent();
        }
    }, 30000);
}

// Load admin dashboard data
async function loadAdminDashboard() {
    try {
        console.log('📊 Loading admin dashboard...');
        const response = await apiRequest('/admin/dashboard');
        
        console.log('📊 Dashboard response:', response);
        
        // Update header
        document.getElementById('todaysDept').textContent = `Today: ${response.today.departments?.join(', ') || 'No Department'}`;
        
        // Update sidebar
        document.getElementById('todaysDeptSidebar').textContent = response.today.departments?.join(', ') || 'No Department';
        document.getElementById('adminCurrentTokenSidebar').textContent = response.today.currentToken || '---';
        document.getElementById('totalTodaySidebar').textContent = response.today.total || 0;
        document.getElementById('verifiedCountSidebar').textContent = response.today.verified || 0;
        document.getElementById('rejectedCountSidebar').textContent = response.today.rejected || 0;
        document.getElementById('pendingCountSidebar').textContent = response.today.pending || 0;
        
        // Update main stats
        document.getElementById('adminCurrentToken').textContent = response.today.currentToken || '---';
        document.getElementById('totalToday').textContent = response.today.total || 0;
        document.getElementById('verifiedCount').textContent = response.today.verified || 0;
        document.getElementById('rejectedCount').textContent = response.today.rejected || 0;
        
        // Weekly Stats
        if (response.weekly) {
            document.getElementById('weeklyTotalStats').textContent = response.weekly.total || 0;
            document.getElementById('weeklyVerified').textContent = response.weekly.verified || 0;
            document.getElementById('weeklyRejected').textContent = response.weekly.rejected || 0;
            document.getElementById('weeklyPending').textContent = response.weekly.pending || 0;
        }
        
        // Monthly Stats
        if (response.monthly) {
            document.getElementById('monthlyTotalStats').textContent = response.monthly.total || 0;
            document.getElementById('monthlyVerified').textContent = response.monthly.verified || 0;
            document.getElementById('monthlyRejected').textContent = response.monthly.rejected || 0;
            document.getElementById('monthlyPending').textContent = response.monthly.pending || 0;
        }
        
        console.log('✅ Admin dashboard loaded successfully');
        
    } catch (error) {
        console.error('❌ Failed to load dashboard:', error);
        showToast('Failed to load dashboard data');
    }
}

// Render admin table
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
                        <button onclick="openVerificationModal('${booking.id}')" class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-all">Verify</button>
                        <button onclick="rejectStudent('${booking.id}')" class="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-all">Reject</button>
                    </div>
                `;
            } else if (booking.status === 'pending') {
                actionBtns = '<span class="text-xs text-slate-400">Waiting</span>';
            } else {
                actionBtns = '<span class="text-xs text-slate-400">Completed</span>';
            }
            
            row.innerHTML = `
                <td class="px-4 py-3">
                    <span class="font-mono font-bold ${booking.status === 'current' ? 'text-emerald-600' : 'text-slate-800'}">${booking.token}</span>
                </td>
                <td class="px-4 py-3">
                    <div class="font-medium text-slate-800">${booking.name}</div>
                </td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium">${booking.department}</span>
                </td>
                <td class="px-4 py-3">
                    <span class="text-xs font-mono">${booking.scholarId || 'N/A'}</span>
                </td>
                <td class="px-4 py-3">
                    <span class="text-xs">${booking.grNumber || 'N/A'}</span>
                </td>
                <td class="px-4 py-3">
                    <span class="text-xs">${booking.currentYear || 'N/A'}</span>
                </td>
                <td class="px-4 py-3">
                    <span class="text-sm text-slate-600">${booking.slotTime}</span>
                </td>
                <td class="px-4 py-3">${statusBadge}</td>
                <td class="px-4 py-3">${actionBtns}</td>
            `;
            
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Failed to render queue:', error);
        tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-8 text-center text-slate-500">Failed to load queue data. Please try again.</td></tr>';
    }
}

// ==================== ONGOING STUDENT PROFILE FUNCTIONS ====================

// Fetch and display the currently serving student
async function loadOngoingStudent() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const dayOfWeek = new Date().getDay();
        const dayToDept = {1: 'DS', 2: 'AIML', 3: 'COMP', 4: 'IT', 5: ['MECH', 'CIVIL', 'AUTO']};
        const departments = dayToDept[dayOfWeek] || [];
        
        const container = document.getElementById('ongoingStudentContent');
        if (!container) return;
        
        if (departments.length === 0) {
            container.innerHTML = `
                <div class="w-full text-center py-8 text-slate-500">
                    <svg class="w-16 h-16 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-lg font-medium">No department scheduled today</p>
                    <p class="text-sm">It's a weekend or holiday</p>
                </div>
            `;
            return;
        }
        
        // For simplicity, show the first department's current student
        const department = departments[0];
        
        // Get current serving student
        const response = await apiRequest(`/bookings/current?department=${department}`);
        
        if (!response.currentToken) {
            container.innerHTML = `
                <div class="w-full text-center py-8 text-slate-500">
                    <svg class="w-16 h-16 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-lg font-medium">No student currently being served</p>
                    <p class="text-sm">Click "Next Token" to start serving</p>
                </div>
            `;
            return;
        }
        
        // Get full student details
        const queueResponse = await apiRequest(`/admin/queue?department=${department}&date=${today}`);
        const currentBooking = queueResponse.queue.find(b => b.token === response.currentToken);
        
        if (currentBooking) {
            displayOngoingStudent(currentBooking);
        }
        
    } catch (error) {
        console.error('Failed to load ongoing student:', error);
    }
}

// Display ongoing student profile
function displayOngoingStudent(booking) {
    const container = document.getElementById('ongoingStudentContent');
    if (!container) return;
    
    // Get initials for avatar
    const initials = booking.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    
    container.innerHTML = `
        <div class="flex items-start gap-6">
            <div class="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                ${initials}
            </div>
            <div class="flex-1">
                <div class="grid grid-cols-2 gap-6">
                    <div>
                        <h4 class="text-xl font-bold text-slate-800 mb-2">${booking.name}</h4>
                        <div class="space-y-2">
                            <div class="flex items-center gap-2">
                                <span class="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium">${booking.token}</span>
                                <span class="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">${booking.department}</span>
                            </div>
                            <p class="text-sm text-slate-600"><span class="font-medium">Scholar ID:</span> ${booking.scholarId || 'N/A'}</p>
                            <p class="text-sm text-slate-600"><span class="font-medium">GR Number:</span> ${booking.grNumber || 'N/A'}</p>
                            <p class="text-sm text-slate-600"><span class="font-medium">Year:</span> ${booking.currentYear || 'N/A'}</p>
                        </div>
                    </div>
                    <div class="bg-slate-50 rounded-xl p-4">
                        <p class="text-sm text-slate-500 mb-2">Booking Details</p>
                        <p class="text-sm text-slate-600"><span class="font-medium">Time:</span> ${booking.slotTime}</p>
                        <p class="text-sm text-slate-600"><span class="font-medium">Date:</span> ${new Date(booking.slotDate).toLocaleDateString()}</p>
                        <p class="text-sm text-slate-600"><span class="font-medium">Scholarship:</span> ${booking.scholarshipType || 'N/A'}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ==================== VERIFICATION MODAL FUNCTIONS ====================

// Open verification modal
async function openVerificationModal(bookingId) {
    try {
        const response = await apiRequest(`/admin/queue/${bookingId}`);
        const booking = response.booking;
        
        const modal = document.getElementById('verificationModal');
        const content = document.getElementById('verificationContent');
        
        const documents = booking.documents || {};
        const checklist = getDocumentChecklist(booking.scholarshipType);
        
        let docsHtml = '<div class="space-y-4 max-h-96 overflow-y-auto">';
        
        checklist.forEach(doc => {
            const status = documents[doc.id]?.status || 'pending';
            const statusClass = {
                'approved': 'bg-emerald-100 text-emerald-700 border-emerald-300',
                'rejected': 'bg-red-100 text-red-700 border-red-300',
                'pending': 'bg-slate-100 text-slate-600 border-slate-300'
            }[status];
            
            docsHtml += `
                <div class="flex items-center justify-between p-3 border rounded-lg ${statusClass}">
                    <div class="flex items-center gap-3">
                        <input type="checkbox" 
                               id="doc-${doc.id}" 
                               data-doc-id="${doc.id}"
                               ${status === 'approved' ? 'checked' : ''}
                               class="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500">
                        <label for="doc-${doc.id}" class="text-sm font-medium">${doc.name}</label>
                    </div>
                    <select id="status-${doc.id}" class="text-xs border rounded-lg px-2 py-1">
                        <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="approved" ${status === 'approved' ? 'selected' : ''}>Approved</option>
                        <option value="rejected" ${status === 'rejected' ? 'selected' : ''}>Rejected</option>
                    </select>
                </div>
            `;
        });
        
        docsHtml += '</div>';
        
        content.innerHTML = `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-slate-800">${booking.student.name}</h3>
                <p class="text-sm text-slate-600">Token: ${booking.token} | Dept: ${booking.student.department}</p>
            </div>
            
            ${docsHtml}
            
            <div class="mt-6 flex justify-end gap-3">
                <button onclick="closeVerificationModal()" class="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">Cancel</button>
                <button onclick="submitVerification('${bookingId}')" class="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">Submit Verification</button>
            </div>
        `;
        
        modal.classList.remove('hidden');
        
    } catch (error) {
        console.error('Failed to open verification modal:', error);
        showToast('Failed to load verification data');
    }
}

// Close verification modal
function closeVerificationModal() {
    document.getElementById('verificationModal').classList.add('hidden');
}

// Submit verification
async function submitVerification(bookingId) {
    const documents = collectDocumentStatuses();
    
    // Determine overall status
    let status = 'pending';
    const values = Object.values(documents);
    if (values.every(v => v === 'approved')) {
        status = 'verified';
    } else if (values.some(v => v === 'rejected')) {
        status = 'rejected';
    }
    
    try {
        await apiRequest(`/admin/queue/${bookingId}/verify`, {
            method: 'PUT',
            body: JSON.stringify({ documents, status })
        });
        
        showToast('Verification submitted successfully');
        closeVerificationModal();
        await renderAdminTable();
        await loadOngoingStudent();
        
    } catch (error) {
        showToast(error.message || 'Failed to submit verification');
    }
}

// ==================== MODAL FUNCTIONS ====================

// Close any modal by ID
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Close student profile modal (for admin viewing students)
function closeStudentProfile() {
    closeModal('studentProfileModal');
}

// Close student's own profile modal
function closeStudentProfileModal() {
    closeModal('studentProfileModal');
}

// Close verification modal
function closeVerificationModal() {
    closeModal('verificationModal');
}

// Open modal with backdrop click to close
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        
        // Remove any existing listener and add new one
        modal.removeEventListener('click', handleBackdropClick);
        modal.addEventListener('click', handleBackdropClick);
    }
}

// Handle backdrop click
function handleBackdropClick(e) {
    if (e.target.classList.contains('fixed') && e.target.classList.contains('inset-0')) {
        closeModal(e.target.id);
    }
}

// Update your viewStudentProfile function to use openModal
async function viewStudentProfile(studentId) {
    try {
        const response = await apiRequest(`/admin/students/${studentId}`);
        const student = response.student;
        const bookings = response.bookings || [];
        
        // Get initials for avatar
        const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        
        // Create profile HTML (your existing code)
        const profileHtml = `...`; // Your existing profile HTML
        
        document.getElementById('studentProfileContent').innerHTML = profileHtml;
        openModal('studentProfileModal'); // Use openModal instead of just removing hidden class
        
    } catch (error) {
        console.error('Failed to load student profile:', error);
        showToast('Failed to load student profile');
    }
}

// Make sure all functions are exported
window.closeStudentProfile = closeStudentProfile;
window.closeStudentProfileModal = closeStudentProfileModal;
window.closeVerificationModal = closeVerificationModal;

// ==================== STUDENT SEARCH FUNCTIONS ====================

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
    if (!query || query.length < 2) {
        showToast('Please enter at least 2 characters to search');
        return;
    }
    
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
            studentCard.className = 'p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all cursor-pointer border border-slate-200';
            studentCard.onclick = () => viewStudentProfile(student._id);
            
            // Get initials for avatar
            const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            
            studentCard.innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                        ${initials}
                    </div>
                    <div class="flex-1">
                        <h4 class="font-semibold text-slate-800">${student.name}</h4>
                        <p class="text-sm text-slate-600">${student.email}</p>
                        <div class="flex gap-2 mt-2">
                            <span class="px-2 py-1 bg-violet-100 text-violet-700 rounded-full text-xs">${student.scholarId || 'N/A'}</span>
                            <span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs">${student.grNumber || 'N/A'}</span>
                            <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">${student.department} - ${student.currentYear}</span>
                        </div>
                    </div>
                    <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            `;
            
            resultsBody.appendChild(studentCard);
        });
        
    } catch (error) {
        resultsBody.innerHTML = '<div class="text-center py-4 text-red-500">Error searching students</div>';
        console.error('Search error:', error);
    }
}

// View student profile in modal
async function viewStudentProfile(studentId) {
    try {
        const response = await apiRequest(`/admin/students/${studentId}`);
        const student = response.student;
        const bookings = response.bookings || [];
        
        // Get initials for avatar
        const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        
        // Create profile HTML
        const profileHtml = `
            <div class="flex items-start gap-6 mb-8">
                <div class="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl shadow-lg">
                    ${initials}
                </div>
                <div class="flex-1">
                    <h3 class="text-2xl font-bold text-slate-800">${student.name}</h3>
                    <p class="text-slate-600">${student.email}</p>
                    <div class="flex gap-2 mt-2">
                        <span class="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium">${student.scholarId || 'Scholar ID Not Assigned'}</span>
                        <span class="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">${student.uniqueKey}</span>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-6 mb-8">
                <div class="bg-slate-50 rounded-xl p-4">
                    <h4 class="font-semibold text-slate-700 mb-3">Personal Information</h4>
                    <div class="space-y-2">
                        <div class="flex justify-between">
                            <span class="text-slate-500">Mobile Number:</span>
                            <span class="font-medium">${student.mobileNumber || 'N/A'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-slate-500">Department:</span>
                            <span class="font-medium">${student.department || 'N/A'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-slate-500">Current Year:</span>
                            <span class="font-medium">${student.currentYear || 'N/A'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-slate-500">Joining Year:</span>
                            <span class="font-medium">${student.joiningYear || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="bg-slate-50 rounded-xl p-4">
                    <h4 class="font-semibold text-slate-700 mb-3">Academic Information</h4>
                    <div class="space-y-2">
                        <div class="flex justify-between">
                            <span class="text-slate-500">GR Number:</span>
                            <span class="font-medium">${student.grNumber || 'N/A'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-slate-500">Scholarship Type:</span>
                            <span class="font-medium">${student.scholarshipType || 'N/A'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-slate-500">Scholar ID:</span>
                            <span class="font-medium">${student.scholarId || 'N/A'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-slate-500">Account Status:</span>
                            <span class="font-medium ${student.isActive ? 'text-emerald-600' : 'text-red-600'}">${student.isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="bg-slate-50 rounded-xl p-4">
                <h4 class="font-semibold text-slate-700 mb-3">Booking History</h4>
                ${bookings.length > 0 ? `
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="border-b">
                                    <th class="text-left py-2">Date</th>
                                    <th class="text-left py-2">Token</th>
                                    <th class="text-left py-2">Time</th>
                                    <th class="text-left py-2">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${bookings.map(booking => `
                                    <tr class="border-b last:border-0">
                                        <td class="py-2">${new Date(booking.slotDate).toLocaleDateString()}</td>
                                        <td class="py-2 font-mono">${booking.department}-${String(booking.tokenNumber).padStart(3, '0')}</td>
                                        <td class="py-2">${booking.slotTime}</td>
                                        <td class="py-2">
                                            <span class="px-2 py-1 rounded-full text-xs ${
                                                booking.status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                                                booking.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                booking.status === 'current' ? 'bg-blue-100 text-blue-700' :
                                                'bg-slate-100 text-slate-600'
                                            }">${booking.status}</span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<p class="text-slate-500 text-center py-4">No booking history found</p>'}
            </div>
        `;
        
        document.getElementById('studentProfileContent').innerHTML = profileHtml;
        document.getElementById('studentProfileModal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Failed to load student profile:', error);
        showToast('Failed to load student profile');
    }
}

// Close student profile modal
function closeStudentProfile() {
    document.getElementById('studentProfileModal').classList.add('hidden');
}

// ==================== QUEUE CONTROL FUNCTIONS ====================

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
        await loadOngoingStudent();
        
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

// ==================== STATISTICS FUNCTIONS ====================

// Show current serving content
function showCurrentServing() {
    document.getElementById('currentServingContent').classList.remove('hidden');
    document.getElementById('adminStatisticsContent').classList.add('hidden');
    
    // Update tab styles
    document.getElementById('currentServingTab').className = 'w-full text-left px-4 py-3 rounded-xl bg-violet-50 text-violet-700 font-medium hover:bg-violet-100 transition-all flex items-center gap-3';
    document.getElementById('adminStatsTab').className = 'w-full text-left px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-3';
}

// Show statistics content
function showAdminStatistics() {
    document.getElementById('currentServingContent').classList.add('hidden');
    document.getElementById('adminStatisticsContent').classList.remove('hidden');
    
    // Update tab styles
    document.getElementById('adminStatsTab').className = 'w-full text-left px-4 py-3 rounded-xl bg-violet-50 text-violet-700 font-medium hover:bg-violet-100 transition-all flex items-center gap-3';
    document.getElementById('currentServingTab').className = 'w-full text-left px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-3';
    
    loadDepartmentStats();
}

// Load department statistics
async function loadDepartmentStats() {
    try {
        const department = document.getElementById('statsDepartmentFilter').value;
        const response = await apiRequest(`/admin/stats?department=${department}`);
        
        document.getElementById('weeklyTotal').textContent = response.stats?.total || 0;
        document.getElementById('weeklyVerified').textContent = response.stats?.verified || 0;
        document.getElementById('weeklyRejected').textContent = response.stats?.rejected || 0;
        document.getElementById('weeklyPending').textContent = response.stats?.pending || 0;
        
        document.getElementById('monthlyTotal').textContent = response.stats?.total || 0;
        document.getElementById('monthlyVerified').textContent = response.stats?.verified || 0;
        document.getElementById('monthlyRejected').textContent = response.stats?.rejected || 0;
        document.getElementById('monthlyPending').textContent = response.stats?.pending || 0;
        
    } catch (error) {
        console.error('Failed to load statistics:', error);
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
window.searchStudents = searchStudents;
window.viewStudentProfile = viewStudentProfile;
window.closeStudentProfile = closeStudentProfile;
window.showUpcomingBookings = showUpcomingBookings;
window.showStatistics = showStatistics;
window.showCurrentServing = showCurrentServing;
window.showAdminStatistics = showAdminStatistics;
window.openVerificationModal = openVerificationModal;
window.closeVerificationModal = closeVerificationModal;
window.updateDocumentChecklist = updateDocumentChecklist;

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
            loadOngoingStudent();
        }
    }
});

window.addEventListener('offline', () => {
    showToast('You are offline - Some features may be unavailable');
});

console.log('✅ Main.js loaded with backend integration');