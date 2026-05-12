import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createClient } from "@libsql/client";

dotenv.config();
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
      password TEXT
    )
  `);

}
// CREATE QUESTIONS TABLE

async function initQuestionsDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_code TEXT,
      author TEXT,
      question TEXT,
      likes INTEGER DEFAULT 0,
      priority INTEGER DEFAULT 0,
      answered INTEGER DEFAULT 0
    )
  `);
  // ADD COLUMNS IF NOT EXISTS
  try {
    await db.execute(`ALTER TABLE questions ADD COLUMN priority INTEGER DEFAULT 0`);
  } catch(e) {}
  try {
    await db.execute(`ALTER TABLE questions ADD COLUMN answered INTEGER DEFAULT 0`);
  } catch(e) {}
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
      sql: `SELECT * FROM events WHERE end_date > ?`,
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
            ORDER BY priority DESC, likes DESC`,
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
    const { event_code, author, question } = req.body;
    await db.execute({
      sql: `INSERT INTO questions (event_code, author, question) VALUES (?, ?, ?)`,
      args: [event_code, author, question]
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

// GET EVENT BY CODE
app.get("/events/code/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const result = await db.execute({
      sql: `SELECT * FROM events WHERE UPPER(code) = UPPER(?)`,
      args: [code]
    });
    if(result.rows.length === 0) {
      return res.json({ success: false, message: "Event not found" });
    }
    res.json({ success: true, event: result.rows[0] });
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

app.listen(3000, () => {
  console.log("Server Running on Port 3000");
});