const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const DB_FILE = path.join(__dirname, 'db.json');

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    return { users: [], posts: [], messages: [] };
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    // защита, если старый формат без messages
    if (!parsed.users) parsed.users = [];
    if (!parsed.posts) parsed.posts = [];
    if (!parsed.messages) parsed.messages = [];
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
    lastLoginAt: null
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

// получить посты (все или по author)
app.get('/api/posts', (req, res) => {
  const author = req.query.author;
  const db = loadDb();
  let posts = db.posts;
  if (author) {
    posts = posts.filter(p => p.author === author);
  }
  res.json(posts);
});

// создать пост
app.post('/api/posts', (req, res) => {
  const { author, text } = req.body;
  if (!author || !text) {
    return res.status(400).json({ error: 'author and text required' });
  }
  const db = loadDb();
  const user = db.users.find(u => u.login === author);
  if (!user) {
    return res.status(400).json({ error: 'unknown author' });
  }
  const post = {
    id: Date.now().toString(),
    author,
    text,
    time: new Date().toISOString()
  };
  db.posts.push(post);
  saveDb(db);
  res.json({ ok: true, post });
});

// получить список собеседников для пользователя (по сообщениям)
app.get('/api/dialogs', (req, res) => {
  const user = req.query.user;
  if (!user) {
    return res.status(400).json({ error: 'user required' });
  }
  const db = loadDb();
  const partners = new Set();
  db.messages.forEach(m => {
    if (m.from === user) partners.add(m.to);
    if (m.to === user) partners.add(m.from);
  });
  res.json(Array.from(partners));
});

// получить сообщения между двумя пользователями
app.get('/api/messages', (req, res) => {
  const user = req.query.user;
  const withUser = req.query.with;
  if (!user || !withUser) {
    return res.status(400).json({ error: 'user and with required' });
  }
  const db = loadDb();
  const msgs = db.messages
    .filter(m =>
      (m.from === user && m.to === withUser) ||
      (m.from === withUser && m.to === user)
    )
    .sort((a, b) => new Date(a.time) - new Date(b.time));
  res.json(msgs);
});

// отправить сообщение
app.post('/api/messages', (req, res) => {
  const { from, to, text } = req.body;
  if (!from || !to || !text) {
    return res.status(400).json({ error: 'from, to and text required' });
  }
  const db = loadDb();
  const fromUser = db.users.find(u => u.login === from);
  const toUser = db.users.find(u => u.login === to);
  if (!fromUser || !toUser) {
    return res.status(400).json({ error: 'unknown user' });
  }
  const msg = {
    id: Date.now().toString(),
    from,
    to,
    text,
    time: new Date().toISOString()
  };
  db.messages.push(msg);
  saveDb(db);
  res.json({ ok: true, message: msg });
});

app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
