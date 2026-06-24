import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { createClient } from "@libsql/client";
import { OAuth2Client } from "google-auth-library";
import rateLimit from "express-rate-limit";


dotenv.config();

const moderationStatus = {};
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ==================== RATE LIMITERS ====================

// GENERAL API LIMIT — 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false
});

// AUTH LIMIT — 10 attempts per 15 minutes (prevents brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many login attempts. Please wait 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false
});

// OTP LIMIT — 5 attempts per 10 minutes
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many OTP requests. Please wait 10 minutes." },
  standardHeaders: true,
  legacyHeaders: false
});

// QUESTION SUBMIT LIMIT — 20 questions per 5 minutes per IP
const questionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { success: false, message: "You're submitting questions too fast. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false
});

// POLL VOTE LIMIT — 30 votes per 5 minutes per IP
const voteLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: { success: false, message: "Too many votes. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false
});

// APPLY GENERAL LIMIT TO ALL ROUTES
app.use("/api", generalLimiter);
// TURSO CONNECTION
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// EMAIL TRANSPORTER
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// CLEAN UP EXPIRED EVENTS
async function cleanExpiredEvents() {
  try {
    const nowUTC = new Date().toISOString();
    await db.execute({
      sql: `DELETE FROM events WHERE end_date < ?`,
      args: [nowUTC]
    });
  } catch(e) {}
}
cleanExpiredEvents();
setInterval(cleanExpiredEvents, 60 * 60 * 1000);

// INIT USERS TABLE
async function initDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      verified INTEGER DEFAULT 0,
      verify_token TEXT
    )
  `);
  // OTP TABLE
  await db.execute(`
    CREATE TABLE IF NOT EXISTS otp_store (
      email TEXT PRIMARY KEY,
      otp TEXT,
      password TEXT,
      expires_at INTEGER
    )
  `);
  try { await db.execute(`ALTER TABLE users ADD COLUMN verified INTEGER DEFAULT 0`); } catch(e) {}
  try { await db.execute(`ALTER TABLE users ADD COLUMN verify_token TEXT`); } catch(e) {}
}

// INIT QUESTIONS TABLE
async function initQuestionsDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_code TEXT,
      author TEXT,
      question TEXT,
      likes INTEGER DEFAULT 0,
      priority INTEGER DEFAULT 0,
      answered INTEGER DEFAULT 0,
      pending INTEGER DEFAULT 0
    )
  `);
  try { await db.execute(`ALTER TABLE questions ADD COLUMN priority INTEGER DEFAULT 0`); } catch(e) {}
  try { await db.execute(`ALTER TABLE questions ADD COLUMN answered INTEGER DEFAULT 0`); } catch(e) {}
  try { await db.execute(`ALTER TABLE questions ADD COLUMN pending INTEGER DEFAULT 0`); } catch(e) {}
}

// INIT POLLS TABLE
async function initPollsDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS polls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_code TEXT,
      type TEXT,
      question TEXT,
      options TEXT,
      votes TEXT DEFAULT '{}',
      active INTEGER DEFAULT 0
    )
  `);
  try { await db.execute(`ALTER TABLE polls ADD COLUMN votes TEXT DEFAULT '{}'`); } catch(e) {}
  try { await db.execute(`ALTER TABLE polls ADD COLUMN active INTEGER DEFAULT 0`); } catch(e) {}
}

// INIT EVENTS TABLE
async function initEventsDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      code TEXT UNIQUE,
      start_date TEXT,
      end_date TEXT,
      user_id INTEGER
    )
  `);
}

initDB();
initQuestionsDB();
initPollsDB();
initEventsDB();

// OFFENSIVE WORDS FILTER
const offensiveWords = [
  "fuck", "shit", "bitch", "asshole", "bastard", "crap",
  "dick", "pussy", "cock", "whore", "slut", "nigger", "nigga",
  "faggot", "retard", "rape", "kill", "murder", "terrorist",
  "bomb", "porn", "nude", "naked", "sex", "hate", "racist"
];
function containsOffensiveWord(text) {
  const lower = text.toLowerCase();
  return offensiveWords.some(word => lower.includes(word));
}

// ==================== INPUT SANITIZATION ====================
// Simple sanitizer — no external deps needed

function sanitize(input) {
  if(typeof input !== "string") return "";
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .trim()
    .substring(0, 1000);
}

function sanitizeEmail(email) {
  if(typeof email !== "string") return "";
  return email.trim().toLowerCase().substring(0, 255);
}

function sanitizeShort(input, maxLen = 300) {
  if(typeof input !== "string") return "";
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .trim()
    .substring(0, maxLen);
}

function sanitizeShort(input, maxLen = 300) {
  if(typeof input !== "string") return "";
  const clean = DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return clean.trim().substring(0, maxLen);
}
// ==================== AUTH MIDDLEWARE ====================

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if(!token) {
    return res.status(401).json({ success: false, message: "Access denied. Please login." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id: userId }
    next();
  } catch(err) {
    return res.status(403).json({ success: false, message: "Invalid or expired session. Please login again." });
  }
}
// ==================== AUTH ROUTES ====================
// SEND OTP
app.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    const email = sanitizeEmail(req.body.email);
    const password = req.body.password;

    if(!email || !password) {
      return res.json({ success: false, message: "Email and password are required" });
    }
    if(password.length < 6 || password.length > 100) {
      return res.json({ success: false, message: "Password must be between 6 and 100 characters" });
    }

    const existing = await db.execute({
      sql: `SELECT id FROM users WHERE email = ?`,
      args: [email]
    });
    if(existing.rows.length > 0) {
      return res.json({ success: false, message: "An account with this email already exists" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    await db.execute({
      sql: `INSERT OR REPLACE INTO otp_store (email, otp, password, expires_at) VALUES (?, ?, ?, ?)`,
      args: [email, otp, password, expiresAt]
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your AskLive verification code",
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:30px;background:#0f172a;color:white;border-radius:16px;">
          <h1 style="color:#38bdf8;">AskLive</h1>
          <h2>Your verification code</h2>
          <p style="color:#94a3b8;">Enter this code to verify your email:</p>
          <div style="background:#1e293b;border-radius:12px;padding:24px;text-align:center;margin:20px 0;">
            <span style="font-size:42px;font-weight:700;letter-spacing:12px;color:#38bdf8;">${otp}</span>
          </div>
          <p style="color:#64748b;font-size:13px;">Expires in 10 minutes.</p>
        </div>
      `
    });

    res.json({ success: true, message: "OTP sent" });
  } catch(err) {
    console.error("send-otp error:", err.message);
    res.status(500).json({ success: false, message: "Failed to send verification code. Try again." });
  }
});

// VERIFY OTP
app.post("/verify-otp", otpLimiter, async (req, res) => {
  try {
    const email = sanitizeEmail(req.body.email);
    const otp = sanitizeShort(req.body.otp, 6);
    const password = req.body.password;

    const stored = await db.execute({
      sql: `SELECT * FROM otp_store WHERE email = ?`,
      args: [email]
    });

    if(stored.rows.length === 0) {
      return res.json({ success: false, message: "No verification code found. Please request a new one." });
    }

    const record = stored.rows[0];

    if(Date.now() > Number(record.expires_at)) {
      await db.execute({ sql: `DELETE FROM otp_store WHERE email = ?`, args: [email] });
      return res.json({ success: false, message: "Code has expired. Please request a new one." });
    }

    if(record.otp !== otp) {
      return res.json({ success: false, message: "Incorrect code. Please try again." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.execute({
      sql: `INSERT INTO users(email, password, verified) VALUES (?, ?, 1)`,
      args: [email, hashedPassword]
    });

    await db.execute({ sql: `DELETE FROM otp_store WHERE email = ?`, args: [email] });

    res.json({ success: true, message: "Account created successfully!" });
  } catch(err) {
    console.error("verify-otp error:", err.message);
    res.status(500).json({ success: false, message: "Something went wrong. Try again." });
  }
});

// LOGIN
app.post("/login", authLimiter, async (req, res) => {
  try {
    const email = sanitizeEmail(req.body.email);
    const password = req.body.password;

    if(!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const result = await db.execute({
      sql: `SELECT * FROM users WHERE email = ?`,
      args: [email]
    });

    const user = result.rows[0];
    if(!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }
    if(!user.verified) {
      return res.status(400).json({ success: false, message: "Please verify your email before logging in." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if(!isMatch) {
      return res.status(400).json({ success: false, message: "Wrong password" });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, token });
  } catch(err) {
    console.error("login error:", err.message);
    res.status(500).json({ success: false, message: "Login failed. Try again." });
  }
});

// GOOGLE AUTH
app.post("/auth/google", authLimiter, async (req, res) => {
  try {
    const email = sanitizeEmail(req.body.email);
    const name = sanitizeShort(req.body.name || "", 100);
    const picture = sanitizeShort(req.body.picture || "", 500);

    if(!email) {
      return res.status(400).json({ success: false, message: "Invalid Google account" });
    }

    let result = await db.execute({
      sql: `SELECT * FROM users WHERE email = ?`, args: [email]
    });

    if(result.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO users (email, password, verified) VALUES (?, ?, 1)`,
        args: [email, "GOOGLE_AUTH"]
      });
      result = await db.execute({
        sql: `SELECT * FROM users WHERE email = ?`, args: [email]
      });
    }

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, token, email, name, picture });
  } catch(err) {
    console.error("google-auth error:", err.message);
    res.status(500).json({ success: false, message: "Google auth failed. Try again." });
  }
});

// ==================== EVENT ROUTES ====================

// CREATE EVENT — protected route
app.post("/create-event", verifyToken, async (req, res) => {
  try {
    const name = sanitizeShort(req.body.name, 100);
    const code = sanitizeShort(req.body.code, 10).toUpperCase();
    const start_date = req.body.start_date;
    const end_date = req.body.end_date;
    const user_id = req.user.id; // FROM TOKEN — not from body

    if(!name || !code || !start_date || !end_date) {
      return res.json({ success: false, message: "All fields are required" });
    }

    const nowUTC = new Date().toISOString();

    const nameCheck = await db.execute({
      sql: `SELECT id FROM events WHERE UPPER(name) = UPPER(?) AND end_date > ?`,
      args: [name, nowUTC]
    });
    if(nameCheck.rows.length > 0) {
      return res.json({ success: false, message: "An event with this name already exists" });
    }

    const codeCheck = await db.execute({
      sql: `SELECT id FROM events WHERE UPPER(code) = UPPER(?) AND end_date > ?`,
      args: [code, nowUTC]
    });
    if(codeCheck.rows.length > 0) {
      return res.json({ success: false, message: "This session code is already taken" });
    }

    await db.execute({
      sql: `INSERT INTO events (name, code, start_date, end_date, user_id) VALUES (?, ?, ?, ?, ?)`,
      args: [name, code, start_date, end_date, user_id]
    });

    res.json({ success: true, message: "Event created" });
  } catch(err) {
    console.error("create-event error:", err.message);
    res.status(500).json({ success: false, message: "Failed to create event. Try again." });
  }
});

// GET EVENTS — protected route
app.get("/events", verifyToken, async (req, res) => {
  try {
    const nowUTC = new Date().toISOString();
    const result = await db.execute({
      sql: `SELECT * FROM events WHERE end_date > ? AND code != 'DEMO123' AND user_id = ?`,
      args: [nowUTC, req.user.id]
    });
    res.json({ success: true, events: result.rows });
  } catch(err) {
    console.error("get-events error:", err.message);
    res.status(500).json({ success: false, message: "Failed to load events." });
  }
});

app.get("/events/moderation/:code", (req, res) => {
  const { code } = req.params;
  res.json({ moderation: moderationStatus[code] || false });
});

app.post("/events/moderation/:code", (req, res) => {
  const { code } = req.params;
  const { enabled } = req.body;
  moderationStatus[code] = enabled;
  res.json({ success: true });
});

app.get("/events/code/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const result = await db.execute({
      sql: `SELECT * FROM events WHERE UPPER(code) = UPPER(?)`,
      args: [code]
    });
    if(result.rows.length === 0) {
      return res.json({ success: false, message: "Oops! We couldn't find a session with that code. Please double-check and try again." });
    }
    const event = result.rows[0];
    const now = new Date().toISOString();
    if(event.end_date < now) {
      return res.json({ success: false, message: "This session has ended. The event you're trying to join is no longer active." });
    }
    if(event.start_date > now) {
      return res.json({ success: false, message: "This session hasn't started yet. Please check back at the scheduled time." });
    }
    res.json({ success: true, event });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== QUESTION ROUTES ====================

app.get("/questions/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const result = await db.execute({
      sql: `SELECT * FROM questions WHERE event_code = ? AND COALESCE(answered,0)=0 AND COALESCE(pending,0)=0 ORDER BY COALESCE(priority,0) DESC, likes DESC`,
      args: [code]
    });
    res.json({ success: true, questions: result.rows });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== QUESTION ROUTES ====================

// ADD QUESTION — rate limited
app.post("/questions", questionLimiter, async (req, res) => {
  try {
    const event_code = sanitizeShort(req.body.event_code, 10);
    const author = sanitizeShort(req.body.author || "Anonymous", 50);
    const question = sanitizeShort(req.body.question, 280); // 280 char limit
    const pending = req.body.pending || 0;

    if(!event_code || !question) {
      return res.json({ success: false, message: "Question and event code are required" });
    }

    if(question.length < 3) {
      return res.json({ success: false, message: "Question is too short" });
    }

    if(containsOffensiveWord(question)) {
      return res.json({
        success: false,
        blocked: true,
        message: "Your question contains inappropriate content and was not submitted."
      });
    }

    await db.execute({
      sql: `INSERT INTO questions (event_code, author, question, pending) VALUES (?, ?, ?, ?)`,
      args: [event_code, author, question, pending]
    });

    res.json({ success: true });
  } catch(err) {
    console.error("add-question error:", err.message);
    res.status(500).json({ success: false, message: "Failed to submit question. Try again." });
  }
});

app.post("/questions/:id/like", async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute({ sql: `UPDATE questions SET likes = likes + 1 WHERE id = ?`, args: [id] });
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/questions/:id/prioritize", async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute({ sql: `UPDATE questions SET priority = 1 WHERE id = ?`, args: [id] });
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/questions/:id/answer", async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute({ sql: `UPDATE questions SET answered = 1 WHERE id = ?`, args: [id] });
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/questions/:code/pending", async (req, res) => {
  try {
    const { code } = req.params;
    const result = await db.execute({
      sql: `SELECT * FROM questions WHERE event_code = ? AND pending = 1 ORDER BY id DESC`,
      args: [code]
    });
    res.json({ success: true, questions: result.rows });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/questions/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute({ sql: `UPDATE questions SET pending = 0 WHERE id = ?`, args: [id] });
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/questions/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute({ sql: `UPDATE questions SET answered = 1, pending = 0 WHERE id = ?`, args: [id] });
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== POLL ROUTES ====================

app.post("/polls", async (req, res) => {
  try {
    const { event_code, type, question, options } = req.body;
    await db.execute({
      sql: `INSERT INTO polls (event_code, type, question, options) VALUES (?, ?, ?, ?)`,
      args: [event_code, type, question, JSON.stringify(options || [])]
    });
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/polls/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const result = await db.execute({
      sql: `SELECT * FROM polls WHERE event_code = ?`,
      args: [code]
    });
    res.json({ success: true, polls: result.rows });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/polls/:id/activate", async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    await db.execute({ sql: `UPDATE polls SET active = ? WHERE id = ?`, args: [active, id] });
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/polls/:id/results", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute({ sql: `SELECT * FROM polls WHERE id = ?`, args: [id] });
    res.json({ success: true, poll: result.rows[0] });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// VOTE ON POLL — rate limited
app.post("/polls/:id/vote", voteLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const answer = sanitizeShort(req.body.answer, 200);

    if(!answer) {
      return res.json({ success: false, message: "Answer is required" });
    }

    const result = await db.execute({
      sql: `SELECT votes FROM polls WHERE id = ?`, args: [id]
    });

    if(result.rows.length === 0) {
      return res.json({ success: false, message: "Poll not found" });
    }

    const votes = JSON.parse(result.rows[0].votes || "{}");
    votes[answer] = (votes[answer] || 0) + 1;

    await db.execute({
      sql: `UPDATE polls SET votes = ? WHERE id = ?`,
      args: [JSON.stringify(votes), id]
    });

    res.json({ success: true });
  } catch(err) {
    console.error("vote error:", err.message);
    res.status(500).json({ success: false, message: "Failed to submit vote. Try again." });
  }
});

// ==================== START SERVER ====================

app.listen(3000, () => {
  console.log("Server Running on Port 3000");
});