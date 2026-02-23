const express = require("express");
const db = require("../config/db");
const { isAuthenticated } = require("../middleware/auth");
const router = express.Router();

// GET /api/cart - Get user's cart items
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ci.id as cart_item_id, ci.added_at, s.*, 
              u.username as seller_name, u.avatar as seller_avatar
       FROM cart_items ci
       JOIN skins s ON ci.skin_id = s.id
       JOIN users u ON s.seller_id = u.id
       WHERE ci.user_id = $1 AND s.status = 'listed'
       ORDER BY ci.added_at DESC`,
      [req.user.id]
    );

    const items = result.rows.map((row) => ({
      cartItemId: row.cart_item_id,
      addedAt: row.added_at,
      skin: {
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
        sellerName: row.seller_name,
        sellerAvatar: row.seller_avatar,
        listedAt: row.listed_at,
        collection: row.collection || undefined,
        status: row.status,
      },
    }));

    res.json(items);
  } catch (err) {
    console.error("Error fetching cart:", err);
    res.status(500).json({ error: "Сагс авахад алдаа гарлаа" });
  }
});

// POST /api/cart - Add item to cart
router.post("/", isAuthenticated, async (req, res) => {
  try {
    const { skinId } = req.body;

    if (!skinId) {
      return res.status(400).json({ error: "skinId шаардлагатай" });
    }

    // Check skin exists and is listed
    const skinCheck = await db.query(
      "SELECT * FROM skins WHERE id = $1 AND status = 'listed'",
      [skinId]
    );

    if (skinCheck.rows.length === 0) {
      return res.status(404).json({ error: "Скин олдсонгүй" });
    }

    // Can't add own skin
    if (skinCheck.rows[0].seller_id === req.user.id) {
      return res
        .status(400)
        .json({ error: "Өөрийн зарыг сагсанд нэмэх боломжгүй" });
    }

    // Check if already in cart
    const existing = await db.query(
      "SELECT * FROM cart_items WHERE user_id = $1 AND skin_id = $2",
      [req.user.id, skinId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Скин сагсанд аль хэдийн байна" });
    }

    await db.query(
      "INSERT INTO cart_items (user_id, skin_id) VALUES ($1, $2)",
      [req.user.id, skinId]
    );

    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Error adding to cart:", err);
    res.status(500).json({ error: "Сагсанд нэмэхэд алдаа гарлаа" });
  }
});

// DELETE /api/cart/:skinId - Remove item from cart
router.delete("/:skinId", isAuthenticated, async (req, res) => {
  try {
    const result = await db.query(
      "DELETE FROM cart_items WHERE user_id = $1 AND skin_id = $2 RETURNING *",
      [req.user.id, req.params.skinId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Сагсанд олдсонгүй" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error removing from cart:", err);
    res.status(500).json({ error: "Сагснаас хасахад алдаа гарлаа" });
  }
});

// DELETE /api/cart - Clear entire cart
router.delete("/", isAuthenticated, async (req, res) => {
  try {
    await db.query("DELETE FROM cart_items WHERE user_id = $1", [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error clearing cart:", err);
    res.status(500).json({ error: "Сагс цэвэрлэхэд алдаа гарлаа" });
  }
});

module.exports = router;
