require('dotenv').config();
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const helmet = require('helmet');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'kebun59.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('Administrator','Manajer Kebun','Staf Inventaris','Kasir')),
  status TEXT NOT NULL DEFAULT 'Aktif' CHECK(status IN ('Aktif','Nonaktif')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS plants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  price INTEGER NOT NULL DEFAULT 0 CHECK(price >= 0),
  location TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('Penjualan','Pembelian')),
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  total INTEGER NOT NULL CHECK(total >= 0),
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const countUsers = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (countUsers === 0) {
  const insertPlant = db.prepare('INSERT INTO plants (name,category,stock,price,location) VALUES (?,?,?,?,?)');
  const seeds = [
    ['Bibit Durian Musang King','Buah',180,45000,'Greenhouse A'],
    ['Monstera Deliciosa','Hias',42,65000,'Area Hias'],
    ['Bibit Alpukat Miki','Buah',95,35000,'Greenhouse B'],
    ['Bibit Kelapa Genjah','Perkebunan',12,28000,'Bedeng 03'],
    ['Aglaonema Red Sumatra','Hias',67,55000,'Area Hias'],
    ['Bibit Cabai Rawit','Sayuran',8,5000,'Bedeng 01']
  ];
  const seedPlants = db.transaction(rows => rows.forEach(row => insertPlant.run(...row)));
  seedPlants(seeds);
  db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES ('businessName','Kebun59'),('businessDesc','Pembibitan dan penjualan tanaman'),('currency','IDR')").run();
}

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(session({
  name: 'kebun59.sid',
  secret: process.env.SESSION_SECRET || 'ganti-secret-ini-sebelum-dipakai-di-jaringan',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'strict', secure: false, maxAge: 8 * 60 * 60 * 1000 }
}));

const roles = ['Administrator','Manajer Kebun','Staf Inventaris','Kasir'];
const requireAuth = (req,res,next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
  const fresh = db.prepare('SELECT id,name,email,role,status FROM users WHERE id=?').get(req.session.user.id);
  if (!fresh || fresh.status !== 'Aktif') {
    return req.session.destroy(() => res.status(401).json({ error: 'Sesi berakhir atau akun nonaktif. Silakan login kembali.' }));
  }
  req.session.user = {id:fresh.id,name:fresh.name,email:fresh.email,role:fresh.role};
  next();
};
const allow = (...allowed) => (req,res,next) => requireAuth(req,res,() => {
  if (!allowed.includes(req.session.user.role)) return res.status(403).json({ error: 'Anda tidak memiliki hak akses.' });
  next();
});
const audit = (req, action, entity, entityId, detail = '') => db.prepare(
  'INSERT INTO audit_logs(user_id,action,entity,entity_id,detail) VALUES (?,?,?,?,?)'
).run(req.session.user?.id || null, action, entity, entityId || null, detail);
const cleanUser = ({id,name,email,role,status,created_at}) => ({id,name,email,role,status,createdAt:created_at});
const validInt = (v,min=0) => Number.isInteger(Number(v)) && Number(v) >= min;

app.get('/api/health', (_req,res) => res.json({ ok:true, app:'Kebun59', database:'SQLite' }));
app.get('/api/setup/status', (_req,res) => res.json({ needsAdmin: db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0 }));
app.post('/api/setup/admin', async (req,res) => {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n !== 0) return res.status(409).json({error:'Administrator sudah dibuat.'});
  const {name,email,password} = req.body || {};
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || typeof password !== 'string' || password.length < 10)
    return res.status(400).json({error:'Isi nama, email valid, dan password minimal 10 karakter.'});
  const hash = await bcrypt.hash(password, 12);
  const result = db.prepare("INSERT INTO users(name,email,password_hash,role,status) VALUES (?,?,?,'Administrator','Aktif')").run(name.trim(),email.trim(),hash);
  req.session.user = {id:Number(result.lastInsertRowid),name:name.trim(),email:email.trim(),role:'Administrator'};
  audit(req,'CREATE','user',Number(result.lastInsertRowid),'Administrator pertama');
  res.status(201).json({user:req.session.user});
});
app.post('/api/auth/login', async (req,res) => {
  const {email,password} = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email || '');
  if (!user || user.status !== 'Aktif' || !(await bcrypt.compare(password || '',user.password_hash)))
    return res.status(401).json({error:'Email atau password salah, atau akun nonaktif.'});
  req.session.regenerate(err => {
    if (err) return res.status(500).json({error:'Tidak dapat membuat sesi.'});
    req.session.user = {id:user.id,name:user.name,email:user.email,role:user.role};
    audit(req,'LOGIN','session',user.id);
    res.json({user:req.session.user});
  });
});
app.post('/api/auth/logout', requireAuth, (req,res) => {
  audit(req,'LOGOUT','session',req.session.user.id);
  req.session.destroy(() => res.clearCookie('kebun59.sid').json({ok:true}));
});
app.get('/api/auth/me', (req,res) => res.json({user:req.session.user || null}));

app.get('/api/dashboard', requireAuth, (req,res) => {
  const stock = db.prepare('SELECT COALESCE(SUM(stock),0) AS total, COUNT(*) AS types, COALESCE(SUM(stock*price),0) AS inventoryValue FROM plants').get();
  const sales = db.prepare("SELECT COALESCE(SUM(total),0) AS total FROM transactions WHERE type='Penjualan'").get().total;
  const purchases = db.prepare("SELECT COALESCE(SUM(total),0) AS total FROM transactions WHERE type='Pembelian'").get().total;
  const activeUsers = db.prepare("SELECT COUNT(*) AS n FROM users WHERE status='Aktif'").get().n;
  const lowStock = db.prepare('SELECT id,name,stock,location FROM plants WHERE stock <= 15 ORDER BY stock ASC').all();
  const recent = db.prepare('SELECT id,date,type,description,quantity,total FROM transactions ORDER BY id DESC LIMIT 8').all();
  res.json({stock:stock.total,types:stock.types,inventoryValue:stock.inventoryValue,sales,purchases,activeUsers,lowStock,recent});
});

app.get('/api/plants', requireAuth, (_req,res) => res.json(db.prepare('SELECT * FROM plants ORDER BY name').all()));
app.post('/api/plants', allow('Administrator','Manajer Kebun','Staf Inventaris'), (req,res) => {
  const {name,category,stock=0,price=0,location=''} = req.body || {};
  if (!name?.trim() || !category?.trim() || !validInt(stock) || !validInt(price)) return res.status(400).json({error:'Data tanaman tidak valid.'});
  const r = db.prepare('INSERT INTO plants(name,category,stock,price,location) VALUES (?,?,?,?,?)').run(name.trim(),category.trim(),Number(stock),Number(price),String(location));
  audit(req,'CREATE','plant',Number(r.lastInsertRowid),name.trim());
  res.status(201).json(db.prepare('SELECT * FROM plants WHERE id=?').get(r.lastInsertRowid));
});
app.put('/api/plants/:id', allow('Administrator','Manajer Kebun','Staf Inventaris'), (req,res) => {
  const {name,category,stock,price,location=''} = req.body || {};
  if (!name?.trim() || !category?.trim() || !validInt(stock) || !validInt(price)) return res.status(400).json({error:'Data tanaman tidak valid.'});
  const r = db.prepare("UPDATE plants SET name=?,category=?,stock=?,price=?,location=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(name.trim(),category.trim(),Number(stock),Number(price),String(location),req.params.id);
  if (!r.changes) return res.status(404).json({error:'Tanaman tidak ditemukan.'});
  audit(req,'UPDATE','plant',Number(req.params.id),name.trim());
  res.json(db.prepare('SELECT * FROM plants WHERE id=?').get(req.params.id));
});
app.delete('/api/plants/:id', allow('Administrator','Manajer Kebun'), (req,res) => {
  const r = db.prepare('DELETE FROM plants WHERE id=?').run(req.params.id);
  if (!r.changes) return res.status(404).json({error:'Tanaman tidak ditemukan.'});
  audit(req,'DELETE','plant',Number(req.params.id));
  res.json({ok:true});
});

app.get('/api/transactions', requireAuth, (_req,res) => res.json(db.prepare('SELECT id,date,type,description,quantity,total,created_by,created_at FROM transactions ORDER BY date DESC,id DESC').all()));
app.post('/api/transactions', allow('Administrator','Manajer Kebun','Kasir'), (req,res) => {
  const {date,type,description,quantity,total} = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !['Penjualan','Pembelian'].includes(type) || !description?.trim() || !validInt(quantity,1) || !validInt(total))
    return res.status(400).json({error:'Data transaksi tidak valid.'});
  const r = db.prepare('INSERT INTO transactions(date,type,description,quantity,total,created_by) VALUES (?,?,?,?,?,?)')
    .run(date,type,description.trim(),Number(quantity),Number(total),req.session.user.id);
  audit(req,'CREATE','transaction',Number(r.lastInsertRowid),type);
  res.status(201).json(db.prepare('SELECT * FROM transactions WHERE id=?').get(r.lastInsertRowid));
});

app.get('/api/users', allow('Administrator','Manajer Kebun'), (_req,res) => res.json(db.prepare('SELECT id,name,email,role,status,created_at FROM users ORDER BY name').all().map(cleanUser)));
app.post('/api/users', allow('Administrator'), async (req,res) => {
  const {name,email,password,role='Staf Inventaris',status='Aktif'} = req.body || {};
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || typeof password !== 'string' || password.length < 10 || !roles.includes(role) || !['Aktif','Nonaktif'].includes(status))
    return res.status(400).json({error:'Periksa nama, email, password (minimal 10 karakter), peran, dan status.'});
  try {
    const hash = await bcrypt.hash(password,12);
    const r = db.prepare('INSERT INTO users(name,email,password_hash,role,status) VALUES (?,?,?,?,?)').run(name.trim(),email.trim(),hash,role,status);
    audit(req,'CREATE','user',Number(r.lastInsertRowid),email);
    res.status(201).json(cleanUser(db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid)));
  } catch { res.status(409).json({error:'Email sudah digunakan.'}); }
});
app.put('/api/users/:id', allow('Administrator'), (req,res) => {
  const {name,email,role,status} = req.body || {};
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || !roles.includes(role) || !['Aktif','Nonaktif'].includes(status))
    return res.status(400).json({error:'Data pengguna tidak valid.'});
  if (Number(req.params.id) === req.session.user.id && (status !== 'Aktif' || role !== 'Administrator')) return res.status(400).json({error:'Anda tidak dapat menonaktifkan atau menurunkan peran akun sendiri.'});
  try {
    const r = db.prepare('UPDATE users SET name=?,email=?,role=?,status=? WHERE id=?').run(name.trim(),email.trim(),role,status,req.params.id);
    if (!r.changes) return res.status(404).json({error:'Pengguna tidak ditemukan.'});
    audit(req,'UPDATE','user',Number(req.params.id),email);
    res.json(cleanUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id)));
  } catch { res.status(409).json({error:'Email sudah digunakan.'}); }
});
app.get('/api/settings', requireAuth, (_req,res) => res.json(Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.value]))));
app.put('/api/settings', allow('Administrator'), (req,res) => {
  const update = db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  for (const key of ['businessName','businessDesc','currency']) if (typeof req.body?.[key] === 'string') update.run(key,req.body[key].slice(0,200));
  audit(req,'UPDATE','settings',null,'Profil usaha');
  res.json(Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.value])));
});
app.get('/api/audit', allow('Administrator'), (_req,res) => res.json(db.prepare(`
  SELECT a.id,a.action,a.entity,a.entity_id,a.detail,a.created_at,u.name AS user_name
  FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200
`).all()));

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req,res,next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.use((err,_req,res,_next) => {
  console.error(err);
  res.status(500).json({error:'Terjadi kesalahan pada server.'});
});
app.listen(PORT, () => console.log(`Kebun59 berjalan di http://localhost:${PORT}`));
