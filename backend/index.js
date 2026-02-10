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
const adminSessions = new Map();

const BANK = process.env.VQR_BANK || 'VCB';
const ACCOUNT = process.env.VQR_ACCOUNT || '0011001234567';
const ACCOUNT_NAME = process.env.VQR_NAME || 'CONG TY TNHH LIMORE CLOUD';
const ADMIN_PASS = process.env.ADMIN_PASS || '123456';

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

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token || !adminSessions.has(token)) return res.status(401).json({ error: 'unauthorized' });
  next();
}

function getConfig(key, cb) {
  db.get('SELECT value FROM config WHERE key = ?', [key], (err, row) => {
    if (err) return cb(err);
    cb(null, row ? row.value : null);
  });
}

function setConfig(key, value, cb) {
  db.run(
    'INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    [key, value],
    cb
  );
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
    if (user.is_locked) return res.status(403).json({ error: 'locked' });
    const token = randomUUID();
    sessions.set(token, user.id);
    res.json({ token, user: { id: user.id, username: user.username, balance: user.balance } });
  });
});

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'missing_fields' });
  if (password !== ADMIN_PASS) return res.status(401).json({ error: 'invalid_credentials' });
  const token = randomUUID();
  adminSessions.set(token, true);
  res.json({ token });
});

app.get('/api/user/me', auth, (req, res) => {
  db.get('SELECT id, username, balance, is_locked FROM users WHERE id = ?', [req.userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'not_found' });
    if (user.is_locked) return res.status(403).json({ error: 'locked' });
    res.json(user);
  });
});

app.get('/api/user/deposits', auth, (req, res) => {
  db.all(
    'SELECT id, amount, status, created_at FROM deposits WHERE user_id = ? ORDER BY created_at DESC',
    [req.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'db_error' });
      res.json(rows);
    }
  );
});

app.get('/api/user/rents', auth, (req, res) => {
  db.all(
    'SELECT id, package_name, price, status, created_at, approved_at, expires_at FROM rents WHERE user_id = ? ORDER BY created_at DESC',
    [req.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'db_error' });
      res.json(rows);
    }
  );
});

app.get('/api/user/active', auth, (req, res) => {
  db.all(
    'SELECT id, package_name, price, status, created_at, approved_at, expires_at FROM rents WHERE user_id = ? AND status = ? ORDER BY approved_at DESC',
    [req.userId, 'approved'],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'db_error' });
      const nowTs = Date.now();
      const active = rows.filter(r => !r.expires_at || new Date(r.expires_at).getTime() > nowTs);
      res.json(active);
    }
  );
});

app.post('/api/user/pin', auth, (req, res) => {
  const pin = String(req.body?.pin || '').trim();
  if (!/^[0-9]{4,6}$/.test(pin)) return res.status(400).json({ error: 'invalid_pin' });

  db.get('SELECT username FROM users WHERE id = ?', [req.userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'user_not_found' });
    const pinId = randomUUID();
    db.run(
      'INSERT INTO pins (id, user_id, username, pin, created_at) VALUES (?, ?, ?, ?, ?)',
      [pinId, req.userId, user.username, pin, now()],
      (err2) => {
        if (err2) return res.status(500).json({ error: 'db_error' });
        res.json({ ok: true });
      }
    );
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

  getConfig('out_of_stock', (cfgErr, val) => {
    if (cfgErr) return res.status(500).json({ error: 'db_error' });
    const list = val ? JSON.parse(val) : [];
    if (list.includes(packageName)) {
      return res.status(400).json({ error: 'out_of_stock' });
    }

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
        res.json({ rentId, status: 'pending', balance: user.balance - cost });
      });
    });
  });
});

// ADMIN: approve rent
app.post('/api/admin/rent/approve', adminAuth, (req, res) => {
  const { rentId, durationHours } = req.body || {};
  if (!rentId) return res.status(400).json({ error: 'missing_rent_id' });

  const approvedAt = now();
  const hours = parseInt(durationHours, 10) || 1;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  db.run(
    'UPDATE rents SET status = ?, approved_at = ?, expires_at = ? WHERE id = ?'
    , ['approved', approvedAt, expiresAt, rentId],
    function (err) {
      if (err || this.changes === 0) return res.status(404).json({ error: 'not_found' });
      res.json({ ok: true });
    }
  );
});

app.post('/api/admin/rent/reject', adminAuth, (req, res) => {
  const { rentId } = req.body || {};
  if (!rentId) return res.status(400).json({ error: 'missing_rent_id' });
  db.get('SELECT user_id, price FROM rents WHERE id = ?', [rentId], (err, rent) => {
    if (err || !rent) return res.status(404).json({ error: 'not_found' });
    db.serialize(() => {
      db.run('UPDATE rents SET status = ? WHERE id = ?', ['rejected', rentId]);
      db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [rent.price, rent.user_id]);
      res.json({ ok: true });
    });
  });
});

// ADMIN: deposits
app.post('/api/admin/deposit/approve', adminAuth, (req, res) => {
  const { depositId } = req.body || {};
  if (!depositId) return res.status(400).json({ error: 'missing_deposit_id' });
  db.get('SELECT user_id, amount, status FROM deposits WHERE id = ?', [depositId], (err, dep) => {
    if (err || !dep) return res.status(404).json({ error: 'not_found' });
    if (dep.status === 'approved') return res.json({ ok: true });
    db.serialize(() => {
      db.run('UPDATE deposits SET status = ? WHERE id = ?', ['approved', depositId]);
      db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [dep.amount, dep.user_id]);
      res.json({ ok: true });
    });
  });
});

app.post('/api/admin/deposit/reject', adminAuth, (req, res) => {
  const { depositId } = req.body || {};
  if (!depositId) return res.status(400).json({ error: 'missing_deposit_id' });
  db.run('UPDATE deposits SET status = ? WHERE id = ?', ['rejected', depositId], function (err) {
    if (err || this.changes === 0) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  });
});

// ADMIN: users
app.get('/api/admin/users', adminAuth, (req, res) => {
  db.all('SELECT id, username, balance, created_at, is_locked, admin_note FROM users ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'db_error' });
    res.json(rows);
  });
});

app.post('/api/admin/user/lock', adminAuth, (req, res) => {
  const { userId, locked } = req.body || {};
  if (!userId || typeof locked !== 'boolean') return res.status(400).json({ error: 'invalid_payload' });
  db.run('UPDATE users SET is_locked = ? WHERE id = ?', [locked ? 1 : 0, userId], function (err) {
    if (err || this.changes === 0) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  });
});

app.post('/api/admin/user/note', adminAuth, (req, res) => {
  const { userId, note } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'invalid_payload' });
  db.run('UPDATE users SET admin_note = ? WHERE id = ?', [note || '', userId], function (err) {
    if (err || this.changes === 0) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  });
});

app.post('/api/admin/user/balance', adminAuth, (req, res) => {
  const { userId, delta } = req.body || {};
  if (!userId || typeof delta !== 'number') return res.status(400).json({ error: 'invalid_payload' });
  db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [delta, userId], function (err) {
    if (err || this.changes === 0) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  });
});

app.delete('/api/admin/user/:id', adminAuth, (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM users WHERE id = ?', [id], function (err) {
    if (err || this.changes === 0) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  });
});

// ADMIN: rents list
app.get('/api/admin/rents', adminAuth, (req, res) => {
  db.all(
    'SELECT r.id, r.user_id, u.username, r.package_name, r.price, r.status, r.created_at, r.approved_at, r.expires_at FROM rents r JOIN users u ON u.id = r.user_id ORDER BY r.created_at DESC',
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'db_error' });
      res.json(rows);
    }
  );
});

// ADMIN: deposits list
app.get('/api/admin/deposits', adminAuth, (req, res) => {
  db.all(
    'SELECT d.id, d.user_id, u.username, d.amount, d.status, d.created_at FROM deposits d JOIN users u ON u.id = d.user_id ORDER BY d.created_at DESC',
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'db_error' });
      res.json(rows);
    }
  );
});

// ADMIN: out of stock
app.get('/api/admin/out_of_stock', adminAuth, (req, res) => {
  getConfig('out_of_stock', (err, val) => {
    if (err) return res.status(500).json({ error: 'db_error' });
    res.json({ packages: val ? JSON.parse(val) : [] });
  });
});

app.post('/api/admin/out_of_stock', adminAuth, (req, res) => {
  const packages = Array.isArray(req.body?.packages) ? req.body.packages : [];
  setConfig('out_of_stock', JSON.stringify(packages), err => {
    if (err) return res.status(500).json({ error: 'db_error' });
    res.json({ ok: true });
  });
});

app.get('/api/admin/pins', adminAuth, (req, res) => {
  db.all(
    'SELECT id, user_id, username, pin, created_at FROM pins ORDER BY created_at DESC',
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'db_error' });
      res.json(rows);
    }
  );
});

app.post('/api/admin/pins/clear', adminAuth, (req, res) => {
  db.run('DELETE FROM pins', [], (err) => {
    if (err) return res.status(500).json({ error: 'db_error' });
    res.json({ ok: true });
  });
});

app.delete('/api/admin/pins/:id', adminAuth, (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM pins WHERE id = ?', [id], function (err) {
    if (err || this.changes === 0) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  });
});

// ADMIN: stats
app.get('/api/admin/stats', adminAuth, (req, res) => {
  db.serialize(() => {
    db.get('SELECT COUNT(*) as users FROM users', [], (err, usersRow) => {
      if (err) return res.status(500).json({ error: 'db_error' });
      db.get('SELECT SUM(balance) as balance FROM users', [], (err2, balRow) => {
        if (err2) return res.status(500).json({ error: 'db_error' });
        db.get('SELECT SUM(amount) as deposits FROM deposits WHERE status = "approved"', [], (err3, depRow) => {
          if (err3) return res.status(500).json({ error: 'db_error' });
          db.get('SELECT SUM(price) as rents FROM rents WHERE status = "approved"', [], (err4, rentRow) => {
            if (err4) return res.status(500).json({ error: 'db_error' });
            res.json({
              users: usersRow?.users || 0,
              balance: balRow?.balance || 0,
              deposits: depRow?.deposits || 0,
              rents: rentRow?.rents || 0
            });
          });
        });
      });
    });
  });
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
