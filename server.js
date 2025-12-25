const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const DB_FILE = path.join(__dirname, 'db.json');

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    return { users: [], posts: [] };
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { users: [], posts: [] };
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
    status: ''
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

app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
