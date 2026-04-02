let currentUser = JSON.parse(localStorage.getItem('user')) || null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    fetchEvents();
    fetchPastEvents();
    if (currentUser) {
        if (currentUser.role === 'admin') fetchAdminStats();
        fetchEnrollments();
    }
});

// UI Navigation
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`section-${sectionId}`).classList.remove('hidden');
    
    // Update nav links
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('text-stone-900', 'underline', 'underline-offset-8'));
    const activeLink = Array.from(document.querySelectorAll('.nav-link')).find(l => l.textContent.toLowerCase() === sectionId.replace('-', ' '));
    if (activeLink) activeLink.classList.add('text-stone-900', 'underline', 'underline-offset-8');

    if (sectionId === 'payment') fetchEnrollments();
    if (sectionId === 'admin') fetchAdminStats();
}

function showNotification(text) {
    const el = document.getElementById('notification');
    document.getElementById('notification-text').textContent = text;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3000);
}

// Auth
// UI Helpers
function toggleAdminPin() {
    const isAdmin = document.getElementById('is-admin-check').checked;
    document.getElementById('admin-pin-container').classList.toggle('hidden', !isAdmin);
}

// Auth
function updateAuthUI() {
    const guest = document.getElementById('auth-guest');
    const user = document.getElementById('auth-user');
    const navPayment = document.getElementById('nav-payment');
    const navAdmin = document.getElementById('nav-admin');

    if (currentUser) {
        guest.classList.add('hidden');
        user.classList.remove('hidden');
        document.getElementById('user-email').textContent = currentUser.email;
        
        if (currentUser.role === 'admin') {
            navAdmin.classList.remove('hidden');
            navPayment.classList.add('hidden');
        } else {
            navAdmin.classList.add('hidden');
            navPayment.classList.remove('hidden');
        }
    } else {
        guest.classList.remove('hidden');
        user.classList.add('hidden');
        navPayment.classList.add('hidden');
        navAdmin.classList.add('hidden');
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('user');
    updateAuthUI();
    showSection('home');
    showNotification('Logged out successfully');
}

// Forms
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const pin = document.getElementById('login-pin').value;
    const isAdmin = document.getElementById('is-admin-check').checked;

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, pin: isAdmin ? pin : undefined })
    });

    if (res.ok) {
        currentUser = await res.json();
        localStorage.setItem('user', JSON.stringify(currentUser));
        updateAuthUI();
        showSection('home');
        showNotification('Login successful!');
    } else {
        const data = await res.json();
        showNotification(data.error || 'Invalid credentials');
    }
});

// Forgot Password
document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });
    if (res.ok) {
        const data = await res.json();
        showNotification(`OTP Sent! (Demo: ${data.demo_otp})`);
        document.getElementById('forgot-password-form').classList.add('hidden');
        document.getElementById('reset-password-form').classList.remove('hidden');
    } else {
        showNotification('User not found');
    }
});

document.getElementById('reset-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    const otp = document.getElementById('reset-otp').value;
    const newPassword = document.getElementById('reset-new-password').value;

    const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
    });

    if (res.ok) {
        showNotification('Password reset successful!');
        showSection('login');
    } else {
        showNotification('Invalid OTP');
    }
});

// Admin Add Event
document.getElementById('add-event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const eventData = {
        title: document.getElementById('event-title').value,
        image: document.getElementById('event-image').value,
        date: document.getElementById('event-date').value,
        time: document.getElementById('event-time').value,
        place: document.getElementById('event-place').value,
        price: document.getElementById('event-price').value
    };

    const res = await fetch('/api/admin/add-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
    });

    if (res.ok) {
        showNotification('Event created successfully!');
        document.getElementById('add-event-modal').classList.add('hidden');
        fetchEvents();
        fetchAdminStats();
    }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
    });

    if (res.ok) {
        currentUser = await res.json();
        localStorage.setItem('user', JSON.stringify(currentUser));
        updateAuthUI();
        showSection('home');
        showNotification('Registration successful!');
    } else {
        showNotification('User already exists');
    }
});

// Data Fetching
async function fetchEvents() {
    try {
        const res = await fetch('/api/events');
        const events = await res.json();
        const grid = document.getElementById('events-grid');
        const featuredGrid = document.getElementById('featured-events-grid');
        
        if (Array.isArray(events)) {
            grid.innerHTML = events.map(e => createEventCard(e, false)).join('');
            if (featuredGrid) {
                featuredGrid.innerHTML = events.slice(0, 3).map(e => createEventCard(e, false)).join('');
            }
        }
    } catch (err) {
        console.error('Fetch events error:', err);
        showNotification('Failed to load events. Please check database connection.');
    }
}

async function fetchPastEvents() {
    try {
        const res = await fetch('/api/events/past');
        const events = await res.json();
        const grid = document.getElementById('past-events-grid');
        if (grid && Array.isArray(events)) {
            grid.innerHTML = events.slice(0, 3).map(e => createEventCard(e, true)).join('');
        }
    } catch (err) {
        console.error('Fetch past events error:', err);
    }
}

async function fetchEnrollments() {
    if (!currentUser) return;
    try {
        const res = await fetch(`/api/enrollments/${currentUser.id}`);
        const enrollments = await res.json();
        const list = document.getElementById('enrollments-list');
        
        if (!Array.isArray(enrollments)) return;

        list.innerHTML = enrollments.map(e => `
            <div class="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center text-stone-900 font-bold">E</div>
                    <div>
                        <h3 class="text-lg font-bold">${e.title}</h3>
                        <p class="text-stone-400 font-mono text-xs uppercase tracking-wider">Price: ₹${e.price} | Paid: ₹${e.paid}</p>
                        <p class="text-emerald-600 font-bold text-sm">Remaining: ₹${e.remaining_amount}</p>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${e.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                        ${e.payment_status}
                    </span>
                    <div class="flex gap-2">
                        ${e.remaining_amount > 0 ? `<button onclick="openPaymentModal(${e.id}, ${e.remaining_amount})" class="bg-stone-900 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all">Pay</button>` : ''}
                        <button onclick="deleteEnrollment(${e.id})" class="text-stone-400 hover:text-red-500 p-2 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Fetch enrollments error:', err);
    }
}

async function deleteEnrollment(id) {
    if (!confirm('Are you sure you want to delete this enrollment?')) return;
    const res = await fetch(`/api/enrollments/${id}`, { method: 'DELETE' });
    if (res.ok) {
        showNotification('Enrollment deleted');
        fetchEnrollments();
    }
}

let activeEnrollmentId = null;
let activeAmount = 0;

function openPaymentModal(enrollmentId, amount) {
    activeEnrollmentId = enrollmentId;
    activeAmount = amount;
    document.getElementById('payment-amount-text').textContent = `Amount: ₹${amount}`;
    
    // Generate QR Code using a public API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=PAY_EVENT_${enrollmentId}_${amount}`;
    document.getElementById('qrcode-container').innerHTML = `<img src="${qrUrl}" alt="QR Code" class="rounded-xl shadow-lg">`;
    
    document.getElementById('payment-modal').classList.remove('hidden');
}

document.getElementById('confirm-payment-btn').addEventListener('click', async () => {
    const res = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId: activeEnrollmentId, amount: activeAmount })
    });

    if (res.ok) {
        document.getElementById('payment-modal').classList.add('hidden');
        
        // Show Receipt
        document.getElementById('receipt-amount').textContent = `₹${activeAmount}`;
        document.getElementById('receipt-date').textContent = new Date().toLocaleDateString();
        document.getElementById('receipt-modal').classList.remove('hidden');
        
        fetchEnrollments();
    }
});

async function fetchAdminStats() {
    if (!currentUser || currentUser.role !== 'admin') return;
    try {
        const res = await fetch('/api/admin/stats');
        const stats = await res.json();

        document.getElementById('admin-total-users').textContent = stats.totalUsers;
        document.getElementById('admin-total-revenue').textContent = `₹${stats.totalAmount.toLocaleString()}`;

        const userTable = document.getElementById('admin-user-table');
        if (Array.isArray(stats.userStats)) {
            userTable.innerHTML = stats.userStats.map(u => `
                <tr class="hover:bg-stone-50 transition-colors border-b border-stone-100 last:border-0">
                    <td class="px-6 py-4 font-black text-stone-900">${u.email}</td>
                    <td class="px-6 py-4 font-mono text-xs text-stone-400">${u.password}</td>
                    <td class="px-6 py-4">
                        <div class="max-w-xs truncate text-stone-600 font-medium" title="${u.events || 'No events'}">
                            ${u.events || '<span class="text-stone-300 italic">No events</span>'}
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex flex-col">
                            <span class="text-emerald-600 font-black text-xs">₹${u.total_paid.toLocaleString()} Paid</span>
                            <span class="text-stone-400 font-bold text-[10px]">₹${u.total_remaining.toLocaleString()} Remaining</span>
                        </div>
                    </td>
                </tr>
            `).join('');
        }

        const eventTable = document.getElementById('admin-event-table');
        if (Array.isArray(stats.eventStats)) {
            eventTable.innerHTML = stats.eventStats.map(e => `
                <tr class="hover:bg-stone-50 transition-colors border-b border-stone-100 last:border-0">
                    <td class="px-6 py-4 font-black text-stone-900">${e.title}</td>
                    <td class="px-6 py-4 font-bold text-stone-600">${e.enrollments} Enrollments</td>
                    <td class="px-6 py-4">
                        <span class="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">₹${e.revenue.toLocaleString()}</span>
                    </td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error('Fetch admin stats error:', err);
    }
}

// Actions
async function enroll(eventId) {
    if (!currentUser) {
        showSection('login');
        return;
    }
    const res = await fetch('/api/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, eventId })
    });

    if (res.ok) {
        showNotification('Enrolled successfully!');
    } else {
        const data = await res.json();
        showNotification(data.error || 'Enrollment failed');
    }
}

async function pay(enrollmentId) {
    const res = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId })
    });

    if (res.ok) {
        showNotification('Payment successful!');
        fetchEnrollments();
    }
}

// Helpers
function createEventCard(event, isPast) {
    return `
        <div class="bg-white border border-stone-200 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 group relative">
            <div class="relative h-64 overflow-hidden">
                <img src="${event.image}" alt="${event.title}" onerror="this.src='https://picsum.photos/seed/event/800/600'" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000">
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div class="absolute top-6 right-6">
                    <span class="bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl text-sm font-black text-stone-900 shadow-xl">₹${event.price}</span>
                </div>
                ${!isPast && event.id % 2 === 0 ? `
                <div class="absolute top-6 left-6">
                    <span class="bg-emerald-500 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg animate-bounce">Trending</span>
                </div>` : ''}
            </div>
            <div class="p-8">
                <div class="flex items-center gap-2 mb-4">
                    <span class="w-2 h-2 bg-emerald-500 rounded-full"></span>
                    <span class="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Premium Event</span>
                </div>
                <h3 class="text-2xl font-black mb-6 line-clamp-1 group-hover:text-emerald-600 transition-colors">${event.title}</h3>
                <div class="grid grid-cols-2 gap-4 mb-8">
                    <div class="flex flex-col">
                        <span class="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Date</span>
                        <span class="text-sm font-bold text-stone-700">${event.date}</span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Location</span>
                        <span class="text-sm font-bold text-stone-700 line-clamp-1">${event.place}</span>
                    </div>
                </div>
                ${!isPast ? `
                <button onclick="enroll(${event.id})" class="w-full bg-stone-900 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-600 transition-all transform active:scale-95 shadow-lg hover:shadow-emerald-200">
                    Secure Spot
                </button>` : `
                <div class="w-full bg-stone-100 text-stone-400 py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-center italic">
                    Event Concluded
                </div>`}
            </div>
        </div>
    `;
}
