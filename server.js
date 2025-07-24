const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const bcrypt = require("bcrypt");

const app = express();
const PORT = 3000; // Directly used instead of process.env.PORT

// ✅ Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ✅ Hardcoded MySQL Connection
const db = mysql.createConnection({
  host: "rds-master.cra6qquqgnrl.eu-west-3.rds.amazonaws.com",
  user: "chaitu",
  password: "chaitu2306",
  database: "zepto"
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
    process.exit(1);
  } else {
    console.log("✅ Connected to MySQL database");
  }
});

// ✅ Health check route
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.get("/", (req, res) => {
  res.send("🚀 Zepto Backend is running!");
});

app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = "INSERT INTO signup_users (username, email, password) VALUES (?, ?, ?)";
    db.query(sql, [username, email, hashedPassword], (err) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({ message: "Email already registered." });
        }
        return res.status(500).json({ message: err.message });
      }
      res.status(201).json({ message: "Signup successful!" });
    });
  } catch {
    res.status(500).json({ message: "Server error." });
  }
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const sql = "SELECT * FROM signup_users WHERE email = ?";
  db.query(sql, [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Query failed." });
    if (!results.length) return res.status(401).json({ message: "Invalid email or password." });

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid email or password." });

    res.status(200).json({ message: "Login successful!", username: user.username });
  });
});

app.post("/contact", (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ message: "All fields are required." });
  }

  const sql = "INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)";
  db.query(sql, [name, email, message], (err) => {
    if (err) return res.status(500).json({ message: "Database error." });
    res.status(201).json({ message: "Message stored successfully!" });
  });
});

app.post("/order/place-order", (req, res) => {
  const { items, total, user } = req.body;
  if (!Array.isArray(items) || !total) {
    return res.status(400).json({ message: "Invalid order data" });
  }

  const sql = "INSERT INTO orders (username, items, total_amount, created_at) VALUES (?, ?, ?, NOW())";
  db.query(sql, [user || "guest", JSON.stringify(items), total], (err) => {
    if (err) return res.status(500).json({ message: "Database error." });
    res.status(201).json({ message: "Order placed successfully!" });
  });
});

app.get("/call-private", async (req, res) => {
  try {
    const response = await axios.get("http://10.0.3.14:3000/ping");
    res.json({ message: "Success from private EC2", data: response.data });
  } catch {
    res.status(500).json({ message: "Failed to contact private EC2" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
