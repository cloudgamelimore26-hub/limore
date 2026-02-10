document.addEventListener('DOMContentLoaded', () => {
    // 0. Admin view via ?admin=1
    const params = new URLSearchParams(window.location.search);
    const isAdmin = params.get('admin') === '1';
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? 'flex' : 'none';
    });
    const adminSection = document.getElementById('admin');
    if (adminSection) adminSection.style.display = isAdmin ? 'block' : 'none';
    // 1. Kiểm tra LocalStorage để giữ đăng nhập khi reset trang
    const savedData = localStorage.getItem('luxe_user');
    if (savedData) applyUserUI(JSON.parse(savedData));

    // 2. Chuyển đổi Tab
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

    // 3. Logic Accordion (Nạp tiền)
    document.querySelectorAll('.acc-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('active');
        });
    });

    // 4. Modal Đăng nhập
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

    // 5. Đăng xuất & Đăng nhập lại
    document.getElementById('btnLogout').onclick = () => {
        if(confirm("Xác nhận đăng xuất khỏi hệ thống?")) {
            localStorage.removeItem('luxe_user');
            window.location.reload(); // Tải lại trang để reset toàn bộ
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
        item.innerHTML = `<div><div class="rent-info">${plan} � ${price.toLocaleString('vi-VN')}&#273;</div><div class="rent-meta">K&#7871;t n&#7889;i � ${time}</div></div><div class="rent-actions"><button class="btn-connect">K&#7870;T N&#7888;I</button><button class="btn-remove">X&#211;A M&#193;Y</button></div>`;
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
        alert("Đã sao chép mã thành công!");
    }
}


