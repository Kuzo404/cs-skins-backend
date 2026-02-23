const express = require("express");
const db = require("../config/db");
const { isAuthenticated } = require("../middleware/auth");
const router = express.Router();

// GET /api/skins - List all skins (with filters)
router.get("/", async (req, res) => {
  try {
    const {
      search,
      category,
      rarity,
      wear,
      stattrak,
      sort = "newest",
      priceMin,
      priceMax,
      limit = 50,
      offset = 0,
    } = req.query;

    let query = `
      SELECT s.*, u.username as seller_name, u.avatar as seller_avatar, u.steam_id as seller_steam_id
      FROM skins s
      JOIN users u ON s.seller_id = u.id
      WHERE s.status = 'listed'
    `;
    const params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      query += ` AND (s.name ILIKE $${paramCount} OR s.weapon ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (category) {
      const categories = category.split(",");
      paramCount++;
      query += ` AND s.category = ANY($${paramCount})`;
      params.push(categories);
    }

    if (rarity) {
      const rarities = rarity.split(",");
      paramCount++;
      query += ` AND s.rarity = ANY($${paramCount})`;
      params.push(rarities);
    }

    if (wear) {
      const wears = wear.split(",");
      paramCount++;
      query += ` AND s.wear = ANY($${paramCount})`;
      params.push(wears);
    }

    if (stattrak === "true") {
      query += ` AND s.stattrak = TRUE`;
    }

    if (priceMin) {
      paramCount++;
      query += ` AND s.price >= $${paramCount}`;
      params.push(parseFloat(priceMin));
    }

    if (priceMax) {
      paramCount++;
      query += ` AND s.price <= $${paramCount}`;
      params.push(parseFloat(priceMax));
    }

    // Sorting
    switch (sort) {
      case "price-asc":
        query += " ORDER BY s.price ASC";
        break;
      case "price-desc":
        query += " ORDER BY s.price DESC";
        break;
      case "float-asc":
        query += " ORDER BY s.float_value ASC";
        break;
      case "float-desc":
        query += " ORDER BY s.float_value DESC";
        break;
      case "newest":
      default:
        query += " ORDER BY s.listed_at DESC";
        break;
    }

    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(parseInt(offset));

    const result = await db.query(query, params);

    // Also get total count for pagination
    let countQuery = `SELECT COUNT(*) FROM skins s WHERE s.status = 'listed'`;
    const countParams = [];
    let countParamIdx = 0;

    if (search) {
      countParamIdx++;
      countQuery += ` AND (s.name ILIKE $${countParamIdx} OR s.weapon ILIKE $${countParamIdx})`;
      countParams.push(`%${search}%`);
    }
    if (category) {
      countParamIdx++;
      countQuery += ` AND s.category = ANY($${countParamIdx})`;
      countParams.push(category.split(","));
    }
    if (rarity) {
      countParamIdx++;
      countQuery += ` AND s.rarity = ANY($${countParamIdx})`;
      countParams.push(rarity.split(","));
    }

    const countResult = await db.query(countQuery, countParams);

    const skins = result.rows.map(formatSkin);

    res.json({
      skins,
      total: parseInt(countResult.rows[0].count),
    });
  } catch (err) {
    console.error("Error fetching skins:", err);
    res.status(500).json({ error: "Скин жагсаалт авахад алдаа гарлаа" });
  }
});

// GET /api/skins/:id - Get single skin
router.get("/:id", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.*, u.username as seller_name, u.avatar as seller_avatar, u.steam_id as seller_steam_id
       FROM skins s
       JOIN users u ON s.seller_id = u.id
       WHERE s.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Скин олдсонгүй" });
    }

    res.json(formatSkin(result.rows[0]));
  } catch (err) {
    console.error("Error fetching skin:", err);
    res.status(500).json({ error: "Скин авахад алдаа гарлаа" });
  }
});

// POST /api/skins - Create new listing
router.post("/", isAuthenticated, async (req, res) => {
  try {
    const {
      name,
      weapon,
      category,
      rarity,
      wear,
      floatValue,
      price,
      imageUrl,
      stattrak,
      collection,
      inspectLink,
      steamAssetId,
    } = req.body;

    if (!name || !weapon || !category || !rarity || !wear || !price) {
      return res.status(400).json({ error: "Шаардлагатай талбарууд дутуу байна" });
    }

    const result = await db.query(
      `INSERT INTO skins (seller_id, name, weapon, category, rarity, wear, float_value, price, image_url, stattrak, collection, inspect_link, steam_asset_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        req.user.id,
        name,
        weapon,
        category,
        rarity,
        wear,
        floatValue || 0,
        price,
        imageUrl || "",
        stattrak || false,
        collection || null,
        inspectLink || null,
        steamAssetId || null,
      ]
    );

    res.status(201).json(formatSkin(result.rows[0], req.user));
  } catch (err) {
    console.error("Error creating listing:", err);
    res.status(500).json({ error: "Скин байршуулахад алдаа гарлаа" });
  }
});

// DELETE /api/skins/:id - Cancel listing
router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    const result = await db.query(
      "UPDATE skins SET status = 'cancelled' WHERE id = $1 AND seller_id = $2 AND status = 'listed' RETURNING *",
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Зар олдсонгүй эсвэл устгах эрхгүй байна" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error cancelling listing:", err);
    res.status(500).json({ error: "Зар цуцлахад алдаа гарлаа" });
  }
});

// Helper: format skin row to frontend format
function formatSkin(row, seller) {
  return {
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
    sellerId: (row.seller_id || "").toString(),
    sellerName: seller ? seller.username : row.seller_name || "",
    sellerAvatar: seller ? seller.avatar : row.seller_avatar || "",
    listedAt: row.listed_at,
    collection: row.collection || undefined,
    inspectLink: row.inspect_link || undefined,
    steamAssetId: row.steam_asset_id || undefined,
    status: row.status,
  };
}

module.exports = router;
