# 🎓 LearnVault – Online Course Material Sharing Platform

A full-stack local web app with Node.js backend + SQLite database.

---

## ⚡ Quick Start (Mac)

### Step 1 — Open Terminal
Press `Cmd + Space`, type `Terminal`, press Enter.

### Step 2 — Go to the project folder
```bash
cd ~/Downloads/learnvault
```
*(adjust path if you unzipped it elsewhere)*

### Step 3 — Run the startup script
```bash
chmod +x start.sh
./start.sh
```

The browser will open automatically at **http://localhost:3000** 🎉

---

## 📁 Project Structure

```
learnvault/
├── server.js          ← Express backend with all API routes
├── package.json       ← Node.js dependencies
├── start.sh           ← One-click startup script
├── db/
│   ├── database.js    ← SQLite setup & seeding
│   └── learnvault.db  ← Auto-created database file
├── public/
│   └── index.html     ← Frontend UI
└── uploads/           ← Uploaded files stored here
```

---

## 🗄️ Database (SQLite)

Tables created automatically:
| Table | Description |
|---|---|
| `users` | Registered users (students/instructors) |
| `courses` | Course catalog |
| `enrollments` | User ↔ Course mapping with progress |
| `materials` | Uploaded files metadata |
| `bookmarks` | User bookmarks |
| `activity_log` | Recent actions feed |

---

## 🔌 API Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/courses` | List courses |
| POST | `/api/courses` | Create course |
| DELETE | `/api/courses/:id` | Delete course |
| GET | `/api/materials` | List materials (filterable) |
| POST | `/api/materials/upload` | Upload material + file |
| DELETE | `/api/materials/:id` | Delete material |
| POST | `/api/materials/:id/download` | Increment download count |
| GET | `/api/bookmarks` | List bookmarks |
| POST | `/api/bookmarks` | Toggle bookmark |
| GET | `/api/activity` | Activity feed |

---

## 🛠 Requirements
- **Node.js** v16+ — https://nodejs.org
- **macOS** (or Linux/Windows with minor adjustments)

---

## 💡 Features
- ✅ Upload real files (PDF, DOCX, MP4, ZIP, PPT, PNG…)
- ✅ SQLite database — all data persists between sessions
- ✅ Course creation and management
- ✅ Material search, download, bookmark, delete
- ✅ Activity feed
- ✅ Progress tracking per course
- ✅ Auto-seeded with sample data on first run
