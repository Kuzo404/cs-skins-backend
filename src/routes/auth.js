const express = require("express");
const passport = require("passport");
const router = express.Router();

// Steam login
router.get("/steam", passport.authenticate("steam", { failureRedirect: "/" }));

// Steam callback
router.get(
  "/steam/return",
  passport.authenticate("steam", { failureRedirect: "/" }),
  (req, res) => {
    // Redirect to frontend after successful login
    res.redirect(process.env.FRONTEND_URL || "http://localhost:3000");
  }
);

// Get current user
router.get("/me", (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const user = req.user;
    return res.json({
      id: user.id.toString(),
      steamId: user.steam_id,
      username: user.username,
      avatar: user.avatar,
      balance: parseFloat(user.balance),
      totalSales: parseFloat(user.total_sales),
      totalPurchases: parseFloat(user.total_purchases),
      joinedAt: user.created_at,
      isOnline: true,
    });
  }
  return res.json(null);
});

// Logout
router.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: "Гарахад алдаа гарлаа" });
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });
});

module.exports = router;
