const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  // inside Docker network Postgres listens on 5432; allow override via DB_PORT env
  port: process.env.DB_PORT || 5432,
});

// Ensure DB schema supports a page field and is ready
(async function ensureDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        page INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // In case table was created earlier without `page` column
    await pool.query("ALTER TABLE notes ADD COLUMN IF NOT EXISTS page INTEGER");
    console.log("DB ready");
  } catch (err) {
    console.error("DB initialization error", err);
    process.exit(1);
  }
})();

// Save a note for a given page (simulates turning the page)
app.post("/notes", async (req, res) => {
  try {
    const { content, page } = req.body;
    await pool.query("INSERT INTO notes (content, page) VALUES ($1, $2)", [
      content,
      page,
    ]);
    res.status(201).json({ message: "Note saved" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Get latest note for a page
app.get("/notes/:page", async (req, res) => {
  try {
    const { page } = req.params;
    const result = await pool.query(
      "SELECT content FROM notes WHERE page = $1 ORDER BY created_at DESC LIMIT 1",
      [page]
    );
    res.json({ content: result.rows[0]?.content || "" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Get total count of notes (optional stats)
app.get("/stats", async (req, res) => {
  const result = await pool.query("SELECT COUNT(*) FROM notes");
  res.json({ count: result.rows[0].count });
});

app.listen(process.env.PORT || 5000, () =>
  console.log("API running on port " + (process.env.PORT || 5000))
);
