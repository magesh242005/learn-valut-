const fs = require('fs');
const path = require('path');

// Path to the sqlite file used by the app
const DB_PATH = path.join(__dirname, '..', 'db', 'learnvault.db');

async function reset() {
  try {
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
      console.log('Removed existing database:', DB_PATH);
    } else {
      console.log('No existing database found, creating new one.');
    }

    // Initialize DB which will recreate and seed it
    const { getDB } = require('../db/database');
    await getDB();
    console.log('✅ Database created and seeded at', DB_PATH);
  } catch (err) {
    console.error('Failed to reset database:', err);
    process.exitCode = 1;
  }
}

reset();
