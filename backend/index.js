const express = require('express');
const cors = require('cors');
const path = require('path');
const { randomUUID } = require('crypto');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const webRoot = path.join(__dirname, 'public');
app.use(express.static(webRoot));

const sessions = new Map();

const BANK = process.env.VQR_BANK || 'VCB';
const ACCOUNT = process.env.VQR_ACCOUNT || '0011001234567';
const ACCOUNT_NAME = process.env.VQR_NAME || 'CONG TY TNHH LIMORE CLOUD';

function now() {
  return new Date().toISOString();
}

function auth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token || !sessions.has(token)) return res.status(401).json({ error: 'unauthorized' });
  req.userId = sessions.get(token);
  next();
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: now() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(webRoot, 'index.html'));
});

app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing_fields' });

  const id = randomUUID();
  db.run(
    'INSERT INTO users (id, username, password, balance, created_at) VALUES (?, ?, ?, 0, ?)'
    , [id, username, password, now()],
    function (err) {
      if (err) return res.status(400).json({ error: 'user_exists' });
      const token = randomUUID();
      sessions.set(token, id);
      res.json({ token, user: { id, username, balance: 0 } });
    }
  );
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing_fields' });

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err || !user || user.password !== password) return res.status(401).json({ error: 'invalid_credentials' });
    const token = randomUUID();
    sessions.set(token, user.id);
    res.json({ token, user: { id: user.id, username: user.username, balance: user.balance } });
  });
});

app.get('/api/user/me', auth, (req, res) => {
  db.get('SELECT id, username, balance FROM users WHERE id = ?', [req.userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'not_found' });
    res.json(user);
  });
});

app.post('/api/deposit/create', auth, (req, res) => {
  const amount = parseInt(req.body?.amount, 10);
  if (isNaN(amount) || amount < 10000) return res.status(400).json({ error: 'invalid_amount' });

  const depositId = randomUUID();
  db.run(
    'INSERT INTO deposits (id, user_id, amount, status, created_at) VALUES (?, ?, ?, ?, ?)'
    , [depositId, req.userId, amount, 'pending', now()],
    (err) => {
      if (err) return res.status(500).json({ error: 'db_error' });
      const addInfo = encodeURIComponent(`NAP ${req.userId} ${amount}`);
      const name = encodeURIComponent(ACCOUNT_NAME);
      const qrUrl = `https://img.vietqr.io/image/${BANK}-${ACCOUNT}-compact2.png?amount=${amount}&addInfo=${addInfo}&accountName=${name}`;
      res.json({ depositId, qrUrl });
    }
  );
});

app.post('/api/deposit/confirm', auth, (req, res) => {
  const { depositId } = req.body || {};
  if (!depositId) return res.status(400).json({ error: 'missing_deposit_id' });

  db.get('SELECT * FROM deposits WHERE id = ? AND user_id = ?', [depositId, req.userId], (err, dep) => {
    if (err || !dep) return res.status(404).json({ error: 'not_found' });
    if (dep.status === 'approved') return res.json({ ok: true, balanceUpdated: false });

    db.serialize(() => {
      db.run('UPDATE deposits SET status = ? WHERE id = ?', ['approved', depositId]);
      db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [dep.amount, req.userId]);
      res.json({ ok: true, balanceUpdated: true });
    });
  });
});

app.post('/api/rent', auth, (req, res) => {
  const { packageName, price, durationHours } = req.body || {};
  const cost = parseInt(price, 10);
  const hours = parseInt(durationHours, 10) || 1;
  if (!packageName || isNaN(cost) || cost <= 0) return res.status(400).json({ error: 'invalid_payload' });

  db.get('SELECT balance FROM users WHERE id = ?', [req.userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'user_not_found' });
    if (user.balance < cost) return res.status(400).json({ error: 'insufficient_balance' });

    const rentId = randomUUID();
    const createdAt = now();
    db.serialize(() => {
      db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [cost, req.userId]);
      db.run(
        'INSERT INTO rents (id, user_id, package_name, price, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        , [rentId, req.userId, packageName, cost, 'pending', createdAt]
      );
      res.json({ rentId, status: 'pending' });
    });
  });
});

app.post('/api/admin/approve', (req, res) => {
  const { rentId } = req.body || {};
  if (!rentId) return res.status(400).json({ error: 'missing_rent_id' });

  const approvedAt = now();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  db.run(
    'UPDATE rents SET status = ?, approved_at = ?, expires_at = ? WHERE id = ?'
    , ['approved', approvedAt, expiresAt, rentId],
    function (err) {
      if (err || this.changes === 0) return res.status(404).json({ error: 'not_found' });
      res.json({ ok: true });
    }
  );
});

app.get('/api/user/notifications', auth, (req, res) => {
  db.all(
    'SELECT id, package_name, price, status, created_at, approved_at, expires_at FROM rents WHERE user_id = ? ORDER BY created_at DESC'
    , [req.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'db_error' });
      res.json(rows);
    }
  );
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
