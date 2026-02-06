// TOAST
function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = msg;
    const container = document.getElementById('toast-container') || document.body;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// DIALOG
function showDialog(title, msg, type = 'alert', onConfirm = null) {
    const titleEl = document.getElementById('dialog-title');
    const bodyEl = document.getElementById('dialog-body');
    const footerEl = document.getElementById('dialog-footer');
    const dialogBox = document.querySelector('#custom-dialog .dialog-box');

    if (!titleEl || !bodyEl || !footerEl) return;
    if (dialogBox) dialogBox.className = 'modal dialog-box';

    titleEl.innerText = title;
    bodyEl.innerHTML = `<div style="color:#ccc; line-height:1.6">${msg}</div>`;
    footerEl.innerHTML = '';

    if (type === 'confirm') {
        footerEl.innerHTML = `
            <button style="flex:1; margin-right:10px; background:#333; color:#fff;" onclick="closeDialog()">HỦY</button>
            <button style="flex:1; background:#fff; color:#000;" id="confirm-btn">XÁC NHẬN</button>`;
        const confirmBtn = document.getElementById('confirm-btn');
        if (confirmBtn) confirmBtn.onclick = () => { if (onConfirm) onConfirm(); closeDialog(); };
    } else {
        footerEl.innerHTML = `<button style="width:100%; background:#fff; color:#000;" onclick="closeDialog()">ĐÓNG</button>`;
    }
    document.getElementById('custom-dialog').style.display = 'flex';
}

function closeDialog() {
    const dialogBox = document.querySelector('#custom-dialog .dialog-box');
    if (dialogBox) dialogBox.className = 'modal dialog-box';
    document.getElementById('custom-dialog').style.display = 'none';
}

// AUTH
let currentUser = null;
let userActivePackages = [];
let userDeposits = [];
let userRents = [];
let authToken = localStorage.getItem('auth_token') || null;
let adminToken = localStorage.getItem('admin_token') || null;

async function apiFetch(path, options = {}, useAdmin = false) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = useAdmin ? adminToken : authToken;
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(path, { ...options, headers });
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : null;
    if (!res.ok) {
        const err = data?.error || 'request_failed';
        throw new Error(err);
    }
    return data;
}

async function refreshMe() {
    if (!authToken) {
        currentUser = null;
        return null;
    }
    const me = await apiFetch('/api/user/me');
    currentUser = {
        id: me.id,
        name: me.username,
        balance: me.balance
    };
    return currentUser;
}

async function loadUserData() {
    if (!authToken) return;
    await refreshMe();
    const [deposits, rents, active] = await Promise.all([
        apiFetch('/api/user/deposits'),
        apiFetch('/api/user/rents'),
        apiFetch('/api/user/active')
    ]);
    userDeposits = deposits || [];
    userRents = rents || [];
    userActivePackages = active || [];
}

function maybeShowPinGuide() {
    if (!currentUser || !Array.isArray(userActivePackages) || userActivePackages.length === 0) return;
    const latest = userActivePackages[0];
    if (!latest?.id) return;
    const key = `pin_guide_seen_${latest.id}`;
    if (localStorage.getItem(key)) return;
    const successModal = document.getElementById('successModal');
    if (successModal) successModal.style.display = 'flex';
    const userLabel = document.getElementById('user-for-support');
    if (userLabel) userLabel.innerText = currentUser.name;
    const note = document.getElementById('connect-note');
    if (note) note.textContent = "Chưa nhập mã.";
    const input = document.getElementById('connect-pin-input');
    if (input) input.value = '';
    localStorage.setItem(key, '1');
}

function openAuth() { 
    renderLogin(); 
    document.getElementById('authModal').style.display = 'flex'; 
}
function closeAuth() { document.getElementById('authModal').style.display = 'none'; }

function renderLogin() {
    const content = document.getElementById('authContent');
    if (!content) return;
    content.innerHTML = `
        <h2>ĐĂNG NHẬP</h2>
        <input type="text" id="l-user" placeholder="Tài khoản">
        <input type="password" id="l-pass" placeholder="Mật khẩu">
        <button onclick="handleLogin()">ĐĂNG NHẬP</button>
        <p onclick="renderRegister()" style="cursor:pointer; color:#888; text-align:center; margin-top:15px;">Tạo tài khoản mới</p>`;
}

function renderRegister() {
    const content = document.getElementById('authContent');
    if (!content) return;
    content.innerHTML = `
        <h2>ĐĂNG KÝ</h2>
        <input type="text" id="r-user" placeholder="Tài khoản">
        <input type="password" id="r-pass" placeholder="Mật khẩu">
        <button onclick="handleRegister()">ĐĂNG KÝ</button>
        <p onclick="renderLogin()" style="cursor:pointer; color:#888; text-align:center; margin-top:15px;">Đã có tài khoản</p>`;
}

async function handleLogin() {
    const u = document.getElementById('l-user')?.value.trim();
    const p = document.getElementById('l-pass')?.value.trim();
    if (!u || !p) return showDialog("Lỗi", "Vui lòng điền đầy đủ.");
    try {
        const data = await apiFetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: u, password: p })
        });
        authToken = data.token;
        localStorage.setItem('auth_token', authToken);
        await loadUserData();
        closeAuth();
        updateUI();
        showToast("Đăng nhập thành công!");
    } catch (err) {
        showDialog("Lỗi", "Tài khoản hoặc mật khẩu sai.");
    }
}

async function handleRegister() {
    const u = document.getElementById('r-user')?.value.trim();
    const p = document.getElementById('r-pass')?.value.trim();
    if (!u || u.length < 3) return showDialog("Lỗi", "Tên tài khoản phải từ 3 ký tự.");
    if (!p) return showDialog("Lỗi", "Mật khẩu không được để trống.");
    try {
        const data = await apiFetch('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username: u, password: p })
        });
        authToken = data.token;
        localStorage.setItem('auth_token', authToken);
        await loadUserData();
        closeAuth();
        updateUI();
        showToast("Đăng ký thành công!");
    } catch (err) {
        if (err.message === 'user_exists') return showDialog("Lỗi", "Tài khoản đã tồn tại.");
        showDialog("Lỗi", "Đăng ký thất bại.");
    }
}

function logout() {
    localStorage.removeItem('auth_token');
    authToken = null;
    currentUser = null;
    userActivePackages = [];
    userDeposits = [];
    userRents = [];
    location.reload();
}

// UPDATE UI
async function updateUI() {
    if (!currentUser && authToken) {
        try {
            await loadUserData();
        } catch (err) {
            logout();
            return;
        }
    }
    if (!currentUser) return;

    const mainLogin = document.getElementById('main-login-btn');
    const userInfo = document.getElementById('user-info-display');
    const welcome = document.getElementById('welcome-text');

    if (mainLogin) mainLogin.style.display = 'none';
    if (userInfo) userInfo.style.display = 'flex';
    if (welcome) welcome.style.display = 'none';

    document.getElementById('name-val').innerText = currentUser.name;
    document.getElementById('id-val').innerText = currentUser.id;
    document.getElementById('balance-val').innerText = Number(currentUser.balance || 0).toLocaleString('vi-VN') + "đ";
    refreshNotiBadge();

    updateCKContent();
    renderRealtime();
    renderAdminDashboard();
    maybeShowPinGuide();
}

function updateCKContent() {
    const ck = document.getElementById('ck-content');
    if (ck && currentUser) ck.textContent = `NAP ${currentUser.id}`;
}

// REALTIME NOTIFICATIONS
function addNotification(message) {
    showToast(message);
}

function refreshNotiBadge() {
    const badge = document.getElementById('noti-count');
    if (!badge) return;
    const pending = (userRents || []).filter(r => r.status === 'pending').length;
    badge.innerText = pending;
}

function markAllNotificationsRead() {
    const badge = document.getElementById('noti-count');
    if (badge) badge.innerText = '0';
}

function renderRealtime() {
    return;
}

// ADMIN DASHBOARD
let adminCache = { users: [], rents: [], deposits: [], stats: null, stock: [], pins: [] };

function isAdminMode() {
    return localStorage.getItem('admin_mode') === '1';
}

async function ensureAdminAuth() {
    if (adminToken) return true;
    const pass = prompt('Nhập mật khẩu admin:');
    if (!pass) return false;
    try {
        const data = await apiFetch('/api/admin/login', {
            method: 'POST',
            body: JSON.stringify({ password: pass })
        }, true);
        adminToken = data.token;
        localStorage.setItem('admin_token', adminToken);
        return true;
    } catch (err) {
        showToast("Mật khẩu admin không đúng.");
        return false;
    }
}

async function loadAdminData() {
    const ok = await ensureAdminAuth();
    if (!ok) return false;
    try {
        const [users, rents, deposits, stock, stats, pins] = await Promise.all([
            apiFetch('/api/admin/users', {}, true),
            apiFetch('/api/admin/rents', {}, true),
            apiFetch('/api/admin/deposits', {}, true),
            apiFetch('/api/admin/out_of_stock', {}, true),
            apiFetch('/api/admin/stats', {}, true),
            apiFetch('/api/admin/pins', {}, true)
        ]);
        adminCache = {
            users: users || [],
            rents: rents || [],
            deposits: deposits || [],
            stock: stock?.packages || [],
            stats: stats || null,
            pins: pins || []
        };
        return true;
    } catch (err) {
        if (err.message === 'unauthorized') {
            adminToken = null;
            localStorage.removeItem('admin_token');
            return await loadAdminData();
        }
        showToast("Không tải được dữ liệu admin.");
        return false;
    }
}

async function renderAdminDashboard() {
    const panel = document.getElementById('admin-panel');
    if (!panel) return;
    if (!isAdminMode()) {
        panel.style.display = 'none';
        return;
    }
    panel.style.display = 'block';
    const ok = await loadAdminData();
    if (!ok) return;
    renderAdminUsers();
    renderAdminRents();
    renderAdminDeposits();
    renderAdminStock();
    renderAdminStats();
    renderAdminPins();
}

function renderAdminUsers() {
    const el = document.getElementById('admin-users');
    if (!el) return;
    const items = adminCache.users || [];
    if (items.length === 0) {
        el.innerHTML = '<div class="admin-meta">Chưa có người dùng.</div>';
        return;
    }
    el.innerHTML = `<div class="admin-grid">` + items.map(u => `
        <div class="admin-card">
            <div class="admin-row">
                <div><strong>${u.username}</strong> <span class="admin-meta">(${u.id})</span></div>
                <div class="admin-meta">Số dư: ${Number(u.balance || 0).toLocaleString('vi-VN')}đ</div>
            </div>
            <div class="admin-row">
                <button class="admin-btn blue" onclick="adminAdjustBalance('${u.id}', 50000)">+50k</button>
                <button class="admin-btn blue" onclick="adminAdjustBalance('${u.id}', -50000)">-50k</button>
                <button class="admin-btn red" onclick="adminResetUser('${u.id}')">XÓA USER</button>
            </div>
        </div>
    `).join('') + `</div>`;
}

function renderAdminRents() {
    const el = document.getElementById('admin-rents');
    if (!el) return;
    const reqs = (adminCache.rents || []).filter(r => r.status === 'pending');
    if (reqs.length === 0) {
        el.innerHTML = '<div class="admin-meta">Không có yêu cầu thuê.</div>';
        return;
    }
    el.innerHTML = `<div class="admin-grid">` + reqs.map(r => `
        <div class="admin-card">
            <div class="admin-row">
                <div><strong>${r.package_name}</strong> <span class="admin-meta">(${r.username})</span></div>
                <div class="admin-meta">${new Date(r.created_at).toLocaleString('vi-VN')}</div>
            </div>
            <div class="admin-row">
                <div class="admin-meta">${Number(r.price).toLocaleString('vi-VN')}đ</div>
                <div>
                    <button class="admin-btn green" onclick="adminApproveRent('${r.id}', '${r.package_name}', ${r.price})">DUYỆT</button>
                    <button class="admin-btn red" onclick="adminRejectRent('${r.id}')">TỪ CHỐI</button>
                </div>
            </div>
        </div>
    `).join('') + `</div>`;
}

function renderAdminDeposits() {
    const el = document.getElementById('admin-deposits');
    if (!el) return;
    const pending = (adminCache.deposits || []).filter(d => d.status === 'pending');
    if (pending.length === 0) {
        el.innerHTML = '<div class="admin-meta">Không có nạp tiền chờ duyệt.</div>';
        return;
    }
    el.innerHTML = `<div class="admin-grid">` + pending.map(d => `
        <div class="admin-card">
            <div class="admin-row">
                <div><strong>${d.username}</strong> <span class="admin-meta">Ngân hàng</span></div>
                <div class="admin-meta">${new Date(d.created_at).toLocaleString('vi-VN')}</div>
            </div>
            <div class="admin-row">
                <div class="admin-meta">${Number(d.amount).toLocaleString('vi-VN')}đ</div>
                <div>
                    <button class="admin-btn green" onclick="adminApproveDeposit('${d.id}')">DUYỆT</button>
                    <button class="admin-btn red" onclick="adminRejectDeposit('${d.id}')">TỪ CHỐI</button>
                </div>
            </div>
        </div>
    `).join('') + `</div>`;
}

function renderAdminStock() {
    const el = document.getElementById('admin-stock');
    if (!el) return;
    const list = adminCache.stock || [];
    const isOut = name => list.includes(name);
    const items = ['Gói Cơ Bản', 'Gói Tối Ưu'];
    el.innerHTML = `<div class="admin-stock">` + items.map(name => `
        <label class="admin-toggle">
            <input type="checkbox" ${isOut(name) ? 'checked' : ''} onchange="adminToggleStock('${name}', this.checked)">
            <span>${name}</span>
        </label>
    `).join('') + `</div>`;
}

function renderAdminStats() {
    const el = document.getElementById('admin-stats');
    if (!el) return;
    const s = adminCache.stats || { users: 0, balance: 0, deposits: 0, rents: 0 };
    el.innerHTML = `
        <div class="admin-grid">
            <div class="admin-card admin-stat"><div class="admin-meta">Tổng người dùng</div><strong>${s.users}</strong></div>
            <div class="admin-card admin-stat"><div class="admin-meta">Tổng số dư</div><strong>${Number(s.balance).toLocaleString('vi-VN')}đ</strong></div>
            <div class="admin-card admin-stat"><div class="admin-meta">Nạp đã duyệt</div><strong>${Number(s.deposits).toLocaleString('vi-VN')}đ</strong></div>
            <div class="admin-card admin-stat"><div class="admin-meta">Doanh thu thuê</div><strong>${Number(s.rents).toLocaleString('vi-VN')}đ</strong></div>
        </div>
    `;
}

async function adminApproveRent(rentId, packageName, price) {
    const isMonthly = /tháng/i.test(packageName) || Number(price) >= 100000;
    const durationHours = isMonthly ? 720 : 1;
    await apiFetch('/api/admin/rent/approve', {
        method: 'POST',
        body: JSON.stringify({ rentId, durationHours })
    }, true);
    await renderAdminDashboard();
    showToast("Đã duyệt thuê gói.");
}

async function adminRejectRent(rentId) {
    await apiFetch('/api/admin/rent/reject', {
        method: 'POST',
        body: JSON.stringify({ rentId })
    }, true);
    await renderAdminDashboard();
    showToast("Đã từ chối yêu cầu.");
}

async function adminApproveDeposit(depositId) {
    await apiFetch('/api/admin/deposit/approve', {
        method: 'POST',
        body: JSON.stringify({ depositId })
    }, true);
    await renderAdminDashboard();
    showToast("Đã duyệt nạp tiền.");
}

async function adminRejectDeposit(depositId) {
    await apiFetch('/api/admin/deposit/reject', {
        method: 'POST',
        body: JSON.stringify({ depositId })
    }, true);
    await renderAdminDashboard();
    showToast("Đã từ chối nạp.");
}

async function adminAdjustBalance(userId, delta) {
    await apiFetch('/api/admin/user/balance', {
        method: 'POST',
        body: JSON.stringify({ userId, delta })
    }, true);
    await renderAdminDashboard();
}

async function adminResetUser(userId) {
    await apiFetch(`/api/admin/user/${userId}`, { method: 'DELETE' }, true);
    await renderAdminDashboard();
    showToast("Đã xóa user.");
}

async function adminToggleStock(name, checked) {
    const set = new Set(adminCache.stock || []);
    if (checked) set.add(name);
    else set.delete(name);
    const next = Array.from(set);
    await apiFetch('/api/admin/out_of_stock', {
        method: 'POST',
        body: JSON.stringify({ packages: next })
    }, true);
    await renderAdminDashboard();
    showToast("Đã cập nhật trạng thái hết máy.");
}

// CHECK BUY & QUEUE
async function checkBuy(price, name) {
    if (!currentUser) return openAuth();

    showDialog("Xác nhận", `Thuê gói ${name} với giá ${price.toLocaleString('vi-VN')}đ?`, 'confirm', async () => {
        try {
            const isMonthly = /tháng/i.test(name) || Number(price) >= 100000;
            const durationHours = isMonthly ? 720 : 1;
            const data = await apiFetch('/api/rent', {
                method: 'POST',
                body: JSON.stringify({ packageName: name, price, durationHours })
            });
            currentUser.balance = data?.balance ?? currentUser.balance;
            await loadUserData();
            updateUI();
            showToast(`Yêu cầu thuê ${name} đã gửi! Đang chờ admin duyệt...`);
            openQueueModal(name, price);
        } catch (err) {
            if (err.message === 'out_of_stock') {
                showDialog("Hết máy", "Hiện tại gói này đã hết máy. Vui lòng quay lại sau hoặc chọn gói khác.");
                return;
            }
            if (err.message === 'insufficient_balance') {
                showDialog("Số dư không đủ", "Vui lòng nạp thêm tiền.");
                return;
            }
            showDialog("Lỗi", "Không thể gửi yêu cầu thuê lúc này.");
        }
    });
}

function openQueueModal(packageName) {
    const modal = document.getElementById('queueModal');
    if (!modal) return;
    modal.style.display = 'flex';

    const fill = document.getElementById('progress-fill');
    const waitTime = 4000;
    document.getElementById('wait-time').innerText = `Đang gửi yêu cầu...`;

    let progress = 0;
    const interval = setInterval(() => {
        progress += 100 / (waitTime / 100);
        if (fill) fill.style.width = `${progress}%`;
        if (progress >= 100) {
            clearInterval(interval);
            if (modal) modal.style.display = 'none';
            document.getElementById('user-for-support').innerText = currentUser ? currentUser.name : 'tài khoản của bạn';
        }
    }, 100);
}

function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) modal.style.display = 'none';
}

function renderAdminPins() {
    const listEl = document.getElementById('admin-pins');
    if (!listEl) return;
    const list = adminCache.pins || [];
    if (list.length === 0) {
        listEl.innerHTML = '<div class="admin-meta">Chưa có PIN nào.</div>';
        return;
    }
    listEl.innerHTML = list.map(item => `
        <div class="admin-card">
            <div class="admin-row">
                <div><strong>${item.username}</strong> <span class="admin-meta">(${item.user_id})</span></div>
                <div class="admin-pin">${item.pin}</div>
            </div>
            <div class="admin-row">
                <div class="admin-meta">${new Date(item.created_at).toLocaleString('vi-VN')}</div>
                <button class="admin-btn red" onclick="adminDeletePin('${item.id}')">ĐÃ XỬ LÝ</button>
            </div>
        </div>
    `).join('');
}

async function adminDeletePin(pinId) {
    await apiFetch(`/api/admin/pins/${pinId}`, { method: 'DELETE' }, true);
    await renderAdminDashboard();
    showToast("Đã xóa PIN.");
}

// SEND CONNECT PIN
document.addEventListener('click', e => {
    if (e.target && e.target.id === 'send-connect-btn') {
        if (!currentUser) return showToast("Vui lòng đăng nhập trước.");
        const input = document.getElementById('connect-pin-input');
        const note = document.getElementById('connect-note');
        const raw = input?.value?.trim() || '';
        if (!raw) {
            if (note) note.textContent = "Chưa nhập mã.";
            return showToast("Bạn chưa nhập Connect PIN.");
        }
        if (!/^[0-9]{4,6}$/.test(raw)) {
            return showToast("Connect PIN chỉ gồm 4-6 chữ số.");
        }
        apiFetch('/api/user/pin', {
            method: 'POST',
            body: JSON.stringify({ pin: raw })
        }).then(() => {
            if (note) note.textContent = `Đã gửi mã: ${raw}`;
            showToast("Đã gửi Connect PIN cho admin.");
            if (input) input.value = '';
            renderAdminDashboard();
        }).catch(() => {
            showToast("Gửi Connect PIN thất bại.");
        });
    }
});

// DEPOSIT MODAL
function openDepositModal() {
    if (!currentUser) return openAuth();
    const modal = document.getElementById('depositModal');
    if (!modal) return;
    modal.style.display = 'flex';

    // Default to bank tab when opening
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const bankBtn = document.querySelector('.tab-btn[data-tab="bank"]');
    const bankTab = document.getElementById('tab-bank');
    if (bankBtn) bankBtn.classList.add('active');
    if (bankTab) bankTab.classList.add('active');

    loadUserData().then(renderDepositHistory).catch(() => renderDepositHistory());
}

function closeDepositModal() {
    const modal = document.getElementById('depositModal');
    if (modal) modal.style.display = 'none';
}

// ADMIN PAIR
function openAdminPairModal() {
    const modal = document.getElementById('adminPairModal');
    if (modal) modal.style.display = 'flex';
}

function closeAdminPairModal() {
    const modal = document.getElementById('adminPairModal');
    if (modal) modal.style.display = 'none';
}

document.addEventListener('click', e => {
    if (e.target.id === 'btn-admin-pair') {
        showToast("Chức năng pair sẽ cập nhật ở bản sau.");
    }
});

// NOTI
async function openNoti() {
    try {
        await loadUserData();
    } catch {}
    maybeShowPinGuide();
    markAllNotificationsRead();

    let content = userActivePackages?.length 
        ? `<div class="pkg-list">` + userActivePackages.map((p, idx) => {
            const expiresAt = p.expires_at ? new Date(p.expires_at).getTime() : 0;
            const diff = expiresAt ? (expiresAt - Date.now()) : 0;
            let remaining = '';
            if (!expiresAt) {
                remaining = 'Đang hoạt động';
            } else if (diff <= 0) {
                remaining = '<span class="pkg-expired">Đã hết hạn</span>';
            } else if (diff < 3600000) {
                remaining = `Còn ${Math.max(1, Math.ceil(diff / 60000))} phút`;
            } else {
                remaining = `Còn ${Math.floor(diff / 3600000)} giờ`;
            }
            const pairStatus = `<span class="pkg-warn">CHƯA PAIR • GỬI PIN CHO ADMIN</span>`;

            return `
                <div class="pkg-card">
                    <div class="pkg-header">
                        <div>
                            <div class="pkg-title">${p.package_name}</div>
                            <div class="pkg-meta">Thuê: ${new Date(p.created_at).toLocaleString('vi-VN')}</div>
                        </div>
                        <div class="pkg-remaining">${remaining}</div>
                    </div>
                    <div class="pkg-status">${pairStatus}</div>
                    <div class="pkg-actions">
                        <button class="pkg-btn pkg-connect" onclick="openSteamGuide()">KẾT NỐI MÁY</button>
                        <button class="pkg-btn pkg-delete" onclick="removePackage(${idx})">XÓA MÁY</button>
                    </div>
                </div>`;
        }).join('') + `</div>`
        : "<div class='noti-empty'>Chưa có gói nào.</div>";

    showDialog("GÓI ĐANG CHẠY & THÔNG BÁO", content);
    const dialogBox = document.querySelector('#custom-dialog .dialog-box');
    if (dialogBox) dialogBox.classList.add('compact-dialog');
}

// SAVE DATA
function saveData() {}

// CHECK EXPIRED
function checkExpiredPackages() {
    return;
}

// REMOVE PACKAGE (manual)
function removePackage(index) {
    if (!userActivePackages || index < 0 || index >= userActivePackages.length) return;
    const pkg = userActivePackages[index];
    showDialog("Thông báo", `Vui lòng liên hệ admin để xóa gói ${pkg.package_name}.`);
}

// HƯỚNG DẪN STEAM
function openSteamGuide() {
    const guide = `
        1. Cài ứng dụng Steam Link trên điện thoại/máy tính.<br>
        2. Admin duyệt thuê → gửi PIN pairing cho admin.<br>
        3. Admin pair máy → kết nối qua app Steam Link.<br>
        <small>Yêu cầu: Mạng ổn định, ping thấp.</small>
    `;
    showDialog("HƯỚNG DẪN KẾT NỐI", guide);
}

// NẠP TIỀN (demo)
document.getElementById('btn-submit-bank')?.addEventListener('click', function() {
    const btn = this;
    if (!currentUser) return openAuth();
    const raw = prompt('Nhập số tiền muốn nạp (VND):', '100000');
    const amt = parseInt((raw || '').replace(/[^\d]/g, ''), 10);
    if (!amt || amt < 10000) return showToast("Số tiền tối thiểu 10.000đ.");

    btn.classList.add('loading');
    btn.disabled = true;

    apiFetch('/api/deposit/create', {
        method: 'POST',
        body: JSON.stringify({ amount: amt })
    }).then(async (data) => {
        await loadUserData();
        renderDepositHistory();
        showToast("Đã tạo yêu cầu nạp. Vui lòng chuyển khoản đúng nội dung.");
    }).catch(() => {
        showToast("Không tạo được yêu cầu nạp.");
    }).finally(() => {
        btn.classList.remove('loading');
        btn.disabled = false;
    });
});

document.getElementById('btn-submit-card')?.addEventListener('click', function() {
    showToast("Nạp thẻ cào đang bảo trì. Vui lòng nạp ngân hàng.");
});

function renderDepositHistory() {
    const container = document.getElementById('history-list');
    if (!container) return;
    if (!currentUser) {
        container.innerHTML = '<p style="padding:40px; text-align:center; color:#666;">Vui lòng đăng nhập để xem lịch sử nạp.</p>';
        return;
    }
    if (!userDeposits || userDeposits.length === 0) {
        container.innerHTML = '<p style="padding:40px; text-align:center; color:#666;">Chưa có lịch sử nạp tiền.</p>';
        return;
    }
    let html = '';
    userDeposits.forEach(item => {
        const statusLabel = item.status === 'pending' ? 'Chờ duyệt' : item.status === 'approved' ? 'Đã duyệt' : 'Từ chối';
        const color = item.status === 'pending' ? '#ff9800' : item.status === 'approved' ? '#4caf50' : '#f44336';
        html += `
            <div style="padding:20px 0; border-bottom:1px solid #222;">
                <strong>Ngân hàng</strong><br>
                Số tiền: ${Number(item.amount).toLocaleString('vi-VN')}đ<br>
                Ngày: ${new Date(item.created_at).toLocaleString('vi-VN')}<br>
                Trạng thái: <span style="color:${color};">${statusLabel}</span>
            </div>`;
    });
    container.innerHTML = html;
}

// TABS NẠP TIỀN
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
});

// ADMIN TABS
document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        const target = document.getElementById('admin-' + btn.dataset.adminTab);
        if (target) target.classList.add('active');
    });
});

// COPY BUTTONS
document.addEventListener('click', e => {
    if (e.target.id === 'copy-ck-btn') {
        const content = document.getElementById('ck-content')?.textContent;
        if (content) navigator.clipboard.writeText(content).then(() => showToast("Đã copy nội dung chuyển khoản!"));
    }
});

// INIT
window.onload = () => {
    if (authToken) {
        loadUserData().then(() => {
            updateUI();
            renderDepositHistory();
        }).catch(() => {
            logout();
        });
    }

    // Enable admin view via ?admin=1 or ?admin=0
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === '1') localStorage.setItem('admin_mode', '1');
    if (params.get('admin') === '0') localStorage.removeItem('admin_mode');
    renderAdminDashboard();
};

document.getElementById('admin-clear-pins')?.addEventListener('click', () => {
    apiFetch('/api/admin/pins/clear', { method: 'POST' }, true)
        .then(() => renderAdminDashboard())
        .then(() => showToast("Đã xóa danh sách PIN."))
        .catch(() => showToast("Không thể xóa PIN."));
});

document.getElementById('admin-refresh')?.addEventListener('click', () => {
    renderAdminDashboard();
    showToast("Đã làm mới.");
});
