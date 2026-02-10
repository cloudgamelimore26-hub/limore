document.addEventListener('DOMContentLoaded', () => {
    const qs = new URLSearchParams(window.location.search);
    const isAdmin = qs.get('admin') === '1';

    // show admin UI if present
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? 'flex' : 'none';
    });
    const adminSection = document.getElementById('admin');
    if (adminSection) adminSection.style.display = isAdmin ? 'block' : 'none';

    // tabs
    const tabs = document.querySelectorAll('.nav-item');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const id = tab.getAttribute('data-tab');
            const target = document.getElementById(id);
            if (target) target.classList.add('active');
        });
    });

    // accordion
    document.querySelectorAll('.acc-header').forEach(header => {
        header.addEventListener('click', () => header.parentElement.classList.toggle('active'));
    });

    // auth modal
    const authModal = document.getElementById('authModal');
    const openAuth = document.getElementById('openAuth');
    const closeAuth = document.querySelector('.close-modal');
    if (openAuth && authModal) openAuth.onclick = () => authModal.style.display = 'block';
    if (closeAuth && authModal) closeAuth.onclick = () => authModal.style.display = 'none';

    // logout
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.onclick = () => {
            if (confirm('Xác nhận đăng xuất khỏi hệ thống?')) {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('luxe_user');
                location.reload();
            }
        };
    }

    // toast
    const toastEl = document.getElementById('toast');
    function showToast(msg) {
        if (!toastEl) return;
        toastEl.innerText = msg;
        toastEl.classList.add('show');
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => toastEl.classList.remove('show'), 2200);
    }

    function openAuthModal() {
        if (authModal) authModal.style.display = 'block';
    }

    function getBalanceValue() {
        const raw = document.getElementById('balance-val')?.innerText || '0';
        const digits = raw.replace(/[^0-9]/g, '');
        return digits ? parseInt(digits, 10) : 0;
    }

    // api helper
    async function apiFetch(path, options = {}) {
        const token = localStorage.getItem('auth_token');
        const headers = Object.assign({}, options.headers || {});
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (!headers['Content-Type'] && options.body) headers['Content-Type'] = 'application/json';
        const res = await fetch(path, Object.assign({}, options, { headers }));
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    }

    function applyUserUI(data) {
    const displayName = document.getElementById('display-name');
    const memo = document.getElementById('deposit-memo');
    const icon = document.getElementById('userIcon');
    const ref = document.getElementById('refText');
    const balance = document.getElementById('balance-val');
    const name = (data.username || data.name || '').toUpperCase();
    if (displayName) displayName.innerText = name || 'USER';
    if (memo) memo.innerText = `NAP ${data.id || name || 'USER'}`;
    if (icon) icon.innerHTML = '<i class="fas fa-check-circle" style="color:white"></i>';
    if (btnLogout) btnLogout.style.display = 'block';
    if (openAuth) openAuth.style.display = 'none';
    if (ref) {
        const code = data.ref_code || (name ? `LX-${name.substring(0,3)}` : '---');
        ref.innerText = code;
    }
    if (balance && data.balance !== undefined) balance.innerText = `${Number(data.balance).toLocaleString('vi-VN')}đ`;
}
    async function loadMe() {
        try {
            const data = await apiFetch('/api/auth/me');
            localStorage.setItem('luxe_user', JSON.stringify(data));
            applyUserUI(data);
        } catch (e) {
            // no session
        }
    }

    // login/register
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const username = document.getElementById('nameInput')?.value?.trim();
            const password = document.getElementById('passInput')?.value?.trim();
            if (!username || !password) {
                showToast('Vui lòng nhập đủ thông tin');
                return;
            }
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                let data;
                if (res.ok) {
                    data = await res.json();
                } else {
                    const r2 = await fetch('/api/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    if (!r2.ok) throw new Error(await r2.text());
                    data = await r2.json();
                }
                localStorage.setItem('auth_token', data.token);
                await loadMe();
                if (authModal) authModal.style.display = 'none';
                showToast('Đăng nhập thành công');
            } catch (err) {
                showToast('Đăng nhập / đăng ký thất bại');
            }
        };
    }

    // rent modal
    const rentModal = document.getElementById('rentModal');
    const closeRent = document.getElementById('closeRent');
    if (closeRent && rentModal) closeRent.onclick = () => rentModal.style.display = 'none';
    if (rentModal) {
        rentModal.addEventListener('click', (e) => {
            if (e.target === rentModal) rentModal.style.display = 'none';
        });
    }

    function addRentHistory(plan, price) {
        const list = document.getElementById('rentHistory');
        if (!list) return;
        const empty = list.querySelector('.rent-empty');
        if (empty) empty.remove();
        const item = document.createElement('div');
        item.className = 'rent-item';
        const time = new Date().toLocaleString('vi-VN');
        item.innerHTML = `
            <div>
                <div class="rent-info">${plan} • ${price.toLocaleString('vi-VN')}đ</div>
                <div class="rent-meta">Kết nối • ${time}</div>
            </div>
            <div class="rent-actions">
                <button class="btn-connect">KẾT NỐI</button>
                <button class="btn-remove">XÓA MÁY</button>
            </div>
        `;
        list.prepend(item);
    }

    const rentHistoryEl = document.getElementById('rentHistory');
    if (rentHistoryEl) {
        rentHistoryEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-remove')) {
                const item = e.target.closest('.rent-item');
                if (item) item.remove();
                if (!rentHistoryEl.querySelector('.rent-item')) {
                    rentHistoryEl.innerHTML = '<div class="rent-empty">Chưa có lượt thuê.</div>';
                }
            }
        });
    }

    document.querySelectorAll('.price-card .btn-rent, .price-card .btn-rent-ghost').forEach(btn => {
        btn.addEventListener('click', async () => {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                showToast('Vui lòng đăng nhập để thuê gói');
                openAuthModal();
                return;
            }
            const card = btn.closest('.price-card');
            const price = parseInt(card?.dataset?.price || '0', 10);
            const plan = card?.querySelector('h3')?.innerText || 'PLAN';
            const balance = getBalanceValue();
            if (balance < price) {
                showToast('Không đủ số dư');
                return;
            }
            try {
                const durationHours = plan.toLowerCase().includes('month') ? 720 : 1;
                await apiFetch('/api/rent', {
                    method: 'POST',
                    body: JSON.stringify({ packageName: plan, price, durationHours })
                });
                showToast('Thuê thành công');
                if (rentModal) rentModal.style.display = 'block';
                addRentHistory(plan, price);
            } catch (e) {
                showToast('Thuê thất bại');
            }
        });
    });

    // send pin
    const sendPin = document.getElementById('sendPin');
    if (sendPin) {
        sendPin.addEventListener('click', async () => {
            const pin = document.getElementById('steamPin')?.value?.trim();
            if (!pin || !/^\\d{4,6}$/.test(pin)) {
                showToast('PIN cần 4-6 số');
                return;
            }
            try {
                await apiFetch('/api/user/pin', {
                    method: 'POST',
                    body: JSON.stringify({ pin })
                });
                showToast('Đã gửi PIN cho admin');
            } catch (e) {
                showToast('Gửi PIN thất bại');
            }
        });
    }

    async function loadRentHistory() {
        try {
            const data = await apiFetch('/api/user/rents');
            const list = document.getElementById('rentHistory');
            if (!list) return;
            list.innerHTML = '';
            if (!data || data.length === 0) {
                list.innerHTML = '<div class="rent-empty">Chưa có lượt thuê.</div>';
                return;
            }
            data.forEach(r => addRentHistory(r.packageName, Number(r.price)));
        } catch (e) {
            // ignore
        }
    }

    // admin
    function getAdminToken() {
        return localStorage.getItem('admin_token');
    }

    async function adminFetch(path, options = {}) {
        const token = getAdminToken();
        const headers = Object.assign({}, options.headers || {});
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (!headers['Content-Type'] && options.body) headers['Content-Type'] = 'application/json';
        const res = await fetch(path, Object.assign({}, options, { headers }));
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    }

    async function initAdmin() {
        let token = getAdminToken();
        if (!token) {
            const pwd = prompt('Nhập mật khẩu admin');
            if (!pwd) return;
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pwd })
            });
            if (!res.ok) {
                showToast('Sai mật khẩu admin');
                return;
            }
            const data = await res.json();
            localStorage.setItem('admin_token', data.token);
        }
        loadAdminData();

        const refreshBtn = document.getElementById('admin-refresh');
        if (refreshBtn) refreshBtn.onclick = loadAdminData;
        const search = document.getElementById('admin-search');
        if (search) search.oninput = () => loadAdminData(search.value.trim());
    }

    function renderAdminList(containerId, rows, renderRow) {
        const wrap = document.getElementById(containerId);
        if (!wrap) return;
        wrap.innerHTML = '';
        if (!rows || rows.length === 0) {
            wrap.innerHTML = '<div class="admin-empty">Không có dữ liệu.</div>';
            return;
        }
        rows.forEach(r => wrap.insertAdjacentHTML('beforeend', renderRow(r)));
    }

    async function loadAdminData(keyword = '') {
        try {
            const [stats, users, rents, deposits, pins] = await Promise.all([
                adminFetch('/api/admin/stats'),
                adminFetch('/api/admin/users'),
                adminFetch('/api/admin/rents'),
                adminFetch('/api/admin/deposits'),
                adminFetch('/api/admin/pins')
            ]);

            const statsEl = document.getElementById('admin-stats');
            if (statsEl) {
                statsEl.innerHTML = `
                    <div class="admin-stat">Users <b>${stats.users}</b></div>
                    <div class="admin-stat">Rentals <b>${stats.rents}</b></div>
                    <div class="admin-stat">Pending Dep <b>${stats.pendingDeposits}</b></div>
                    <div class="admin-stat">Pins <b>${stats.pins}</b></div>
                `;
            }

            const kw = keyword.toLowerCase();
            const fUsers = !kw ? users : users.filter(u => (u.username || '').toLowerCase().includes(kw) || String(u.id).includes(kw) || (u.admin_note || '').toLowerCase().includes(kw));
            const fRents = !kw ? rents : rents.filter(r => (r.username || '').toLowerCase().includes(kw) || String(r.user_id).includes(kw));
            const fDeps = !kw ? deposits : deposits.filter(d => (d.username || '').toLowerCase().includes(kw) || String(d.user_id).includes(kw));
            const fPins = !kw ? pins : pins.filter(p => (p.username || '').toLowerCase().includes(kw) || String(p.user_id).includes(kw));

            renderAdminList('admin-users', fUsers, (u) => `
                <div class="admin-row">
                    <div>
                        <div class="admin-title">${u.username} <span class="admin-sub">#${u.id}</span></div>
                        <div class="admin-sub">Balance: ${Number(u.balance).toLocaleString('vi-VN')}đ • ${u.is_locked ? 'LOCKED' : 'ACTIVE'}</div>
                        <input class="admin-note" data-id="${u.id}" value="${u.admin_note || ''}" placeholder="Ghi chú admin" />
                    </div>
                    <div class="admin-actions">
                        <button class="btn-sm" data-action="add" data-id="${u.id}">+10k</button>
                        <button class="btn-sm" data-action="sub" data-id="${u.id}">-10k</button>
                        <button class="btn-sm" data-action="${u.is_locked ? 'unlock' : 'lock'}" data-id="${u.id}">${u.is_locked ? 'Mở' : 'Khoá'}</button>
                        <button class="btn-sm danger" data-action="del" data-id="${u.id}">Xoá</button>
                    </div>
                </div>
            `);

            renderAdminList('admin-rents', fRents, (r) => `
                <div class="admin-row">
                    <div>
                        <div class="admin-title">${r.username || 'User'} • ${r.packageName}</div>
                        <div class="admin-sub">${Number(r.price).toLocaleString('vi-VN')}đ • ${r.status} • ${new Date(r.created_at).toLocaleString('vi-VN')}</div>
                    </div>
                    <div class="admin-actions">
                        <button class="btn-sm" data-action="approve-rent" data-id="${r.id}">Duyệt</button>
                        <button class="btn-sm danger" data-action="reject-rent" data-id="${r.id}">Từ chối</button>
                    </div>
                </div>
            `);

            renderAdminList('admin-deposits', fDeps, (d) => `
                <div class="admin-row">
                    <div>
                        <div class="admin-title">${d.username || 'User'} • ${Number(d.amount).toLocaleString('vi-VN')}đ</div>
                        <div class="admin-sub">${d.status} • ${new Date(d.created_at).toLocaleString('vi-VN')}</div>
                    </div>
                    <div class="admin-actions">
                        <button class="btn-sm" data-action="approve-dep" data-id="${d.id}" data-uid="${d.user_id}" data-amount="${d.amount}">Duyệt</button>
                        <button class="btn-sm danger" data-action="reject-dep" data-id="${d.id}">Từ chối</button>
                    </div>
                </div>
            `);

            renderAdminList('admin-pins', fPins, (p) => `
                <div class="admin-row">
                    <div>
                        <div class="admin-title">${p.username || 'User'} • PIN: ${p.pin}</div>
                        <div class="admin-sub">${new Date(p.created_at).toLocaleString('vi-VN')}</div>
                    </div>
                    <div class="admin-actions">
                        <button class="btn-sm danger" data-action="del-pin" data-id="${p.id}">Xoá</button>
                    </div>
                </div>
            `);

        } catch (e) {
            showToast('Không tải được dữ liệu admin');
        }
    }

    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-sm');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        try {
            if (action === 'add' || action === 'sub') {
                const amount = action === 'add' ? 10000 : -10000;
                await adminFetch('/api/admin/balance', { method: 'POST', body: JSON.stringify({ userId: id, amount }) });
            } else if (action === 'lock' || action === 'unlock') {
                await adminFetch(`/api/admin/user/${action}`, { method: 'POST', body: JSON.stringify({ userId: id }) });
            } else if (action === 'del') {
                await adminFetch(`/api/admin/user/${id}`, { method: 'DELETE' });
            } else if (action === 'approve-rent' || action === 'reject-rent') {
                await adminFetch(`/api/admin/rent/${action === 'approve-rent' ? 'approve' : 'reject'}`, { method: 'POST', body: JSON.stringify({ rentId: id }) });
            } else if (action === 'approve-dep' || action === 'reject-dep') {
                const uid = btn.getAttribute('data-uid');
                const amount = Number(btn.getAttribute('data-amount'));
                await adminFetch(`/api/admin/deposit/${action === 'approve-dep' ? 'approve' : 'reject'}`, { method: 'POST', body: JSON.stringify({ depositId: id, userId: uid, amount }) });
            } else if (action === 'del-pin') {
                await adminFetch(`/api/admin/pins/${id}`, { method: 'DELETE' });
            }
            loadAdminData();
        } catch (err) {
            showToast('Thao tác thất bại');
        }
    });

    document.addEventListener('change', async (e) => {
        const input = e.target.closest('.admin-note');
        if (!input) return;
        const id = input.getAttribute('data-id');
        const note = input.value.trim();
        try {
            await adminFetch('/api/admin/user/note', { method: 'POST', body: JSON.stringify({ userId: id, note }) });
            showToast('Đã lưu ghi chú');
        } catch (err) {
            showToast('Lưu ghi chú thất bại');
        }
    });

    // bootstrap
    if (localStorage.getItem('auth_token')) {
        loadMe();
        loadRentHistory();
    }
    if (isAdmin) initAdmin();
});

function copyCode() {
    const code = document.getElementById('refText')?.innerText;
    if (code && code !== '---') {
        navigator.clipboard.writeText(code);
        alert('Đã sao chép mã thành công!');
    }
}

