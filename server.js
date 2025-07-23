require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ✅ MySQL Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
  } else {
    console.log("✅ Connected to MySQL database");
  }
});

// ✅ Health check route for ALB
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// ✅ Basic root response
app.get("/", (req, res) => {
  res.send("🚀 Zepto Backend is running!");
});

// ✅ Signup API
app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = "INSERT INTO signup_users (username, email, password) VALUES (?, ?, ?)";
    db.query(sql, [username, email, hashedPassword], (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({ message: "Email already registered." });
        }
        console.error("❌ Insert error:", err);
        return res.status(500).json({ message: err.message });
      }
      res.status(201).json({ message: "Signup successful!" });
    });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// ✅ Login API
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const sql = "SELECT * FROM signup_users WHERE email = ?";
  db.query(sql, [email], async (err, results) => {
    if (err) {
      console.error("❌ Login query error:", err);
      return res.status(500).json({ message: "Something went wrong." });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const user = results[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    return res.status(200).json({ message: "Login successful!", username: user.username });
  });
});

// ✅ Contact form
app.post("/contact", (req, res) => {
  console.log("📨 Contact form submission received:", req.body);
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ message: "All fields are required." });
  }

  const sql = "INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)";
  db.query(sql, [name, email, message], (err, result) => {
    if (err) {
      console.error("❌ Contact insert error:", err);
      return res.status(500).json({ message: "Database error." });
    }
    res.status(201).json({ message: "Message stored successfully!" });
  });
});

// ✅ Order API
app.post("/order/place-order", (req, res) => {
  const { items, total, user } = req.body;
  if (!Array.isArray(items) || items.length === 0 || !total) {
    return res.status(400).json({ message: "Invalid order data" });
  }

  const sql = "INSERT INTO orders (username, items, total_amount, created_at) VALUES (?, ?, ?, NOW())";
  const values = [
    user || "guest",
    JSON.stringify(items),
    total
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("❌ Order insert error:", err);
      return res.status(500).json({ message: "Database error." });
    }

    res.status(201).json({ message: "Order placed successfully!" });
  });
});

// ✅ Internal test route
app.get("/call-private", async (req, res) => {
  try {
    const response = await axios.get("http://10.0.3.14:3000/ping");
    res.json({ message: "Success from private EC2", data: response.data });
  } catch (error) {
    console.error("❌ Error contacting private EC2:", error.message);
    res.status(500).json({ message: "Failed to contact private EC2" });
  }
});

// ✅ Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
