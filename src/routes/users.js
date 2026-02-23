const express = require("express");
const db = require("../config/db");
const { isAuthenticated } = require("../middleware/auth");
const router = express.Router();

// GET /api/users/profile - Get current user profile with stats
router.get("/profile", isAuthenticated, async (req, res) => {
  try {
    const userResult = await db.query("SELECT * FROM users WHERE id = $1", [
      req.user.id,
    ]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Хэрэглэгч олдсонгүй" });
    }

    const user = userResult.rows[0];

    // Get listing stats
    const listingsResult = await db.query(
      "SELECT COUNT(*) as active_listings FROM skins WHERE seller_id = $1 AND status = 'listed'",
      [req.user.id]
    );

    const soldResult = await db.query(
      "SELECT COUNT(*) as total_sold FROM skins WHERE seller_id = $1 AND status = 'sold'",
      [req.user.id]
    );

    res.json({
      id: user.id.toString(),
      steamId: user.steam_id,
      username: user.username,
      avatar: user.avatar,
      profileUrl: user.profile_url,
      balance: parseFloat(user.balance),
      totalSales: parseFloat(user.total_sales),
      totalPurchases: parseFloat(user.total_purchases),
      activeListings: parseInt(listingsResult.rows[0].active_listings),
      totalSold: parseInt(soldResult.rows[0].total_sold),
      createdAt: user.created_at,
    });
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).json({ error: "Профайл авахад алдаа гарлаа" });
  }
});

// GET /api/users/listings - Get user's own listings
router.get("/listings", isAuthenticated, async (req, res) => {
  try {
    const { status = "listed" } = req.query;
    const result = await db.query(
      `SELECT s.* FROM skins s WHERE s.seller_id = $1 AND s.status = $2 ORDER BY s.listed_at DESC`,
      [req.user.id, status]
    );

    const skins = result.rows.map((row) => ({
      id: row.id.toString(),
      name: row.name,
      weapon: row.weapon,
      category: row.category,
      rarity: row.rarity,
      wear: row.wear,
      float: parseFloat(row.float_value),
      price: parseFloat(row.price),
      imageUrl: row.image_url,
      stattrak: row.stattrak,
      sellerId: row.seller_id.toString(),
      sellerName: req.user.username,
      listedAt: row.listed_at,
      collection: row.collection || undefined,
      status: row.status,
    }));

    res.json(skins);
  } catch (err) {
    console.error("Error fetching listings:", err);
    res.status(500).json({ error: "Зарууд авахад алдаа гарлаа" });
  }
});

// GET /api/users/transactions - Get user's transaction history
router.get("/transactions", isAuthenticated, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await db.query(
      `SELECT t.*, s.name as skin_name 
       FROM transactions t
       LEFT JOIN skins s ON t.skin_id = s.id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), parseInt(offset)]
    );

    const transactions = result.rows.map((row) => ({
      id: row.id.toString(),
      type: row.type,
      amount: parseFloat(row.amount),
      description: row.description,
      skinName: row.skin_name || undefined,
      status: row.status,
      date: row.created_at,
    }));

    res.json(transactions);
  } catch (err) {
    console.error("Error fetching transactions:", err);
    res.status(500).json({ error: "Гүйлгээнүүд авахад алдаа гарлаа" });
  }
});

// POST /api/users/purchase - Purchase items in cart
router.post("/purchase", isAuthenticated, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // Get cart items
    const cartResult = await client.query(
      `SELECT ci.skin_id, s.price, s.seller_id, s.name, s.status
       FROM cart_items ci
       JOIN skins s ON ci.skin_id = s.id
       WHERE ci.user_id = $1`,
      [req.user.id]
    );

    if (cartResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Сагс хоосон байна" });
    }

    // Check all items are still listed
    const unavailable = cartResult.rows.filter(
      (item) => item.status !== "listed"
    );
    if (unavailable.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Зарим скинүүд аль хэдийн зарагдсан",
        unavailable: unavailable.map((i) => i.name),
      });
    }

    // Calculate total
    const total = cartResult.rows.reduce(
      (sum, item) => sum + parseFloat(item.price),
      0
    );

    // Check balance
    const userResult = await client.query(
      "SELECT balance FROM users WHERE id = $1 FOR UPDATE",
      [req.user.id]
    );
    const balance = parseFloat(userResult.rows[0].balance);

    if (balance < total) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Үлдэгдэл хүрэлцэхгүй байна" });
    }

    // Process each item
    for (const item of cartResult.rows) {
      // Mark skin as sold
      await client.query("UPDATE skins SET status = 'sold' WHERE id = $1", [
        item.skin_id,
      ]);

      // Deduct from buyer
      await client.query(
        "UPDATE users SET balance = balance - $1, total_purchases = total_purchases + $1 WHERE id = $2",
        [item.price, req.user.id]
      );

      // Pay seller
      await client.query(
        "UPDATE users SET balance = balance + $1, total_sales = total_sales + $1 WHERE id = $2",
        [item.price, item.seller_id]
      );

      // Buyer transaction
      await client.query(
        `INSERT INTO transactions (user_id, type, amount, description, skin_id, status)
         VALUES ($1, 'purchase', $2, $3, $4, 'completed')`,
        [req.user.id, item.price, `${item.name} худалдаж авсан`, item.skin_id]
      );

      // Seller transaction
      await client.query(
        `INSERT INTO transactions (user_id, type, amount, description, skin_id, status)
         VALUES ($1, 'sale', $2, $3, $4, 'completed')`,
        [item.seller_id, item.price, `${item.name} зарагдсан`, item.skin_id]
      );
    }

    // Clear cart
    await client.query("DELETE FROM cart_items WHERE user_id = $1", [
      req.user.id,
    ]);

    await client.query("COMMIT");

    res.json({
      success: true,
      total,
      itemCount: cartResult.rows.length,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error processing purchase:", err);
    res.status(500).json({ error: "Худалдан авахад алдаа гарлаа" });
  } finally {
    client.release();
  }
});

module.exports = router;
