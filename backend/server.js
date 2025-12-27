const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: 5432,
});

// Initialize DB Tables
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        page INTEGER,
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Database initialized successfully");
  } catch (err) {
    console.error("Database init error:", err);
  }
};
initDB();

// Middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// --- ROUTES ---

// Register
app.post("/auth/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send("Missing fields");

  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username",
      [username, hash]
    );
    const token = jwt.sign({ id: result.rows[0].id }, process.env.JWT_SECRET || "secret");
    res.json({ token, username: result.rows[0].username });
  } catch (err) {
    res.status(500).json({ error: "User likely already exists" });
  }
});

// Login
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    const user = result.rows[0];

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || "secret");
    res.json({ token, username: user.username });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

// Save Note
app.post("/notes", authenticate, async (req, res) => {
  const { content, page } = req.body;
  try {
    await pool.query(
      "INSERT INTO notes (content, page, user_id) VALUES ($1, $2, $3)",
      [content, page, req.userId]
    );
    res.json({ message: "Saved" });
  } catch (err) {
    res.status(500).send("Error saving");
  }
});

// Get Note
app.get("/notes/:page", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT content FROM notes WHERE page = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1",
      [req.params.page, req.userId]
    );
    res.json({ content: result.rows[0]?.content || "" });
  } catch (err) {
    res.status(500).send("Error loading");
  }
});

app.listen(5000, () => console.log("Backend running on port 5000"));