// Auth middleware - checks if user is logged in
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: "Нэвтрэх шаардлагатай" });
}

module.exports = { isAuthenticated };
