const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const DB_FILE = path.join(__dirname, 'db.json');

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    const empty = { users: [], posts: [], messages: [], comments: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(empty, null, 2), 'utf8');
    return empty;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.users) parsed.users = [];
    if (!parsed.posts) parsed.posts = [];
    if (!parsed.messages) parsed.messages = [];
    if (!parsed.comments) parsed.comments = [];

    // дополняем старые аккаунты новыми полями
    parsed.users = parsed.users.map(u => ({
      ...u,
      friends: Array.isArray(u.friends) ? u.friends : [],
      avatar: typeof u.avatar === 'string' ? u.avatar : '',
      role: u.role || 'user',         // user | admin
      mutedUntil: u.mutedUntil || null,
      lastPostAt: u.lastPostAt || null
    }));

    ensureAdmins(parsed);

    return parsed;
  } catch {
    const empty = { users: [], posts: [], messages: [], comments: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(empty, null, 2), 'utf8');
    return empty;
  }
}


    // гарантируем, что testa acc — админ
    ensureAdmin(parsed);

    return parsed;
  } catch {
    return { users: [], posts: [], messages: [] };
  }
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h.toString();
}

function ensureAdmins(db) {
  const adminLogins = ['testa acc', 'mops']; // сюда можно добавлять новых
  db.users.forEach(u => {
    if (adminLogins.includes(u.login)) {
      u.role = 'admin';
    }
  });
}

function isAdmin(db, login) {
  const u = db.users.find(x => x.login === login);
  return u && u.role === 'admin';
}


app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('atype backend ok');
});

// регистрация
app.post('/api/register', (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ error: 'login and password required' });
  }
  const db = loadDb();
  if (db.users.find(u => u.login === login)) {
    return res.status(400).json({ error: 'user exists' });
  }
  const user = {
    login,
    passHash: simpleHash(password),
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    lastPostAt: null,
    friends: [],
    avatar: '',
    role: 'user',
    mutedUntil: null
  };
  db.users.push(user);
  saveDb(db);
  res.json({ ok: true });
});

// логин
app.post('/api/login', (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ error: 'login and password required' });
  }
  const db = loadDb();
  const user = db.users.find(u => u.login === login);
  if (!user || user.passHash !== simpleHash(password)) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  user.lastLoginAt = new Date().toISOString();
  saveDb(db);
  res.json({ ok: true, login });
});

// обновить аватар (url картинки)
app.post('/api/avatar', (req, res) => {
  const { login, avatar } = req.body;
  if (!login) {
    return res.status(400).json({ error: 'login required' });
  }
  const db = loadDb();
  const user = db.users.find(u => u.login === login);
  if (!user) {
    return res.status(400).json({ error: 'unknown user' });
  }
  user.avatar = typeof avatar === 'string' ? avatar.trim() : '';
  saveDb(db);
  res.json({ ok: true });
});

// КОММЕНТАРИИ
app.post('/api/comments/add', (req, res) => {
  const db = loadDb();
  const { postId, authorLogin, text } = req.body;
  
  if (!postId || !authorLogin || !text) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  
  if (!db.comments) db.comments = [];
  const comment = { id: Date.now(), postId, authorLogin, text, timestamp: new Date().toISOString() };
  db.comments.push(comment);
  saveDb(db);
  res.json(comment);
});

app.get('/api/comments/:postId', (req, res) => {
  const db = loadDb();
  const { postId } = req.params;
  if (!db.comments) db.comments = [];
  const postComments = db.comments.filter(c => c.postId == postId);
  res.json(postComments);
});

app.listen(PORT, () => {
  console.log(`atype backend running on port ${PORT}`);
});
