require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");

// Configure passport strategy
require("./config/passport");

// Import routes
const authRoutes = require("./routes/auth");
const skinsRoutes = require("./routes/skins");
const cartRoutes = require("./routes/cart");
const usersRoutes = require("./routes/users");
const inventoryRoutes = require("./routes/inventory");

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for Render/production (needed for secure cookies & Steam auth)
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "cs-skins-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  })
);

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/skins", skinsRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/inventory", inventoryRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Серверийн алдаа гарлаа" });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api`);
  console.log(`🎮 Frontend: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
});
