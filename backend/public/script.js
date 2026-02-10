document.addEventListener('DOMContentLoaded', () => {
    // 0. Admin view via ?admin=1
    const params = new URLSearchParams(window.location.search);
    const isAdmin = params.get('admin') === '1';
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? 'flex' : 'none';
    });
    const adminSection = document.getElementById('admin');
    if (adminSection) adminSection.style.display = isAdmin ? 'block' : 'none';
    if (isAdmin) { initAdmin(); }
    // 1. Kiá»ƒm tra LocalStorage Ä‘á»ƒ giá»¯ Ä‘Äƒng nháº­p khi reset trang
    const savedData = localStorage.getItem('luxe_user');
    if (savedData) applyUserUI(JSON.parse(savedData));

    // 2. Chuyá»ƒn Ä‘á»•i Tab
    const tabs = document.querySelectorAll('.nav-item');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.getAttribute('data-tab')).classList.add('active');
        });
    });

    // 3. Logic Accordion (Náº¡p tiá»n)
    document.querySelectorAll('.acc-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('active');
        });
    });

    // 4. Modal ÄÄƒng nháº­p
    const modal = document.getElementById('authModal');
    const openBtn = document.getElementById('openAuth');
    const closeBtn = document.querySelector('.close-modal');

    openBtn.onclick = () => modal.style.display = "block";
    closeBtn.onclick = () => modal.style.display = "none";

    document.getElementById('loginForm').onsubmit = (e) => {
        e.preventDefault();
        const username = document.getElementById('nameInput').value;
        const userData = {
            name: username.toUpperCase(),
            memo: "NAP LUXE " + username.toUpperCase(),
            isLoggedIn: true
        };
        localStorage.setItem('luxe_user', JSON.stringify(userData));
        applyUserUI(userData);
        modal.style.display = "none";
    };

    // 5. ÄÄƒng xuáº¥t & ÄÄƒng nháº­p láº¡i
    document.getElementById('btnLogout').onclick = () => {
        if(confirm("XÃ¡c nháº­n Ä‘Äƒng xuáº¥t khá»i há»‡ thá»‘ng?")) {
            localStorage.removeItem('luxe_user');
            window.location.reload(); // Táº£i láº¡i trang Ä‘á»ƒ reset toÃ n bá»™
        }
    };

    // 6. Rent click + balance check
    const toastEl = document.getElementById('toast');
    function showToast(msg) {
        if (!toastEl) return;
        toastEl.innerText = msg;
        toastEl.classList.add('show');
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => toastEl.classList.remove('show'), 2200);
    }

    function getBalanceValue() {
        const raw = document.getElementById('balance-val')?.innerText || '0';
        const digits = raw.replace(/[^0-9]/g, '');
        return digits ? parseInt(digits, 10) : 0;
    }

    const rentModal = document.getElementById('rentModal');
    const closeRent = document.getElementById('closeRent');
    if (closeRent && rentModal) closeRent.onclick = () => rentModal.style.display = "none";
    if (rentModal) {
        rentModal.addEventListener('click', (e) => {
            if (e.target === rentModal) rentModal.style.display = "none";
        });
    }

    function openRentModal() {
        if (rentModal) rentModal.style.display = "block";
    }

    function addRentHistory(plan, price) {
        const list = document.getElementById('rentHistory');
        if (!list) return;
        const empty = list.querySelector('.rent-empty');
        if (empty) empty.remove();
        const item = document.createElement('div');
        item.className = 'rent-item';
        const time = new Date().toLocaleString('vi-VN');
        item.innerHTML = `<div><div class="rent-info">${plan} • ${price.toLocaleString('vi-VN')}&#273;</div><div class="rent-meta">K&#7871;t n&#7889;i • ${time}</div></div><div class="rent-actions"><button class="btn-connect">K&#7870;T N&#7888;I</button><button class="btn-remove">X&#211;A M&#193;Y</button></div>`;
        list.prepend(item);
    }

    const rentHistoryEl = document.getElementById('rentHistory');
    if (rentHistoryEl) {
        rentHistoryEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-remove')) {
                const item = e.target.closest('.rent-item');
                if (item) item.remove();
                if (!rentHistoryEl.querySelector('.rent-item')) {
                    rentHistoryEl.innerHTML = '<div class="rent-empty">Ch&#432;a c&#243; l&#432;&#7907;t thu&#234;.</div>';
                }
            }
        });
    }

    document.querySelectorAll('.price-card .btn-rent, .price-card .btn-rent-ghost').forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.price-card');
            const price = parseInt(card?.dataset?.price || '0', 10);
            const plan = card?.querySelector('h3')?.innerText || 'PLAN';
            const balance = getBalanceValue();
            if (balance < price) {
                showToast('\u004B\u0068\u00F4\u006E\u0067 \u0111\u1EE7 \u0073\u1ED1 \u0064\u01B0');
                return;
            }
            showToast('\u0054\u0068\u0075\u00EA \u0074\u0068\u00E0\u006E\u0068 \u0063\u00F4\u006E\u0067');
            openRentModal();
            addRentHistory(plan, price);
            const username = document.getElementById('display-name')?.innerText || 'GUEST';
            fetch('/api/rent', { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, plan, price }) }).catch(() => {});
        });
    });
    function applyUserUI(data) {
        document.getElementById('display-name').innerText = data.name;
        document.getElementById('deposit-memo').innerText = data.memo;
        document.getElementById('userIcon').innerHTML = `<i class="fas fa-check-circle" style="color:white"></i>`;
        document.getElementById('btnLogout').style.display = "block";
        document.getElementById('openAuth').style.display = "none";
        document.getElementById('refText').innerText = "LX-" + data.name.substring(0,3);
    }
});

function copyCode() {
    const code = document.getElementById('refText').innerText;
    if(code !== "---") {
        navigator.clipboard.writeText(code);
        alert("ÄÃ£ sao chÃ©p mÃ£ thÃ nh cÃ´ng!");
    }
}



// === ADMIN (server) ===
let adminToken = localStorage.getItem('admin_token') || null;
let adminData = { users: [], rents: [], deposits: [], pins: [], stats: null };

async function adminFetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'admin_error');
    return data;
}

async function initAdmin() {
    const btnRefresh = document.getElementById('admin-refresh');
    if (btnRefresh) btnRefresh.onclick = () => loadAdminData();
    const search = document.getElementById('admin-search');
    if (search) search.oninput = () => renderAdminAll();

    if (!adminToken) {
        const pass = prompt('Nh?p m?t kh?u admin:');
        if (!pass) return;
        try {
            const data = await adminFetch('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: pass }) });
            adminToken = data.token;
            localStorage.setItem('admin_token', adminToken);
        } catch (e) {
            alert('M?t kh?u admin không dúng.');
            return;
        }
    }
    loadAdminData();
}

async function loadAdminData() {
    try {
        const [users, rents, deposits, pins, stats] = await Promise.all([
            adminFetch('/api/admin/users'),
            adminFetch('/api/admin/rents'),
            adminFetch('/api/admin/deposits'),
            adminFetch('/api/admin/pins'),
            adminFetch('/api/admin/stats')
        ]);
        adminData = { users, rents, deposits, pins, stats };
        renderAdminAll();
    } catch (e) {
        if (e.message === 'unauthorized') {
            adminToken = null;
            localStorage.removeItem('admin_token');
            initAdmin();
            return;
        }
        alert('Không t?i du?c d? li?u admin.');
    }
}

function adminFilter(list, text, fields) {
    if (!text) return list;
    const t = text.toLowerCase();
    return list.filter(item => fields.some(f => String(item[f] || '').toLowerCase().includes(t)));
}

function renderAdminAll() {
    renderAdminStats();
    renderAdminRents();
    renderAdminDeposits();
    renderAdminUsers();
    renderAdminPins();
}

function renderAdminStats() {
    const el = document.getElementById('admin-stats');
    if (!el) return;
    const s = adminData.stats || { users: 0, balance: 0, deposits: 0, rents: 0 };
    el.innerHTML = `
        <div class="admin-stat-card"><div class="label">USERS</div><div class="value">${s.users}</div></div>
        <div class="admin-stat-card"><div class="label">BALANCE</div><div class="value">${Number(s.balance || 0).toLocaleString('vi-VN')}d</div></div>
        <div class="admin-stat-card"><div class="label">DEPOSITS</div><div class="value">${Number(s.deposits || 0).toLocaleString('vi-VN')}d</div></div>
        <div class="admin-stat-card"><div class="label">RENTS</div><div class="value">${Number(s.rents || 0).toLocaleString('vi-VN')}d</div></div>
    `;
}

function renderAdminRents() {
    const el = document.getElementById('admin-rents');
    if (!el) return;
    const search = document.getElementById('admin-search')?.value || '';
    const pending = (adminData.rents || []).filter(r => r.status === 'pending');
    const list = adminFilter(pending, search, ['username', 'package_name']);
    if (!list.length) { el.innerHTML = 'Không có yêu c?u.'; return; }
    el.innerHTML = `<div class="admin-list">` + list.map(r => `
        <div class="admin-item">
            <div class="admin-item-head">
                <div>
                    <div class="admin-title-row"><strong>${r.package_name}</strong><span class="admin-chip">CH?</span></div>
                    <div class="admin-meta-line">${r.username} • ${new Date(r.created_at).toLocaleString('vi-VN')}</div>
                </div>
                <div class="admin-price">${Number(r.price).toLocaleString('vi-VN')}d</div>
            </div>
            <div class="admin-actions">
                <button class="admin-btn" onclick="adminApproveRent('${r.id}', 1)">DUY?T 1H</button>
                <button class="admin-btn ghost" onclick="adminApproveRent('${r.id}', 6)">6H</button>
                <button class="admin-btn ghost" onclick="adminApproveRent('${r.id}', 24)">1 NGÀY</button>
                <button class="admin-btn warn" onclick="adminApproveRent('${r.id}', 720)">30 NGÀY</button>
                <button class="admin-btn danger" onclick="adminRejectRent('${r.id}')">T? CH?I</button>
            </div>
        </div>
    `).join('') + `</div>`;
}

function renderAdminDeposits() {
    const el = document.getElementById('admin-deposits');
    if (!el) return;
    const search = document.getElementById('admin-search')?.value || '';
    const pending = (adminData.deposits || []).filter(d => d.status === 'pending');
    const list = adminFilter(pending, search, ['username']);
    if (!list.length) { el.innerHTML = 'Không có yêu c?u.'; return; }
    el.innerHTML = `<div class="admin-list">` + list.map(d => `
        <div class="admin-item">
            <div class="admin-item-head">
                <div>
                    <div class="admin-title-row"><strong>${d.username}</strong><span class="admin-chip">N?P</span></div>
                    <div class="admin-meta-line">${new Date(d.created_at).toLocaleString('vi-VN')}</div>
                </div>
                <div class="admin-price">${Number(d.amount).toLocaleString('vi-VN')}d</div>
            </div>
            <div class="admin-actions">
                <button class="admin-btn" onclick="adminApproveDeposit('${d.id}')">DUY?T</button>
                <button class="admin-btn danger" onclick="adminRejectDeposit('${d.id}')">T? CH?I</button>
            </div>
        </div>
    `).join('') + `</div>`;
}

function renderAdminUsers() {
    const el = document.getElementById('admin-users');
    if (!el) return;
    const search = document.getElementById('admin-search')?.value || '';
    const list = adminFilter(adminData.users || [], search, ['username', 'id', 'admin_note']);
    if (!list.length) { el.innerHTML = 'Không có d? li?u.'; return; }
    el.innerHTML = `<div class="admin-list">` + list.map(u => `
        <div class="admin-item">
            <div class="admin-item-head">
                <div>
                    <div class="admin-title-row"><strong>${u.username}</strong><span class="admin-chip">ID: ${u.id}</span></div>
                    <div class="admin-meta-line">S? du: ${Number(u.balance || 0).toLocaleString('vi-VN')}d</div>
                </div>
                <div class="admin-chip">${u.is_locked ? 'ÐÃ KHÓA' : 'ÐANG M?'}</div>
            </div>
            <div class="admin-actions">
                <button class="admin-btn ghost" onclick="adminAdjustBalance('${u.id}', 50000)">+50K</button>
                <button class="admin-btn ghost" onclick="adminAdjustBalance('${u.id}', -50000)">-50K</button>
                <button class="admin-btn warn" onclick="adminToggleLock('${u.id}', ${u.is_locked ? 'false' : 'true'})">${u.is_locked ? 'M? KHÓA' : 'KHÓA'}</button>
                <button class="admin-btn danger" onclick="adminDeleteUser('${u.id}')">XÓA</button>
            </div>
            <div class="admin-actions">
                <input class="admin-search" style="flex:1" id="note-${u.id}" placeholder="Ghi chú admin..." value="${(u.admin_note || '').replace(/"/g,'&quot;')}" />
                <button class="admin-btn" onclick="adminSaveNote('${u.id}')">LUU</button>
            </div>
        </div>
    `).join('') + `</div>`;
}

function renderAdminPins() {
    const el = document.getElementById('admin-pins');
    if (!el) return;
    const search = document.getElementById('admin-search')?.value || '';
    const list = adminFilter(adminData.pins || [], search, ['username', 'user_id', 'pin']);
    if (!list.length) { el.innerHTML = 'Không có PIN.'; return; }
    el.innerHTML = `<div class="admin-list">` + list.map(p => `
        <div class="admin-item">
            <div class="admin-item-head">
                <div>
                    <div class="admin-title-row"><strong>${p.username}</strong><span class="admin-chip">PIN</span></div>
                    <div class="admin-meta-line">${p.user_id} • ${new Date(p.created_at).toLocaleString('vi-VN')}</div>
                </div>
                <div class="admin-price">${p.pin}</div>
            </div>
            <div class="admin-actions">
                <button class="admin-btn danger" onclick="adminDeletePin('${p.id}')">ÐÃ X? LÝ</button>
            </div>
        </div>
    `).join('') + `</div>`;
}

async function adminApproveRent(id, hours) {
    await adminFetch('/api/admin/rent/approve', { method: 'POST', body: JSON.stringify({ rentId: id, durationHours: hours }) });
    loadAdminData();
}
async function adminRejectRent(id) {
    await adminFetch('/api/admin/rent/reject', { method: 'POST', body: JSON.stringify({ rentId: id }) });
    loadAdminData();
}
async function adminApproveDeposit(id) {
    await adminFetch('/api/admin/deposit/approve', { method: 'POST', body: JSON.stringify({ depositId: id }) });
    loadAdminData();
}
async function adminRejectDeposit(id) {
    await adminFetch('/api/admin/deposit/reject', { method: 'POST', body: JSON.stringify({ depositId: id }) });
    loadAdminData();
}
async function adminAdjustBalance(id, delta) {
    await adminFetch('/api/admin/user/balance', { method: 'POST', body: JSON.stringify({ userId: id, delta }) });
    loadAdminData();
}
async function adminToggleLock(id, locked) {
    await adminFetch('/api/admin/user/lock', { method: 'POST', body: JSON.stringify({ userId: id, locked }) });
    loadAdminData();
}
async function adminDeleteUser(id) {
    if (!confirm('Xóa user này?')) return;
    await adminFetch(`/api/admin/user/${id}`, { method: 'DELETE' });
    loadAdminData();
}
async function adminSaveNote(id) {
    const val = document.getElementById(`note-${id}`)?.value || '';
    await adminFetch('/api/admin/user/note', { method: 'POST', body: JSON.stringify({ userId: id, note: val }) });
    loadAdminData();
}
async function adminDeletePin(id) {
    await adminFetch(`/api/admin/pins/${id}`, { method: 'DELETE' });
    loadAdminData();
}