/**
 * -------------------------------------------------------------------------
 * script.js - เวอร์ชันเชื่อมต่อ API + MongoDB จริง
 * -------------------------------------------------------------------------
 */

// --- 1. Config ---
const API_BASE = '/api';

// --- 2. State ---
let currentUser = null;
let blacklistData = [];

// --- 3. Helpers ---
const getToken = () => localStorage.getItem('bl_token');

const apiFetch = async (endpoint, options = {}) => {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(API_BASE + endpoint, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'เกิดข้อผิดพลาด');
    return data;
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

const showAlert = (msg, type = 'info') => {
    const alertBox = document.getElementById('globalAlert');
    if (!alertBox) return alert(msg);
    alertBox.textContent = msg;
    alertBox.className = `global-alert show ${type}`;
    setTimeout(() => alertBox.classList.remove('show'), 3500);
};

// --- 4. Page Navigation ---
window.showPage = (pageId) => {
    if (pageId === 'adminPage' && (!currentUser || !currentUser.isAdmin)) {
        showAlert('⚠️ เฉพาะแอดมินเท่านั้นที่มีสิทธิ์เข้าถึงหน้านี้', 'error');
        window.showPage('searchPage');
        return;
    }
    const restricted = ['reportPage', 'appealPage'];
    if (restricted.includes(pageId) && !currentUser) {
        showAlert('🔒 กรุณาเข้าสู่ระบบก่อนดำเนินการ', 'warning');
        window.showPage('loginPage');
        return;
    }
    document.querySelectorAll('.page-section').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(pageId);
    if (target) {
        target.classList.remove('hidden');
        updateNavUI(pageId);
        if (pageId === 'casesPage') loadPublicCases();
        if (pageId === 'adminPage') loadAdminDashboard();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

const updateNavUI = (pageId) => {
    const navIds = ['nav-search', 'nav-list', 'nav-report', 'nav-appeal', 'nav-admin', 'nav-login'];
    navIds.forEach(id => document.getElementById(id)?.classList.remove('active-nav'));
    let navSuffix = pageId.replace('Page', '');
    if (navSuffix === 'cases') navSuffix = 'list';
    const activeBtn = document.getElementById('nav-' + navSuffix);
    if (activeBtn) activeBtn.classList.add('active-nav');
};

// --- 5. Auth ---
window.handleLogin = async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'กำลังล็อกอิน...';
    try {
        const data = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        localStorage.setItem('bl_token', data.token);
        currentUser = { username: data.username, isAdmin: data.isAdmin };
        updateUserUI();
        showAlert('✅ เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ ' + data.username, 'success');
        window.showPage('searchPage');
    } catch (err) {
        showAlert('❌ ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Login';
    }
};

window.handleRegister = async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUser').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPass').value;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'กำลังสมัคร...';
    try {
        await apiFetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
        showAlert('✅ สมัครสมาชิกสำเร็จ! กรุณาล็อกอิน', 'success');
        e.target.reset();
        window.toggleAuth('login');
    } catch (err) {
        showAlert('❌ ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'ยืนยันการสมัคร';
    }
};

window.handleForgotPassword = (e) => {
    e.preventDefault();
    showAlert('📧 ระบบจะส่งรหัสผ่านไปที่อีเมลของท่าน (ฟีเจอร์นี้จะเพิ่มในเร็วๆ นี้)', 'info');
    window.toggleAuth('login');
};

window.handleLogout = () => {
    localStorage.removeItem('bl_token');
    currentUser = null;
    updateUserUI();
    window.showPage('searchPage');
    showAlert('ออกจากระบบแล้ว', 'info');
};

window.toggleAuth = (mode) => {
    document.getElementById('auth-login-box').classList.toggle('hidden', mode !== 'login');
    document.getElementById('auth-register-box').classList.toggle('hidden', mode !== 'register');
    document.getElementById('auth-forgot-box').classList.toggle('hidden', mode !== 'forgot');
};

const updateUserUI = () => {
    const loginBtn = document.getElementById('nav-login');
    const userInfo = document.getElementById('user-info');
    const displayName = document.getElementById('display-name');
    const adminBtn = document.getElementById('nav-admin');

    if (currentUser) {
        displayName.innerText = 'สวัสดี, ' + currentUser.username;
        userInfo.classList.remove('hidden');
        userInfo.classList.add('flex');
        loginBtn.classList.add('hidden');
        if (currentUser.isAdmin) adminBtn.classList.remove('hidden');
        else adminBtn.classList.add('hidden');
    } else {
        userInfo.classList.add('hidden');
        userInfo.classList.remove('flex');
        loginBtn.classList.remove('hidden');
        adminBtn.classList.add('hidden');
    }
};

// --- 6. Blacklist ---
const loadPublicCases = async () => {
    const tbody = document.getElementById('caseTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" class="py-10 text-center text-slate-400">⏳ กำลังโหลด...</td></tr>';
    try {
        const data = await apiFetch('/blacklist');
        blacklistData = data;
        renderPublicCases(data);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-10 text-center text-red-400">❌ ${err.message}</td></tr>`;
    }
};

const renderPublicCases = (data) => {
    const tbody = document.getElementById('caseTableBody');
    const countEl = document.getElementById('caseCount');
    if (!tbody) return;
    countEl.innerText = `${data.length} รายการ`;
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="py-20 text-center italic text-slate-300">ยังไม่มีข้อมูล</td></tr>';
        return;
    }
    tbody.innerHTML = data.map(s => {
        const date = new Date(s.createdAt).toLocaleDateString('th-TH');
        return `<tr class="border-b text-sm hover:bg-slate-100 transition">
            <td class="p-5 text-slate-400 text-xs">${date}</td>
            <td class="p-5 text-slate-600 font-medium">${escHtml(s.reportedBy)}</td>
            <td class="p-5 font-bold text-red-600">${escHtml(s.name)}</td>
            <td class="p-5 text-center">
                ${s.image ? `<button onclick="window.loadAndViewEvidence('${s._id}')" class="text-blue-500 underline text-xs">🖼️ ดูรูป</button>` : '-'}
            </td>
            <td class="p-5">${escHtml(s.type)}</td>
            <td class="p-5 text-slate-500 max-w-xs truncate" title="${escHtml(s.detail)}">${escHtml(s.detail)}</td>
            <td class="p-5 text-orange-600 italic font-medium max-w-xs truncate">${escHtml(s.negotiation || '-')}</td>
            <td class="p-5 text-center"><span class="px-2 py-1 rounded-full text-[9px] font-bold ${getStatusClass(s.status)}">${escHtml(s.status)}</span></td>
        </tr>`;
    }).join('');
};

window.handleSearch = async () => {
    const q = document.getElementById('searchInput').value.trim();
    const list = document.getElementById('resultList');
    if (!q) return;
    document.getElementById('searchResultArea').classList.remove('hidden');
    list.innerHTML = '<p class="text-center text-slate-400">⏳ กำลังค้นหา...</p>';
    try {
        const results = await apiFetch(`/blacklist/search?q=${encodeURIComponent(q)}`);
        if (results.length === 0) {
            list.innerHTML = '<div class="p-10 text-center font-bold">✅ ไม่พบประวัติการโกงในระบบ สามารถทำธุรกรรมได้อย่างปลอดภัย</div>';
        } else {
            list.innerHTML = results.map(s => `
                <div class="bg-red-50 p-6 rounded-3xl border border-red-100 flex justify-between items-center mb-4">
                    <div>
                        <p class="font-bold text-red-600 text-lg">${escHtml(s.status)}</p>
                        <p class="text-slate-800 font-bold">ไอดี/บัญชี: ${escHtml(s.name)}</p>
                        <p class="text-xs text-slate-500 mt-1">ประเภท: ${escHtml(s.type)} | โดย: ${escHtml(s.reportedBy)}</p>
                        <p class="text-xs text-slate-400 mt-1">${escHtml(s.detail)}</p>
                    </div>
                    ${s.image ? `<button onclick="window.loadAndViewEvidence('${s._id}')" class="bg-white text-blue-500 border border-blue-100 p-2 rounded-xl text-sm font-bold shadow-sm ml-4 whitespace-nowrap">ดูรูป</button>` : ''}
                </div>
            `).join('');
        }
    } catch (err) {
        list.innerHTML = `<p class="text-center text-red-400">❌ ${err.message}</p>`;
    }
};

// โหลดรูปตอนคลิก (lazy load)
window.loadAndViewEvidence = async (id) => {
    try {
        const data = await apiFetch(`/blacklist/${id}/image`);
        window.viewEvidence(data.image);
    } catch {
        showAlert('❌ ไม่สามารถโหลดรูปได้', 'error');
    }
};

window.handleReportSubmit = async (e) => {
    e.preventDefault();
    const file = document.getElementById('reportFile').files[0];
    if (!file) return showAlert('กรุณาแนบรูปหลักฐาน', 'error');
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '⏳ กำลังส่งข้อมูล...';
    try {
        const image = await fileToBase64(file);
        await apiFetch('/blacklist', {
            method: 'POST',
            body: JSON.stringify({
                name: document.getElementById('reportName').value,
                type: document.getElementById('reportType').value,
                detail: document.getElementById('reportDetail').value,
                image
            })
        });
        showAlert('📢 บันทึกสำเร็จ! รอแอดมินตรวจสอบ', 'success');
        e.target.reset();
        window.showPage('casesPage');
    } catch (err) {
        showAlert('❌ ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'บันทึกข้อมูล Blacklist';
    }
};

window.handleAppealSubmit = async (e) => {
    e.preventDefault();
    const file = document.getElementById('appealFile').files[0];
    if (!file) return showAlert('กรุณาแนบรูปหลักฐาน', 'error');
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '⏳ กำลังส่ง...';
    try {
        const image = await fileToBase64(file);
        await apiFetch('/appeal', {
            method: 'POST',
            body: JSON.stringify({
                targetId: document.getElementById('appealTarget').value,
                detail: document.getElementById('appealDetail').value,
                image
            })
        });
        showAlert('🛠️ ยื่นคำร้องสำเร็จ! แอดมินจะตรวจสอบครับ', 'success');
        e.target.reset();
        window.showPage('searchPage');
    } catch (err) {
        showAlert('❌ ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'ส่งคำร้องให้แอดมิน';
    }
};

// --- 7. Admin ---
const loadAdminDashboard = async () => {
    try {
        const [stats, pending, appeals] = await Promise.all([
            apiFetch('/blacklist/stats'),
            apiFetch('/blacklist/pending'),
            apiFetch('/appeal/pending')
        ]);
        document.getElementById('admin-pending-count').innerText = stats.pending;
        document.getElementById('admin-appeal-count').innerText = appeals.length;
        document.getElementById('admin-success-count').innerText = stats.resolved;
        renderAdminScams(pending);
        renderAdminAppeals(appeals);
    } catch (err) {
        showAlert('❌ โหลด dashboard ไม่สำเร็จ: ' + err.message, 'error');
    }
};

const renderAdminScams = (list) => {
    const tbody = document.getElementById('admin-pending-scams');
    if (!tbody) return;
    tbody.innerHTML = list.length === 0
        ? '<tr><td colspan="6" class="py-4 text-center text-slate-400">ไม่มีรายการรอตรวจสอบ ✅</td></tr>'
        : list.map(s => {
            const date = new Date(s.createdAt).toLocaleDateString('th-TH');
            return `<tr>
                <td class="p-4">${date}</td>
                <td class="p-4">${escHtml(s.reportedBy)}</td>
                <td class="p-4 font-bold text-red-600">${escHtml(s.name)}</td>
                <td class="p-4 max-w-xs truncate">${escHtml(s.detail)}</td>
                <td class="p-4 text-center">
                    ${s.image ? `<button onclick="window.loadAndViewEvidence('${s._id}')" class="text-blue-500 underline text-xs">ดูรูป</button>` : '-'}
                </td>
                <td class="p-4 flex gap-1">
                    <button onclick="window.adminApproveScam('${s._id}')" class="bg-green-600 text-white px-3 py-1 rounded font-bold text-xs">อนุมัติ</button>
                    <button onclick="window.adminDeleteScam('${s._id}')" class="bg-red-50 text-red-400 px-3 py-1 rounded font-bold text-xs">ลบ</button>
                </td>
            </tr>`;
        }).join('');
};

const renderAdminAppeals = (list) => {
    const tbody = document.getElementById('admin-pending-appeals');
    if (!tbody) return;
    tbody.innerHTML = list.length === 0
        ? '<tr><td colspan="6" class="py-4 text-center text-slate-400">ไม่มีคำร้อง ✅</td></tr>'
        : list.map(a => {
            const date = new Date(a.createdAt).toLocaleDateString('th-TH');
            return `<tr>
                <td class="p-4">${date}</td>
                <td class="p-4 font-medium">${escHtml(a.submittedBy)}</td>
                <td class="p-4 font-bold text-blue-600">${escHtml(a.targetId)}</td>
                <td class="p-4 max-w-xs truncate">${escHtml(a.detail)}</td>
                <td class="p-4 text-center">
                    ${a.image ? `<button onclick="window.viewEvidence('${a.image}')" class="text-blue-500 underline text-xs">ดูรูป</button>` : '-'}
                </td>
                <td class="p-4 text-center">
                    <button onclick="window.adminApproveAppeal('${a._id}')" class="bg-blue-600 text-white px-3 py-1 rounded-lg font-bold text-xs">ยืนยัน</button>
                </td>
            </tr>`;
        }).join('');
};

window.adminApproveScam = async (id) => {
    if (!confirm('อนุมัติรายการนี้?')) return;
    try {
        await apiFetch(`/blacklist/${id}/approve`, { method: 'PATCH' });
        showAlert('✅ อนุมัติเรียบร้อย', 'success');
        loadAdminDashboard();
    } catch (err) {
        showAlert('❌ ' + err.message, 'error');
    }
};

window.adminDeleteScam = async (id) => {
    if (!confirm('ลบข้อมูลถาวร?')) return;
    try {
        await apiFetch(`/blacklist/${id}`, { method: 'DELETE' });
        showAlert('🗑️ ลบสำเร็จ', 'success');
        loadAdminDashboard();
    } catch (err) {
        showAlert('❌ ' + err.message, 'error');
    }
};

window.adminApproveAppeal = async (id) => {
    if (!confirm('ยืนยันการแก้สถานะ?')) return;
    try {
        await apiFetch(`/appeal/${id}/approve`, { method: 'PATCH' });
        showAlert('✅ เปลี่ยนสถานะเรียบร้อย', 'success');
        loadAdminDashboard();
    } catch (err) {
        showAlert('❌ ' + err.message, 'error');
    }
};

// --- 8. Modal ---
window.viewEvidence = (imgSrc) => {
    document.getElementById('modalImage').src = imgSrc;
    document.getElementById('evidenceModal').classList.remove('hidden');
};

window.closeModal = () => document.getElementById('evidenceModal').classList.add('hidden');

// --- 9. Utilities ---
const escHtml = (str) => String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function getStatusClass(status) {
    if (status === 'อันตราย') return 'bg-red-100 text-red-600';
    if (status && status.includes('คืนเงิน')) return 'bg-orange-100 text-orange-600';
    return 'bg-yellow-100 text-yellow-600';
}

// --- 10. Init ---
const init = async () => {
    const token = getToken();
    if (token) {
        try {
            const data = await apiFetch('/auth/me');
            currentUser = { username: data.username, isAdmin: data.isAdmin };
            updateUserUI();
        } catch {
            localStorage.removeItem('bl_token');
        }
    }
    window.showPage('searchPage');
};

// ค้นหาด้วย Enter
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('searchInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') window.handleSearch();
    });
    init();
});