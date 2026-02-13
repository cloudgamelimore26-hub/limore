document.addEventListener('DOMContentLoaded', () => {
    const qs = new URLSearchParams(window.location.search);
    const isAdmin = qs.get('admin') === '1';

    const authModal = document.getElementById('authModal');
    const openAuth = document.getElementById('openAuth');
    const closeAuth = document.querySelector('.close-modal');
    const btnLogout = document.getElementById('btnLogout');
    const toastEl = document.getElementById('toast');

    document.querySelectorAll('.admin-only').forEach((el) => {
        el.style.display = isAdmin ? 'flex' : 'none';
    });

    const adminSection = document.getElementById('admin');
    if (adminSection) adminSection.style.display = isAdmin ? 'block' : 'none';

    const tabs = document.querySelectorAll('.nav-item');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            tabs.forEach((t) => t.classList.remove('active'));
            contents.forEach((c) => c.classList.remove('active'));
            tab.classList.add('active');
            const id = tab.getAttribute('data-tab');
            const target = document.getElementById(id);
            if (target) {
                target.style.display = '';
                target.classList.add('active');
            }
        });
    });

    document.querySelectorAll('.acc-header').forEach((header) => {
        header.addEventListener('click', () => header.parentElement.classList.toggle('active'));
    });

    // Mobile-friendly QR: tap to open larger image for scanning
    const bankQrImg = document.querySelector('.bank-qr-img');
    if (bankQrImg) {
        bankQrImg.addEventListener('click', () => {
            window.open(bankQrImg.src, '_blank', 'noopener');
        });
    }

    if (openAuth && authModal) openAuth.onclick = () => (authModal.style.display = 'block');
    if (closeAuth && authModal) closeAuth.onclick = () => (authModal.style.display = 'none');

    if (btnLogout) {
        btnLogout.onclick = () => {
            if (confirm('Xac nhan dang xuat khoi he thong?')) {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('luxe_user');
                location.reload();
            }
        };
    }

    function showToast(msg) {
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => toastEl.classList.remove('show'), 2400);
    }

    function openAuthModal() {
        if (authModal) authModal.style.display = 'block';
    }

    function formatMoney(v) {
        return `${Number(v || 0).toLocaleString('vi-VN')}d`;
    }

    function toTs(v) {
        const t = new Date(v || '').getTime();
        return Number.isFinite(t) ? t : 0;
    }

    function computeExpiryTs(r) {
        if (r && r.expires_at) return toTs(r.expires_at);
        const name = String(r?.package_name || r?.packageName || '').toLowerCase();
        const createdTs = toTs(r?.created_at) || Date.now();
        if (name.includes('hour')) return createdTs + 60 * 60 * 1000;
        if (name.includes('month')) return createdTs + 30 * 24 * 60 * 60 * 1000;
        return 0;
    }

    function remainingText(expiryTs) {
        if (!expiryTs) return '';
        const remain = expiryTs - Date.now();
        if (remain <= 0) return 'expired';
        const min = Math.floor(remain / 60000);
        const h = Math.floor(min / 60);
        const m = min % 60;
        return `con ${h}h ${m}m`;
    }

    function getBalanceValue() {
        const raw = document.getElementById('balance-val')?.innerText || '0';
        const digits = raw.replace(/[^0-9]/g, '');
        return digits ? parseInt(digits, 10) : 0;
    }

    async function apiFetch(path, options = {}) {
        const token = localStorage.getItem('auth_token');
        const headers = Object.assign({}, options.headers || {});
        if (token) headers.Authorization = `Bearer ${token}`;
        if (!headers['Content-Type'] && options.body) headers['Content-Type'] = 'application/json';

        const res = await fetch(path, Object.assign({}, options, { headers }));
        if (!res.ok) {
            let errText = '';
            try {
                const errJson = await res.json();
                errText = errJson.error || JSON.stringify(errJson);
            } catch (_) {
                errText = await res.text();
            }
            throw new Error(errText || 'request_failed');
        }
        return res.json();
    }

    function applyUserUI(data) {
        const displayName = document.getElementById('display-name');
        const memo = document.getElementById('deposit-memo');
        const icon = document.getElementById('userIcon');
        const ref = document.getElementById('refText');
        const balance = document.getElementById('balance-val');

        const username = (data.username || data.name || 'USER').toUpperCase();
        if (displayName) displayName.innerText = username;
        if (memo) memo.innerText = `NAP ${data.id || username}`;
        if (icon) icon.innerHTML = '<i class="fas fa-check-circle" style="color:white"></i>';
        if (btnLogout) btnLogout.style.display = 'block';
        if (openAuth) openAuth.style.display = 'none';
        if (ref) ref.innerText = data.ref_code || `LX-${username.substring(0, 3)}`;
        if (balance && data.balance !== undefined) balance.innerText = formatMoney(data.balance);
    }

    async function loadMe() {
        try {
            const me = await apiFetch('/api/user/me');
            localStorage.setItem('luxe_user', JSON.stringify(me));
            applyUserUI(me);
        } catch (_) {
            // no active session
        }
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const username = document.getElementById('nameInput')?.value?.trim();
            const password = document.getElementById('passInput')?.value?.trim();

            if (!username || !password) {
                showToast('Vui long nhap day du tai khoan va mat khau');
                return;
            }

            try {
                let data;
                const loginRes = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                if (loginRes.ok) {
                    data = await loginRes.json();
                } else {
                    const regRes = await fetch('/api/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    if (!regRes.ok) throw new Error('auth_failed');
                    data = await regRes.json();
                }

                localStorage.setItem('auth_token', data.token);
                await loadMe();
                await loadRentHistory();
                if (authModal) authModal.style.display = 'none';
                showToast('Dang nhap thanh cong');
            } catch (_) {
                showToast('Dang nhap / dang ky that bai');
            }
        };
    }

    const rentModal = document.getElementById('rentModal');
    const closeRent = document.getElementById('closeRent');
    if (closeRent && rentModal) closeRent.onclick = () => (rentModal.style.display = 'none');
    if (rentModal) {
        rentModal.addEventListener('click', (e) => {
            if (e.target === rentModal) rentModal.style.display = 'none';
        });
    }

    function appendRentItem(r) {
        const list = document.getElementById('rentHistory');
        if (!list) return;
        const empty = list.querySelector('.rent-empty');
        if (empty) empty.remove();

        const title = r.package_name || r.packageName || 'PLAN';
        const created = r.created_at ? new Date(r.created_at).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN');
        const expiryTs = computeExpiryTs(r);
        const expired = expiryTs > 0 && Date.now() >= expiryTs;
        const baseStatus = String(r.status || 'pending');
        const statusText = expired ? 'expired' : baseStatus;
        const remain = remainingText(expiryTs);

        const item = document.createElement('div');
        item.className = 'rent-item';
        item.dataset.expiryTs = String(expiryTs || 0);
        item.dataset.status = baseStatus;
        item.dataset.created = created;
        item.innerHTML = `
            <div>
                <div class="rent-info">${title} • ${formatMoney(r.price)}</div>
                <div class="rent-meta">${statusText} • ${created}${remain ? ` • ${remain}` : ''}</div>
            </div>
            <div class="rent-actions">
                <button class="btn-connect">KET NOI</button>
                <button class="btn-remove">XOA MAY</button>
            </div>
        `;
        if (expired) {
            const connectBtn = item.querySelector('.btn-connect');
            if (connectBtn) connectBtn.remove();
        }
        list.prepend(item);
    }

    function refreshRentExpiryView() {
        const list = document.getElementById('rentHistory');
        if (!list) return;
        const rows = list.querySelectorAll('.rent-item');
        rows.forEach((row) => {
            const expiryTs = Number(row.dataset.expiryTs || 0);
            const meta = row.querySelector('.rent-meta');
            if (!meta) return;
            if (!expiryTs) return;
            const isExpired = Date.now() >= expiryTs;
            const current = String(row.dataset.status || 'pending');
            const createdPart = String(row.dataset.created || '');
            if (isExpired) {
                meta.textContent = `expired • ${createdPart}`;
                const connectBtn = row.querySelector('.btn-connect');
                if (connectBtn) connectBtn.remove();
            } else {
                const remain = remainingText(expiryTs);
                meta.textContent = `${current} • ${createdPart}${remain ? ` • ${remain}` : ''}`;
            }
        });
    }

    async function loadRentHistory() {
        const list = document.getElementById('rentHistory');
        if (!list) return;
        try {
            const rents = await apiFetch('/api/user/rents');
            list.innerHTML = '';
            if (!rents || rents.length === 0) {
                list.innerHTML = '<div class="rent-empty">Chua co luot thue.</div>';
                return;
            }
            rents.forEach((r) => appendRentItem(r));
            refreshRentExpiryView();
        } catch (_) {
            list.innerHTML = '<div class="rent-empty">Chua co luot thue.</div>';
        }
    }

    const rentHistoryEl = document.getElementById('rentHistory');
    if (rentHistoryEl) {
        rentHistoryEl.addEventListener('click', (e) => {
            if (!e.target.classList.contains('btn-remove')) return;
            const row = e.target.closest('.rent-item');
            if (row) row.remove();
            if (!rentHistoryEl.querySelector('.rent-item')) {
                rentHistoryEl.innerHTML = '<div class="rent-empty">Chua co luot thue.</div>';
            }
        });
    }

    // Update remaining time every 30s so 1h package auto expires in UI
    setInterval(refreshRentExpiryView, 30000);

    document.querySelectorAll('.price-card .btn-rent, .price-card .btn-rent-ghost').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                showToast('Vui long dang nhap de thue goi');
                openAuthModal();
                return;
            }

            const card = btn.closest('.price-card');
            const price = parseInt(card?.dataset?.price || '0', 10);
            const packageName = card?.querySelector('h3')?.innerText || 'PLAN';

            if (getBalanceValue() < price) {
                showToast('Khong du so du');
                return;
            }

            try {
                const durationHours = packageName.toLowerCase().includes('month') ? 720 : 1;
                const rent = await apiFetch('/api/rent', {
                    method: 'POST',
                    body: JSON.stringify({ packageName, price, durationHours })
                });
                showToast('Thue thanh cong, cho admin duyet');
                if (rentModal) rentModal.style.display = 'block';
                appendRentItem({ package_name: packageName, price, status: rent.status, created_at: new Date().toISOString() });
                loadMe();
            } catch (err) {
                const msg = String(err.message || '');
                if (msg.includes('out_of_stock')) {
                    showToast('Goi nay tam het may');
                } else if (msg.includes('insufficient_balance')) {
                    showToast('Khong du so du');
                } else {
                    showToast('Thue that bai');
                }
            }
        });
    });

    const sendPin = document.getElementById('sendPin');
    if (sendPin) {
        sendPin.addEventListener('click', async () => {
            const pin = document.getElementById('steamPin')?.value?.trim();
            if (!pin || !/^\d{4,6}$/.test(pin)) {
                showToast('PIN can 4-6 so');
                return;
            }
            try {
                await apiFetch('/api/user/pin', {
                    method: 'POST',
                    body: JSON.stringify({ pin })
                });
                showToast('Da gui PIN cho admin');
            } catch (_) {
                showToast('Gui PIN that bai');
            }
        });
    }

    function getAdminToken() {
        return localStorage.getItem('admin_token');
    }

    async function adminFetch(path, options = {}) {
        const token = getAdminToken();
        const headers = Object.assign({}, options.headers || {});
        if (token) headers.Authorization = `Bearer ${token}`;
        if (!headers['Content-Type'] && options.body) headers['Content-Type'] = 'application/json';
        const res = await fetch(path, Object.assign({}, options, { headers }));
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    }

    function renderAdminList(containerId, rows, renderRow) {
        const wrap = document.getElementById(containerId);
        if (!wrap) return;
        wrap.innerHTML = '';
        if (!rows || rows.length === 0) {
            wrap.innerHTML = '<div class="admin-empty">Khong co du lieu.</div>';
            return;
        }
        rows.forEach((row) => wrap.insertAdjacentHTML('beforeend', renderRow(row)));
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
                    <div class="admin-stat-card"><div class="label">USERS</div><div class="value">${stats.users || 0}</div></div>
                    <div class="admin-stat-card"><div class="label">TOTAL BALANCE</div><div class="value">${formatMoney(stats.balance || 0)}</div></div>
                    <div class="admin-stat-card"><div class="label">APPROVED DEPOSITS</div><div class="value">${formatMoney(stats.deposits || 0)}</div></div>
                    <div class="admin-stat-card"><div class="label">APPROVED RENTS</div><div class="value">${formatMoney(stats.rents || 0)}</div></div>
                `;
            }

            const kw = keyword.toLowerCase();
            const fUsers = !kw ? users : users.filter((u) => (u.username || '').toLowerCase().includes(kw) || String(u.id).includes(kw));
            const fRents = !kw ? rents : rents.filter((r) => (r.username || '').toLowerCase().includes(kw) || String(r.user_id).includes(kw));
            const fDeposits = !kw ? deposits : deposits.filter((d) => (d.username || '').toLowerCase().includes(kw) || String(d.user_id).includes(kw));
            const fPins = !kw ? pins : pins.filter((p) => (p.username || '').toLowerCase().includes(kw) || String(p.user_id).includes(kw));

            renderAdminList('admin-users', fUsers, (u) => `
                <div class="admin-item">
                    <div class="admin-item-head">
                        <div>
                            <div class="admin-title-row"><b>${u.username}</b><span class="admin-chip">#${u.id}</span></div>
                            <div class="admin-meta-line">Balance: ${formatMoney(u.balance)} • ${u.is_locked ? 'LOCKED' : 'ACTIVE'}</div>
                            <input class="admin-note" data-id="${u.id}" value="${u.admin_note || ''}" placeholder="Ghi chu admin" />
                        </div>
                        <div class="admin-actions">
                            <button class="admin-btn" data-action="add" data-id="${u.id}">+10k</button>
                            <button class="admin-btn ghost" data-action="sub" data-id="${u.id}">-10k</button>
                            <button class="admin-btn warn" data-action="${u.is_locked ? 'unlock' : 'lock'}" data-id="${u.id}">${u.is_locked ? 'Mo' : 'Khoa'}</button>
                            <button class="admin-btn danger" data-action="del-user" data-id="${u.id}">Xoa</button>
                        </div>
                    </div>
                </div>
            `);

            renderAdminList('admin-rents', fRents, (r) => `
                <div class="admin-item">
                    <div class="admin-item-head">
                        <div>
                            <div class="admin-title-row"><b>${r.username || 'User'}</b><span class="admin-chip">${r.package_name || '-'}</span></div>
                            <div class="admin-meta-line">${formatMoney(r.price)} • ${r.status} • ${new Date(r.created_at).toLocaleString('vi-VN')}</div>
                        </div>
                        <div class="admin-actions">
                            <button class="admin-btn" data-action="approve-rent" data-id="${r.id}">Duyet</button>
                            <button class="admin-btn danger" data-action="reject-rent" data-id="${r.id}">Tu choi</button>
                        </div>
                    </div>
                </div>
            `);

            renderAdminList('admin-deposits', fDeposits, (d) => `
                <div class="admin-item">
                    <div class="admin-item-head">
                        <div>
                            <div class="admin-title-row"><b>${d.username || 'User'}</b><span class="admin-chip">#${d.id}</span></div>
                            <div class="admin-meta-line">${formatMoney(d.amount)} • ${d.status} • ${new Date(d.created_at).toLocaleString('vi-VN')}</div>
                        </div>
                        <div class="admin-actions">
                            <button class="admin-btn" data-action="approve-dep" data-id="${d.id}">Duyet</button>
                            <button class="admin-btn danger" data-action="reject-dep" data-id="${d.id}">Tu choi</button>
                        </div>
                    </div>
                </div>
            `);

            renderAdminList('admin-pins', fPins, (p) => `
                <div class="admin-item">
                    <div class="admin-item-head">
                        <div>
                            <div class="admin-title-row"><b>${p.username || 'User'}</b><span class="admin-chip">PIN ${p.pin}</span></div>
                            <div class="admin-meta-line">${new Date(p.created_at).toLocaleString('vi-VN')}</div>
                        </div>
                        <div class="admin-actions">
                            <button class="admin-btn danger" data-action="del-pin" data-id="${p.id}">Xoa</button>
                        </div>
                    </div>
                </div>
            `);
        } catch (_) {
            showToast('Khong tai duoc du lieu admin');
        }
    }

    async function initAdmin() {
        let token = getAdminToken();
        if (!token) {
            const pwd = prompt('Nhap mat khau admin');
            if (!pwd) return;
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pwd })
            });
            if (!res.ok) {
                showToast('Sai mat khau admin');
                return;
            }
            const data = await res.json();
            localStorage.setItem('admin_token', data.token);
            token = data.token;
        }

        await loadAdminData();

        const refreshBtn = document.getElementById('admin-refresh');
        if (refreshBtn) refreshBtn.onclick = () => loadAdminData(document.getElementById('admin-search')?.value?.trim() || '');

        const search = document.getElementById('admin-search');
        if (search) search.oninput = () => loadAdminData(search.value.trim());
    }

    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');

        try {
            if (action === 'add' || action === 'sub') {
                const delta = action === 'add' ? 10000 : -10000;
                await adminFetch('/api/admin/user/balance', {
                    method: 'POST',
                    body: JSON.stringify({ userId: id, delta })
                });
            } else if (action === 'lock' || action === 'unlock') {
                await adminFetch('/api/admin/user/lock', {
                    method: 'POST',
                    body: JSON.stringify({ userId: id, locked: action === 'lock' })
                });
            } else if (action === 'del-user') {
                await adminFetch(`/api/admin/user/${id}`, { method: 'DELETE' });
            } else if (action === 'approve-rent') {
                await adminFetch('/api/admin/rent/approve', {
                    method: 'POST',
                    body: JSON.stringify({ rentId: id, durationHours: 1 })
                });
            } else if (action === 'reject-rent') {
                await adminFetch('/api/admin/rent/reject', {
                    method: 'POST',
                    body: JSON.stringify({ rentId: id })
                });
            } else if (action === 'approve-dep') {
                await adminFetch('/api/admin/deposit/approve', {
                    method: 'POST',
                    body: JSON.stringify({ depositId: id })
                });
            } else if (action === 'reject-dep') {
                await adminFetch('/api/admin/deposit/reject', {
                    method: 'POST',
                    body: JSON.stringify({ depositId: id })
                });
            } else if (action === 'del-pin') {
                await adminFetch(`/api/admin/pins/${id}`, { method: 'DELETE' });
            }

            await loadAdminData(document.getElementById('admin-search')?.value?.trim() || '');
            showToast('Da cap nhat');
        } catch (_) {
            showToast('Thao tac that bai');
        }
    });

    document.addEventListener('change', async (e) => {
        const input = e.target.closest('.admin-note');
        if (!input) return;
        const userId = input.getAttribute('data-id');
        const note = input.value.trim();
        try {
            await adminFetch('/api/admin/user/note', {
                method: 'POST',
                body: JSON.stringify({ userId, note })
            });
            showToast('Da luu ghi chu');
        } catch (_) {
            showToast('Luu ghi chu that bai');
        }
    });

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
        alert('Da sao chep ma thanh cong!');
    }
}
