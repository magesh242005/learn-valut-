// db/database.js — SQLite via sql.js (pure JavaScript, no native compilation)
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'learnvault.db');

async function initDB() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  let data = null;
  if (fs.existsSync(DB_PATH)) {
    data = fs.readFileSync(DB_PATH);
  }

  const db = data ? new SQL.Database(data) : new SQL.Database();

  // Save db to disk after every write
  db.save = () => {
    const buf = db.export();
    fs.writeFileSync(DB_PATH, buf);
  };

  // Query: returns array of row objects
  db.query = (sql, params = []) => {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  };

  // Query one row
  db.queryOne = (sql, params = []) => db.query(sql, params)[0] || null;

  // Execute write + return lastInsertRowid
  db.execute = (sql, params = []) => {
    db.run(sql, params);
    const row = db.queryOne('SELECT last_insert_rowid() as id');
    db.save();
    return { lastInsertRowid: row ? row.id : null };
  };

  // ─── SCHEMA ───
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL,
      email     TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      role      TEXT DEFAULT 'student',
      avatar    TEXT DEFAULT 'AK',
      dept      TEXT DEFAULT 'CS Dept.',
      created_at DATETIME DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS courses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      subject     TEXT NOT NULL,
      emoji       TEXT DEFAULT '📚',
      color       TEXT DEFAULT '#1a2a3a',
      accent      TEXT DEFAULT '#5b8df6',
      instructor  TEXT NOT NULL,
      description TEXT,
      created_at  DATETIME DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS enrollments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER,
      course_id   INTEGER,
      progress    INTEGER DEFAULT 0,
      enrolled_at DATETIME DEFAULT (datetime('now')),
      UNIQUE(user_id, course_id)
    );
    CREATE TABLE IF NOT EXISTS materials (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      subtitle    TEXT,
      course_id   INTEGER,
      user_id     INTEGER,
      file_type   TEXT NOT NULL,
      file_name   TEXT NOT NULL,
      file_path   TEXT,
      file_size   TEXT DEFAULT '0 KB',
      downloads   INTEGER DEFAULT 0,
      bookmarked  INTEGER DEFAULT 0,
      created_at  DATETIME DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS bookmarks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER,
      material_id INTEGER,
      created_at  DATETIME DEFAULT (datetime('now')),
      UNIQUE(user_id, material_id)
    );
    CREATE TABLE IF NOT EXISTS activity_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER,
      action      TEXT NOT NULL,
      detail      TEXT,
      icon        TEXT DEFAULT '📌',
      created_at  DATETIME DEFAULT (datetime('now'))
    );
  `);
  db.save();

  // ─── SEED ───
  const userCount = db.queryOne('SELECT COUNT(*) as c FROM users').c;
  if (userCount === 0) {
    const u1 = db.execute('INSERT INTO users (name,email,role,avatar,dept) VALUES (?,?,?,?,?)',
      ['Arjun Kumar','arjun@learnvault.app','student','AK','CS Dept.']).lastInsertRowid;
    const u2 = db.execute('INSERT INTO users (name,email,role,avatar,dept) VALUES (?,?,?,?,?)',
      ['Priya Sharma','priya@learnvault.app','instructor','PS','AI Dept.']).lastInsertRowid;

    const c1 = db.execute('INSERT INTO courses (name,subject,emoji,color,accent,instructor,description) VALUES (?,?,?,?,?,?,?)',
      ['Data Structures & Algorithms','Computer Science','🌳','#1a2a3a','#5b8df6','Dr. Ramesh Iyer','Core CS fundamentals.']).lastInsertRowid;
    const c2 = db.execute('INSERT INTO courses (name,subject,emoji,color,accent,instructor,description) VALUES (?,?,?,?,?,?,?)',
      ['Machine Learning','AI & Data Science','🤖','#1a2230','#3ecf8e','Prof. Ananya Nair','ML from regression to deep learning.']).lastInsertRowid;
    const c3 = db.execute('INSERT INTO courses (name,subject,emoji,color,accent,instructor,description) VALUES (?,?,?,?,?,?,?)',
      ['Web Development','Software Engineering','🌐','#211828','#c084fc','Dr. Vikram Sharma','Full-stack with modern frameworks.']).lastInsertRowid;
    const c4 = db.execute('INSERT INTO courses (name,subject,emoji,color,accent,instructor,description) VALUES (?,?,?,?,?,?,?)',
      ['Computer Networks','Systems','🔗','#1e1e10','#f0b429','Prof. Sujata Bhat','Protocols and security.']).lastInsertRowid;

    for (const [uid,cid,prog] of [[u1,c1,72],[u1,c2,88],[u1,c3,100],[u1,c4,45]])
      db.execute('INSERT OR IGNORE INTO enrollments (user_id,course_id,progress) VALUES (?,?,?)',[uid,cid,prog]);

    const mats = [
      ['Week 7 Lecture Notes','Sorting Algorithms Deep Dive',c1,u2,'pdf','week7_notes.pdf','2.4 MB',34],
      ['Neural Network Tutorial','Backpropagation Explained',c2,u2,'video','nn_tutorial.mp4','480 MB',21],
      ['Assignment 3 — Trees','Due: Apr 10',c1,u1,'doc','assignment3.docx','340 KB',8],
      ['HTTP Protocol Guide','Full reference PDF',c4,u2,'pdf','http_guide.pdf','5.1 MB',56],
      ['Final Project Resources','Assets & boilerplate',c3,u1,'zip','project_assets.zip','12 MB',19],
      ['Slides — Convolutional Nets','CNN architecture overview',c2,u2,'ppt','cnn_slides.pptx','8.7 MB',43],
      // Additional seeded materials
      ['Graph Algorithms Reference','Cheatsheet: BFS, DFS, Dijkstra',c1,u2,'pdf','graph_cheatsheet.pdf','1.1 MB',12],
      ['Sorting Visualizer Code','Interactive JS visualizer',c1,u2,'zip','sort_visualizer.zip','2.6 MB',9],
      ['ML Dataset — Cats vs Dogs','Sample dataset subset',c2,u2,'zip','cats_dogs_sample.zip','220 MB',31],
      ['CNN Lab Notebook','Experiments and notes',c2,u1,'doc','cnn_lab_notes.docx','560 KB',6],
      ['Web Starter Kit','Boilerplate for projects',c3,u1,'zip','web_starter.zip','1.8 MB',27],
      ['React Hooks Guide','Practical patterns',c3,u2,'pdf','react_hooks.pdf','900 KB',18],
      ['Network Lab — Packet Capture','PCAP traces and analysis',c4,u2,'zip','network_lab_pcaps.zip','45 MB',14],
      ['Security Checklist','Secure coding practices',c4,u2,'pdf','security_checklist.pdf','420 KB',7],
      ['Final Project Demo','Video walkthrough',c3,u1,'video','final_demo.mp4','120 MB',52],
    ];
    for (const m of mats)
      db.execute('INSERT INTO materials (title,subtitle,course_id,user_id,file_type,file_name,file_size,downloads) VALUES (?,?,?,?,?,?,?,?)', m);

    const acts = [
      [u1,'uploaded','Week 7 Lecture Notes to DSA','📤'],
      [u2,'commented','Priya S. commented on your ML notes','💬'],
      [u1,'download','Assignment 3 downloaded 8 times today','⬇️'],
      [u2,'added','New material added to Computer Networks','🔔'],
      [u1,'completed','You completed Web Development course!','✅'],
    ];
    for (const a of acts)
      db.execute('INSERT INTO activity_log (user_id,action,detail,icon) VALUES (?,?,?,?)', a);

    console.log('✅ Database seeded with sample data.');
  }

  return db;
}

let dbPromise = null;
function getDB() {
  if (!dbPromise) dbPromise = initDB();
  return dbPromise;
}

module.exports = { getDB };
