/* ══════════════════════════════════════════════════
   EVENT MANAGEMENT SYSTEM — Dynamic Backend Version
   All data is stored in SQLite via Flask API
══════════════════════════════════════════════════ */

const API = 'https://promycelial-noninferentially-andra.ngrok-free.dev';  // same origin; change to 'http://localhost:5000' if needed

let db = {
    events: [], registrations: [], notices: [], schedules: [],
    feedbacks: [], brochures: [], moments: [], certificates: [],
    paymentSettings: {}
};
let isAdmin = false;
let currentEditId = null, currentScheduleEditId = null, selectedRating = 0;
let currentBrochureEditId = null, pendingBrochureFile = null;
let currentMomentEditId = null, pendingMomentFile = null;
let currentCertEditId = null;
let adminMomentsFilter = 'all', guestMomentsFilter = 'all';
let adminCertsFilter = 'all', guestCertsFilter = 'all';
let currentPrintCertId = null;

/* ── API helpers ─────────────────────────────────────────────────────────── */
async function apiFetch(path, method = 'GET', body = null) {
    const opts = { 
        method, 
        headers: { 
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
        } 
    };
    if (body !== null) opts.body = JSON.stringify(body);
    const res = await fetch(API + path, opts);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}

async function loadPublic() {
    db.events = await apiFetch('/api/events').catch(() => []);
    db.schedules = await apiFetch('/api/schedules').catch(() => []);
    db.notices = await apiFetch('/api/notices').catch(() => []);
    db.brochures = await apiFetch('/api/brochures').catch(() => []);
    db.moments = await apiFetch('/api/moments').catch(() => []);
    db.certificates = await apiFetch('/api/certificates').catch(() => []);
    db.paymentSettings = await apiFetch('/api/payment-settings').catch(() => ({}));
}
    db.events = events || [];
    db.schedules = schedules || [];
    db.notices = notices || [];
    db.brochures = brochures || [];
    db.moments = moments || [];
    db.certificates = certificates || [];
    db.paymentSettings = paymentSettings || {};
}

/* ── Modal ─────────────────────────────────────────────────────────────────── */
function openAdminModal()  { document.getElementById('adminModal').classList.add('active'); }
function closeAdminModal() { document.getElementById('adminModal').classList.remove('active'); }
window.onclick = e => {
    if (e.target === document.getElementById('adminModal')) closeAdminModal();
    if (e.target === document.getElementById('brochureViewerModal')) closeBrochureViewer();
    if (e.target === document.getElementById('momentViewerModal')) closeMomentViewer();
    if (e.target === document.getElementById('certPreviewModal')) closeCertPreview();
};

/* ── Entry points ─────────────────────────────────────────────────────────── */
async function enterAsGuest() {
    isAdmin = false;
    showLoadingOverlay('Loading data...');
    try {
        await loadPublic();
    } catch (err) {
        console.error('Load error:', err);
    }
    hideLoadingOverlay();
    document.getElementById('landingPage').classList.remove('active');
    document.getElementById('appPage').classList.add('active');
    document.getElementById('adminBtn').style.display = 'none';
    setupNavigation();
    loadPublicData();
    displayPaymentInfo();
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    try {
        const res = await apiFetch('/api/auth/login', 'POST', { username, password });
        if (res.success) {
            isAdmin = true;
            closeAdminModal();
            showLoadingOverlay('Loading admin data...');
            await loadAll();
            hideLoadingOverlay();
            document.getElementById('landingPage').classList.remove('active');
            document.getElementById('appPage').classList.add('active');
            document.getElementById('adminBtn').style.display = 'none';
            setupNavigation();
            loadAllData();
        } else {
            showError('loginError', 'Invalid username or password');
        }
    } catch (err) {
        showError('loginError', 'Login failed. Is the server running?');
    }
}

function showLoadingOverlay(msg) {
    let ov = document.getElementById('loadingOverlay');
    if (!ov) {
        ov = document.createElement('div');
        ov.id = 'loadingOverlay';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;font-size:18px;color:#8b6f47;gap:16px;';
        ov.innerHTML = '<div style="font-size:40px;">⏳</div><div id="loadingMsg"></div>';
        document.body.appendChild(ov);
    }
    document.getElementById('loadingMsg').textContent = msg || 'Loading...';
    ov.style.display = 'flex';
}
function hideLoadingOverlay() {
    const ov = document.getElementById('loadingOverlay');
    if (ov) ov.style.display = 'none';
}

function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 3000);
}

function logout() { isAdmin = false; location.reload(); }

/* ── Navigation ─────────────────────────────────────────────────────────── */
function setupNavigation() {
    const nav = document.getElementById('mainNav');
    if (isAdmin) {
        nav.innerHTML = `
            <button class="active" onclick="showPage('adminEvents',event)">Events</button>
            <button onclick="showPage('adminSchedules',event)">Schedules</button>
            <button onclick="showPage('adminRegistrations',event)">Registrations</button>
            <button onclick="showPage('adminAttendance',event)">Attendance</button>
            <button onclick="showPage('adminFeedbacks',event)">Feedbacks</button>
            <button onclick="showPage('adminNotices',event)">Notices</button>
            <button onclick="showPage('adminBrochures',event)">Brochures</button>
            <button onclick="showPage('adminMoments',event)">Moments</button>
            <button onclick="showPage('adminCertificates',event)">🏆 Certificates</button>
            <button onclick="showPage('adminPaymentSettings',event)">Payment</button>
            <button onclick="logout()">Logout</button>`;
        showPage('adminEvents', { target: nav.querySelector('button') });
    } else {
        nav.innerHTML = `
            <button class="active" onclick="showPage('brochures',event)">Brochures</button>
            <button onclick="showPage('moments',event)">Moments</button>
            <button onclick="showPage('certificates',event)">🏆 Certificates</button>
            <button onclick="showPage('events',event)">Events</button>
            <button onclick="showPage('schedule',event)">Schedule</button>
            <button onclick="showPage('register',event)">Register</button>
            <button onclick="showPage('payment',event)">Payment</button>
            <button onclick="showPage('feedback',event)">Feedback</button>
            <button onclick="showPage('notices',event)">Notices</button>
            <button onclick="logout()">Exit</button>`;
        showPage('brochures', { target: nav.querySelector('button') });
    }
}

function showPage(pageId, evt) {
    document.querySelectorAll('.container .page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
    if (evt && evt.target) evt.target.classList.add('active');
    const loaders = {
        payment: displayPaymentInfo,
        adminPaymentSettings: () => { loadPaymentSettings(); displayAdminPaymentPreview(); },
        adminRegistrations: loadRegistrations,
        adminAttendance: loadAttendanceEvents,
        adminFeedbacks: loadFeedbacks,
        adminNotices: loadNoticesAdmin,
        adminSchedules: loadSchedulesAdmin,
        adminEvents: loadEventsAdmin,
        adminBrochures: () => { loadBrochureEventOptions(); loadAdminBrochures(); },
        adminMoments: () => { loadMomentEventOptions(); loadAdminMoments(); },
        adminCertificates: () => { loadCertEventOptions(); loadAdminCerts(); },
        events: loadEvents,
        schedule: loadSchedules,
        notices: loadNotices,
        register: loadEvents,
        feedback: loadEvents,
        brochures: loadGuestBrochures,
        moments: loadGuestMoments,
        certificates: loadGuestCerts
    };
    if (loaders[pageId]) loaders[pageId]();
}

function loadPublicData() { loadGuestBrochures(); loadGuestMoments(); loadGuestCerts(); loadEvents(); loadNotices(); loadSchedules(); }
function loadAllData() { loadEvents(); loadEventsAdmin(); loadNotices(); loadNoticesAdmin(); loadRegistrations(); loadSchedules(); loadSchedulesAdmin(); loadFeedbacks(); loadPaymentSettings(); displayAdminPaymentPreview(); loadAttendanceEvents(); loadBrochureEventOptions(); loadAdminBrochures(); loadMomentEventOptions(); loadAdminMoments(); loadCertEventOptions(); loadAdminCerts(); }

/* ── Events ──────────────────────────────────────────────────────────────── */
function loadEvents() {
    const ud = document.getElementById('userEvents'), es = document.getElementById('eventSelect'),
          fs = document.getElementById('feedbackEventSelect'), ss = document.getElementById('scheduleEventSelect');
    if (ud) ud.innerHTML = '';
    if (es) es.innerHTML = '<option value="">Select Event</option>';
    if (fs) fs.innerHTML = '<option value="">Select Event (Optional)</option><option value="General">General Feedback</option>';
    if (ss) ss.innerHTML = '<option value="">Select Event</option>';
    if (!db.events || !db.events.length) { if (ud) ud.innerHTML = '<p style="text-align:center;color:#999;">No events available</p>'; return; }
    db.events.forEach(ev => {
        const d = new Date(ev.date).toLocaleString(), pc = ev.participants || 1;
        if (ud) ud.innerHTML += `<div class="event-card"><h3>${ev.name}</h3><p><strong>Date:</strong> ${d}</p><p><strong>Venue:</strong> ${ev.venue}</p>${ev.description ? `<p><strong>Details:</strong> ${ev.description}</p>` : ''}<span class="participant-badge">${pc === 1 ? '👤' : '👥'} ${pc} Participant${pc > 1 ? 's' : ''} Required</span></div>`;
        if (es) es.innerHTML += `<option value="${ev.name}" data-participants="${pc}">${ev.name} (${pc} participant${pc > 1 ? 's' : ''})</option>`;
        if (fs) fs.innerHTML += `<option value="${ev.name}">${ev.name}</option>`;
        if (ss) ss.innerHTML += `<option value="${ev.name}">${ev.name}</option>`;
    });
    if (es && es.value) onEventSelectChange();
}

function loadEventsAdmin() {
    const d = document.getElementById('adminEventsList');
    if (!d) return;
    d.innerHTML = '';
    if (!db.events || !db.events.length) { d.innerHTML = '<p style="text-align:center;color:#999;">No events created yet</p>'; return; }
    db.events.forEach(ev => {
        const pc = ev.participants || 1;
        d.innerHTML += `<div class="event-card"><h3>${ev.name}</h3><p><strong>Date:</strong> ${new Date(ev.date).toLocaleString()}</p><p><strong>Venue:</strong> ${ev.venue}</p>${ev.description ? `<p>${ev.description}</p>` : ''}<span class="participant-badge">${pc === 1 ? '👤' : '👥'} ${pc} Participant${pc > 1 ? 's' : ''} per Registration</span><div style="margin-top:10px;"><button class="btn-edit" onclick="editEvent('${ev._id}')">Edit</button><button class="btn-delete" onclick="deleteEvent('${ev._id}')">Delete</button></div></div>`;
    });
}

async function handleEventSubmit(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('eventName').value,
        date: new Date(document.getElementById('eventDate').value).toISOString(),
        venue: document.getElementById('eventVenue').value,
        description: document.getElementById('eventDesc').value,
        participants: parseInt(document.getElementById('eventParticipants').value) || 1
    };
    try {
        if (currentEditId) {
            const updated = await apiFetch(`/api/events/${currentEditId}`, 'PUT', data);
            const idx = db.events.findIndex(x => x._id === currentEditId);
            if (idx > -1) db.events[idx] = updated;
        } else {
            const created = await apiFetch('/api/events', 'POST', data);
            db.events.push(created);
        }
        e.target.reset();
        document.getElementById('eventParticipants').value = 1;
        currentEditId = null;
        document.getElementById('eventSubmitBtn').textContent = 'Create Event';
        document.getElementById('cancelBtn').style.display = 'none';
        loadEvents(); loadEventsAdmin();
    } catch (err) { alert('Failed to save event: ' + err.message); }
}

function editEvent(id) {
    const ev = db.events.find(e => e._id === id);
    if (!ev) return;
    document.getElementById('eventName').value = ev.name;
    document.getElementById('eventDate').value = new Date(ev.date).toISOString().slice(0, 16);
    document.getElementById('eventVenue').value = ev.venue;
    document.getElementById('eventDesc').value = ev.description || '';
    document.getElementById('eventParticipants').value = ev.participants || 1;
    currentEditId = id;
    document.getElementById('eventSubmitBtn').textContent = 'Update Event';
    document.getElementById('cancelBtn').style.display = 'inline-block';
    window.scrollTo(0, 0);
}

function cancelEdit() {
    document.getElementById('eventForm').reset();
    document.getElementById('eventParticipants').value = 1;
    currentEditId = null;
    document.getElementById('eventSubmitBtn').textContent = 'Create Event';
    document.getElementById('cancelBtn').style.display = 'none';
}

async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    try {
        await apiFetch(`/api/events/${id}`, 'DELETE');
        db.events = db.events.filter(e => e._id !== id);
        loadEvents(); loadEventsAdmin();
    } catch (err) { alert('Delete failed: ' + err.message); }
}

/* ── Schedules ───────────────────────────────────────────────────────────── */
function loadSchedules() {
    const d = document.getElementById('userSchedules');
    if (!d) return;
    d.innerHTML = '';
    if (!db.schedules || !db.schedules.length) { d.innerHTML = '<p style="text-align:center;color:#999;">No schedules available</p>'; return; }
    const g = {};
    db.schedules.forEach(s => { if (!g[s.eventName]) g[s.eventName] = []; g[s.eventName].push(s); });
    for (let k in g) {
        g[k].sort((a, b) => a.time.localeCompare(b.time));
        d.innerHTML += `<div class="event-group"><h4>${k}</h4>`;
        g[k].forEach(s => { d.innerHTML += `<div class="schedule-card"><div class="schedule-time">${s.time}</div><div class="schedule-details"><h4>${s.activity}</h4><p><strong>Speaker:</strong> ${s.speaker}</p>${s.venue ? `<p><strong>Venue:</strong> ${s.venue}</p>` : ''}</div></div>`; });
        d.innerHTML += `</div>`;
    }
}

function loadSchedulesAdmin() {
    const d = document.getElementById('adminSchedulesList');
    if (!d) return;
    d.innerHTML = '';
    if (!db.schedules || !db.schedules.length) { d.innerHTML = '<p style="text-align:center;color:#999;">No schedules yet</p>'; return; }
    const g = {};
    db.schedules.forEach(s => { if (!g[s.eventName]) g[s.eventName] = []; g[s.eventName].push(s); });
    for (let k in g) {
        g[k].sort((a, b) => a.time.localeCompare(b.time));
        d.innerHTML += `<div class="event-group"><h4>${k}</h4>`;
        g[k].forEach(s => { d.innerHTML += `<div class="schedule-card"><div class="schedule-time">${s.time}</div><div class="schedule-details"><h4>${s.activity}</h4><p><strong>Speaker:</strong> ${s.speaker}</p>${s.venue ? `<p><strong>Venue:</strong> ${s.venue}</p>` : ''}<div style="margin-top:10px;"><button class="btn-edit" onclick="editSchedule('${s._id}')">Edit</button><button class="btn-delete" onclick="deleteSchedule('${s._id}')">Delete</button></div></div></div>`; });
        d.innerHTML += `</div>`;
    }
}

async function handleScheduleSubmit(e) {
    e.preventDefault();
    const data = {
        eventName: document.getElementById('scheduleEventSelect').value,
        time: document.getElementById('scheduleTime').value,
        activity: document.getElementById('scheduleActivity').value,
        speaker: document.getElementById('scheduleSpeaker').value,
        venue: document.getElementById('scheduleVenue').value
    };
    try {
        if (currentScheduleEditId) {
            const updated = await apiFetch(`/api/schedules/${currentScheduleEditId}`, 'PUT', data);
            const idx = db.schedules.findIndex(s => s._id === currentScheduleEditId);
            if (idx > -1) db.schedules[idx] = { ...updated, _id: currentScheduleEditId };
        } else {
            const created = await apiFetch('/api/schedules', 'POST', data);
            db.schedules.push(created);
        }
        e.target.reset();
        currentScheduleEditId = null;
        document.getElementById('scheduleSubmitBtn').textContent = 'Add Schedule Item';
        document.getElementById('cancelScheduleBtn').style.display = 'none';
        loadSchedules(); loadSchedulesAdmin();
    } catch (err) { alert('Failed to save schedule: ' + err.message); }
}

function editSchedule(id) {
    const s = db.schedules.find(x => x._id === id);
    if (!s) return;
    document.getElementById('scheduleEventSelect').value = s.eventName;
    document.getElementById('scheduleTime').value = s.time;
    document.getElementById('scheduleActivity').value = s.activity;
    document.getElementById('scheduleSpeaker').value = s.speaker;
    document.getElementById('scheduleVenue').value = s.venue || '';
    currentScheduleEditId = id;
    document.getElementById('scheduleSubmitBtn').textContent = 'Update Schedule Item';
    document.getElementById('cancelScheduleBtn').style.display = 'inline-block';
    window.scrollTo(0, 0);
}
function cancelScheduleEdit() { document.getElementById('scheduleForm').reset(); currentScheduleEditId = null; document.getElementById('scheduleSubmitBtn').textContent = 'Add Schedule Item'; document.getElementById('cancelScheduleBtn').style.display = 'none'; }
async function deleteSchedule(id) {
    if (!confirm('Delete?')) return;
    await apiFetch(`/api/schedules/${id}`, 'DELETE');
    db.schedules = db.schedules.filter(s => s._id !== id);
    loadSchedules(); loadSchedulesAdmin();
}

/* ── Notices ─────────────────────────────────────────────────────────────── */
function loadNotices() {
    const d = document.getElementById('noticeList');
    if (!d) return;
    d.innerHTML = '';
    if (!db.notices || !db.notices.length) { d.innerHTML = '<p style="text-align:center;color:#999;">No notices available</p>'; return; }
    db.notices.forEach(n => { d.innerHTML += `<div class="notice-card"><h3>${n.title}</h3><p>${n.description}</p></div>`; });
}
function loadNoticesAdmin() {
    const d = document.getElementById('adminNoticesList');
    if (!d) return;
    d.innerHTML = '';
    if (!db.notices || !db.notices.length) { d.innerHTML = '<p style="text-align:center;color:#999;">No notices yet</p>'; return; }
    db.notices.forEach(n => { d.innerHTML += `<div class="notice-card"><h3>${n.title}</h3><p>${n.description}</p><button class="btn-delete" onclick="deleteNotice('${n._id}')">Delete</button></div>`; });
}
async function handleNoticeSubmit(e) {
    e.preventDefault();
    const data = { title: document.getElementById('noticeTitle').value, description: document.getElementById('noticeDesc').value };
    const created = await apiFetch('/api/notices', 'POST', data);
    db.notices.unshift(created);
    e.target.reset();
    loadNotices(); loadNoticesAdmin();
}
async function deleteNotice(id) {
    if (!confirm('Delete?')) return;
    await apiFetch(`/api/notices/${id}`, 'DELETE');
    db.notices = db.notices.filter(n => n._id !== id);
    loadNotices(); loadNoticesAdmin();
}

/* ── Feedback ────────────────────────────────────────────────────────────── */
function initRatingStars() {
    document.querySelectorAll('.star').forEach(s => {
        s.addEventListener('click', function () { selectedRating = parseInt(this.getAttribute('data-rating')); document.getElementById('feedbackRating').value = selectedRating; updateStars(selectedRating); });
        s.addEventListener('mouseenter', function () { updateStars(parseInt(this.getAttribute('data-rating'))); });
    });
    const rc = document.getElementById('ratingStars');
    if (rc) rc.addEventListener('mouseleave', () => updateStars(selectedRating));
}
function updateStars(r) { document.querySelectorAll('.star').forEach((s, i) => i < r ? s.classList.add('active') : s.classList.remove('active')); }

async function handleFeedbackSubmit(e) {
    e.preventDefault();
    if (selectedRating === 0) { alert('Please select a rating'); return; }
    const data = {
        name: document.getElementById('feedbackName').value,
        email: document.getElementById('feedbackEmail').value,
        eventName: document.getElementById('feedbackEventSelect').value,
        rating: selectedRating,
        comments: document.getElementById('feedbackComments').value
    };
    try {
        const created = await apiFetch('/api/feedbacks', 'POST', data);
        db.feedbacks.unshift(created);
        const s = document.getElementById('feedbackSuccess');
        s.textContent = 'Thank you for your feedback!';
        s.style.display = 'block';
        e.target.reset(); selectedRating = 0; updateStars(0);
        setTimeout(() => s.style.display = 'none', 3000);
    } catch (err) { alert('Failed to submit feedback.'); }
}

function loadFeedbacks() {
    if (!isAdmin) return;
    const d = document.getElementById('feedbackList');
    if (!d) return;
    d.innerHTML = '';
    if (!db.feedbacks || !db.feedbacks.length) { d.innerHTML = '<p style="text-align:center;color:#999;">No feedback yet</p>'; return; }
    const g = {};
    db.feedbacks.forEach(f => { const k = f.eventName || 'General'; if (!g[k]) g[k] = []; g[k].push(f); });
    for (let k in g) {
        d.innerHTML += `<div class="event-group"><h4>${k}</h4>`;
        g[k].forEach(f => { const stars = '★'.repeat(f.rating) + '☆'.repeat(5 - f.rating); d.innerHTML += `<div class="feedback-card"><div style="display:flex;justify-content:space-between;align-items:start;"><div><h3 style="color:#8b6f47;margin-bottom:5px;">${f.name}</h3><p style="color:#999;font-size:14px;">${f.email}</p></div><button class="btn-delete" onclick="deleteFeedback('${f._id}')">Delete</button></div><div class="feedback-rating">${stars}</div><p style="margin:10px 0;line-height:1.6;">${f.comments}</p><div class="feedback-meta">Submitted on ${new Date(f.submittedAt || f.submitted_at).toLocaleString()}</div></div>`; });
        d.innerHTML += `</div>`;
    }
}

async function deleteFeedback(id) {
    if (!confirm('Delete?')) return;
    await apiFetch(`/api/feedbacks/${id}`, 'DELETE');
    db.feedbacks = db.feedbacks.filter(f => f._id !== id);
    loadFeedbacks();
}

/* ── Payment ─────────────────────────────────────────────────────────────── */
function previewQRCode(ev) {
    const f = ev.target.files[0];
    if (f) { const r = new FileReader(); r.onload = e => { document.getElementById('qrPreview').innerHTML = `<img src="${e.target.result}" class="qr-preview" alt="QR Code Preview">`; }; r.readAsDataURL(f); }
}

async function handlePaymentSettings(e) {
    e.preventDefault();
    const qf = document.getElementById('qrCodeUpload').files[0];
    const settings = {
        upiId: document.getElementById('upiId').value.trim(),
        upiName: document.getElementById('upiName').value.trim(),
        bankName: document.getElementById('bankName').value.trim(),
        accountNumber: document.getElementById('accountNumber').value.trim(),
        ifscCode: document.getElementById('ifscCode').value.trim(),
        accountHolder: document.getElementById('accountHolder').value.trim(),
        qrCode: db.paymentSettings.qrCode || ''
    };
    const save = async () => {
        await apiFetch('/api/payment-settings', 'POST', settings);
        db.paymentSettings = settings;
        showPaymentSaveSuccess();
        displayAdminPaymentPreview();
    };
    if (qf) {
        const r = new FileReader();
        r.onload = async ev => { settings.qrCode = ev.target.result; await save(); };
        r.readAsDataURL(qf);
    } else { await save(); }
}

function showPaymentSaveSuccess() { const d = document.getElementById('paymentSaveSuccess'); d.style.display = 'block'; setTimeout(() => d.style.display = 'none', 3000); }
function loadPaymentSettings() {
    if (!isAdmin) return;
    const s = db.paymentSettings;
    document.getElementById('upiId').value = s.upiId || '';
    document.getElementById('upiName').value = s.upiName || '';
    document.getElementById('bankName').value = s.bankName || '';
    document.getElementById('accountNumber').value = s.accountNumber || '';
    document.getElementById('ifscCode').value = s.ifscCode || '';
    document.getElementById('accountHolder').value = s.accountHolder || '';
    if (s.qrCode && s.qrCode.trim() !== '') document.getElementById('qrPreview').innerHTML = `<img src="${s.qrCode}" class="qr-preview" alt="QR">`;
    else document.getElementById('qrPreview').innerHTML = '';
}
function displayAdminPaymentPreview() { const d = document.getElementById('adminPaymentPreview'); if (d) d.innerHTML = generatePaymentHTML(db.paymentSettings); }
function copyToClipboard(text, btn) { navigator.clipboard.writeText(text).then(() => { const t = btn.textContent; btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = t, 2000); }).catch(() => alert('Copied: ' + text)); }
function generatePaymentHTML(s) {
    let html = '', any = false;
    if (s.qrCode && s.qrCode.trim() !== '') { any = true; html += `<div class="payment-method-card"><h4>Scan QR Code</h4><img src="${s.qrCode}" class="qr-preview" alt="Payment QR Code"><p style="text-align:center;color:#666;margin-top:10px;font-size:14px;">Scan with any UPI app to pay</p></div>`; }
    if (s.upiId && s.upiId.trim() !== '') { any = true; html += `<div class="payment-method-card"><h4>UPI Payment</h4><div class="payment-info-box"><p><strong>UPI ID:</strong> ${s.upiId} <button class="copy-btn" onclick="copyToClipboard('${s.upiId}',this)">Copy</button></p>${s.upiName && s.upiName.trim() !== '' ? `<p><strong>Account Name:</strong> ${s.upiName}</p>` : ''}</div></div>`; }
    if (s.bankName && s.bankName.trim() !== '' && s.accountNumber && s.accountNumber.trim() !== '') { any = true; html += `<div class="payment-method-card"><h4>Bank Transfer</h4><div class="payment-info-box"><p><strong>Bank Name:</strong> ${s.bankName}</p><p><strong>Account Number:</strong> ${s.accountNumber} <button class="copy-btn" onclick="copyToClipboard('${s.accountNumber}',this)">Copy</button></p>${s.ifscCode && s.ifscCode.trim() !== '' ? `<p><strong>IFSC Code:</strong> ${s.ifscCode} <button class="copy-btn" onclick="copyToClipboard('${s.ifscCode}',this)">Copy</button></p>` : ''} ${s.accountHolder && s.accountHolder.trim() !== '' ? `<p><strong>Account Holder:</strong> ${s.accountHolder}</p>` : ''}</div></div>`; }
    if (!any) html = `<div style="text-align:center;padding:40px;background:#faf8f5;border-radius:10px;border:2px dashed #d4a574;"><p style="color:#8b6f47;font-size:18px;">No Payment Methods Configured</p></div>`;
    return html;
}
function displayPaymentInfo() { const d = document.getElementById('paymentMethodsDisplay'); if (!d) return; d.innerHTML = generatePaymentHTML(db.paymentSettings); }

/* ── Registration ─────────────────────────────────────────────────────────── */
function onEventSelectChange() {
    const es = document.getElementById('eventSelect'), body = document.getElementById('registrationFormBody'),
          notice = document.getElementById('eventInfoNotice'), btn = document.getElementById('regSubmitBtn');
    const opt = es.options[es.selectedIndex], evName = es.value;
    if (!evName) { body.innerHTML = ''; notice.innerHTML = ''; notice.classList.remove('visible'); btn.style.display = 'none'; return; }
    const pCount = parseInt(opt.getAttribute('data-participants')) || 1;
    btn.style.display = 'block';
    if (pCount === 1) {
        notice.innerHTML = `<p>✅ <strong>Individual Event</strong> — Please fill in your details below.</p>`;
        notice.classList.add('visible');
        body.innerHTML = `<div style="margin-top:6px;"><input name="p_name_1" placeholder="Your Full Name" required><input name="p_college" placeholder="College Name" required><input name="p_roll_1" placeholder="Roll Number" required><input name="p_email" type="email" placeholder="Email Address" required><input name="p_phone" placeholder="Phone Number" required><label style="display:block;margin-top:12px;color:#8b6f47;font-weight:600;">Food Preference</label><select name="p_menu_1" required><option value="">Select Menu Preference</option><option value="Vegetarian">Vegetarian</option><option value="Non-Vegetarian">Non-Vegetarian</option></select></div>`;
    } else {
        notice.innerHTML = `<p>👥 <strong>Team Event</strong> — ${pCount} participants required.</p>`;
        notice.classList.add('visible');
        let html = `<div class="reg-shared-section"><div class="reg-shared-title">🏫 Shared Team Details <span class="shared-badge">Same for all</span></div><input name="p_college" placeholder="College Name" required><input name="p_email" type="email" placeholder="Team Contact Email" required><input name="p_phone" placeholder="Team Contact Phone" required></div><div class="participants-section"><div class="participants-section-title">👥 Individual Participant Details</div>`;
        for (let i = 1; i <= pCount; i++) { html += `<div class="participant-block"><div class="participant-block-header"><div class="participant-number">${i}</div><span>Participant ${i}</span></div><div class="p-row-grid"><input name="p_name_${i}" placeholder="Full Name" required><input name="p_roll_${i}" placeholder="Roll Number" required></div><label style="display:block;margin:8px 0 2px;color:#8b6f47;font-size:13px;font-weight:600;">Food Preference</label><select name="p_menu_${i}" required><option value="">Select Menu</option><option value="Vegetarian">Vegetarian</option><option value="Non-Vegetarian">Non-Vegetarian</option></select></div>`; }
        html += `</div>`;
        body.innerHTML = html;
    }
}

async function handleRegistration(e) {
    e.preventDefault();
    const form = document.getElementById('registerForm');
    const evName = document.getElementById('eventSelect').value;
    const ev = db.events.find(x => x.name === evName);
    const pCount = ev ? (ev.participants || 1) : 1;
    const college = form.querySelector('[name="p_college"]').value.trim();
    const email = form.querySelector('[name="p_email"]').value.trim();
    const phone = form.querySelector('[name="p_phone"]').value.trim();
    const participants = [];
    for (let i = 1; i <= pCount; i++) {
        participants.push({ name: form.querySelector(`[name="p_name_${i}"]`).value.trim(), rollNo: form.querySelector(`[name="p_roll_${i}"]`).value.trim(), menu: form.querySelector(`[name="p_menu_${i}"]`).value, college, email, phone });
    }
    const reg = {
        studentName: participants[0].name, collegeName: college, rollNo: participants[0].rollNo,
        email, phone, menuPreference: participants[0].menu, participants,
        participantCount: pCount, eventName: evName, paymentStatus: 'pending'
    };
    try {
        const created = await apiFetch('/api/registrations', 'POST', reg);
        db.registrations.unshift(created);
        const names = participants.map((p, i) => `${i + 1}. ${p.name}  (Roll: ${p.rollNo})  🍽 ${p.menu}`).join('\n');
        alert(`Registration submitted!\n\nEvent: ${evName}\nCollege: ${college}\nContact: ${email}  |  ${phone}\n\nParticipants:\n${names}\n\nPlease complete payment via Payment tab.`);
        form.reset();
        document.getElementById('registrationFormBody').innerHTML = '';
        document.getElementById('eventInfoNotice').classList.remove('visible');
        document.getElementById('regSubmitBtn').style.display = 'none';
    } catch (err) { alert('Registration failed: ' + err.message); }
}

function loadRegistrations() {
    if (!isAdmin) return;
    const rl = document.getElementById('registrationList');
    if (!rl) return;
    rl.innerHTML = '';
    if (!db.registrations || !db.registrations.length) { rl.innerHTML = '<p style="text-align:center;color:#999;">No registrations yet</p>'; return; }
    const g = {};
    db.registrations.forEach(r => { if (!g[r.eventName]) g[r.eventName] = []; g[r.eventName].push(r); });
    for (let evName in g) {
        rl.innerHTML += `<div class="event-group"><h4>${evName}</h4>`;
        g[evName].forEach(reg => {
            const pc = reg.participantCount || 1;
            let ps = '';
            if (pc > 1) {
                ps = `<div class="team-participant-summary"><div class="team-label">👥 Team Members (${pc})</div>`;
                (reg.participants || []).forEach((p, i) => { ps += `<div class="participant-row">${i + 1}. <strong>${p.name}</strong> &nbsp;|&nbsp; Roll: ${p.rollNo} &nbsp;|&nbsp; 🍽 ${p.menu || '—'}</div>`; });
                ps += `</div>`;
            }
            rl.innerHTML += `<div class="registration-card"><p><strong>${reg.studentName}</strong>${pc > 1 ? ` <span style="color:#d4a574;font-size:13px;">(Team of ${pc})</span>` : ''}</p><p>🏫 <strong>${reg.collegeName}</strong> &nbsp;|&nbsp; ✉️ ${reg.email || '—'} &nbsp;|&nbsp; 📞 ${reg.phone || '—'}</p>${pc === 1 ? `<p>Roll: ${reg.rollNo} &nbsp;|&nbsp; 🍽 ${reg.menuPreference || 'Not specified'}</p>` : ps}<p style="color:#999;font-size:12px;">Registered: ${new Date(reg.registeredAt || reg.registered_at).toLocaleString()}</p><button class="btn-delete" onclick="deleteRegistration('${reg._id}')">Delete</button></div>`;
        });
        rl.innerHTML += `</div>`;
    }
}

async function deleteRegistration(id) {
    if (!confirm('Delete?')) return;
    await apiFetch(`/api/registrations/${id}`, 'DELETE');
    db.registrations = db.registrations.filter(r => r._id !== id);
    loadRegistrations();
}

/* ── Attendance ──────────────────────────────────────────────────────────── */
function loadAttendanceEvents() {
    const s = document.getElementById('attendanceEventSelect');
    if (!s) return;
    s.innerHTML = '<option value="">Choose an event...</option>';
    if (!db.events) return;
    db.events.forEach(ev => s.innerHTML += `<option value="${ev.name}">${ev.name}</option>`);
}

function generateAttendanceSheet() {
    const evName = document.getElementById('attendanceEventSelect').value;
    const cont = document.getElementById('attendanceSheetContainer');
    if (!evName) { cont.innerHTML = ''; return; }
    const regs = db.registrations ? db.registrations.filter(r => r.eventName === evName) : [];
    if (!regs.length) { cont.innerHTML = `<div style="text-align:center;padding:40px;color:#999;"><p>No registrations found.</p></div>`; return; }
    const ev = db.events.find(e => e.name === evName);
    const evDate = ev ? new Date(ev.date).toLocaleDateString() : '', evVenue = ev ? ev.venue : '', pc = ev ? (ev.participants || 1) : 1;
    let rows = '';
    regs.forEach((reg, idx) => {
        if (pc === 1) { rows += `<tr><td>${idx + 1}</td><td><strong>${reg.studentName}</strong></td><td>${reg.collegeName}</td><td>${reg.rollNo}</td><td>${reg.email || '—'}</td><td>${reg.phone || '—'}</td><td>${reg.menuPreference || '—'}</td><td class="signature-cell"></td></tr>`; }
        else {
            (reg.participants || []).forEach((p, pi) => { rows += `<tr ${pi === 0 ? '' : 'style="background:#fefaf7;"'}><td>${pi === 0 ? idx + 1 : ''}</td><td><strong>${p.name}</strong> <small style="color:#999;">(P${pi + 1})</small></td><td>${pi === 0 ? reg.collegeName : '<span style="color:#bbb;font-size:12px;">↑ same</span>'}</td><td>${p.rollNo}</td><td>${pi === 0 ? (reg.email || '—') : '<span style="color:#bbb;font-size:12px;">↑ same</span>'}</td><td>${pi === 0 ? (reg.phone || '—') : '<span style="color:#bbb;font-size:12px;">↑ same</span>'}</td><td>${p.menu || '—'}</td><td class="signature-cell"></td></tr>`; });
            rows += `<tr style="background:#f5e6d3;"><td colspan="8" style="padding:3px 12px;font-size:11px;color:#8b6f47;">— Team ${idx + 1} end —</td></tr>`;
        }
    });
    cont.innerHTML = `<div style="margin:20px 0;"><button class="btn-print" onclick="printAttendanceSheet()">🖨️ Print Attendance Sheet</button></div><div id="printableArea"><div style="text-align:center;margin-bottom:30px;"><h2 style="color:#8b6f47;margin-bottom:10px;">ATTENDANCE SHEET</h2><h3 style="color:#6d5637;margin-bottom:5px;">${evName}</h3><p style="color:#666;">Date: ${evDate} | Venue: ${evVenue}</p></div><table class="attendance-table"><thead><tr><th>S.No</th><th>Name</th><th>College</th><th>Roll No.</th><th>Email</th><th>Phone</th><th>Food Pref.</th><th class="signature-cell">Signature</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function printAttendanceSheet() { window.print(); }

/* ── Brochures ───────────────────────────────────────────────────────────── */
function loadBrochureEventOptions() {
    const sel = document.getElementById('brochureEventLink');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Not linked to a specific event —</option>';
    if (db.events) db.events.forEach(ev => sel.innerHTML += `<option value="${ev.name}">${ev.name}</option>`);
}
function onBrochureFileChosen(ev) {
    const file = ev.target.files[0];
    if (!file) { pendingBrochureFile = null; return; }
    const zone = document.getElementById('brochureUploadZone'), preview = document.getElementById('brochureFilePreview');
    zone.querySelector('p').textContent = file.name;
    zone.querySelector('small').textContent = (file.size / 1024).toFixed(1) + ' KB  •  ' + file.type;
    const reader = new FileReader();
    reader.onload = e => {
        pendingBrochureFile = { data: e.target.result, type: file.type, name: file.name };
        if (file.type.startsWith('image/')) { preview.innerHTML = `<img src="${e.target.result}" style="max-width:180px;max-height:220px;border-radius:8px;border:2px solid #d4a574;margin:8px 0;object-fit:cover;">`; }
        else { preview.innerHTML = `<div style="display:inline-block;background:linear-gradient(135deg,#8b6f47,#6d5637);color:white;padding:14px 20px;border-radius:10px;font-size:22px;margin:8px 0;">📄 PDF Ready</div>`; }
    };
    reader.readAsDataURL(file);
}
async function handleBrochureSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('brochureTitle').value.trim(), desc = document.getElementById('brochureDesc').value.trim(), linked = document.getElementById('brochureEventLink').value;
    if (!pendingBrochureFile && !currentBrochureEditId) { alert('Please select a brochure file to upload.'); return; }
    const data = { title, description: desc, linkedEvent: linked, desc };
    if (pendingBrochureFile) { data.fileData = pendingBrochureFile.data; data.fileType = pendingBrochureFile.type; data.fileName = pendingBrochureFile.name; }
    try {
        if (currentBrochureEditId) {
            const updated = await apiFetch(`/api/brochures/${currentBrochureEditId}`, 'PUT', data);
            const idx = db.brochures.findIndex(b => b._id === currentBrochureEditId);
            if (idx > -1) db.brochures[idx] = { ...db.brochures[idx], ...data, _id: currentBrochureEditId };
        } else {
            const created = await apiFetch('/api/brochures', 'POST', data);
            db.brochures.unshift(created);
        }
        const s = document.getElementById('brochureSuccess');
        s.textContent = currentBrochureEditId ? 'Brochure updated!' : 'Brochure uploaded!';
        s.style.display = 'block'; setTimeout(() => s.style.display = 'none', 3000);
        cancelBrochureEdit(); loadAdminBrochures();
    } catch (err) { alert('Failed: ' + err.message); }
}
function cancelBrochureEdit() { document.getElementById('brochureForm').reset(); document.getElementById('brochureFilePreview').innerHTML = ''; document.getElementById('brochureUploadZone').querySelector('p').textContent = 'Click to choose a file'; document.getElementById('brochureUploadZone').querySelector('small').textContent = 'Image or PDF'; pendingBrochureFile = null; currentBrochureEditId = null; document.getElementById('brochureSubmitBtn').textContent = '📤 Upload Brochure'; document.getElementById('cancelBrochureBtn').style.display = 'none'; }
function editBrochure(id) { const b = db.brochures.find(x => x._id === id); if (!b) return; document.getElementById('brochureTitle').value = b.title; document.getElementById('brochureDesc').value = b.description || b.desc || ''; document.getElementById('brochureEventLink').value = b.linkedEvent || ''; currentBrochureEditId = id; pendingBrochureFile = null; document.getElementById('brochureSubmitBtn').textContent = '✏️ Update Brochure'; document.getElementById('cancelBrochureBtn').style.display = 'inline-block'; window.scrollTo(0, 0); const preview = document.getElementById('brochureFilePreview'); if (b.fileType && b.fileType.startsWith('image/')) { preview.innerHTML = `<img src="${b.fileData}" style="max-width:120px;max-height:150px;border-radius:8px;border:2px solid #d4a574;margin:8px 0;object-fit:cover;"><p style="color:#aaa;font-size:12px;">Current file — upload new to replace</p>`; } else { preview.innerHTML = `<div style="display:inline-block;background:linear-gradient(135deg,#8b6f47,#6d5637);color:white;padding:10px 16px;border-radius:8px;font-size:18px;margin:8px 0;">📄 ${b.fileName || 'PDF'}</div><p style="color:#aaa;font-size:12px;">Current — upload new to replace</p>`; } document.getElementById('brochureUploadZone').querySelector('p').textContent = 'Upload new file to replace current'; }
async function deleteBrochure(id) { if (!confirm('Delete this brochure?')) return; await apiFetch(`/api/brochures/${id}`, 'DELETE'); db.brochures = db.brochures.filter(b => b._id !== id); loadAdminBrochures(); }
function loadAdminBrochures() {
    const d = document.getElementById('adminBrochuresList');
    if (!d) return;
    if (!db.brochures || !db.brochures.length) { d.innerHTML = '<div class="brochure-empty"><div class="empty-icon">📋</div><h3>No brochures uploaded yet</h3><p>Use the form above to upload your first brochure.</p></div>'; return; }
    d.innerHTML = '';
    db.brochures.forEach(b => { const isImg = b.fileType && b.fileType.startsWith('image/'); const thumb = isImg ? `<img src="${b.fileData}" class="brochure-thumb" alt="thumbnail">` : `<div class="brochure-thumb-pdf">📄</div>`; d.innerHTML += `<div class="brochure-admin-card">${thumb}<h3>${b.title}</h3>${(b.description || b.desc) ? `<p>${b.description || b.desc}</p>` : ''} ${b.linkedEvent ? `<p>🔗 Linked to: <strong>${b.linkedEvent}</strong></p>` : ''}<p>📁 ${b.fileName || 'File'} &nbsp;|&nbsp; ${isImg ? 'Image' : 'PDF'}</p><div class="brochure-meta">Uploaded: ${new Date(b.uploadedAt).toLocaleString()}</div><div style="margin-top:12px;"><button class="btn-edit" onclick="editBrochure('${b._id}')">Edit</button><button class="btn-delete" onclick="deleteBrochure('${b._id}')">Delete</button></div></div>`; });
}
function loadGuestBrochures() {
    const d = document.getElementById('guestBrochuresList');
    if (!d) return;
    if (!db.brochures || !db.brochures.length) { d.innerHTML = `<div class="brochure-empty"><div class="empty-icon">📋</div><h3>No Brochures Available</h3><p>Brochures will appear here once uploaded.</p></div>`; return; }
    d.innerHTML = `<div class="brochure-grid">`;
    db.brochures.forEach(b => { const isImg = b.fileType && b.fileType.startsWith('image/'); const coverHTML = isImg ? `<img src="${b.fileData}" alt="${b.title}">` : `<div class="brochure-no-img">📄</div>`; d.innerHTML += `<div class="brochure-guest-card"><div class="brochure-cover">${coverHTML}<span class="brochure-type-badge">${isImg ? 'Image' : 'PDF'}</span></div><div class="brochure-body"><h3>${b.title}</h3>${b.linkedEvent ? `<span class="brochure-event-tag">🔗 ${b.linkedEvent}</span>` : ''}<p>${b.description || b.desc || 'Official event brochure.'}</p><button class="brochure-view-btn" onclick="openBrochureViewer('${b._id}')">👁 View Brochure</button></div></div>`; });
    d.innerHTML += `</div>`;
}
function openBrochureViewer(id) { const b = db.brochures.find(x => x._id === id); if (!b) return; document.getElementById('brochureViewerTitle').textContent = b.title; const body = document.getElementById('brochureViewerBody'); const isImg = b.fileType && b.fileType.startsWith('image/'); if (isImg) { body.innerHTML = `<img src="${b.fileData}" alt="${b.title}" style="max-width:100%;">`; } else { body.innerHTML = `<iframe src="${b.fileData}" style="width:100%;min-height:520px;border:none;border-radius:8px;"></iframe>`; } const dl = document.getElementById('brochureDownloadLink'); dl.href = b.fileData; dl.download = b.fileName || b.title; document.getElementById('brochureViewerModal').classList.add('active'); }
function closeBrochureViewer() { document.getElementById('brochureViewerModal').classList.remove('active'); document.getElementById('brochureViewerBody').innerHTML = ''; }

/* ── Moments ─────────────────────────────────────────────────────────────── */
function loadMomentEventOptions() { const sel = document.getElementById('momentEventLink'); if (!sel) return; sel.innerHTML = '<option value="">— Not linked to a specific event —</option>'; if (db.events) db.events.forEach(ev => sel.innerHTML += `<option value="${ev.name}">${ev.name}</option>`); }
function onMomentTypeChange() { const type = document.getElementById('momentType').value, hint = document.getElementById('momentFileHint'), input = document.getElementById('momentFileInput'); if (type === 'photo') { hint.textContent = 'Accepted: JPG, PNG, GIF'; input.accept = 'image/*'; } else if (type === 'video' || type === 'makeover') { hint.textContent = 'Accepted: MP4, MOV, AVI, WebM'; input.accept = 'video/*'; } else { hint.textContent = 'Select type first'; input.accept = 'image/*,video/*'; } }
function onMomentFileChosen(ev) { const file = ev.target.files[0]; if (!file) { pendingMomentFile = null; return; } const zone = document.getElementById('momentUploadZone'), preview = document.getElementById('momentFilePreview'); zone.querySelector('p').textContent = file.name; zone.querySelector('small').textContent = (file.size / 1024).toFixed(1) + ' KB  •  ' + file.type; const reader = new FileReader(); reader.onload = e => { pendingMomentFile = { data: e.target.result, type: file.type, name: file.name }; if (file.type.startsWith('image/')) { preview.innerHTML = `<img src="${e.target.result}" style="max-width:180px;max-height:160px;border-radius:8px;border:2px solid #d4a574;margin:8px 0;object-fit:cover;">`; } else { preview.innerHTML = `<video src="${e.target.result}" style="max-width:260px;max-height:160px;border-radius:8px;border:2px solid #d4a574;margin:8px 0;" controls></video>`; } }; reader.readAsDataURL(file); }
async function handleMomentSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('momentTitle').value.trim(), type = document.getElementById('momentType').value, desc = document.getElementById('momentDesc').value.trim(), linked = document.getElementById('momentEventLink').value;
    if (!pendingMomentFile && !currentMomentEditId) { alert('Please select a file to upload.'); return; }
    const data = { title, type, desc, linkedEvent: linked };
    if (pendingMomentFile) { data.fileData = pendingMomentFile.data; data.fileType = pendingMomentFile.type; data.fileName = pendingMomentFile.name; }
    try {
        if (currentMomentEditId) {
            await apiFetch(`/api/moments/${currentMomentEditId}`, 'PUT', data);
            const idx = db.moments.findIndex(m => m._id === currentMomentEditId);
            if (idx > -1) db.moments[idx] = { ...db.moments[idx], ...data, _id: currentMomentEditId };
        } else {
            const created = await apiFetch('/api/moments', 'POST', data);
            db.moments.unshift(created);
        }
        const s = document.getElementById('momentSuccess');
        s.textContent = currentMomentEditId ? 'Moment updated!' : 'Moment uploaded!';
        s.style.display = 'block'; setTimeout(() => s.style.display = 'none', 3000);
        cancelMomentEdit(); loadAdminMoments();
    } catch (err) { alert('Failed: ' + err.message); }
}
function cancelMomentEdit() { document.getElementById('momentForm').reset(); document.getElementById('momentFilePreview').innerHTML = ''; document.getElementById('momentUploadZone').querySelector('p').textContent = 'Click to choose a file'; document.getElementById('momentUploadZone').querySelector('small').textContent = 'Photo or Video'; document.getElementById('momentFileHint').textContent = 'Select type first'; pendingMomentFile = null; currentMomentEditId = null; document.getElementById('momentSubmitBtn').textContent = '📤 Upload Moment'; document.getElementById('cancelMomentBtn').style.display = 'none'; }
function editMoment(id) { const m = db.moments.find(x => x._id === id); if (!m) return; document.getElementById('momentTitle').value = m.title; document.getElementById('momentType').value = m.type; document.getElementById('momentDesc').value = m.desc || ''; document.getElementById('momentEventLink').value = m.linkedEvent || ''; onMomentTypeChange(); currentMomentEditId = id; pendingMomentFile = null; document.getElementById('momentSubmitBtn').textContent = '✏️ Update Moment'; document.getElementById('cancelMomentBtn').style.display = 'inline-block'; window.scrollTo(0, 0); const preview = document.getElementById('momentFilePreview'); if (m.fileType && m.fileType.startsWith('image/')) { preview.innerHTML = `<img src="${m.fileData}" style="max-width:120px;max-height:100px;border-radius:8px;border:2px solid #d4a574;margin:8px 0;object-fit:cover;"><p style="color:#aaa;font-size:12px;">Current — upload new to replace</p>`; } else { preview.innerHTML = `<div style="display:inline-block;background:linear-gradient(135deg,#1565c0,#0d47a1);color:white;padding:10px 16px;border-radius:8px;font-size:18px;margin:8px 0;">🎬 ${m.fileName || 'Video'}</div><p style="color:#aaa;font-size:12px;">Current — upload new to replace</p>`; } document.getElementById('momentUploadZone').querySelector('p').textContent = 'Upload new file to replace current'; }
async function deleteMoment(id) { if (!confirm('Delete this moment?')) return; await apiFetch(`/api/moments/${id}`, 'DELETE'); db.moments = db.moments.filter(m => m._id !== id); loadAdminMoments(); }
function filterAdminMoments(filter, btn) { adminMomentsFilter = filter; document.querySelectorAll('.moments-type-tab').forEach(b => b.classList.remove('active')); btn.classList.add('active'); loadAdminMoments(); }
function loadAdminMoments() { const d = document.getElementById('adminMomentsList'); if (!d) return; const list = adminMomentsFilter === 'all' ? db.moments : db.moments.filter(m => m.type === adminMomentsFilter); if (!list || !list.length) { d.innerHTML = '<div class="moments-empty"><div class="empty-icon">🎞️</div><h3>No moments uploaded yet</h3></div>'; return; } const typeLabels = { photo: '📷 Photo', video: '🎬 Video', makeover: '✨ Makeover' }, typeBadgeClass = { photo: 'moment-type-photo', video: 'moment-type-video', makeover: 'moment-type-makeover' }; d.innerHTML = ''; list.forEach(m => { const isImg = m.fileType && m.fileType.startsWith('image/'); let thumb = isImg ? `<img src="${m.fileData}" class="moment-thumb-img" alt="thumb">` : (m.type === 'makeover' ? `<div class="moment-thumb-makeover">✨</div>` : `<div class="moment-thumb-video">🎬</div>`); d.innerHTML += `<div class="moment-admin-card"><span class="moment-type-badge-admin ${typeBadgeClass[m.type] || 'moment-type-photo'}">${typeLabels[m.type] || m.type}</span>${thumb}<h3>${m.title}</h3>${m.desc ? `<p>${m.desc}</p>` : ''} ${m.linkedEvent ? `<p>🔗 Linked to: <strong>${m.linkedEvent}</strong></p>` : ''}<p>📁 ${m.fileName || 'File'}</p><div class="moment-meta">Uploaded: ${new Date(m.uploadedAt).toLocaleString()}</div><div style="margin-top:12px;"><button class="btn-edit" onclick="editMoment('${m._id}')">Edit</button><button class="btn-delete" onclick="deleteMoment('${m._id}')">Delete</button></div></div>`; }); }
function filterGuestMoments(filter, btn) { guestMomentsFilter = filter; document.querySelectorAll('.moments-filter-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderGuestMoments(); }
function loadGuestMoments() { guestMomentsFilter = 'all'; const btns = document.querySelectorAll('.moments-filter-btn'); btns.forEach(b => b.classList.remove('active')); if (btns[0]) btns[0].classList.add('active'); renderGuestMoments(); }
function renderGuestMoments() { const d = document.getElementById('guestMomentsList'); if (!d) return; const list = guestMomentsFilter === 'all' ? db.moments : db.moments.filter(m => m.type === guestMomentsFilter); if (!list || !list.length) { const emptyLabels = { all: 'No Moments Yet', photo: 'No Photos Yet', video: 'No Videos Yet', makeover: 'No Makeover Videos Yet' }; d.innerHTML = `<div class="moments-empty"><div class="empty-icon">🎞️</div><h3>${emptyLabels[guestMomentsFilter] || 'Nothing here'}</h3></div>`; return; } const badgeClass = { photo: 'moment-badge-photo', video: 'moment-badge-video', makeover: 'moment-badge-makeover' }, badgeLabel = { photo: '📷 Photo', video: '🎬 Video', makeover: '✨ Makeover' }; d.innerHTML = `<div class="moments-grid">`; list.forEach(m => { const isImg = m.fileType && m.fileType.startsWith('image/'); let coverHTML = isImg ? `<img src="${m.fileData}" alt="${m.title}">` : `<div class="moment-no-thumb">${m.type === 'makeover' ? '✨' : '🎬'}</div><div class="moment-play-overlay">▶</div>`; d.innerHTML += `<div class="moment-guest-card"><div class="moment-cover">${coverHTML}<span class="moment-badge ${badgeClass[m.type] || 'moment-badge-photo'}">${badgeLabel[m.type] || m.type}</span></div><div class="moment-body"><h3>${m.title}</h3>${m.linkedEvent ? `<span class="moment-event-tag">🔗 ${m.linkedEvent}</span>` : ''}<p>${m.desc || 'Click to view.'}</p><button class="moment-view-btn" onclick="openMomentViewer('${m._id}')">${isImg ? '🔍 View Photo' : '▶ Play Video'}</button></div></div>`; }); d.innerHTML += `</div>`; }
function openMomentViewer(id) { const m = db.moments.find(x => x._id === id); if (!m) return; document.getElementById('momentViewerTitle').textContent = m.title; const body = document.getElementById('momentViewerBody'); const isImg = m.fileType && m.fileType.startsWith('image/'); if (isImg) { body.innerHTML = `<img src="${m.fileData}" alt="${m.title}" style="max-width:100%;">`; } else { body.innerHTML = `<video src="${m.fileData}" controls autoplay style="max-width:100%;max-height:520px;border-radius:8px;background:#000;"></video>`; } document.getElementById('momentViewerDesc').textContent = m.desc || ''; const dl = document.getElementById('momentDownloadLink'); dl.href = m.fileData; dl.download = m.fileName || m.title; document.getElementById('momentViewerModal').classList.add('active'); }
function closeMomentViewer() { document.getElementById('momentViewerModal').classList.remove('active'); document.getElementById('momentViewerBody').innerHTML = ''; }

/* ── Certificates ────────────────────────────────────────────────────────── */
function loadCertEventOptions() { const sel = document.getElementById('certEventSelect'); if (!sel) return; sel.innerHTML = '<option value="">Select Event</option>'; if (db.events) db.events.forEach(ev => sel.innerHTML += `<option value="${ev._id}" data-name="${ev.name}">${ev.name}</option>`); }
function onCertEventChange() {}
function toggleAutoParticipants() { const auto = document.getElementById('certAutoParticipants').checked; const container = document.getElementById('certWinnersContainer'); container.style.opacity = auto ? '0.4' : '1'; container.style.pointerEvents = auto ? 'none' : 'auto'; }
function addWinnerRow() { const c = document.getElementById('certWinnersContainer'); const row = document.createElement('div'); row.className = 'winner-entry-row'; row.innerHTML = `<input class="cert-winner-name" placeholder="Recipient Name *"><input class="cert-winner-roll" placeholder="Roll No. (Optional)"><button type="button" class="remove-winner-btn" onclick="removeWinnerRow(this)">✕</button>`; c.appendChild(row); }
function removeWinnerRow(btn) { const rows = document.querySelectorAll('.winner-entry-row'); if (rows.length <= 1) { alert('At least one recipient row is required.'); return; } btn.parentElement.remove(); }

async function handleCertSubmit(e) {
    e.preventDefault();
    const evSel = document.getElementById('certEventSelect');
    const evId = evSel.value;
    const evName = evSel.options[evSel.selectedIndex]?.getAttribute('data-name') || '';
    const type = document.getElementById('certType').value;
    const achievement = document.getElementById('certAchievement').value.trim();
    const orgName = document.getElementById('certOrgName').value.trim() || 'Event Management System';
    const sig1Name = document.getElementById('certSig1Name').value.trim();
    const sig1Title = document.getElementById('certSig1Title').value.trim();
    const sig2Name = document.getElementById('certSig2Name').value.trim();
    const sig2Title = document.getElementById('certSig2Title').value.trim();
    const autoParticipants = document.getElementById('certAutoParticipants').checked;
    const ev = db.events.find(x => x._id === evId);
    const evDate = ev ? new Date(ev.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString();
    let recipients = [];
    if (autoParticipants && type === 'participant') {
        const regs = db.registrations ? db.registrations.filter(r => r.eventName === evName) : [];
        if (!regs.length) { alert('No registrations found for this event.'); return; }
        regs.forEach(reg => { if (reg.participants && reg.participants.length > 1) { reg.participants.forEach(p => recipients.push({ name: p.name, rollNo: p.rollNo || '' })); } else { recipients.push({ name: reg.studentName, rollNo: reg.rollNo || '' }); } });
    } else {
        document.querySelectorAll('.winner-entry-row').forEach(row => { const n = row.querySelector('.cert-winner-name').value.trim(); const r = row.querySelector('.cert-winner-roll').value.trim(); if (n) recipients.push({ name: n, rollNo: r }); });
    }
    if (!recipients.length) { alert('Please add at least one recipient.'); return; }
    const certGroup = { eventId: evId, eventName: evName, eventDate: evDate, type, achievement, orgName, sig1Name, sig1Title, sig2Name, sig2Title, recipients };
    try {
        if (currentCertEditId) {
            const updated = await apiFetch(`/api/certificates/${currentCertEditId}`, 'PUT', certGroup);
            const idx = db.certificates.findIndex(c => c._id === currentCertEditId);
            if (idx > -1) db.certificates[idx] = { ...certGroup, _id: currentCertEditId };
        } else {
            const created = await apiFetch('/api/certificates', 'POST', certGroup);
            db.certificates.unshift(created);
        }
        const s = document.getElementById('certSuccess');
        s.textContent = `✅ ${recipients.length} certificate(s) published successfully!`;
        s.style.display = 'block'; setTimeout(() => s.style.display = 'none', 4000);
        cancelCertEdit(); loadAdminCerts();
    } catch (err) { alert('Failed: ' + err.message); }
}
function cancelCertEdit() { document.getElementById('certForm').reset(); document.getElementById('certWinnersContainer').innerHTML = `<div class="winner-entry-row"><input class="cert-winner-name" placeholder="Recipient Name *" required><input class="cert-winner-roll" placeholder="Roll No. (Optional)"><button type="button" class="remove-winner-btn" onclick="removeWinnerRow(this)">✕</button></div>`; currentCertEditId = null; document.getElementById('certSubmitBtn').textContent = '🏆 Publish Certificates'; document.getElementById('cancelCertBtn').style.display = 'none'; const container = document.getElementById('certWinnersContainer'); container.style.opacity = '1'; container.style.pointerEvents = 'auto'; }
function editCertGroup(id) { const cg = db.certificates.find(x => x._id === id); if (!cg) return; document.getElementById('certEventSelect').value = cg.eventId; document.getElementById('certType').value = cg.type; document.getElementById('certAchievement').value = cg.achievement || ''; document.getElementById('certOrgName').value = cg.orgName || ''; document.getElementById('certSig1Name').value = cg.sig1Name || ''; document.getElementById('certSig1Title').value = cg.sig1Title || ''; document.getElementById('certSig2Name').value = cg.sig2Name || ''; document.getElementById('certSig2Title').value = cg.sig2Title || ''; const c = document.getElementById('certWinnersContainer'); c.innerHTML = ''; cg.recipients.forEach(r => { const row = document.createElement('div'); row.className = 'winner-entry-row'; row.innerHTML = `<input class="cert-winner-name" value="${r.name}" placeholder="Recipient Name *"><input class="cert-winner-roll" value="${r.rollNo || ''}" placeholder="Roll No."><button type="button" class="remove-winner-btn" onclick="removeWinnerRow(this)">✕</button>`; c.appendChild(row); }); currentCertEditId = id; document.getElementById('certSubmitBtn').textContent = '✏️ Update Certificates'; document.getElementById('cancelCertBtn').style.display = 'inline-block'; window.scrollTo(0, 0); }
async function deleteCertGroup(id) { if (!confirm('Delete this certificate group?')) return; await apiFetch(`/api/certificates/${id}`, 'DELETE'); db.certificates = db.certificates.filter(c => c._id !== id); loadAdminCerts(); }

const CERT_TYPE_INFO = {
    winner: { label: '🥇 1st Place – Winner', icon: '🥇', badge: 'cert-badge-winner', color: '#b8860b' },
    runner: { label: '🥈 2nd Place – Runner-up', icon: '🥈', badge: 'cert-badge-runner', color: '#888' },
    second_runner: { label: '🥉 3rd Place', icon: '🥉', badge: 'cert-badge-runner', color: '#cd7f32' },
    participant: { label: '📜 Participation', icon: '📜', badge: 'cert-badge-participant', color: '#8b6f47' },
    special: { label: '⭐ Special Achievement', icon: '⭐', badge: 'cert-badge-special', color: '#9b59b6' }
};

function filterAdminCerts(filter, btn) { adminCertsFilter = filter; document.querySelectorAll('#adminCertificates .cert-filter-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); loadAdminCerts(); }
function loadAdminCerts() {
    const d = document.getElementById('adminCertsList'); if (!d) return;
    let list = db.certificates || [];
    if (adminCertsFilter !== 'all') { list = list.filter(c => { if (adminCertsFilter === 'runner') return c.type === 'runner' || c.type === 'second_runner'; return c.type === adminCertsFilter; }); }
    if (!list.length) { d.innerHTML = '<div class="cert-empty"><div class="empty-icon">🏆</div><h3>No certificates published yet</h3><p>Use the form above to publish certificates for event results.</p></div>'; return; }
    d.innerHTML = '';
    list.forEach(cg => { const ti = CERT_TYPE_INFO[cg.type] || CERT_TYPE_INFO.participant; const names = cg.recipients.map(r => r.name).join(', '); d.innerHTML += `<div class="cert-admin-card"><span class="cert-type-badge ${ti.badge}">${ti.label}</span><h3>${cg.eventName} — ${cg.achievement || ti.label}</h3><div class="cert-winner-names">Recipients (${cg.recipients.length}): <strong>${names}</strong></div><div class="cert-winner-names">🏢 ${cg.orgName || '—'} &nbsp;|&nbsp; 📅 ${cg.eventDate}</div>${cg.sig1Name ? `<div class="cert-winner-names">✍️ ${cg.sig1Name}${cg.sig1Title ? ' — ' + cg.sig1Title : ''} ${cg.sig2Name ? '&nbsp;|&nbsp; ' + cg.sig2Name + (cg.sig2Title ? ' — ' + cg.sig2Title : '') : ''}</div>` : ''}<div class="cert-meta">Published: ${new Date(cg.publishedAt).toLocaleString()}</div><div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;"><button onclick="previewCertificateGroup('${cg._id}')" class="btn-cert">👁 Preview All</button><button class="btn-edit" onclick="editCertGroup('${cg._id}')">Edit</button><button class="btn-delete" onclick="deleteCertGroup('${cg._id}')">Delete</button></div></div>`; });
}

function filterGuestCerts(filter, btn) { guestCertsFilter = filter; document.querySelectorAll('#certificates .cert-filter-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderGuestCerts(); }
function loadGuestCerts() { guestCertsFilter = 'all'; const btns = document.querySelectorAll('#certificates .cert-filter-btn'); btns.forEach(b => b.classList.remove('active')); if (btns[0]) btns[0].classList.add('active'); renderGuestCerts(); }
function renderGuestCerts() {
    const d = document.getElementById('guestCertsList'); if (!d) return;
    let groups = db.certificates || [];
    if (guestCertsFilter !== 'all') { groups = groups.filter(c => { if (guestCertsFilter === 'runner') return c.type === 'runner' || c.type === 'second_runner'; return c.type === guestCertsFilter; }); }
    if (!groups.length) { d.innerHTML = `<div class="cert-empty"><div class="empty-icon">🏆</div><h3>No Certificates Published Yet</h3><p>Certificates will appear here once the organizers publish results.</p></div>`; return; }
    let html = '<div class="cert-grid">';
    groups.forEach(cg => { const ti = CERT_TYPE_INFO[cg.type] || CERT_TYPE_INFO.participant; cg.recipients.forEach((r, ri) => { html += `<div class="cert-guest-card"><div class="cert-card-top"><div class="cert-icon">${ti.icon}</div><div class="cert-type-label">${ti.label}</div></div><div class="cert-card-body"><h3>${cg.achievement || ti.label}</h3><span class="cert-event-tag">🎯 ${cg.eventName}</span><div class="cert-recipient">👤 <strong>${r.name}</strong>${r.rollNo ? ' &nbsp;|&nbsp; Roll: ' + r.rollNo : ''}</div><div class="cert-date-info">📅 ${cg.eventDate}</div><button class="cert-download-btn" onclick="openCertPreview('${cg._id}', ${ri})">🖨️ View & Download PDF</button></div></div>`; }); });
    html += '</div>';
    d.innerHTML = html;
}

function previewCertificateGroup(cgId) { openCertPreview(cgId, 0); }
function openCertPreview(cgId, recipientIdx) {
    const cg = db.certificates.find(x => x._id === cgId); if (!cg) return;
    const r = cg.recipients[recipientIdx]; if (!r) return;
    currentPrintCertId = { cgId, recipientIdx };
    document.getElementById('certPreviewTitle').textContent = `🏆 Certificate — ${r.name}`;
    const body = document.getElementById('certPreviewBody');
    body.innerHTML = buildCertificateHTML(cg, r);
    document.getElementById('certPreviewModal').classList.add('active');
}

function buildCertificateHTML(cg, recipient) {
    const ti = CERT_TYPE_INFO[cg.type] || CERT_TYPE_INFO.participant;
    const awardText = cg.achievement || ti.label.replace(/^[^\s]+\s/, '');
    const sig2Block = cg.sig2Name ? `<div class="cert-signature-block"><div class="cert-signature-line"></div><div class="cert-signature-name">${cg.sig2Name}</div><div class="cert-signature-title">${cg.sig2Title || ''}</div></div>` : `<div class="cert-signature-block"><div class="cert-seal">🏛️</div></div>`;
    return `<div class="certificate-design" id="certPrintArea"><div class="cert-bg-pattern"></div><div class="cert-outer-border"></div><div class="cert-inner-border"></div><div class="cert-corner cert-corner-tl"><svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><path d="M5,5 L20,5 M5,5 L5,20" stroke="#8b6f47" stroke-width="2" fill="none"/><path d="M2,2 L22,2 M2,2 L2,22" stroke="#d4a574" stroke-width="1" fill="none"/><circle cx="5" cy="5" r="3" fill="#8b6f47"/></svg></div><div class="cert-corner cert-corner-tr"><svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><path d="M5,5 L20,5 M5,5 L5,20" stroke="#8b6f47" stroke-width="2" fill="none"/><path d="M2,2 L22,2 M2,2 L2,22" stroke="#d4a574" stroke-width="1" fill="none"/><circle cx="5" cy="5" r="3" fill="#8b6f47"/></svg></div><div class="cert-corner cert-corner-bl"><svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><path d="M5,5 L20,5 M5,5 L5,20" stroke="#8b6f47" stroke-width="2" fill="none"/><path d="M2,2 L22,2 M2,2 L2,22" stroke="#d4a574" stroke-width="1" fill="none"/><circle cx="5" cy="5" r="3" fill="#8b6f47"/></svg></div><div class="cert-corner cert-corner-br"><svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><path d="M5,5 L20,5 M5,5 L5,20" stroke="#8b6f47" stroke-width="2" fill="none"/><path d="M2,2 L22,2 M2,2 L2,22" stroke="#d4a574" stroke-width="1" fill="none"/><circle cx="5" cy="5" r="3" fill="#8b6f47"/></svg></div><div class="cert-content"><div style="text-align:center;"><div class="cert-header-logo">🏛️</div><div class="cert-org-name">${cg.orgName || 'Event Management System'}</div><div class="cert-divider"></div><div class="cert-title-line">This is to certify that</div><div class="cert-main-title">Certificate of ${cg.type === 'participant' ? 'Participation' : 'Achievement'}</div><div class="cert-award-type">${ti.icon} ${awardText}</div><div class="cert-recipient-label">Proudly presented to</div><div class="cert-recipient-name">${recipient.name}</div>${recipient.rollNo ? `<div style="font-size:12px;color:#aaa;font-family:'Segoe UI',sans-serif;margin-top:4px;">Roll No: ${recipient.rollNo}</div>` : ''}<div class="cert-event-name">for participation in</div><div style="font-size:18px;color:#5a3e1e;font-weight:bold;font-family:Georgia,serif;margin:4px 0 8px;">${cg.eventName}</div><div class="cert-event-detail">held on ${cg.eventDate}</div><div class="cert-body-text">This certificate is awarded in recognition of outstanding dedication, skill, and contribution to the event.</div></div><div class="cert-footer"><div class="cert-signature-block"><div class="cert-signature-line"></div><div class="cert-signature-name">${cg.sig1Name || 'Event Coordinator'}</div><div class="cert-signature-title">${cg.sig1Title || 'Organizing Committee'}</div></div><div class="cert-signature-block" style="flex:0;padding:0 20px;"><div style="font-size:40px;opacity:0.12;">🏆</div></div>${sig2Block}</div><div class="cert-date-text">Issued on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div></div>`;
}

function closeCertPreview() { document.getElementById('certPreviewModal').classList.remove('active'); document.getElementById('certPreviewBody').innerHTML = ''; currentPrintCertId = null; }
function printCertificate() {
    const certEl = document.getElementById('certPrintArea'); if (!certEl) return;
    const printWin = window.open('', '_blank', 'width=900,height=700');
    printWin.document.write(`<!DOCTYPE html><html><head><title>Certificate</title><style>* { margin:0; padding:0; box-sizing:border-box; } body { background:white; display:flex; justify-content:center; align-items:center; min-height:100vh; } @page { size: A4 landscape; margin: 10mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } } .certificate-design { width:100%; max-width:750px; min-height:530px; background:white; border-radius:4px; position:relative; overflow:hidden; font-family:Georgia,'Times New Roman',serif; } .cert-outer-border { position:absolute; inset:10px; border:3px solid #8b6f47; border-radius:2px; pointer-events:none; } .cert-inner-border { position:absolute; inset:16px; border:1px solid #d4a574; border-radius:2px; pointer-events:none; } .cert-corner { position:absolute; width:50px; height:50px; } .cert-corner svg { width:50px; height:50px; } .cert-corner-tl { top:6px; left:6px; } .cert-corner-tr { top:6px; right:6px; transform:scaleX(-1); } .cert-corner-bl { bottom:6px; left:6px; transform:scaleY(-1); } .cert-corner-br { bottom:6px; right:6px; transform:scale(-1); } .cert-bg-pattern { position:absolute; inset:0; opacity:0.04; background-image:radial-gradient(circle,#8b6f47 1px,transparent 1px); background-size:24px 24px; } .cert-content { position:relative; z-index:2; padding:40px 60px; min-height:530px; display:flex; flex-direction:column; align-items:center; justify-content:space-between; } .cert-header-logo { font-size:36px; margin-bottom:4px; } .cert-org-name { font-size:13px; letter-spacing:3px; text-transform:uppercase; color:#8b6f47; font-family:'Segoe UI',sans-serif; font-weight:600; margin-bottom:12px; } .cert-divider { width:120px; height:2px; background:linear-gradient(to right,transparent,#d4a574,transparent); margin:0 auto 16px; } .cert-title-line { font-size:11px; letter-spacing:4px; text-transform:uppercase; color:#999; font-family:'Segoe UI',sans-serif; margin-bottom:8px; } .cert-main-title { font-size:34px; color:#5a3e1e; font-weight:bold; margin-bottom:16px; font-style:italic; } .cert-award-type { display:inline-block; background:linear-gradient(135deg,#8b6f47,#5a3e1e); color:white; font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; padding:6px 24px; border-radius:20px; font-family:'Segoe UI',sans-serif; margin-bottom:18px; } .cert-recipient-label { font-size:13px; color:#999; font-family:'Segoe UI',sans-serif; letter-spacing:1px; text-transform:uppercase; margin-bottom:6px; } .cert-recipient-name { font-size:28px; color:#3d2b10; font-weight:bold; margin-bottom:4px; border-bottom:2px solid #d4a574; padding-bottom:8px; min-width:300px; text-align:center; } .cert-event-name { font-size:14px; color:#666; font-family:'Segoe UI',sans-serif; margin:10px 0 4px; } .cert-event-detail { font-size:13px; color:#888; font-family:'Segoe UI',sans-serif; margin-bottom:4px; } .cert-body-text { font-size:13px; color:#666; font-family:'Segoe UI',sans-serif; line-height:1.7; max-width:500px; margin:10px auto 0; text-align:center; } .cert-footer { width:100%; display:flex; justify-content:space-between; align-items:flex-end; margin-top:16px; } .cert-signature-block { text-align:center; flex:1; } .cert-signature-line { width:160px; height:1px; background:#8b6f47; margin:0 auto 6px; } .cert-signature-name { font-size:13px; color:#5a3e1e; font-weight:600; font-family:'Segoe UI',sans-serif; } .cert-signature-title { font-size:11px; color:#999; font-family:'Segoe UI',sans-serif; letter-spacing:0.5px; } .cert-date-text { font-size:11px; color:#999; font-family:'Segoe UI',sans-serif; margin-top:20px; letter-spacing:0.5px; }</style></head><body>${certEl.outerHTML}</body></html>`);
    printWin.document.close(); printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 600);
}

/* ── Init ────────────────────────────────────────────────────────────────── */
window.onload = () => { initRatingStars(); };
