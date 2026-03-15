// Add this at the very top of main.js for debugging
const DEBUG = true;
function log(...args) {
    if (DEBUG) console.log('[ScholarSwift]', ...args);
}

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
    'AUTO': { day: 5, name: 'Friday', fullName: 'Automobile Engineering' },
    'SAT': { day: 6, name: 'Saturday', fullName: 'Weekend Special' },
    'SUN': { day: 0, name: 'Sunday', fullName: 'Weekend Special' }
};

// Department display names
const departmentNames = {
    'DS': 'Data Science',
    'AIML': 'AI & Machine Learning',
    'COMP': 'Computer Engineering',
    'IT': 'Information Technology',
    'MECH': 'Mechanical Engineering',
    'CIVIL': 'Civil Engineering',
    'AUTO': 'Automobile Engineering',
    'SAT': 'Weekend Special',
    'SUN': 'Weekend Special'
};

// Day to departments mapping (for admin)
const dayToDepts = {
    1: ['DS'],
    2: ['AIML'],
    3: ['COMP'],
    4: ['IT'],
    5: ['MECH', 'CIVIL', 'AUTO'],
    6: ['SAT'],
    0: ['SUN']
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
    log('Initializing app...');
    
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
        nameField.classList.remove('hidden');
        mobileField.classList.remove('hidden');
        
        if (userType === 'student') {
            // Student signup - show all fields
            deptField.classList.remove('hidden');
            studentProfileFields.classList.remove('hidden');
            
            passwordInput.required = true;
            passwordInput.placeholder = '•••••••• (min 6 characters)';
            passwordHint.textContent = 'Password must be at least 6 characters';
            
        } else {
            // Admin CANNOT sign up - show message and switch to login
            alert('Admin signup is disabled. Please use the admin login credentials provided by the system.');
            setAuthMode('login');
            return;
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
        { value: 'AUTO', label: 'Automobile Engineering (AUTO) - Friday' },
        { value: 'SAT', label: 'Weekend Special (SAT) - Saturday' },
        { value: 'SUN', label: 'Weekend Special (SUN) - Sunday' }
    ];
    
    deptSelect.innerHTML = '<option value="">Select Department</option>';
    departments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.value;
        option.textContent = dept.label;
        deptSelect.appendChild(option);
    });
}

function renderDepartmentSchedule() {
    const scheduleContainer = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-7, .grid.grid-cols-1.md\\:grid-cols-9');
    if (!scheduleContainer) return;
    
    scheduleContainer.innerHTML = '';
    
    const allDays = [
        { day: 'Monday', dept: 'DS', name: 'Data Science' },
        { day: 'Tuesday', dept: 'AIML', name: 'AI & ML' },
        { day: 'Wednesday', dept: 'COMP', name: 'Computer Eng.' },
        { day: 'Thursday', dept: 'IT', name: 'Information Tech' },
        { day: 'Friday', dept: 'MECH', name: 'Mechanical' },
        { day: 'Friday', dept: 'CIVIL', name: 'Civil' },
        { day: 'Friday', dept: 'AUTO', name: 'Automobile' },
        { day: 'Saturday', dept: 'SAT', name: 'Weekend Special' },
        { day: 'Sunday', dept: 'SUN', name: 'Weekend Special' }
    ];
    
    allDays.forEach(dayInfo => {
        scheduleContainer.innerHTML += `
            <div class="glass-card rounded-xl p-4 text-center">
                <p class="text-xs text-slate-500 mb-1">${dayInfo.day}</p>
                <p class="font-bold text-slate-800">${dayInfo.name}</p>
                <p class="text-xs text-emerald-600 mt-1">${dayInfo.dept}</p>
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
    const mobileNumber = document.getElementById('mobileNumber')?.value || '';
    const currentYear = document.getElementById('currentYear')?.value || '';
    const joiningYear = document.getElementById('joiningYear')?.value || '';
    const grNumber = document.getElementById('grNumber')?.value || '';
    const scholarshipType = document.getElementById('scholarshipType')?.value || '';
    
    const errorDiv = document.getElementById('authError');
    
    // Prevent admin signup
    if (authMode === 'signup' && userType === 'admin') {
        errorDiv.textContent = 'Admin signup is not allowed. Please contact the system administrator.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        errorDiv.textContent = 'Please enter a valid email address';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    if (authMode === 'signup') {
        if (!name) {
            errorDiv.textContent = 'Please enter your name';
            errorDiv.classList.remove('hidden');
            return;
        }
        
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
            // Fixed validation for joining year
            if (!/^\d{4}$/.test(joiningYear)) {
                errorDiv.textContent = 'Please select a valid joining year';
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
                userType: 'student', // Force to student
                mobileNumber,
                password,
                department: dept,
                currentYear,
                joiningYear,
                grNumber,
                scholarshipType
            };
            
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

// ==================== STUDENT DASHBOARD FUNCTIONS ====================

async function showStudentDashboard() {
    log('Showing student dashboard');
    
    try {
        // Hide auth page, show dashboard
        document.getElementById('authPage').classList.add('hidden');
        document.getElementById('studentDashboard').classList.remove('hidden');
        
        // Update header info
        document.getElementById('studentName').textContent = currentUser.name;
        document.getElementById('studentKey').textContent = `KEY: ${currentUser.uniqueKey}`;
        
        // Update department booking day
        const deptInfo = deptToDay[currentUser.department];
        if (deptInfo) {
            document.getElementById('bookingDayDisplay').textContent = `${deptInfo.name} (${deptInfo.fullName})`;
        }
        
        // Initialize dashboard
        restrictDateToDepartmentDay();
        await loadAvailableSlots();
        await updateStudentDashboard();
        
        // Add event listeners
        document.getElementById('slotDate').addEventListener('change', loadAvailableSlots);
        
        // Set up auto-refresh every 30 seconds
        if (window.studentRefreshInterval) {
            clearInterval(window.studentRefreshInterval);
        }
        window.studentRefreshInterval = setInterval(async () => {
            if (currentUser && currentUser.userType === 'student') {
                log('Auto-refreshing student dashboard...');
                await updateStudentDashboard();
            }
        }, 30000);
        
        log('Student dashboard shown successfully');
    } catch (error) {
        console.error('Error showing student dashboard:', error);
        showToast('Error loading dashboard');
    }
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
    }
    targetDate.setDate(targetDate.getDate() + daysUntilTarget);
    
    dateInput.value = targetDate.toISOString().split('T')[0];
    dateInput.min = targetDate.toISOString().split('T')[0];
    
    let maxDate = new Date(targetDate);
    maxDate.setDate(maxDate.getDate() + 28);
    dateInput.max = maxDate.toISOString().split('T')[0];
}

async function updateStudentDashboard() {
    log('Updating student dashboard...');
    
    try {
        // Check if user is logged in and is a student
        if (!currentUser || currentUser.userType !== 'student') {
            log('Not a student or not logged in');
            return;
        }
        
        // Get user's position in queue
        log('Fetching position for student:', currentUser.email);
        const positionResponse = await apiRequest('/bookings/position');
        log('Position response:', positionResponse);
        
        // Get current token for department
        const currentResponse = await apiRequest(`/bookings/current?department=${currentUser.department}`);
        log('Current token response:', currentResponse);
        
        // Get all DOM elements
        const elements = {
            currentToken: document.getElementById('currentToken'),
            yourToken: document.getElementById('yourToken'),
            studentsAhead: document.getElementById('studentsAhead'),
            waitTime: document.getElementById('waitTime'),
            cancelBtn: document.getElementById('cancelBookingContainer'),
            reminderBanner: document.getElementById('reminderBanner'),
            verifiedMsg: document.getElementById('verificationDoneMessage'),
            pendingMsg: document.getElementById('pendingMessage'),
            rejectedMsg: document.getElementById('rejectedMessage'),
            studentsBeforeYou: document.getElementById('studentsBeforeYou'),
            bookingConfirmation: document.getElementById('bookingConfirmation'),
            slotDate: document.getElementById('slotDate'),
            slotTime: document.getElementById('slotTime'),
            bookSlotBtn: document.getElementById('bookSlotBtn')
        };
        
        // Update current token
        if (elements.currentToken) {
            elements.currentToken.textContent = currentResponse.currentToken || 'No active token';
        }
        
        // Hide all status messages first
        if (elements.reminderBanner) elements.reminderBanner.classList.add('hidden');
        if (elements.verifiedMsg) elements.verifiedMsg.classList.add('hidden');
        if (elements.pendingMsg) elements.pendingMsg.classList.add('hidden');
        if (elements.rejectedMsg) elements.rejectedMsg.classList.add('hidden');
        if (elements.cancelBtn) elements.cancelBtn.classList.add('hidden');
        if (elements.bookingConfirmation) elements.bookingConfirmation.classList.add('hidden');
        
        // Default: enable booking form
        if (elements.slotDate) elements.slotDate.disabled = false;
        if (elements.slotTime) elements.slotTime.disabled = false;
        if (elements.bookSlotBtn) {
            elements.bookSlotBtn.disabled = false;
            elements.bookSlotBtn.innerHTML = 'Book Slot';
            elements.bookSlotBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        
        if (positionResponse.hasBooking) {
            // Update the three main fields
            if (elements.yourToken) {
                elements.yourToken.textContent = positionResponse.token || '--';
                log('Updated yourToken to:', positionResponse.token);
            }
            
            if (elements.studentsAhead) {
                elements.studentsAhead.textContent = positionResponse.studentsBefore || 0;
                log('Updated studentsAhead to:', positionResponse.studentsBefore);
            }
            
            if (elements.waitTime) {
                elements.waitTime.textContent = `${positionResponse.estimatedWaitTime || 0} min`;
                log('Updated waitTime to:', `${positionResponse.estimatedWaitTime} min`);
            }
            
            const status = positionResponse.status;
            log('Booking status:', status);
            
            // Show appropriate message based on status
            if (status === 'verified') {
                if (elements.verifiedMsg) {
                    elements.verifiedMsg.classList.remove('hidden');
                }
                
                // VERIFIED STUDENTS CANNOT BOOK
                if (elements.slotDate) elements.slotDate.disabled = true;
                if (elements.slotTime) elements.slotTime.disabled = true;
                if (elements.bookSlotBtn) {
                    elements.bookSlotBtn.disabled = true;
                    elements.bookSlotBtn.innerHTML = 'Already Verified';
                    elements.bookSlotBtn.classList.add('opacity-50', 'cursor-not-allowed');
                }
            }
            else if (status === 'rejected') {
                if (elements.rejectedMsg) {
                    elements.rejectedMsg.classList.remove('hidden');
                }
                
                // REJECTED STUDENTS CAN BOOK AGAIN
                if (elements.slotDate) elements.slotDate.disabled = false;
                if (elements.slotTime) elements.slotTime.disabled = false;
                if (elements.bookSlotBtn) {
                    elements.bookSlotBtn.disabled = false;
                    elements.bookSlotBtn.innerHTML = 'Book New Slot';
                    elements.bookSlotBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            }
            else if (status === 'pending') {
                if (elements.pendingMsg) {
                    elements.pendingMsg.classList.remove('hidden');
                }
                
                // Show cancel button for pending
                if (elements.cancelBtn) {
                    elements.cancelBtn.classList.remove('hidden');
                }
                
                // PENDING STUDENTS CANNOT BOOK
                if (elements.slotDate) elements.slotDate.disabled = true;
                if (elements.slotTime) elements.slotTime.disabled = true;
                if (elements.bookSlotBtn) {
                    elements.bookSlotBtn.disabled = true;
                    elements.bookSlotBtn.innerHTML = 'Already Booked';
                    elements.bookSlotBtn.classList.add('opacity-50', 'cursor-not-allowed');
                }
                
                // Show reminder if close to front (less than 3 students ahead)
                if (positionResponse.studentsBefore <= 3 && elements.reminderBanner) {
                    elements.reminderBanner.classList.remove('hidden');
                    if (elements.studentsBeforeYou) {
                        elements.studentsBeforeYou.textContent = positionResponse.studentsBefore;
                    }
                }
            }
            else if (status === 'current') {
                if (elements.pendingMsg) {
                    elements.pendingMsg.classList.remove('hidden');
                    const msgEl = elements.pendingMsg.querySelector('p:last-child');
                    if (msgEl) msgEl.textContent = 'You are currently being served. Please wait for the admin to verify your documents.';
                }
                
                // STUDENTS BEING SERVED CANNOT BOOK
                if (elements.slotDate) elements.slotDate.disabled = true;
                if (elements.slotTime) elements.slotTime.disabled = true;
                if (elements.bookSlotBtn) {
                    elements.bookSlotBtn.disabled = true;
                    elements.bookSlotBtn.innerHTML = 'Being Served';
                    elements.bookSlotBtn.classList.add('opacity-50', 'cursor-not-allowed');
                }
            }
        } else {
            // No active booking - reset displays
            if (elements.yourToken) elements.yourToken.textContent = '--';
            if (elements.studentsAhead) elements.studentsAhead.textContent = '0';
            if (elements.waitTime) elements.waitTime.textContent = '--';
            
            // STUDENTS WITH NO BOOKING CAN BOOK
            if (elements.slotDate) elements.slotDate.disabled = false;
            if (elements.slotTime) elements.slotTime.disabled = false;
            if (elements.bookSlotBtn) {
                elements.bookSlotBtn.disabled = false;
                elements.bookSlotBtn.innerHTML = 'Book Slot';
                elements.bookSlotBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
        
        // FORCE REPAINT - Force the browser to update the display
        setTimeout(() => {
            // Force a reflow on the specific elements
            ['yourToken', 'studentsAhead', 'waitTime', 'currentToken'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    // Reading offsetHeight forces a reflow
                    const forceReflow = el.offsetHeight;
                    // Tiny style change and revert
                    el.style.transform = 'translateZ(0)';
                    setTimeout(() => { el.style.transform = ''; }, 10);
                }
            });
            
            // Also force repaint on the parent container
            const container = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-4');
            if (container) {
                container.style.opacity = '0.99';
                setTimeout(() => { container.style.opacity = '1'; }, 10);
            }
            
            log('Force repaint completed');
        }, 50);
        
    } catch (error) {
        console.error('Failed to update student dashboard:', error);
        showToast('Error updating dashboard');
    }
}

// ==================== TIME SLOT FUNCTIONS ====================
function generateTimeSlots() {
    const select = document.getElementById('slotTime');
    if (!select) {
        console.error('❌ Slot time select element not found');
        return;
    }
    
    select.innerHTML = '<option value="">Select a time slot</option>';
    
    let hours = 9;
    let minutes = 30;
    const endHours = 17;
    const breakStart = 13 * 60;
    const breakEnd = 14 * 60;
    
    while (hours < endHours || (hours === endHours && minutes === 0)) {
        const currentMinutes = hours * 60 + minutes;
        
        if (currentMinutes >= breakStart && currentMinutes < breakEnd) {
            hours = 14;
            minutes = 0;
            continue;
        }
        
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours > 12 ? hours - 12 : hours;
        const displayHoursFormatted = displayHours === 0 ? 12 : displayHours;
        const timeStr = `${displayHoursFormatted}:${String(minutes).padStart(2, '0')} ${ampm}`;
        
        const option = document.createElement('option');
        option.value = timeStr;
        option.textContent = timeStr;
        select.appendChild(option);
        
        minutes += 7;
        if (minutes >= 60) {
            hours++;
            minutes = minutes % 60;
        }
    }
}

async function loadAvailableSlots() {
    const date = document.getElementById('slotDate').value;
    const select = document.getElementById('slotTime');
    
    if (!date || !select) return;
    
    try {
        generateTimeSlots();
        
        const response = await apiRequest(`/bookings/available-slots?date=${date}`);
        
        Array.from(select.options).forEach(option => {
            if (option.value) {
                const slot = response.slots.find(s => s.time === option.value);
                if (slot && !slot.available) {
                    option.disabled = true;
                    option.textContent = `${option.value} - Booked`;
                    option.classList.add('text-slate-400', 'line-through');
                }
            }
        });
    } catch (error) {
        console.error('❌ Failed to load slots:', error);
        showToast('Using default slots - booking availability may not be accurate');
    }
}

function setMinDate() {
    const dateInput = document.getElementById('slotDate');
    if (dateInput) {
        dateInput.min = new Date().toISOString().split('T')[0];
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
    
    // Check if user is already verified
    try {
        const checkResponse = await apiRequest('/bookings/my-bookings');
        const today = new Date().toISOString().split('T')[0];
        const existingBooking = checkResponse.bookings.find(b => b.slotDate === today);
        
        if (existingBooking && existingBooking.status === 'verified') {
            showToast('You are already verified and cannot book another slot');
            return;
        }
    } catch (error) {
        console.log('Error checking verification status');
    }
    
    const btn = document.getElementById('bookSlotBtn');
    btn.disabled = true;
    btn.innerHTML = 'Booking...';
    
    try {
        const response = await apiRequest('/bookings', {
            method: 'POST',
            body: JSON.stringify({ slotDate: date, slotTime: time })
        });
        
        // Show booked slot details
        document.getElementById('yourToken').textContent = response.booking.token;
        document.getElementById('waitTime').textContent = `${response.booking.estimatedWaitTime} min`;
        document.getElementById('studentsAhead').textContent = response.booking.studentsBefore || 0;
        
        // Show booking confirmation
        const confirmationDiv = document.getElementById('bookingConfirmation');
        if (confirmationDiv) {
            confirmationDiv.classList.remove('hidden');
            document.getElementById('confirmationMessage').innerHTML = 
                `<strong>Your Booked Slot:</strong><br>
                Token: ${response.booking.token}<br>
                Time: ${time}<br>
                Date: ${new Date(date).toLocaleDateString()}<br>
                Students Ahead: ${response.booking.studentsBefore || 0}`;
            
            setTimeout(() => {
                confirmationDiv.classList.add('hidden');
            }, 8000);
        }
        
        // Show pending message and disable booking form
        document.getElementById('pendingMessage')?.classList.remove('hidden');
        document.getElementById('cancelBookingContainer')?.classList.remove('hidden');
        
        // Disable booking form after successful booking
        document.getElementById('slotDate').disabled = true;
        document.getElementById('slotTime').disabled = true;
        document.getElementById('bookSlotBtn').disabled = true;
        document.getElementById('bookSlotBtn').innerHTML = 'Already Booked';
        document.getElementById('bookSlotBtn').classList.add('opacity-50', 'cursor-not-allowed');
        
        showToast('Slot booked successfully!');
        await loadAvailableSlots();
        await updateStudentDashboard();
        
    } catch (error) {
        showToast(error.message || 'Failed to book slot');
        // Re-enable button on error
        btn.disabled = false;
        btn.innerHTML = 'Book Slot';
    }
}

// ==================== CANCEL BOOKING FUNCTIONS ====================
function showCancelConfirmation() {
    document.getElementById('cancelModal')?.classList.remove('hidden');
}

function closeCancelModal() {
    document.getElementById('cancelModal')?.classList.add('hidden');
}

async function cancelBooking() {
    try {
        const myBookings = await apiRequest('/bookings/my-bookings');
        const today = new Date().toISOString().split('T')[0];
        const todaysBooking = myBookings.bookings.find(b => b.slotDate === today);
        
        if (!todaysBooking) {
            showToast('No active booking found');
            closeCancelModal();
            return;
        }
        
        await apiRequest(`/bookings/cancel/${todaysBooking.id}`, {
            method: 'PUT'
        });
        
        showToast('Booking cancelled successfully');
        closeCancelModal();
        
        await updateStudentDashboard();
        
    } catch (error) {
        showToast(error.message || 'Failed to cancel booking');
    }
}

function enableRebooking() {
    document.getElementById('rejectedMessage')?.classList.add('hidden');
    document.getElementById('slotDate').disabled = false;
    document.getElementById('slotTime').disabled = false;
    document.getElementById('bookSlotBtn').disabled = false;
    document.getElementById('bookSlotBtn').innerHTML = 'Book Slot';
    document.getElementById('cancelBookingContainer')?.classList.add('hidden');
    showToast('You can now book a new slot');
}

// ==================== STUDENT PROFILE FUNCTIONS ====================
async function showStudentProfileModal() {
    log('Opening student profile modal');
    
    if (!currentUser) {
        showToast('No user logged in');
        return;
    }
    
    try {
        let bookings = [];
        try {
            const response = await apiRequest('/bookings/my-bookings');
            bookings = response.bookings || [];
        } catch (error) {
            log('No bookings found');
        }
        
        const nameParts = currentUser.name ? currentUser.name.split(' ') : ['User'];
        const initials = nameParts.map(n => n[0]).join('').toUpperCase().substring(0, 2);
        
        const formatDate = (dateString) => {
            if (!dateString) return 'N/A';
            try {
                return new Date(dateString).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            } catch {
                return dateString;
            }
        };
        
        const profileHtml = `
            <div class="flex items-start gap-6 mb-8">
                <div class="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-3xl shadow-lg">
                    ${initials}
                </div>
                <div class="flex-1">
                    <h3 class="text-2xl font-bold text-slate-800">${currentUser.name || 'N/A'}</h3>
                    <p class="text-slate-600">${currentUser.email || 'N/A'}</p>
                    <div class="flex flex-wrap gap-2 mt-2">
                        <span class="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium">${currentUser.scholarId || 'Not Assigned'}</span>
                        <span class="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">${currentUser.uniqueKey || 'N/A'}</span>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div class="bg-slate-50 rounded-xl p-4">
                    <h4 class="font-semibold text-slate-700 mb-3">Personal Information</h4>
                    <div class="space-y-2">
                        <div class="flex justify-between"><span class="text-slate-500">Mobile:</span><span class="font-medium">${currentUser.mobileNumber || 'N/A'}</span></div>
                        <div class="flex justify-between"><span class="text-slate-500">Department:</span><span class="font-medium">${currentUser.department || 'N/A'}</span></div>
                        <div class="flex justify-between"><span class="text-slate-500">Year:</span><span class="font-medium">${currentUser.currentYear || 'N/A'}</span></div>
                        <div class="flex justify-between"><span class="text-slate-500">Joined:</span><span class="font-medium">${currentUser.joiningYear || 'N/A'}</span></div>
                    </div>
                </div>
                
                <div class="bg-slate-50 rounded-xl p-4">
                    <h4 class="font-semibold text-slate-700 mb-3">Academic Information</h4>
                    <div class="space-y-2">
                        <div class="flex justify-between"><span class="text-slate-500">GR Number:</span><span class="font-medium">${currentUser.grNumber || 'N/A'}</span></div>
                        <div class="flex justify-between"><span class="text-slate-500">Scholarship:</span><span class="font-medium">${currentUser.scholarshipType || 'N/A'}</span></div>
                        <div class="flex justify-between"><span class="text-slate-500">Scholar ID:</span><span class="font-medium">${currentUser.scholarId || 'N/A'}</span></div>
                        <div class="flex justify-between"><span class="text-slate-500">Status:</span><span class="font-medium text-emerald-600">Active</span></div>
                    </div>
                </div>
            </div>
            
            <div class="bg-slate-50 rounded-xl p-4">
                <h4 class="font-semibold text-slate-700 mb-3">Booking History</h4>
                ${bookings.length > 0 ? `
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead><tr class="border-b"><th class="text-left py-2">Date</th><th class="text-left py-2">Token</th><th class="text-left py-2">Time</th><th class="text-left py-2">Status</th></tr></thead>
                            <tbody>${bookings.map(booking => `
                                <tr class="border-b">
                                    <td class="py-2">${formatDate(booking.slotDate)}</td>
                                    <td class="py-2 font-mono">${booking.token || 'N/A'}</td>
                                    <td class="py-2">${booking.slotTime || 'N/A'}</td>
                                    <td class="py-2"><span class="px-2 py-1 rounded-full text-xs ${
                                        booking.status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                                        booking.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                        booking.status === 'current' ? 'bg-blue-100 text-blue-700' :
                                        booking.status === 'cancelled' ? 'bg-slate-100 text-slate-600' :
                                        'bg-amber-100 text-amber-700'
                                    }">${booking.status || 'pending'}</span></td>
                                </tr>`).join('')}</tbody>
                        </table>
                    </div>
                ` : '<p class="text-slate-500 text-center py-4">No booking history found</p>'}
            </div>
        `;
        
        const contentDiv = document.getElementById('studentProfileContent');
        if (contentDiv) contentDiv.innerHTML = profileHtml;
        
        const modal = document.getElementById('studentProfileModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.onclick = (e) => {
                if (e.target === modal) closeStudentProfileModal();
            };
        }
    } catch (error) {
        console.error('Failed to load profile:', error);
        showToast('Failed to load profile');
    }
}

function closeStudentProfileModal() {
    document.getElementById('studentProfileModal')?.classList.add('hidden');
}

// ==================== DOCUMENT CHECKLIST FUNCTIONS ====================
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

function getDocumentChecklist(scholarshipType) {
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
    }
    return baseDocuments;
}

function updateDocumentChecklist() {
    const scholarshipType = document.getElementById('scholarshipType')?.value;
    if (scholarshipType) {
        log('Selected scholarship type:', scholarshipType);
        getDocumentChecklist(scholarshipType);
    }
}

// ==================== ADMIN DASHBOARD FUNCTIONS ====================
async function showAdminDashboard() {
    document.getElementById('authPage').classList.add('hidden');
    document.getElementById('adminDashboard').classList.remove('hidden');
    document.getElementById('adminName').textContent = currentUser.name;
    
    await loadAdminDashboard();
    await renderAdminTable();
    setupStudentSearch();
    await loadOngoingStudent();
    
    setInterval(async () => {
        if (currentUser?.userType === 'admin') {
            await loadAdminDashboard();
            await renderAdminTable();
            await loadOngoingStudent();
        }
    }, 30000);
}

async function loadAdminDashboard() {
    try {
        const response = await apiRequest('/admin/dashboard');
        
        // Add null checks for all elements
        const todaysDeptEl = document.getElementById('todaysDept');
        if (todaysDeptEl) {
            todaysDeptEl.textContent = `Today: ${response.today.departments?.join(', ') || 'No Department'}`;
        }
        
        const todaysDeptSidebar = document.getElementById('todaysDeptSidebar');
        if (todaysDeptSidebar) {
            todaysDeptSidebar.textContent = response.today.departments?.join(', ') || 'No Department';
        }
        
        const adminCurrentTokenSidebar = document.getElementById('adminCurrentTokenSidebar');
        if (adminCurrentTokenSidebar) {
            adminCurrentTokenSidebar.textContent = response.today.currentToken || '---';
        }
        
        const totalTodaySidebar = document.getElementById('totalTodaySidebar');
        if (totalTodaySidebar) {
            totalTodaySidebar.textContent = response.today.total || 0;
        }
        
        const verifiedCountSidebar = document.getElementById('verifiedCountSidebar');
        if (verifiedCountSidebar) {
            verifiedCountSidebar.textContent = response.today.verified || 0;
        }
        
        const rejectedCountSidebar = document.getElementById('rejectedCountSidebar');
        if (rejectedCountSidebar) {
            rejectedCountSidebar.textContent = response.today.rejected || 0;
        }
        
        const pendingCountSidebar = document.getElementById('pendingCountSidebar');
        if (pendingCountSidebar) {
            pendingCountSidebar.textContent = response.today.pending || 0;
        }
        
        const adminCurrentToken = document.getElementById('adminCurrentToken');
        if (adminCurrentToken) {
            adminCurrentToken.textContent = response.today.currentToken || '---';
        }
        
        const totalToday = document.getElementById('totalToday');
        if (totalToday) {
            totalToday.textContent = response.today.total || 0;
        }
        
        const verifiedCount = document.getElementById('verifiedCount');
        if (verifiedCount) {
            verifiedCount.textContent = response.today.verified || 0;
        }
        
        const rejectedCount = document.getElementById('rejectedCount');
        if (rejectedCount) {
            rejectedCount.textContent = response.today.rejected || 0;
        }
        
        if (response.weekly) {
            const weeklyTotalStats = document.getElementById('weeklyTotalStats');
            if (weeklyTotalStats) weeklyTotalStats.textContent = response.weekly.total || 0;
            
            const weeklyVerified = document.getElementById('weeklyVerified');
            if (weeklyVerified) weeklyVerified.textContent = response.weekly.verified || 0;
            
            const weeklyRejected = document.getElementById('weeklyRejected');
            if (weeklyRejected) weeklyRejected.textContent = response.weekly.rejected || 0;
            
            const weeklyPending = document.getElementById('weeklyPending');
            if (weeklyPending) weeklyPending.textContent = response.weekly.pending || 0;
        }
        
        if (response.monthly) {
            const monthlyTotalStats = document.getElementById('monthlyTotalStats');
            if (monthlyTotalStats) monthlyTotalStats.textContent = response.monthly.total || 0;
            
            const monthlyVerified = document.getElementById('monthlyVerified');
            if (monthlyVerified) monthlyVerified.textContent = response.monthly.verified || 0;
            
            const monthlyRejected = document.getElementById('monthlyRejected');
            if (monthlyRejected) monthlyRejected.textContent = response.monthly.rejected || 0;
            
            const monthlyPending = document.getElementById('monthlyPending');
            if (monthlyPending) monthlyPending.textContent = response.monthly.pending || 0;
        }
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
        const response = await apiRequest('/admin/queue');
        
        if (response.queue.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-8 text-center text-slate-500">No students in queue for today.</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        
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
                    <button onclick="openVerificationModal('${booking.id}')" class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-all">
                        Verify Documents
                    </button>
                `;
            } else if (booking.status === 'pending') {
                actionBtns = '<span class="text-xs text-slate-400">Waiting</span>';
            } else {
                actionBtns = '<span class="text-xs text-slate-400">Completed</span>';
            }
            
            row.innerHTML = `
                <td class="px-4 py-3"><span class="font-mono font-bold ${booking.status === 'current' ? 'text-emerald-600' : 'text-slate-800'}">${booking.token}</span></td>
                <td class="px-4 py-3"><div class="font-medium text-slate-800">${booking.name}</div></td>
                <td class="px-4 py-3"><span class="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium">${booking.department}</span></td>
                <td class="px-4 py-3"><span class="text-xs font-mono">${booking.scholarId || 'N/A'}</span></td>
                <td class="px-4 py-3"><span class="text-xs">${booking.grNumber || 'N/A'}</span></td>
                <td class="px-4 py-3"><span class="text-xs">${booking.currentYear || 'N/A'}</span></td>
                <td class="px-4 py-3"><span class="text-sm text-slate-600">${booking.slotTime}</span></td>
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

// ==================== ONGOING STUDENT FUNCTIONS ====================
async function loadOngoingStudent() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const dayOfWeek = new Date().getDay();
        const dayToDept = {
            1: 'DS', 2: 'AIML', 3: 'COMP', 4: 'IT',
            5: ['MECH', 'CIVIL', 'AUTO'], 6: 'SAT', 0: 'SUN'
        };
        
        const departments = Array.isArray(dayToDept[dayOfWeek]) 
            ? dayToDept[dayOfWeek] 
            : [dayToDept[dayOfWeek]].filter(Boolean);
        
        const container = document.getElementById('ongoingStudentContent');
        if (!container) return;
        
        if (departments.length === 0) {
            container.innerHTML = '<div class="w-full text-center py-8 text-slate-500">No department scheduled today</div>';
            return;
        }
        
        const department = departments[0];
        const response = await apiRequest(`/bookings/current?department=${department}`);
        
        if (!response.currentToken) {
            container.innerHTML = `
                <div class="w-full text-center py-8 text-slate-500">
                    <p class="text-lg font-medium">No student currently being served</p>
                    <p class="text-sm">Click "Next Token" to start serving</p>
                </div>
            `;
            return;
        }
        
        const queueResponse = await apiRequest(`/admin/queue?department=${department}&date=${today}`);
        const currentBooking = queueResponse.queue.find(b => b.token === response.currentToken);
        
        if (currentBooking) displayOngoingStudent(currentBooking);
    } catch (error) {
        console.error('Failed to load ongoing student:', error);
    }
}

function displayOngoingStudent(booking) {
    const container = document.getElementById('ongoingStudentContent');
    if (!container) return;
    
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
async function openVerificationModal(bookingId) {
    try {
        const response = await apiRequest(`/admin/queue/${bookingId}`);
        const booking = response.booking;
        const student = booking.student;
        
        const modal = document.getElementById('verificationModal');
        const content = document.getElementById('verificationContent');
        
        const documents = booking.documents || {};
        const scholarshipType = booking.scholarshipType || student?.scholarshipType || 'Other';
        const checklist = getDocumentChecklist(scholarshipType);
        
        const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        
        let docsHtml = `
            <div class="mb-6">
                <div class="flex items-start gap-4 mb-4">
                    <div class="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">${initials}</div>
                    <div>
                        <h3 class="text-xl font-bold text-slate-800">${student.name}</h3>
                        <p class="text-sm text-slate-600">${student.email}</p>
                        <div class="flex gap-2 mt-2">
                            <span class="px-2 py-1 bg-violet-100 text-violet-700 rounded-full text-xs">${booking.token}</span>
                            <span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs">${student.department}</span>
                        </div>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-4 p-4 bg-slate-50 rounded-lg">
                    <div><p class="text-xs text-slate-500">Scholar ID</p><p class="font-medium">${student.scholarId || 'N/A'}</p></div>
                    <div><p class="text-xs text-slate-500">GR Number</p><p class="font-medium">${student.grNumber || 'N/A'}</p></div>
                    <div><p class="text-xs text-slate-500">Current Year</p><p class="font-medium">${student.currentYear || 'N/A'}</p></div>
                    <div><p class="text-xs text-slate-500">Scholarship Type</p><p class="font-medium">${student.scholarshipType || 'N/A'}</p></div>
                </div>
                
                <h4 class="font-semibold text-slate-700 mb-3">Document Verification</h4>
                <div class="space-y-3 max-h-96 overflow-y-auto pr-2">
        `;
        
        checklist.forEach(doc => {
            const status = documents[doc.id]?.status || 'pending';
            const statusClass = {
                'approved': 'bg-emerald-50 border-emerald-200',
                'rejected': 'bg-red-50 border-red-200',
                'pending': 'bg-slate-50 border-slate-200'
            }[status];
            
            docsHtml += `
                <div class="flex items-center justify-between p-3 border rounded-lg ${statusClass}">
                    <div class="flex items-center gap-3">
                        <input type="checkbox" id="doc-${doc.id}" data-doc-id="${doc.id}" ${status === 'approved' ? 'checked' : ''} class="w-4 h-4 text-emerald-600 rounded">
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
        
        docsHtml += `
                </div>
            </div>
            <div class="mt-6 flex justify-end gap-3 border-t pt-4">
                <button onclick="closeVerificationModal()" class="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">Cancel</button>
                <button onclick="submitVerification('${bookingId}')" class="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">Submit Verification</button>
            </div>
        `;
        
        content.innerHTML = docsHtml;
        modal.classList.remove('hidden');
        modal.onclick = (e) => {
            if (e.target === modal) closeVerificationModal();
        };
    } catch (error) {
        console.error('Failed to open verification modal:', error);
        showToast('Failed to load verification data');
    }
}

function closeVerificationModal() {
    document.getElementById('verificationModal')?.classList.add('hidden');
}

function collectDocumentStatuses() {
    const documents = {};
    document.querySelectorAll('[id^="doc-"]').forEach(checkbox => {
        const docId = checkbox.dataset.docId;
        const statusSelect = document.getElementById(`status-${docId}`);
        if (statusSelect) {
            documents[docId] = checkbox.checked && statusSelect.value === 'pending' ? 'approved' : statusSelect.value;
        }
    });
    return documents;
}

async function submitVerification(bookingId) {
    try {
        const documents = collectDocumentStatuses();
        const values = Object.values(documents);
        const status = values.every(v => v === 'approved') ? 'verified' : 
                      values.some(v => v === 'rejected') ? 'rejected' : 'pending';
        
        await apiRequest(`/admin/queue/${bookingId}/verify`, {
            method: 'PUT',
            body: JSON.stringify({ documents, status })
        });
        
        showToast('Verification submitted successfully');
        closeVerificationModal();
        await loadAdminDashboard();
        await renderAdminTable();
        await loadOngoingStudent();
    } catch (error) {
        showToast(error.message || 'Failed to submit verification');
    }
}

// ==================== STUDENT SEARCH FUNCTIONS ====================
let searchTimeout;

function setupStudentSearch() {
    const searchInput = document.getElementById('studentSearch');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (e.target.value.length >= 2) searchStudents();
            else document.getElementById('searchResults')?.classList.add('hidden');
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
            
            const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            
            studentCard.innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">${initials}</div>
                    <div class="flex-1">
                        <h4 class="font-semibold text-slate-800">${student.name}</h4>
                        <p class="text-sm text-slate-600">${student.email}</p>
                        <div class="flex gap-2 mt-2">
                            <span class="px-2 py-1 bg-violet-100 text-violet-700 rounded-full text-xs">${student.scholarId || 'N/A'}</span>
                            <span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs">${student.grNumber || 'N/A'}</span>
                            <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">${student.department} - ${student.currentYear}</span>
                        </div>
                    </div>
                    <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
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
        const student = response.student;
        const bookings = response.bookings || [];
        
        const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        
        const formatDate = (date) => new Date(date).toLocaleDateString();
        
        const profileHtml = `
            <div class="flex items-start gap-6 mb-8">
                <div class="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl shadow-lg">${initials}</div>
                <div class="flex-1">
                    <h3 class="text-2xl font-bold text-slate-800">${student.name}</h3>
                    <p class="text-slate-600">${student.email}</p>
                    <div class="flex gap-2 mt-2">
                        <span class="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium">${student.scholarId || 'Not Assigned'}</span>
                        <span class="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">${student.uniqueKey}</span>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-6 mb-8">
                <div class="bg-slate-50 rounded-xl p-4">
                    <h4 class="font-semibold text-slate-700 mb-3">Personal Information</h4>
                    <div class="space-y-2">
                        <div class="flex justify-between"><span class="text-slate-500">Mobile:</span><span class="font-medium">${student.mobileNumber || 'N/A'}</span></div>
                        <div class="flex justify-between"><span class="text-slate-500">Department:</span><span class="font-medium">${student.department || 'N/A'}</span></div>
                        <div class="flex justify-between"><span class="text-slate-500">Year:</span><span class="font-medium">${student.currentYear || 'N/A'}</span></div>
                        <div class="flex justify-between"><span class="text-slate-500">Joined:</span><span class="font-medium">${student.joiningYear || 'N/A'}</span></div>
                    </div>
                </div>
                
                <div class="bg-slate-50 rounded-xl p-4">
                    <h4 class="font-semibold text-slate-700 mb-3">Academic Information</h4>
                    <div class="space-y-2">
                        <div class="flex justify-between"><span class="text-slate-500">GR Number:</span><span class="font-medium">${student.grNumber || 'N/A'}</span></div>
                        <div class="flex justify-between"><span class="text-slate-500">Scholarship:</span><span class="font-medium">${student.scholarshipType || 'N/A'}</span></div>
                        <div class="flex justify-between"><span class="text-slate-500">Scholar ID:</span><span class="font-medium">${student.scholarId || 'N/A'}</span></div>
                        <div class="flex justify-between"><span class="text-slate-500">Status:</span><span class="font-medium ${student.isActive ? 'text-emerald-600' : 'text-red-600'}">${student.isActive ? 'Active' : 'Inactive'}</span></div>
                    </div>
                </div>
            </div>
            
            <div class="bg-slate-50 rounded-xl p-4">
                <h4 class="font-semibold text-slate-700 mb-3">Booking History</h4>
                ${bookings.length ? `
                    <table class="w-full text-sm">
                        <thead><tr class="border-b"><th class="text-left py-2">Date</th><th class="text-left py-2">Token</th><th class="text-left py-2">Time</th><th class="text-left py-2">Status</th></tr></thead>
                        <tbody>${bookings.map(b => `<tr class="border-b"><td class="py-2">${formatDate(b.slotDate)}</td><td class="py-2 font-mono">${b.department}-${String(b.tokenNumber).padStart(3,'0')}</td><td class="py-2">${b.slotTime}</td><td class="py-2"><span class="px-2 py-1 rounded-full text-xs ${b.status === 'verified' ? 'bg-emerald-100 text-emerald-700' : b.status === 'rejected' ? 'bg-red-100 text-red-700' : b.status === 'current' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}">${b.status}</span></td></tr>`).join('')}</tbody>
                    </table>
                ` : '<p class="text-slate-500 text-center py-4">No booking history found</p>'}
            </div>
        `;
        
        document.getElementById('studentProfileContent').innerHTML = profileHtml;
        const modal = document.getElementById('studentProfileModal');
        modal.classList.remove('hidden');
        modal.onclick = (e) => { if (e.target === modal) closeStudentProfile(); };
    } catch (error) {
        showToast('Failed to load student profile');
    }
}

function closeStudentProfile() {
    document.getElementById('studentProfileModal')?.classList.add('hidden');
}

// ==================== QUEUE CONTROL FUNCTIONS ====================
async function nextToken() {
    try {
        const dayOfWeek = new Date().getDay();
        const dayToDept = {1:'DS',2:'AIML',3:'COMP',4:'IT',5:'MECH',6:'SAT',0:'SUN'};
        const department = dayToDept[dayOfWeek];
        
        if (!department) {
            showToast('No department scheduled today');
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
        
        if (response.currentToken) {
            setTimeout(async () => {
                const queue = await apiRequest(`/admin/queue?department=${department}`);
                const current = queue.queue.find(b => b.token === response.currentToken);
                if (current) openVerificationModal(current.id);
            }, 500);
        }
    } catch (error) {
        showToast(error.message || 'Failed to move to next token');
    }
}

function togglePause() {
    isPaused = !isPaused;
    const btn = document.getElementById('pauseBtn');
    const dot = document.getElementById('queueStatusDot');
    const text = document.getElementById('queueStatusText');
    
    if (isPaused) {
        btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Resume Queue';
        btn.className = 'px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl shadow-lg flex items-center gap-2';
        dot.className = 'w-3 h-3 rounded-full bg-amber-500';
        text.textContent = 'Paused';
        text.className = 'text-sm text-amber-600 font-medium';
    } else {
        btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Pause Queue';
        btn.className = 'px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-lg flex items-center gap-2';
        dot.className = 'pulse-dot w-3 h-3 rounded-full bg-emerald-500';
        text.textContent = 'Active';
        text.className = 'text-sm text-emerald-600 font-medium';
    }
    showToast(isPaused ? 'Queue paused' : 'Queue resumed');
}

function addExtraTime() {
    showToast('Added 5 minutes extra time for current token');
}

// ==================== STATISTICS FUNCTIONS ====================
function showCurrentServing() {
    document.getElementById('currentServingContent')?.classList.remove('hidden');
    document.getElementById('adminStatisticsContent')?.classList.add('hidden');
    document.getElementById('studentsRecordsContent')?.classList.add('hidden');
    document.getElementById('currentServingTab').className = 'w-full text-left px-4 py-3 rounded-xl bg-violet-50 text-violet-700 font-medium hover:bg-violet-100 transition-all flex items-center gap-3';
    document.getElementById('adminStatsTab').className = 'w-full text-left px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-3';
    document.getElementById('studentsRecordsTab').className = 'w-full text-left px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-3';
}

function showAdminStatistics() {
    document.getElementById('currentServingContent')?.classList.add('hidden');
    document.getElementById('adminStatisticsContent')?.classList.remove('hidden');
    document.getElementById('studentsRecordsContent')?.classList.add('hidden');
    document.getElementById('adminStatsTab').className = 'w-full text-left px-4 py-3 rounded-xl bg-violet-50 text-violet-700 font-medium hover:bg-violet-100 transition-all flex items-center gap-3';
    document.getElementById('currentServingTab').className = 'w-full text-left px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-3';
    document.getElementById('studentsRecordsTab').className = 'w-full text-left px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-3';
    loadDepartmentStats();
}

async function loadDepartmentStats() {
    try {
        const dept = document.getElementById('statsDepartmentFilter')?.value || 'all';
        const res = await apiRequest(`/admin/stats?department=${dept}`);
        if (res.stats) {
            document.getElementById('weeklyTotal').textContent = res.stats.total || 0;
            document.getElementById('weeklyVerified').textContent = res.stats.verified || 0;
            document.getElementById('weeklyRejected').textContent = res.stats.rejected || 0;
            document.getElementById('weeklyPending').textContent = res.stats.pending || 0;
            document.getElementById('monthlyTotal').textContent = res.stats.total || 0;
            document.getElementById('monthlyVerified').textContent = res.stats.verified || 0;
            document.getElementById('monthlyRejected').textContent = res.stats.rejected || 0;
            document.getElementById('monthlyPending').textContent = res.stats.pending || 0;
        }
    } catch (error) {
        console.error('Failed to load statistics:', error);
    }
}

// ==================== STUDENTS RECORDS FUNCTIONS ====================
let currentRecordsPage = 1;
let recordsPerPage = 50;
let totalRecords = 0;
let allRecords = [];
let filteredRecords = [];
let allDocumentTypes = [];

// Show students records content
function showStudentsRecords() {
    console.log('Showing students records');
    
    // Hide other content
    document.getElementById('currentServingContent')?.classList.add('hidden');
    document.getElementById('adminStatisticsContent')?.classList.add('hidden');
    document.getElementById('studentsRecordsContent')?.classList.remove('hidden');
    
    // Update tab styles
    document.getElementById('currentServingTab').className = 'w-full text-left px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-3';
    document.getElementById('adminStatsTab').className = 'w-full text-left px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-3';
    document.getElementById('studentsRecordsTab').className = 'w-full text-left px-4 py-3 rounded-xl bg-violet-50 text-violet-700 font-medium hover:bg-violet-100 transition-all flex items-center gap-3';
    
    // Load records
    loadStudentsRecords();
}

// Load students records from API
async function loadStudentsRecords() {
    try {
        console.log('Loading students records...');
        
        let department = document.getElementById('recordsDepartmentFilter')?.value || 'all';
        
        // Don't send "all" - send empty string instead
        const deptParam = department === 'all' ? '' : department;
        
        console.log(`Fetching from: /admin/students/all?department=${deptParam}&page=${currentRecordsPage}&limit=${recordsPerPage}`);
        
        const response = await apiRequest(`/admin/students/all?department=${deptParam}&page=${currentRecordsPage}&limit=${recordsPerPage}`);
        
        console.log('API Response:', response);
        
        allRecords = response.students || [];
        totalRecords = response.pagination?.total || 0;
        filteredRecords = allRecords;
        
        // Collect all unique document types from all students
        allDocumentTypes = new Set();
        allRecords.forEach(student => {
            if (student.documentStatus) {
                Object.keys(student.documentStatus).forEach(docId => allDocumentTypes.add(docId));
            }
        });
        
        // Add default document types if none found
        if (allDocumentTypes.size === 0) {
            const defaultDocs = [
                'aadhar', 'domicile', 'income', 'ssc', 'hsc', 'previousYear',
                'feeReceipt', 'capLetter', 'bankPassbook', 'bonafide', 'leaving', 'selfDeclaration',
                'caste', 'casteValidity', 'nonCreamy'
            ];
            defaultDocs.forEach(doc => allDocumentTypes.add(doc));
        }
        
        allDocumentTypes = Array.from(allDocumentTypes).sort();
        
        console.log(`Loaded ${allRecords.length} records with ${allDocumentTypes.length} document types`);
        renderRecordsTable();
        updatePagination();
        
    } catch (error) {
        console.error('Failed to load students records:', error);
        
        let errorMessage = 'Failed to load records. ';
        if (error.message) {
            errorMessage += error.message;
        }
        
        showToast(errorMessage);
        
        const tbody = document.getElementById('studentsRecordsBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="20" class="px-6 py-8 text-center text-red-500">${errorMessage}. Check console for details.</td></tr>`;
        }
    }
}

// Render records table with document columns
function renderRecordsTable() {
    const tbody = document.getElementById('studentsRecordsBody');
    if (!tbody) return;
    
    // Update table header with document columns
    const thead = document.querySelector('#studentsRecordsContent thead tr');
    if (thead) {
        // Keep existing headers
        let html = `
            <th class="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">S.No</th>
            <th class="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Name</th>
            <th class="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Email</th>
            <th class="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Mobile</th>
            <th class="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Dept</th>
            <th class="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Year</th>
            <th class="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">GR No.</th>
            <th class="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Scholar ID</th>
            <th class="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Scholarship</th>
            <th class="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Status</th>
        `;
        
        // Add document columns with compact headers
        allDocumentTypes.forEach(docId => {
            // Use shorter names for document columns
            let shortName = getDocumentShortName(docId);
            html += `<th class="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap" title="${getDocumentDisplayName(docId)}">${shortName}</th>`;
        });
        
        html += `<th class="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Actions</th>`;
        
        thead.innerHTML = html;
    }
    
    if (filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="20" class="px-6 py-8 text-center text-slate-500">No records found</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    filteredRecords.forEach((student, index) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-50';
        row.dataset.id = student.id;
        
        // Get latest booking status badge
        let statusBadge = '<span class="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs whitespace-nowrap">No bookings</span>';
        if (student.latestBooking) {
            const status = student.latestBooking.status;
            statusBadge = `<span class="px-2 py-1 rounded-full text-xs whitespace-nowrap ${
                status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                status === 'rejected' ? 'bg-red-100 text-red-700' :
                status === 'current' ? 'bg-blue-100 text-blue-700' :
                'bg-amber-100 text-amber-700'
            }">${status}</span>`;
        }
        
        // Start building row
        let rowHtml = `
            <td class="px-3 py-3 text-sm whitespace-nowrap">${(currentRecordsPage - 1) * recordsPerPage + index + 1}</td>
            <td class="px-3 py-3">
                <div class="font-medium text-slate-800 whitespace-nowrap">${student.name || 'N/A'}</div>
                <div class="text-xs text-slate-500">${student.uniqueKey || ''}</div>
            </td>
            <td class="px-3 py-3 text-sm whitespace-nowrap">${student.email || 'N/A'}</td>
            <td class="px-3 py-3 text-sm whitespace-nowrap">${student.mobileNumber || 'N/A'}</td>
            <td class="px-3 py-3 text-sm whitespace-nowrap">
                <span class="px-2 py-1 bg-violet-100 text-violet-700 rounded-full text-xs">${student.department || 'N/A'}</span>
            </td>
            <td class="px-3 py-3 text-sm whitespace-nowrap">${student.currentYear || 'N/A'}</td>
            <td class="px-3 py-3 text-sm font-mono whitespace-nowrap">${student.grNumber || 'N/A'}</td>
            <td class="px-3 py-3 text-sm font-mono whitespace-nowrap">${student.scholarId || 'N/A'}</td>
            <td class="px-3 py-3 text-sm whitespace-nowrap">
                <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">${student.scholarshipType || 'N/A'}</span>
            </td>
            <td class="px-3 py-3 text-sm whitespace-nowrap">${statusBadge}</td>
        `;
        
        // Add document status columns - more compact representation
        allDocumentTypes.forEach(docId => {
            const status = student.documentStatus?.[docId] || 'not_submitted';
            let statusClass = 'bg-slate-100 text-slate-600';
            let statusText = '✗';
            let title = getDocumentDisplayName(docId) + ': ';
            
            if (status === 'approved') {
                statusClass = 'bg-emerald-100 text-emerald-700';
                statusText = '✓';
                title += 'Approved';
            } else if (status === 'rejected') {
                statusClass = 'bg-red-100 text-red-700';
                statusText = '✗';
                title += 'Rejected';
            } else if (status === 'pending') {
                statusClass = 'bg-amber-100 text-amber-700';
                statusText = '⏳';
                title += 'Pending';
            } else {
                title += 'Not Submitted';
            }
            
            rowHtml += `<td class="px-2 py-3 text-center"><span class="px-1.5 py-1 rounded-full text-xs ${statusClass}" title="${title}">${statusText}</span></td>`;
        });
        
        // Add actions
        rowHtml += `
            <td class="px-3 py-3 text-sm whitespace-nowrap">
                <div class="flex gap-2">
                    <button onclick="editStudentRecord('${student.id}')" class="text-amber-600 hover:text-amber-800 text-xs font-medium">
                        Edit
                    </button>
                    <button onclick="viewStudentProfile('${student.id}')" class="text-violet-600 hover:text-violet-800 text-xs font-medium">
                        View
                    </button>
                </div>
            </td>
        `;
        
        row.innerHTML = rowHtml;
        tbody.appendChild(row);
    });
}

// Helper function to get short document names for column headers
function getDocumentShortName(docId) {
    const shortNames = {
        'aadhar': 'Aadhar',
        'domicile': 'Domicile',
        'income': 'Income',
        'ssc': 'SSC',
        'hsc': 'HSC',
        'previousYear': 'Prev Yr',
        'feeReceipt': 'Fee Rec',
        'capLetter': 'CAP',
        'bankPassbook': 'Bank',
        'bonafide': 'Bonafide',
        'leaving': 'LC',
        'selfDeclaration': 'Self Dec',
        'caste': 'Caste',
        'casteValidity': 'Caste Val',
        'nonCreamy': 'NCL'
    };
    return shortNames[docId] || docId.substring(0, 5);
}

// Filter records based on search input
function filterRecords() {
    const searchTerm = document.getElementById('recordsSearch').value.toLowerCase().trim();
    
    if (!searchTerm) {
        filteredRecords = allRecords;
    } else {
        filteredRecords = allRecords.filter(student => 
            (student.name && student.name.toLowerCase().includes(searchTerm)) ||
            (student.email && student.email.toLowerCase().includes(searchTerm)) ||
            (student.grNumber && student.grNumber.toLowerCase().includes(searchTerm)) ||
            (student.scholarId && student.scholarId.toLowerCase().includes(searchTerm)) ||
            (student.mobileNumber && student.mobileNumber.includes(searchTerm)) ||
            (student.uniqueKey && student.uniqueKey.toLowerCase().includes(searchTerm))
        );
    }
    
    renderRecordsTable();
}

// View document details
async function viewDocumentDetails(studentId) {
    try {
        const student = allRecords.find(s => s.id === studentId);
        if (!student) {
            // Fetch if not in current records
            const response = await apiRequest(`/admin/students/${studentId}`);
            const studentData = response.student;
            const documents = {};
            
            // Get documents from bookings
            if (response.bookings && response.bookings.length > 0) {
                const latestBooking = response.bookings[0];
                if (latestBooking.documents) {
                    latestBooking.documents.forEach((value, key) => {
                        documents[key] = value;
                    });
                }
            }
            
            showDocumentModal(studentData, documents);
        } else {
            showDocumentModal(student, student.documentStatus || {});
        }
        
    } catch (error) {
        console.error('Error viewing documents:', error);
        showToast('Failed to load document details');
    }
}

// Show document modal
function showDocumentModal(student, documents) {
    const docTypes = Object.keys(documents);
    
    let html = `
        <div class="mb-4">
            <h3 class="text-lg font-semibold text-slate-800">${student.name || 'Student'}</h3>
            <p class="text-sm text-slate-600">${student.email || ''} | ${student.department || ''}</p>
        </div>
        <div class="space-y-2 max-h-96 overflow-y-auto">
    `;
    
    if (docTypes.length === 0) {
        html += '<p class="text-slate-500 text-center py-4">No documents submitted yet</p>';
    } else {
        docTypes.sort().forEach(docId => {
            const doc = documents[docId];
            const status = doc?.status || 'pending';
            const statusClass = {
                'approved': 'bg-emerald-100 text-emerald-700',
                'rejected': 'bg-red-100 text-red-700',
                'pending': 'bg-amber-100 text-amber-700'
            }[status] || 'bg-slate-100 text-slate-600';
            
            html += `
                <div class="flex justify-between items-center p-3 border rounded-lg">
                    <span class="text-sm font-medium">${getDocumentDisplayName(docId)}</span>
                    <span class="px-2 py-1 rounded-full text-xs ${statusClass}">${status}</span>
                </div>
            `;
        });
    }
    
    html += '</div>';
    
    document.getElementById('documentDetailsContent').innerHTML = html;
    document.getElementById('documentDetailsModal').classList.remove('hidden');
}

// Close document modal
function closeDocumentModal() {
    document.getElementById('documentDetailsModal').classList.add('hidden');
}

// Edit student record
async function editStudentRecord(studentId) {
    try {
        const response = await apiRequest(`/admin/students/${studentId}`);
        const student = response.student;
        
        const editHtml = `
            <form id="editStudentForm" onsubmit="saveStudentChanges(event, '${studentId}')">
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-2">Name</label>
                        <input type="text" id="editName" value="${student.name || ''}" class="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-2">Email</label>
                        <input type="email" id="editEmail" value="${student.email || ''}" class="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all" required>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-2">Mobile Number</label>
                        <input type="tel" id="editMobile" value="${student.mobileNumber || ''}" class="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-2">Department</label>
                        <select id="editDepartment" class="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all">
                            <option value="DS" ${student.department === 'DS' ? 'selected' : ''}>Data Science (DS)</option>
                            <option value="AIML" ${student.department === 'AIML' ? 'selected' : ''}>AI & ML (AIML)</option>
                            <option value="COMP" ${student.department === 'COMP' ? 'selected' : ''}>Computer Eng. (COMP)</option>
                            <option value="IT" ${student.department === 'IT' ? 'selected' : ''}>IT (IT)</option>
                            <option value="MECH" ${student.department === 'MECH' ? 'selected' : ''}>Mechanical (MECH)</option>
                            <option value="CIVIL" ${student.department === 'CIVIL' ? 'selected' : ''}>Civil (CIVIL)</option>
                            <option value="AUTO" ${student.department === 'AUTO' ? 'selected' : ''}>Automobile (AUTO)</option>
                            <option value="SAT" ${student.department === 'SAT' ? 'selected' : ''}>Weekend (SAT)</option>
                            <option value="SUN" ${student.department === 'SUN' ? 'selected' : ''}>Weekend (SUN)</option>
                        </select>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-2">Current Year</label>
                        <select id="editYear" class="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all">
                            <option value="FE" ${student.currentYear === 'FE' ? 'selected' : ''}>First Year (FE)</option>
                            <option value="SE" ${student.currentYear === 'SE' ? 'selected' : ''}>Second Year (SE)</option>
                            <option value="TE" ${student.currentYear === 'TE' ? 'selected' : ''}>Third Year (TE)</option>
                            <option value="BE" ${student.currentYear === 'BE' ? 'selected' : ''}>Final Year (BE)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-2">Joining Year</label>
                        <select id="editJoiningYear" class="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all">
                            <option value="2025" ${student.joiningYear === '2025' ? 'selected' : ''}>2025</option>
                            <option value="2024" ${student.joiningYear === '2024' ? 'selected' : ''}>2024</option>
                            <option value="2023" ${student.joiningYear === '2023' ? 'selected' : ''}>2023</option>
                            <option value="2022" ${student.joiningYear === '2022' ? 'selected' : ''}>2022</option>
                            <option value="2021" ${student.joiningYear === '2021' ? 'selected' : ''}>2021</option>
                            <option value="2020" ${student.joiningYear === '2020' ? 'selected' : ''}>2020</option>
                        </select>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-2">GR Number</label>
                        <input type="text" id="editGrNumber" value="${student.grNumber || ''}" class="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-2">Scholar ID</label>
                        <input type="text" id="editScholarId" value="${student.scholarId || ''}" class="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all" readonly class="bg-slate-50">
                        <p class="text-xs text-slate-500 mt-1">Scholar ID cannot be changed</p>
                    </div>
                </div>
                
                <div class="mb-6">
                    <label class="block text-sm font-medium text-slate-700 mb-2">Scholarship Type</label>
                    <select id="editScholarship" class="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all">
                        <option value="SC" ${student.scholarshipType === 'SC' ? 'selected' : ''}>SC - Scheduled Caste</option>
                        <option value="ST" ${student.scholarshipType === 'ST' ? 'selected' : ''}>ST - Scheduled Tribe</option>
                        <option value="OBC" ${student.scholarshipType === 'OBC' ? 'selected' : ''}>OBC/SBC/VJNT</option>
                        <option value="EBC" ${student.scholarshipType === 'EBC' ? 'selected' : ''}>EBC</option>
                        <option value="Other" ${student.scholarshipType === 'Other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                
                <div class="mb-4">
                    <label class="flex items-center gap-2">
                        <input type="checkbox" id="editIsActive" ${student.isActive ? 'checked' : ''} class="w-4 h-4 text-emerald-600 rounded">
                        <span class="text-sm font-medium text-slate-700">Account Active</span>
                    </label>
                </div>
                
                <div class="flex justify-end gap-3 mt-6">
                    <button type="button" onclick="closeEditModal()" class="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">Cancel</button>
                    <button type="submit" class="px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600">Save Changes</button>
                </div>
            </form>
        `;
        
        document.getElementById('editStudentContent').innerHTML = editHtml;
        document.getElementById('editStudentModal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading student for edit:', error);
        showToast('Failed to load student data');
    }
}

// Save student changes
async function saveStudentChanges(event, studentId) {
    event.preventDefault();
    
    const updatedData = {
        name: document.getElementById('editName').value,
        email: document.getElementById('editEmail').value,
        mobileNumber: document.getElementById('editMobile').value,
        department: document.getElementById('editDepartment').value,
        currentYear: document.getElementById('editYear').value,
        joiningYear: document.getElementById('editJoiningYear').value,
        grNumber: document.getElementById('editGrNumber').value,
        scholarshipType: document.getElementById('editScholarship').value,
        isActive: document.getElementById('editIsActive').checked
    };
    
    try {
        await apiRequest(`/admin/students/${studentId}`, {
            method: 'PUT',
            body: JSON.stringify(updatedData)
        });
        
        showToast('Student record updated successfully');
        closeEditModal();
        loadStudentsRecords(); // Refresh the records
        
    } catch (error) {
        console.error('Error updating student:', error);
        showToast(error.message || 'Failed to update student');
    }
}

// Close edit modal
function closeEditModal() {
    document.getElementById('editStudentModal').classList.add('hidden');
}

// Pagination functions
function updatePagination() {
    const start = filteredRecords.length > 0 ? (currentRecordsPage - 1) * recordsPerPage + 1 : 0;
    const end = filteredRecords.length > 0 ? Math.min(currentRecordsPage * recordsPerPage, totalRecords) : 0;
    
    document.getElementById('recordsStart').textContent = start;
    document.getElementById('recordsEnd').textContent = end;
    document.getElementById('recordsTotal').textContent = totalRecords;
    document.getElementById('currentPageDisplay').textContent = `Page ${currentRecordsPage}`;
    
    document.getElementById('prevPageBtn').disabled = currentRecordsPage === 1;
    document.getElementById('nextPageBtn').disabled = currentRecordsPage * recordsPerPage >= totalRecords;
}

function prevPage() {
    if (currentRecordsPage > 1) {
        currentRecordsPage--;
        loadStudentsRecords();
    }
}

function nextPage() {
    if (currentRecordsPage * recordsPerPage < totalRecords) {
        currentRecordsPage++;
        loadStudentsRecords();
    }
}

// ==================== UTILITY FUNCTIONS ====================
function showToast(message) {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toastMessage');
    if (msg) msg.textContent = message;
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
        toast.classList.remove('translate-y-0', 'opacity-100');
    }, 3000);
}

// ==================== EXPORT FUNCTIONS ====================
window.setUserType = setUserType;
window.setAuthMode = setAuthMode;
window.handleAuth = handleAuth;
window.logout = logout;
window.bookSlot = bookSlot;
window.nextToken = nextToken;
window.togglePause = togglePause;
window.addExtraTime = addExtraTime;
window.searchStudents = searchStudents;
window.viewStudentProfile = viewStudentProfile;
window.closeStudentProfile = closeStudentProfile;
window.showCurrentServing = showCurrentServing;
window.showAdminStatistics = showAdminStatistics;
window.openVerificationModal = openVerificationModal;
window.closeVerificationModal = closeVerificationModal;
window.updateDocumentChecklist = updateDocumentChecklist;
window.showStudentProfileModal = showStudentProfileModal;
window.closeStudentProfileModal = closeStudentProfileModal;
window.showCancelConfirmation = showCancelConfirmation;
window.closeCancelModal = closeCancelModal;
window.cancelBooking = cancelBooking;
window.enableRebooking = enableRebooking;
window.showStudentDashboard = showStudentDashboard;
window.showAdminDashboard = showAdminDashboard;

// Students Records functions
window.showStudentsRecords = showStudentsRecords;
window.loadStudentsRecords = loadStudentsRecords;
window.filterRecords = filterRecords;
window.viewDocumentDetails = viewDocumentDetails;
window.closeDocumentModal = closeDocumentModal;
window.editStudentRecord = editStudentRecord;
window.saveStudentChanges = saveStudentChanges;
window.closeEditModal = closeEditModal;
window.prevPage = prevPage;
window.nextPage = nextPage;

// Initialize app
document.addEventListener('DOMContentLoaded', initApp);

// Online/offline handlers
window.addEventListener('online', () => {
    showToast('Back online - Syncing data...');
    if (currentUser?.userType === 'student') {
        updateStudentDashboard();
        loadAvailableSlots();
    } else if (currentUser?.userType === 'admin') {
        loadAdminDashboard();
        renderAdminTable();
        loadOngoingStudent();
    }
});

window.addEventListener('offline', () => showToast('You are offline - Some features may be unavailable'));

console.log('✅ Main.js loaded with backend integration');