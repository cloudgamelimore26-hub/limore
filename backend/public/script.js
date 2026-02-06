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
let currentUser = JSON.parse(localStorage.getItem('session_user')) || null;
// OUT OF STOCK CONFIG (add package names here to block renting)
const outOfStockPackages = new Set(JSON.parse(localStorage.getItem('out_of_stock') || '[]'));
// removed status/realtime panels

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

function handleLogin() {
    const u = document.getElementById('l-user')?.value.trim();
    const p = document.getElementById('l-pass')?.value.trim();
    if (!u || !p) return showDialog("Lỗi", "Vui lòng điền đầy đủ.");

    const users = JSON.parse(localStorage.getItem('db_users')) || {};
    if (users[u] && users[u].password === p) {
        currentUser = { name: u, ...users[u] };
        localStorage.setItem('session_user', JSON.stringify(currentUser));
        closeAuth();
        updateUI();
        showToast("Đăng nhập thành công!");
    } else {
        showDialog("Lỗi", "Tài khoản hoặc mật khẩu sai.");
    }
}

function handleRegister() {
    const u = document.getElementById('r-user')?.value.trim();
    const p = document.getElementById('r-pass')?.value.trim();
    if (!u || u.length < 3) return showDialog("Lỗi", "Tên tài khoản phải từ 3 ký tự.");
    if (!p) return showDialog("Lỗi", "Mật khẩu không được để trống.");

    let users = JSON.parse(localStorage.getItem('db_users')) || {};
    if (users[u]) return showDialog("Lỗi", "Tài khoản đã tồn tại.");

    const newUser = { password: p, balance: 0, id: "ID-" + Math.floor(Math.random()*99999), activePackages: [], pendingRequests: [], depositHistory: [] };
    users[u] = newUser;
    localStorage.setItem('db_users', JSON.stringify(users));
    currentUser = { name: u, ...newUser };
    localStorage.setItem('session_user', JSON.stringify(currentUser));
    closeAuth();
    updateUI();
    showToast("Đăng ký thành công!");
}

function logout() {
    localStorage.removeItem('session_user');
    location.reload();
}

// UPDATE UI
function updateUI() {
    if (!currentUser) return;

    checkExpiredPackages();

    const mainLogin = document.getElementById('main-login-btn');
    const userInfo = document.getElementById('user-info-display');
    const welcome = document.getElementById('welcome-text');

    if (mainLogin) mainLogin.style.display = 'none';
    if (userInfo) userInfo.style.display = 'flex';
    if (welcome) welcome.style.display = 'none';

    document.getElementById('name-val').innerText = currentUser.name;
    document.getElementById('id-val').innerText = currentUser.id;
    document.getElementById('balance-val').innerText = currentUser.balance.toLocaleString('vi-VN') + "đ";
    refreshNotiBadge();

    updateCKContent();
    renderRealtime();
    renderAdminDashboard();
}

function updateCKContent() {
    const ck = document.getElementById('ck-content');
    if (ck && currentUser) ck.textContent = `NAP ${currentUser.id}`;
}

// REALTIME NOTIFICATIONS
function ensureNotifications() {
    if (!currentUser) return;
    if (!currentUser.notifications) currentUser.notifications = [];
}

function addNotification(message, type = 'info') {
    if (!currentUser) return;
    ensureNotifications();
    currentUser.notifications.unshift({
        id: Date.now() + Math.random(),
        message,
        type,
        time: new Date().toLocaleString('vi-VN'),
        read: false
    });
    saveData();
    renderRealtime();
    refreshNotiBadge();
}

function refreshNotiBadge() {
    const badge = document.getElementById('noti-count');
    if (!badge) return;
    const count = currentUser?.notifications?.filter(n => !n.read).length || 0;
    badge.innerText = count;
}

function markAllNotificationsRead() {
    if (!currentUser?.notifications) return;
    currentUser.notifications = currentUser.notifications.map(n => ({ ...n, read: true }));
    saveData();
    refreshNotiBadge();
}

function renderRealtime() {
    // no UI now, keep data logic for badge/notifications
    return;
}

// ADMIN DASHBOARD
function isAdminMode() {
    return localStorage.getItem('admin_mode') === '1';
}

function getUsersMap() {
    return JSON.parse(localStorage.getItem('db_users') || '{}');
}

function saveUsersMap(users) {
    localStorage.setItem('db_users', JSON.stringify(users));
}

function getOutOfStockList() {
    return JSON.parse(localStorage.getItem('out_of_stock') || '[]');
}

function saveOutOfStockList(list) {
    localStorage.setItem('out_of_stock', JSON.stringify(list));
}

function renderAdminDashboard() {
    const panel = document.getElementById('admin-panel');
    if (!panel) return;
    if (!isAdminMode()) {
        panel.style.display = 'none';
        return;
    }
    panel.style.display = 'block';
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
    const users = getUsersMap();
    const items = Object.keys(users).map(name => ({ name, ...users[name] }));
    if (items.length === 0) {
        el.innerHTML = '<div class="admin-meta">Chưa có người dùng.</div>';
        return;
    }
    el.innerHTML = `<div class="admin-grid">` + items.map(u => `
        <div class="admin-card">
            <div class="admin-row">
                <div><strong>${u.name}</strong> <span class="admin-meta">(${u.id || 'N/A'})</span></div>
                <div class="admin-meta">Số dư: ${Number(u.balance || 0).toLocaleString('vi-VN')}đ</div>
            </div>
            <div class="admin-row">
                <button class="admin-btn blue" onclick="adminAdjustBalance('${u.name}', 50000)">+50k</button>
                <button class="admin-btn blue" onclick="adminAdjustBalance('${u.name}', -50000)">-50k</button>
                <button class="admin-btn red" onclick="adminResetUser('${u.name}')">XÓA USER</button>
            </div>
        </div>
    `).join('') + `</div>`;
}

function renderAdminRents() {
    const el = document.getElementById('admin-rents');
    if (!el) return;
    const users = getUsersMap();
    const reqs = [];
    Object.keys(users).forEach(name => {
        (users[name].pendingRequests || []).forEach((r, idx) => {
            reqs.push({ user: name, idx, ...r });
        });
    });
    if (reqs.length === 0) {
        el.innerHTML = '<div class="admin-meta">Không có yêu cầu thuê.</div>';
        return;
    }
    el.innerHTML = `<div class="admin-grid">` + reqs.map(r => `
        <div class="admin-card">
            <div class="admin-row">
                <div><strong>${r.packageName}</strong> <span class="admin-meta">(${r.user})</span></div>
                <div class="admin-meta">${r.date}</div>
            </div>
            <div class="admin-row">
                <div class="admin-meta">${r.price.toLocaleString('vi-VN')}đ</div>
                <div>
                    <button class="admin-btn green" onclick="adminApproveRent('${r.user}', ${r.idx})">DUYỆT</button>
                    <button class="admin-btn red" onclick="adminRejectRent('${r.user}', ${r.idx})">TỪ CHỐI</button>
                </div>
            </div>
        </div>
    `).join('') + `</div>`;
}

function renderAdminDeposits() {
    const el = document.getElementById('admin-deposits');
    if (!el) return;
    const users = getUsersMap();
    const deps = [];
    Object.keys(users).forEach(name => {
        (users[name].depositHistory || []).forEach((d, idx) => {
            deps.push({ user: name, idx, ...d });
        });
    });
    const pending = deps.filter(d => (d.status || '').includes('Chờ'));
    if (pending.length === 0) {
        el.innerHTML = '<div class="admin-meta">Không có nạp tiền chờ duyệt.</div>';
        return;
    }
    el.innerHTML = `<div class="admin-grid">` + pending.map(d => `
        <div class="admin-card">
            <div class="admin-row">
                <div><strong>${d.user}</strong> <span class="admin-meta">${d.type === 'bank' ? 'Ngân hàng' : 'Thẻ cào'}</span></div>
                <div class="admin-meta">${d.date}</div>
            </div>
            <div class="admin-row">
                <div class="admin-meta">${d.amount.toLocaleString('vi-VN')}đ</div>
                <div>
                    <button class="admin-btn green" onclick="adminApproveDeposit('${d.user}', ${d.idx})">DUYỆT</button>
                    <button class="admin-btn red" onclick="adminRejectDeposit('${d.user}', ${d.idx})">TỪ CHỐI</button>
                </div>
            </div>
        </div>
    `).join('') + `</div>`;
}

function renderAdminStock() {
    const el = document.getElementById('admin-stock');
    if (!el) return;
    const list = getOutOfStockList();
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
    const users = getUsersMap();
    const userList = Object.keys(users).map(k => users[k]);
    const totalUsers = userList.length;
    const totalBalance = userList.reduce((s, u) => s + (u.balance || 0), 0);
    let totalDeposits = 0;
    let totalRents = 0;
    userList.forEach(u => {
        (u.depositHistory || []).forEach(d => {
            if ((d.status || '').includes('Đã duyệt')) totalDeposits += d.amount + (d.bonus || 0);
        });
        (u.pendingRequests || []).forEach(r => {
            if ((r.status || '') === 'approved') totalRents += r.price;
        });
    });
    el.innerHTML = `
        <div class="admin-grid">
            <div class="admin-card admin-stat"><div class="admin-meta">Tổng người dùng</div><strong>${totalUsers}</strong></div>
            <div class="admin-card admin-stat"><div class="admin-meta">Tổng số dư</div><strong>${totalBalance.toLocaleString('vi-VN')}đ</strong></div>
            <div class="admin-card admin-stat"><div class="admin-meta">Nạp đã duyệt</div><strong>${totalDeposits.toLocaleString('vi-VN')}đ</strong></div>
            <div class="admin-card admin-stat"><div class="admin-meta">Doanh thu thuê</div><strong>${totalRents.toLocaleString('vi-VN')}đ</strong></div>
        </div>
    `;
}

function adminApproveRent(username, idx) {
    const users = getUsersMap();
    const user = users[username];
    if (!user || !user.pendingRequests || !user.pendingRequests[idx]) return;
    const req = user.pendingRequests[idx];
    const isMonthly = /tháng/i.test(req.packageName) || req.price >= 100000;
    const durationMs = isMonthly ? 30 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    user.activePackages = user.activePackages || [];
    user.activePackages.push({
        name: req.packageName,
        price: req.price,
        date: new Date().toLocaleString('vi-VN'),
        expiresAt: Date.now() + durationMs,
        paired: false,
        connectPin: "Chưa có"
    });
    req.status = 'approved';
    user.pendingRequests.splice(idx, 1);
    users[username] = user;
    saveUsersMap(users);
    renderAdminDashboard();
    showToast("Đã duyệt thuê gói.");
}

function adminRejectRent(username, idx) {
    const users = getUsersMap();
    const user = users[username];
    if (!user || !user.pendingRequests || !user.pendingRequests[idx]) return;
    user.pendingRequests.splice(idx, 1);
    users[username] = user;
    saveUsersMap(users);
    renderAdminDashboard();
    showToast("Đã từ chối yêu cầu.");
}

function adminApproveDeposit(username, idx) {
    const users = getUsersMap();
    const user = users[username];
    if (!user || !user.depositHistory || !user.depositHistory[idx]) return;
    const d = user.depositHistory[idx];
    if ((d.status || '').includes('Đã duyệt')) return;
    d.status = 'Đã duyệt';
    const amount = d.amount + (d.bonus || 0);
    user.balance = (user.balance || 0) + amount;
    users[username] = user;
    saveUsersMap(users);
    renderAdminDashboard();
    showToast("Đã duyệt nạp tiền.");
}

function adminRejectDeposit(username, idx) {
    const users = getUsersMap();
    const user = users[username];
    if (!user || !user.depositHistory || !user.depositHistory[idx]) return;
    user.depositHistory[idx].status = 'Từ chối';
    users[username] = user;
    saveUsersMap(users);
    renderAdminDashboard();
    showToast("Đã từ chối nạp.");
}

function adminAdjustBalance(username, delta) {
    const users = getUsersMap();
    const user = users[username];
    if (!user) return;
    user.balance = (user.balance || 0) + delta;
    users[username] = user;
    saveUsersMap(users);
    if (currentUser?.name === username) {
        currentUser.balance = user.balance;
        saveData();
        updateUI();
    }
    renderAdminDashboard();
}

function adminResetUser(username) {
    const users = getUsersMap();
    if (!users[username]) return;
    delete users[username];
    saveUsersMap(users);
    if (currentUser?.name === username) {
        localStorage.removeItem('session_user');
        currentUser = null;
        location.reload();
        return;
    }
    renderAdminDashboard();
    showToast("Đã xóa user.");
}

function adminToggleStock(name, checked) {
    const list = getOutOfStockList();
    const set = new Set(list);
    if (checked) set.add(name);
    else set.delete(name);
    const next = Array.from(set);
    saveOutOfStockList(next);
    outOfStockPackages.clear();
    next.forEach(n => outOfStockPackages.add(n));
    renderAdminDashboard();
    showToast("Đã cập nhật trạng thái hết máy.");
}

// CHECK BUY & QUEUE
function checkBuy(price, name) {
    if (!currentUser) return openAuth();

    // Out of stock handling
    if (outOfStockPackages.has(name)) {
        showDialog("Hết máy", "Hiện tại gói này đã hết máy. Vui lòng quay lại sau hoặc chọn gói khác.");
        return;
    }

    if (currentUser.balance < price) {
        showDialog("Số dư không đủ", `Bạn cần thêm ${ (price - currentUser.balance).toLocaleString('vi-VN') }đ.`);
        return;
    }

    showDialog("Xác nhận", `Thuê gói ${name} với giá ${price.toLocaleString('vi-VN')}đ?`, 'confirm', () => {
        currentUser.balance -= price;

        if (!currentUser.pendingRequests) currentUser.pendingRequests = [];
        currentUser.pendingRequests.push({
            packageName: name,
            price,
            date: new Date().toLocaleString('vi-VN'),
            status: 'pending'
        });

        saveData();
        updateUI();
        showToast(`Yêu cầu thuê ${name} đã gửi! Đang chờ admin duyệt...`);
        addNotification(`Đã gửi yêu cầu thuê ${name}.`, 'info');
        openQueueModal(name, price);
    });
}

function openQueueModal(packageName, price) {
    const modal = document.getElementById('queueModal');
    if (!modal) return;
    modal.style.display = 'flex';

    const fill = document.getElementById('progress-fill');
    const waitTime = Math.floor(Math.random() * 10000) + 5000;
    document.getElementById('wait-time').innerText = `${Math.round(waitTime / 60000)}-${Math.round(waitTime / 60000 + 5)} phút`;

    let progress = 0;
    const interval = setInterval(() => {
        progress += 100 / (waitTime / 100);
        if (fill) fill.style.width = `${progress}%`;
        if (progress >= 100) {
            clearInterval(interval);
            if (modal) modal.style.display = 'none';
            document.getElementById('user-for-support').innerText = currentUser ? currentUser.name : 'tài khoản của bạn';
            if (currentUser) {
                currentUser.activePackages = currentUser.activePackages || [];
                const isMonthly = /tháng/i.test(packageName) || price >= 100000;
                const durationMs = isMonthly ? 30 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
                currentUser.activePackages.push({
                    name: packageName,
                    price,
                    date: new Date().toLocaleString('vi-VN'),
                    expiresAt: Date.now() + durationMs,
                    paired: false,
                    connectPin: "Chưa có"
                });

                if (currentUser.pendingRequests && currentUser.pendingRequests.length) {
                    currentUser.pendingRequests[currentUser.pendingRequests.length - 1].status = 'approved';
                }

                saveData();
                updateUI();
                addNotification(`Gói ${packageName} đã được duyệt và kích hoạt.`, 'success');
            }
            const successModal = document.getElementById('successModal');
            if (successModal) successModal.style.display = 'flex';
            const note = document.getElementById('connect-note');
            if (note) {
                note.textContent = currentUser?.lastConnectPin
                    ? `Mã gần nhất: ${currentUser.lastConnectPin}`
                    : "Chưa nhập mã.";
            }
            const input = document.getElementById('connect-pin-input');
            if (input) input.value = '';
            showToast("Admin đã duyệt! Gửi PIN pairing cho admin nhé.");
        }
    }, 100);
}

function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) modal.style.display = 'none';
}

// ADMIN PIN STORAGE
function getAdminPins() {
    return JSON.parse(localStorage.getItem('admin_pins') || '[]');
}

function saveAdminPins(list) {
    localStorage.setItem('admin_pins', JSON.stringify(list));
}

function addAdminPin(payload) {
    const list = getAdminPins();
    list.unshift(payload);
    saveAdminPins(list);
    renderAdminPins();
}

function renderAdminPins() {
    const listEl = document.getElementById('admin-pins');
    if (!listEl) return;
    const list = getAdminPins();
    if (list.length === 0) {
        listEl.innerHTML = '<div class="admin-meta">Chưa có PIN nào.</div>';
        return;
    }
    listEl.innerHTML = list.map(item => `
        <div class="admin-card">
            <div class="admin-row">
                <div><strong>${item.username}</strong> <span class="admin-meta">(${item.userId})</span></div>
                <div class="admin-pin">${item.pin}</div>
            </div>
            <div class="admin-meta">${item.time}</div>
        </div>
    `).join('');
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

        currentUser.lastConnectPin = raw;
        saveData();
        addAdminPin({
            username: currentUser.name,
            userId: currentUser.id,
            pin: raw,
            time: new Date().toLocaleString('vi-VN')
        });
        if (note) note.textContent = `Đã lưu mã: ${raw} (hãy gửi cho admin).`;
        showToast("Đã lưu Connect PIN. Hãy gửi cho admin.");
        if (input) input.value = '';
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

    renderDepositHistory();
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
        const btn = e.target;
        const username = document.getElementById('pair-username')?.value.trim();
        const pairingPin = document.getElementById('pair-pin')?.value.trim();
        const connectPin = document.getElementById('pair-connect-pin')?.value.trim();

        if (!username || pairingPin.length !== 4 || isNaN(pairingPin)) {
            showToast("Nhập tên khách và PIN 4 số hợp lệ!");
            return;
        }

        btn.querySelector('span').style.display = 'none';
        const spinner = btn.querySelector('.fa-spinner');
        if (spinner) spinner.style.display = 'inline-block';
        btn.disabled = true;

        setTimeout(() => {
            let users = JSON.parse(localStorage.getItem('db_users')) || {};
            if (!users[username]) {
                showToast("Không tìm thấy khách!");
                resetBtn();
                return;
            }

            let user = users[username];
            if (!user.activePackages || user.activePackages.length === 0) {
                showToast("Khách chưa có gói active!");
                resetBtn();
                return;
            }

            let pkg = user.activePackages[user.activePackages.length - 1];
            pkg.paired = true;
            pkg.pairingPinUsed = pairingPin;
            pkg.connectPin = connectPin || "Không cần";
            pkg.pairDate = new Date().toLocaleString('vi-VN');

            users[username] = user;
            localStorage.setItem('db_users', JSON.stringify(users));

            if (currentUser && currentUser.name === username) {
                currentUser = { ...user };
                saveData();
                updateUI();
            }

            showToast(`Pair thành công cho ${username}!`);
            showDialog("THÀNH CÔNG", `Đã pair máy cho ${username}. Connect PIN: ${pkg.connectPin}`);
            closeAdminPairModal();
            resetBtn();
        }, 1200);

        function resetBtn() {
            btn.querySelector('span').style.display = 'inline';
            const spinner = btn.querySelector('.fa-spinner');
            if (spinner) spinner.style.display = 'none';
            btn.disabled = false;
        }
    }
});

// NOTI
function openNoti() {
    checkExpiredPackages();
    markAllNotificationsRead();

    let content = currentUser?.activePackages?.length 
        ? `<div class="pkg-list">` + currentUser.activePackages.map((p, idx) => {
            const diff = p.expiresAt - Date.now();
            let remaining = '';
            if (diff <= 0) {
                remaining = '<span class="pkg-expired">Đã hết hạn</span>';
            } else if (diff < 3600000) {
                remaining = `Còn ${Math.max(1, Math.ceil(diff / 60000))} phút`;
            } else {
                remaining = `Còn ${Math.floor(diff / 3600000)} giờ`;
            }
            const pairStatus = p.paired
                ? `<span class="pkg-paired">ĐÃ PAIR • Connect PIN: ${p.connectPin}</span>`
                : `<span class="pkg-warn">CHƯA PAIR • GỬI PIN CHO ADMIN</span>`;

            return `
                <div class="pkg-card">
                    <div class="pkg-header">
                        <div>
                            <div class="pkg-title">${p.name}</div>
                            <div class="pkg-meta">Thuê: ${p.date}</div>
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
function saveData() {
    if (!currentUser) return;
    const users = JSON.parse(localStorage.getItem('db_users')) || {};
    users[currentUser.name] = { ...currentUser, name: undefined };
    localStorage.setItem('db_users', JSON.stringify(users));
    localStorage.setItem('session_user', JSON.stringify(currentUser));
}

// CHECK EXPIRED
function checkExpiredPackages() {
    if (!currentUser?.activePackages) return;

    const now = Date.now();
    let hasExpired = false;

    currentUser.activePackages = currentUser.activePackages.filter(pkg => {
        if (pkg.expiresAt && now >= pkg.expiresAt) {
            hasExpired = true;
            showToast(`Gói ${pkg.name} đã hết hạn và bị xóa!`);
            addNotification(`Gói ${pkg.name} đã hết hạn.`, 'warn');
            return false;
        }
        return true;
    });

    if (hasExpired) {
        saveData();
        updateUI();
    }
}

// REMOVE PACKAGE (manual)
function removePackage(index) {
    if (!currentUser?.activePackages || index < 0 || index >= currentUser.activePackages.length) return;
    const pkg = currentUser.activePackages[index];
    showDialog("Xác nhận", `Bạn muốn xóa gói ${pkg.name}?`, 'confirm', () => {
        currentUser.activePackages.splice(index, 1);
        saveData();
        updateUI();
        showToast(`Đã xóa gói ${pkg.name}.`);
        openNoti();
    });
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
    const amt = 100000;

    btn.classList.add('loading');
    btn.disabled = true;

    setTimeout(() => {
        currentUser.depositHistory = currentUser.depositHistory || [];
        currentUser.depositHistory.push({
            type: 'bank',
            amount: amt,
            date: new Date().toLocaleString('vi-VN'),
            status: 'Chờ duyệt'
        });
        saveData();
        renderDepositHistory();
        showToast("Yêu cầu nạp đã gửi!");
        addNotification("Yêu cầu nạp ngân hàng đã gửi.", 'info');
        btn.classList.remove('loading');
        btn.disabled = false;
    }, 1200);
});

document.getElementById('btn-submit-card')?.addEventListener('click', function() {
    const btn = this;
    const prov = document.getElementById('card-provider')?.value;
    const code = document.getElementById('card-code')?.value.trim();
    const serial = document.getElementById('card-serial')?.value.trim();
    if (!prov || !code || !serial) return showToast("Điền đầy đủ thông tin");

    btn.classList.add('loading');
    btn.disabled = true;

    setTimeout(() => {
        const amount = 100000;
        const bonus = 5000;
        currentUser.depositHistory = currentUser.depositHistory || [];
        currentUser.depositHistory.push({
            type: 'card',
            provider: prov,
            amount,
            bonus,
            date: new Date().toLocaleString('vi-VN'),
            status: 'Đã duyệt (demo)'
        });
        currentUser.balance += amount + bonus;
        saveData();
        updateUI();
        renderDepositHistory();
        showToast(`Nạp thành công +${(amount + bonus).toLocaleString('vi-VN')}đ (demo)!`);
        addNotification(`Nạp thẻ thành công +${(amount + bonus).toLocaleString('vi-VN')}đ (demo).`, 'success');
        document.getElementById('card-provider').value = '';
        document.getElementById('card-code').value = '';
        document.getElementById('card-serial').value = '';
        btn.classList.remove('loading');
        btn.disabled = false;
    }, 1200);
});

function renderDepositHistory() {
    const container = document.getElementById('history-list');
    if (!container) return;
    if (!currentUser) {
        container.innerHTML = '<p style="padding:40px; text-align:center; color:#666;">Vui lòng đăng nhập để xem lịch sử nạp.</p>';
        return;
    }
    if (!currentUser.depositHistory || currentUser.depositHistory.length === 0) {
        container.innerHTML = '<p style="padding:40px; text-align:center; color:#666;">Chưa có lịch sử nạp tiền.</p>';
        return;
    }
    let html = '';
    currentUser.depositHistory.forEach(item => {
        const color = item.status.includes('Chờ') ? '#ff9800' : '#4caf50';
        html += `
            <div style="padding:20px 0; border-bottom:1px solid #222;">
                <strong>${item.type === 'bank' ? 'Ngân hàng' : 'Thẻ cào ' + item.provider}</strong><br>
                Số tiền: ${item.amount.toLocaleString('vi-VN')}đ
                ${item.bonus ? ` + ${item.bonus.toLocaleString('vi-VN')}đ bonus` : ''}<br>
                Ngày: ${item.date}<br>
                Trạng thái: <span style="color:${color};">${item.status}</span>
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
    if (currentUser) updateUI();
    renderDepositHistory(); // nếu mở deposit modal
    renderAdminDashboard();

    // Enable admin view via ?admin=1 or ?admin=0
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === '1') localStorage.setItem('admin_mode', '1');
    if (params.get('admin') === '0') localStorage.removeItem('admin_mode');
    renderAdminDashboard();

    // Auto cleanup expired packages (runs even if user doesn't open notifications)
    setInterval(() => {
        if (currentUser) checkExpiredPackages();
    }, 60000);

    // Realtime sync from storage (multi-tab)
    setInterval(() => {
        const session = JSON.parse(localStorage.getItem('session_user'));
        if (session && currentUser && session.name === currentUser.name) {
            currentUser = session;
            renderRealtime();
            refreshNotiBadge();
            renderAdminDashboard();
        }
    }, 5000);

};

document.getElementById('admin-clear-pins')?.addEventListener('click', () => {
    saveAdminPins([]);
    renderAdminDashboard();
    showToast("Đã xóa danh sách PIN.");
});

document.getElementById('admin-refresh')?.addEventListener('click', () => {
    renderAdminDashboard();
    showToast("Đã làm mới.");
});
