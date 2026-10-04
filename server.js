// server.js — LearnVault Backend (sql.js edition)
const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { getDB } = require('./db/database');
const fetch = require('node-fetch');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── MULTER ───
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename:    (req, file, cb) => {
    const u = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, u + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

// ─── HELPERS ───
function formatSize(b) {
  if (!b) return '0 KB';
  if (b < 1024) return b + ' B';
  if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
  return (b/(1024*1024)).toFixed(1) + ' MB';
}

function timeAgo(d) {
  if (!d) return '—';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 3600)  return Math.floor(diff/60)   + ' mins ago';
  if (diff < 86400) return Math.floor(diff/3600)  + ' hrs ago';
  if (diff < 172800) return 'Yesterday';
  return new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
}

// Wrap every route so we always await getDB()
function route(fn) {
  return async (req, res) => {
    try {
      const db = await getDB();
      await fn(req, res, db);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  };
}

// ═══════════════════════════════════════════
//  STATS
// ═══════════════════════════════════════════
app.get('/api/stats', route(async (req, res, db) => {
  const userId = req.query.userId || 1;
  const courses   = db.queryOne('SELECT COUNT(*) as c FROM enrollments WHERE user_id=?', [userId]).c;
  const materials = db.queryOne('SELECT COUNT(*) as c FROM materials').c;
  const prog      = db.queryOne('SELECT AVG(progress) as avg FROM enrollments WHERE user_id=?', [userId]);
  const dl        = db.queryOne('SELECT SUM(downloads) as s FROM materials');
  res.json({
    courses,
    materials,
    progress: Math.round(prog?.avg || 0),
    downloads: dl?.s || 0
  });
}));

// ═══════════════════════════════════════════
//  COURSES
// ═══════════════════════════════════════════
app.get('/api/courses', route(async (req, res, db) => {
  const userId = req.query.userId || 1;
  const courses = db.query(`
    SELECT c.*,
      e.progress,
      (SELECT COUNT(*) FROM materials m WHERE m.course_id = c.id) as file_count
    FROM courses c
    LEFT JOIN enrollments e ON e.course_id = c.id AND e.user_id = ?
    ORDER BY c.created_at DESC
  `, [userId]);
  res.json(courses);
}));

app.post('/api/courses', route(async (req, res, db) => {
  const { name, subject, emoji, color, accent, instructor, description } = req.body;
  if (!name || !subject || !instructor) return res.status(400).json({ error: 'Missing required fields' });
  const info = db.execute(
    'INSERT INTO courses (name,subject,emoji,color,accent,instructor,description) VALUES (?,?,?,?,?,?,?)',
    [name, subject, emoji||'📚', color||'#1a2a3a', accent||'#5b8df6', instructor, description||'']
  );
  const course = db.queryOne('SELECT * FROM courses WHERE id=?', [info.lastInsertRowid]);
  res.json(course);
}));

app.delete('/api/courses/:id', route(async (req, res, db) => {
  const id = req.params.id;
  // delete related files from disk
  const mats = db.query('SELECT file_path FROM materials WHERE course_id=?', [id]);
  for (const m of mats) {
    if (m.file_path) {
      const full = path.join(__dirname, m.file_path);
      if (fs.existsSync(full)) fs.unlinkSync(full);
    }
  }
  db.execute('DELETE FROM bookmarks WHERE material_id IN (SELECT id FROM materials WHERE course_id=?)', [id]);
  db.execute('DELETE FROM materials WHERE course_id=?', [id]);
  db.execute('DELETE FROM enrollments WHERE course_id=?', [id]);
  db.execute('DELETE FROM courses WHERE id=?', [id]);
  res.json({ success: true });
}));

// ═══════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════
app.post('/api/auth/register', route(async (req, res, db) => {
  const { name, email, password, role, avatar, dept } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const existing = db.queryOne('SELECT id FROM users WHERE email=?', [email]);
  if (existing) return res.status(400).json({ error: 'An account with this email already exists' });
  // Store password as plain text (no bcrypt dependency needed)
  const info = db.execute(
    'INSERT INTO users (name,email,password_hash,role,avatar,dept) VALUES (?,?,?,?,?,?)',
    [name, email, password, role||'student', avatar||(name.slice(0,2).toUpperCase()), dept||'General']
  );
  const user = db.queryOne('SELECT id,name,email,role,avatar,dept FROM users WHERE id=?', [info.lastInsertRowid]);
  res.json({ user });
}));

app.post('/api/auth/login', route(async (req, res, db) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const user = db.queryOne('SELECT * FROM users WHERE email=?', [email]);
  if (!user) return res.status(401).json({ error: 'No account found with this email' });
  // Check password (plain text comparison OR if no password set, accept 'password123' for demo seeds)
  const valid = user.password_hash ? user.password_hash === password : password === 'password123';
  if (!valid) return res.status(401).json({ error: 'Incorrect password' });
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, dept: user.dept } });
}));

// ═══════════════════════════════════════════
//  ENROLLMENTS
// ═══════════════════════════════════════════
app.post('/api/enroll', route(async (req, res, db) => {
  const { userId, courseId } = req.body;
  db.execute('INSERT OR IGNORE INTO enrollments (user_id,course_id,progress) VALUES (?,?,0)', [userId, courseId]);
  res.json({ success: true });
}));

app.post('/api/progress', route(async (req, res, db) => {
  const { userId, courseId, progress } = req.body;
  const val = Math.max(0, Math.min(100, parseInt(progress)||0));
  db.execute('INSERT OR IGNORE INTO enrollments (user_id,course_id,progress) VALUES (?,?,?)', [userId, courseId, val]);
  db.execute('UPDATE enrollments SET progress=? WHERE user_id=? AND course_id=?', [val, userId, courseId]);
  res.json({ success: true, progress: val });
}));

// ═══════════════════════════════════════════
//  MATERIALS
// ═══════════════════════════════════════════
app.get('/api/materials', route(async (req, res, db) => {
  const { courseId, search } = req.query;
  let sql = `
    SELECT m.*, c.name as course_name, u.name as uploader_name
    FROM materials m
    LEFT JOIN courses c ON c.id = m.course_id
    LEFT JOIN users u ON u.id = m.user_id
  `;
  const params = [];
  const where = [];
  if (courseId) { where.push('m.course_id = ?'); params.push(courseId); }
  if (search)   { where.push('(m.title LIKE ? OR c.name LIKE ?)'); params.push('%'+search+'%','%'+search+'%'); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY m.created_at DESC';
  const rows = db.query(sql, params);
  res.json(rows.map(r => ({ ...r, time_ago: timeAgo(r.created_at) })));
}));

app.post('/api/materials/upload', upload.single('file'), route(async (req, res, db) => {
  const { title, subtitle, courseId, userId, fileType } = req.body;
  const file = req.file;
  if (!title || !courseId) return res.status(400).json({ error: 'Title and course required' });

  const fileName = file ? file.originalname : 'no-file.pdf';
  const filePath = file ? '/uploads/' + file.filename : null;
  const fileSize = file ? formatSize(file.size) : '0 KB';
  const type = fileType || (file ? path.extname(file.originalname).replace('.','').toLowerCase() : 'pdf');

  const info = db.execute(
    'INSERT INTO materials (title,subtitle,course_id,user_id,file_type,file_name,file_path,file_size) VALUES (?,?,?,?,?,?,?,?)',
    [title, subtitle||'', courseId, userId||1, type, fileName, filePath, fileSize]
  );

  const course = db.queryOne('SELECT name FROM courses WHERE id=?', [courseId]);
  db.execute('INSERT INTO activity_log (user_id,action,detail,icon) VALUES (?,?,?,?)',
    [userId||1, 'uploaded', `${title} to ${course?.name||'course'}`, '📤']);

  const material = db.queryOne('SELECT * FROM materials WHERE id=?', [info.lastInsertRowid]);
  res.json(material);
}));

app.delete('/api/materials/:id', route(async (req, res, db) => {
  const mat = db.queryOne('SELECT file_path FROM materials WHERE id=?', [req.params.id]);
  if (mat?.file_path) {
    const full = path.join(__dirname, mat.file_path);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  }
  db.execute('DELETE FROM bookmarks WHERE material_id=?', [req.params.id]);
  db.execute('DELETE FROM materials WHERE id=?', [req.params.id]);
  res.json({ success: true });
}));

app.post('/api/materials/:id/download', route(async (req, res, db) => {
  db.execute('UPDATE materials SET downloads = downloads + 1 WHERE id=?', [req.params.id]);
  const mat = db.queryOne('SELECT downloads FROM materials WHERE id=?', [req.params.id]);
  res.json({ success: true, downloads: mat?.downloads || 0 });
}));

// ═══════════════════════════════════════════
//  BOOKMARKS
// ═══════════════════════════════════════════
app.get('/api/bookmarks', route(async (req, res, db) => {
  const userId = req.query.userId || 1;
  const rows = db.query(`
    SELECT m.*, c.name as course_name, b.created_at as bookmarked_at
    FROM bookmarks b
    JOIN materials m ON m.id = b.material_id
    LEFT JOIN courses c ON c.id = m.course_id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
  `, [userId]);
  res.json(rows.map(r => ({ ...r, time_ago: timeAgo(r.created_at) })));
}));

app.post('/api/bookmarks', route(async (req, res, db) => {
  const { userId, materialId } = req.body;
  const existing = db.queryOne('SELECT id FROM bookmarks WHERE user_id=? AND material_id=?', [userId, materialId]);
  if (existing) {
    db.execute('DELETE FROM bookmarks WHERE user_id=? AND material_id=?', [userId, materialId]);
    db.execute('UPDATE materials SET bookmarked=0 WHERE id=?', [materialId]);
    return res.json({ bookmarked: false });
  }
  db.execute('INSERT INTO bookmarks (user_id,material_id) VALUES (?,?)', [userId, materialId]);
  db.execute('UPDATE materials SET bookmarked=1 WHERE id=?', [materialId]);
  res.json({ bookmarked: true });
}));

// ═══════════════════════════════════════════
//  ACTIVITY
// ═══════════════════════════════════════════
app.get('/api/activity', route(async (req, res, db) => {
  const rows = db.query(`
    SELECT a.*, u.name as user_name
    FROM activity_log a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC LIMIT 20
  `);
  res.json(rows.map(r => ({ ...r, time_ago: timeAgo(r.created_at) })));
}));

// ═══════════════════════════════════════════
//  USERS
// ═══════════════════════════════════════════
app.get('/api/users', route(async (req, res, db) => {
  res.json(db.query('SELECT id,name,email,role,avatar,dept FROM users'));
}));

// ─────────────────────────────────────────────────────────────────
//  AI ASSISTANT
//  POST /api/assist { message, userId }
//  - If OPENAI_API_KEY is set, forward to OpenAI Chat Completions
//  - Otherwise return basic course recommendations from the local DB
// ─────────────────────────────────────────────────────────────────
app.post('/api/assist', route(async (req, res, db) => {
  const { message, userId } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Missing message' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const payload = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are LearnVault assistant. Help users find courses, summarize materials, and provide friendly guidance.' },
          { role: 'user', content: message }
        ],
        max_tokens: 600,
        temperature: 0.7
      };

      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      const reply = data?.choices?.[0]?.message?.content || 'Sorry, I could not get a reply.';
      return res.json({ reply, raw: data });
    } catch (err) {
      console.error('OpenAI error', err);
      // fallthrough to local fallback
    }
  }

  // Local fallback: recommend popular courses and short summaries
  const courses = db.query(`
    SELECT c.id, c.name, c.subject, c.emoji, COUNT(e.id) as enroll_count
    FROM courses c
    LEFT JOIN enrollments e ON e.course_id = c.id
    GROUP BY c.id
    ORDER BY enroll_count DESC, c.created_at DESC
    LIMIT 5
  `);

  const reply = `I don't have an AI key configured. Here are some popular courses you might like:\n\n` +
    courses.map(c => `${c.emoji || ''} ${c.name} — ${c.subject}`).join('\n');

  res.json({ reply, suggestions: courses });
}));

// ─── FRONTEND FALLBACK ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── START ───
function startServer(port) {
  app.listen(port, () => {
    console.log(`\n🚀 LearnVault running at http://localhost:${port}`);
    console.log(`📁 Uploads: ${path.join(__dirname, 'uploads')}`);
    console.log(`🗄️  Database: ${path.join(__dirname, 'db', 'learnvault.db')}\n`);
  }).on('error', err => {
    if (err && err.code === 'EADDRINUSE' && port === 3000) {
      const next = 3001;
      console.warn(`Port ${port} in use; trying ${next} instead.`);
      startServer(next);
    } else {
      console.error('❌ Failed to start:', err);
      process.exit(1);
    }
  });
}

getDB().then(() => startServer(PORT)).catch(err => {
  console.error('❌ Failed to initialize DB:', err);
  process.exit(1);
});
