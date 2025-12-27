const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

if (!process.env.JWT_SECRET) {
  console.warn(
    "Warning: JWT_SECRET not set. Set it in environment for production."
  );
}

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Ensure DB schema supports users and page/user_id fields
(async function ensureDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        page INTEGER,
        user_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query("ALTER TABLE notes ADD COLUMN IF NOT EXISTS page INTEGER");
    await pool.query(
      "ALTER TABLE notes ADD COLUMN IF NOT EXISTS user_id INTEGER"
    );

    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'notes_user_fk'
        ) THEN
          ALTER TABLE notes
          ADD CONSTRAINT notes_user_fk FOREIGN KEY (user_id) REFERENCES users(id);
        END IF;
      END
      $$;
    `);

    console.log("DB ready");
  } catch (err) {
    console.error("DB initialization error", err);
    process.exit(1);
  }
})();

// Simple JWT auth middleware
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth)
    return res.status(401).json({ error: "Missing Authorization header" });
  const parts = auth.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer")
    return res.status(401).json({ error: "Malformed Authorization header" });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    req.user = { id: payload.id };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Register
app.post("/auth/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "username and password required" });
    const hash = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username",
      [username, hash]
    );
    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "7d" }
    );
    res.status(201).json({ token, username: user.username });
  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ error: "username already exists" });
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query(
      "SELECT id, password_hash FROM users WHERE username = $1",
      [username]
    );
    if (!result.rows.length)
      return res.status(401).json({ error: "Invalid credentials" });
    const user = result.rows[0];
    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "7d" }
    );
    res.json({ token, username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Save a note for a given page (user-scoped)
app.post("/notes", authMiddleware, async (req, res) => {
  try {
    const { content, page } = req.body;
    const userId = req.user.id;
    await pool.query(
      "INSERT INTO notes (content, page, user_id) VALUES ($1, $2, $3)",
      [content, page, userId]
    );
    res.status(201).json({ message: "Note saved" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Get latest note for a page for the authenticated user
app.get("/notes/:page", authMiddleware, async (req, res) => {
  try {
    const { page } = req.params;
    const userId = req.user.id;
    const result = await pool.query(
      "SELECT content FROM notes WHERE page = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1",
      [page, userId]
    );
    res.json({ content: result.rows[0]?.content || "" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Get total count of notes for the user
app.get("/stats", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const result = await pool.query(
    "SELECT COUNT(*) FROM notes WHERE user_id = $1",
    [userId]
  );
  res.json({ count: result.rows[0].count });
});

app.listen(process.env.PORT || 5000, () =>
  console.log("API running on port " + (process.env.PORT || 5000))
);
