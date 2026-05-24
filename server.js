import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createClient } from "@libsql/client";
import { OAuth2Client } from "google-auth-library";

dotenv.config();
const moderationStatus = {};
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

console.log(process.env.TURSO_DATABASE_URL);
console.log(process.env.TURSO_AUTH_TOKEN);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));


// TURSO CONNECTION

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// CLEAN UP EXPIRED EVENTS ON START
async function cleanExpiredEvents() {
  try {
    const nowUTC = new Date().toISOString();
    await db.execute({
      sql: `DELETE FROM events WHERE end_date < ?`,
      args: [nowUTC]
    });
    console.log("Expired events cleaned up");
  } catch(e) {
    // SILENTLY IGNORE NETWORK ERRORS
  }
}
cleanExpiredEvents();
setInterval(cleanExpiredEvents, 60 * 60 * 1000);

// CREATE TABLE

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
  try { await db.execute(`ALTER TABLE users ADD COLUMN verified INTEGER DEFAULT 0`); } catch(e) {}
  try { await db.execute(`ALTER TABLE users ADD COLUMN verify_token TEXT`); } catch(e) {}
}
// ADD PENDING COLUMN TO QUESTIONS
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

initQuestionsDB();

// CREATE POLLS TABLE
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
  // ADD COLUMNS IF NOT EXISTS (for existing tables)
  try {
    await db.execute(`ALTER TABLE polls ADD COLUMN votes TEXT DEFAULT '{}'`);
  } catch(e) {}
  try {
    await db.execute(`ALTER TABLE polls ADD COLUMN active INTEGER DEFAULT 0`);
  } catch(e) {}
}
initPollsDB();

// CREATE EVENTS TABLE
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
initEventsDB();
initDB();


// SIGNUP

app.post("/signup", async (req, res) => {

  try {

    const { email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.execute({
      sql: `
        INSERT INTO users(email, password)
        VALUES (?, ?)
      `,
      args: [email, hashedPassword]
    });

    res.json({
      success:true,
      message:"Account created"
    });

  }
  catch(err){

    res.status(500).json({
      success:false,
      message:err.message
    });

  }

});


// LOGIN

app.post("/login", async (req, res) => {

  try{

    const { email, password } = req.body;

    const result = await db.execute({
      sql: `
        SELECT * FROM users
        WHERE email = ?
      `,
      args:[email]
    });

    const user = result.rows[0];

    if(!user){

      return res.status(400).json({
        success:false,
        message:"User not found"
      });

    }

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if(!isMatch){

      return res.status(400).json({
        success:false,
        message:"Wrong password"
      });

    }

    const token = jwt.sign(
      { id:user.id },
      process.env.JWT_SECRET,
      { expiresIn:"7d" }
    );

    res.json({
      success:true,
      token
    });

  }
  catch(err){

    res.status(500).json({
      success:false,
      message:err.message
    });

  }

});

// CREATE EVENT
app.post("/create-event", async (req, res) => {
  try {
    const { name, code, start_date, end_date, user_id } = req.body;
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
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET ALL EVENTS
app.get("/events", async (req, res) => {
  try {
    const nowUTC = new Date().toISOString();
    const result = await db.execute({
      sql: `SELECT * FROM events WHERE end_date > ? AND code != 'DEMO123'`,
      args: [nowUTC]
    });
    res.json({ success: true, events: result.rows });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// GET QUESTIONS BY EVENT CODE

app.get("/questions/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const result = await db.execute({
      sql: `SELECT * FROM questions 
            WHERE event_code = ? 
            AND COALESCE(answered, 0) = 0
            AND COALESCE(pending, 0) = 0
            ORDER BY COALESCE(priority,0) DESC, likes DESC`,
      args: [code]
    });
    res.json({ success: true, questions: result.rows });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ADD QUESTION
app.post("/questions", async (req, res) => {
  try {
    const { event_code, author, question, pending } = req.body;
    await db.execute({
      sql: `INSERT INTO questions (event_code, author, question, pending) VALUES (?, ?, ?, ?)`,
      args: [event_code, author, question, pending || 0]
    });
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// LIKE QUESTION
app.post("/questions/:id/like", async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute({
      sql: `UPDATE questions SET likes = likes + 1 WHERE id = ?`,
      args: [id]
    });
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET/SET MODERATION STATUS
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

// GET EVENT BY CODE
app.get("/events/code/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const result = await db.execute({
      sql: `SELECT * FROM events WHERE UPPER(code) = UPPER(?)`,
      args: [code]
    });

    if(result.rows.length === 0) {
      return res.json({
        success: false,
        message: "Oops! We couldn't find a session with that code. Please double-check and try again."
      });
    }

    const event = result.rows[0];
    const now = new Date().toISOString();

    // CHECK IF EVENT EXPIRED
    if(event.end_date < now) {
      return res.json({
        success: false,
        message: "This session has ended. The event you're trying to join is no longer active."
      });
    }

    // CHECK IF EVENT NOT STARTED YET
    if(event.start_date > now) {
      return res.json({
        success: false,
        message: "This session hasn't started yet. Please check back at the scheduled time."
      }); 
    }

    res.json({ success: true, event });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// CREATE POLL
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

// GET POLLS BY EVENT CODE
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

// ACTIVATE / DEACTIVATE POLL
app.post("/polls/:id/activate", async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    await db.execute({
      sql: `UPDATE polls SET active = ? WHERE id = ?`,
      args: [active, id]
    });
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET POLL RESULTS
app.get("/polls/:id/results", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute({
      sql: `SELECT * FROM polls WHERE id = ?`,
      args: [id]
    });
    res.json({ success: true, poll: result.rows[0] });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// SUBMIT VOTE
app.post("/polls/:id/vote", async (req, res) => {
  try {
    const { id } = req.params;
    const { answer } = req.body;
    const result = await db.execute({
      sql: `SELECT votes FROM polls WHERE id = ?`,
      args: [id]
    });
    const votes = JSON.parse(result.rows[0].votes || "{}");
    votes[answer] = (votes[answer] || 0) + 1;
    await db.execute({
      sql: `UPDATE polls SET votes = ? WHERE id = ?`,
      args: [JSON.stringify(votes), id]
    });
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PRIORITIZE QUESTION
app.post("/questions/:id/prioritize", async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute({
      sql: `UPDATE questions SET priority = 1 WHERE id = ?`,
      args: [id]
    });
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// MARK QUESTION AS ANSWERED
app.post("/questions/:id/answer", async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute({
      sql: `UPDATE questions SET answered = 1 WHERE id = ?`,
      args: [id]
    });
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GOOGLE LOGIN
// GOOGLE AUTH
app.post("/auth/google", async (req, res) => {
  try {
    const { email, name, picture } = req.body;

    // CHECK IF USER EXISTS
    let result = await db.execute({
      sql: `SELECT * FROM users WHERE email = ?`,
      args: [email]
    });

    // CREATE USER IF NOT EXISTS
    if(result.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO users (email, password) VALUES (?, ?)`,
        args: [email, "GOOGLE_AUTH"]
      });
      result = await db.execute({
        sql: `SELECT * FROM users WHERE email = ?`,
        args: [email]
      });
    }

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      email,
      name,
      picture
    });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});



// GET PENDING QUESTIONS (for organizer review)
app.get("/questions/:code/pending", async (req, res) => {
  try {
    const { code } = req.params;
    const result = await db.execute({
      sql: `SELECT * FROM questions 
            WHERE event_code = ? AND pending = 1
            ORDER BY id DESC`,
      args: [code]
    });
    res.json({ success: true, questions: result.rows });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// APPROVE QUESTION
app.post("/questions/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute({
      sql: `UPDATE questions SET pending = 0 WHERE id = ?`,
      args: [id]
    });
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// REJECT QUESTION
app.post("/questions/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute({
      sql: `UPDATE questions SET answered = 1, pending = 0 WHERE id = ?`,
      args: [id]
    });
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

import nodemailer from "nodemailer";

// EMAIL TRANSPORTER
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});



// UPDATE SIGNUP ROUTE
app.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const token = Math.random().toString(36).substring(2, 15) + 
                  Math.random().toString(36).substring(2, 15);

    await db.execute({
      sql: `INSERT INTO users(email, password, verify_token, verified) VALUES (?, ?, ?, 0)`,
      args: [email, hashedPassword, token]
    });

    // SEND VERIFICATION EMAIL
    const verifyUrl = `${process.env.APP_URL || "http://localhost:3000"}/verify?token=${token}`;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Verify your AskLive account",
      html: `
        <div style="font-family:Poppins,sans-serif;max-width:500px;margin:auto;padding:30px;background:#0f172a;color:white;border-radius:16px;">
          <h1 style="color:#38bdf8;">AskLive</h1>
          <h2>Verify your email</h2>
          <p style="color:#94a3b8;">Click the button below to verify your account.</p>
          <a href="${verifyUrl}" style="display:inline-block;padding:14px 28px;background:#38bdf8;color:#0f172a;border-radius:12px;text-decoration:none;font-weight:600;margin-top:16px;">
            Verify Email
          </a>
          <p style="color:#64748b;margin-top:24px;font-size:13px;">If you didn't create an account, ignore this email.</p>
        </div>
      `
    });

    res.json({ success: true, message: "Account created! Please check your email to verify." });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// VERIFY EMAIL ROUTE
app.get("/verify", async (req, res) => {
  try {
    const { token } = req.query;
    const result = await db.execute({
      sql: `SELECT * FROM users WHERE verify_token = ?`,
      args: [token]
    });
    if(result.rows.length === 0) {
      return res.send(`
        <html><body style="background:#0f172a;color:white;font-family:Poppins,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;">
          <div style="text-align:center;">
            <h1 style="color:#ef4444;">Invalid or expired link</h1>
            <a href="/login.html" style="color:#38bdf8;">Go to Login</a>
          </div>
        </body></html>
      `);
    }
    await db.execute({
      sql: `UPDATE users SET verified = 1, verify_token = NULL WHERE verify_token = ?`,
      args: [token]
    });
    res.send(`
      <html><body style="background:#0f172a;color:white;font-family:Poppins,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;">
        <div style="text-align:center;">
          <h1 style="color:#38bdf8;">✅ Email Verified!</h1>
          <p style="color:#94a3b8;">Your account is now active.</p>
          <a href="/login.html" style="display:inline-block;padding:12px 24px;background:#38bdf8;color:#0f172a;border-radius:12px;text-decoration:none;font-weight:600;margin-top:16px;">Go to Login</a>
        </div>
      </body></html>
    `);
  } catch(err) {
    res.status(500).send("Something went wrong");
  }
});

// UPDATE LOGIN TO CHECK VERIFICATION
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await db.execute({
      sql: `SELECT * FROM users WHERE email = ?`,
      args: [email]
    });
    const user = result.rows[0];
    if(!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }
    // CHECK VERIFICATION
    if(!user.verified) {
      return res.status(400).json({ 
        success: false, 
        message: "Please verify your email before logging in. Check your inbox." 
      });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if(!isMatch) {
      return res.status(400).json({ success: false, message: "Wrong password" });
    }
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, token });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(3000, () => {
  console.log("Server Running on Port 3000");
});