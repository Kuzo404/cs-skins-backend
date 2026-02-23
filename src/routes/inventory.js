const express = require("express");
const { isAuthenticated } = require("../middleware/auth");
const router = express.Router();

// GET /api/inventory - Fetch user's Steam inventory (CS2)
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const steamId = req.user.steam_id;
    const apiKey = process.env.STEAM_API_KEY;

    if (!apiKey || apiKey === "YOUR_STEAM_API_KEY_HERE") {
      return res.status(500).json({
        error: "Steam API ключ тохируулаагүй байна",
      });
    }

    // CS2 App ID = 730
    const inventoryUrl = `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=1000`;

    const response = await fetch(inventoryUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        return res.status(403).json({
          error: "Steam инвентар хаалттай байна. Инвентараа нээнэ үү.",
        });
      }
      return res.status(response.status).json({
        error: "Steam инвентар авахад алдаа гарлаа",
      });
    }

    const data = await response.json();

    if (!data || !data.assets || !data.descriptions) {
      return res.json([]);
    }

    // Map assets to descriptions
    const items = data.assets
      .map((asset) => {
        const desc = data.descriptions.find(
          (d) =>
            d.classid === asset.classid &&
            d.instanceid === asset.instanceid
        );

        if (!desc || !desc.marketable) return null;

        // Parse item details from tags
        const weaponTag = desc.tags?.find(
          (t) => t.category === "Weapon" || t.category === "Type"
        );
        const categoryTag = desc.tags?.find(
          (t) => t.category === "Type"
        );
        const rarityTag = desc.tags?.find(
          (t) => t.category === "Rarity"
        );
        const wearTag = desc.tags?.find(
          (t) => t.category === "Exterior"
        );

        // Get inspect link
        let inspectLink = null;
        if (desc.actions) {
          const inspectAction = desc.actions.find((a) =>
            a.link?.includes("csgo_econ_action_preview")
          );
          if (inspectAction) {
            inspectLink = inspectAction.link
              .replace("%owner_steamid%", steamId)
              .replace("%assetid%", asset.assetid);
          }
        }

        // Map rarity
        const rarityMap = {
          "Consumer Grade": "consumer",
          "Industrial Grade": "industrial",
          "Mil-Spec Grade": "milspec",
          Restricted: "restricted",
          Classified: "classified",
          Covert: "covert",
          Contraband: "contraband",
          "Base Grade": "consumer",
        };

        // Map wear
        const wearMap = {
          "Factory New": "fn",
          "Minimal Wear": "mw",
          "Field-Tested": "ft",
          "Well-Worn": "ww",
          "Battle-Scarred": "bs",
        };

        // Map category
        const categoryMap = {
          Pistol: "pistol",
          Rifle: "rifle",
          SMG: "smg",
          Shotgun: "shotgun",
          "Machine Gun": "machinegun",
          "Sniper Rifle": "rifle",
          Knife: "knife",
          Gloves: "gloves",
        };

        const imageUrl = desc.icon_url
          ? `https://community.akamai.steamstatic.com/economy/image/${desc.icon_url}/360fx360f`
          : "";

        return {
          assetId: asset.assetid,
          name: desc.market_hash_name || desc.name,
          weapon: weaponTag?.localized_tag_name || "",
          category: categoryMap[categoryTag?.localized_tag_name] || "other",
          rarity: rarityMap[rarityTag?.localized_tag_name] || "consumer",
          wear: wearMap[wearTag?.localized_tag_name] || "fn",
          stattrak: desc.name?.includes("StatTrak") || false,
          imageUrl,
          inspectLink,
          tradable: desc.tradable === 1,
          marketable: desc.marketable === 1,
        };
      })
      .filter(Boolean);

    res.json(items);
  } catch (err) {
    console.error("Error fetching Steam inventory:", err);
    res.status(500).json({ error: "Steam инвентар авахад алдаа гарлаа" });
  }
});

module.exports = router;
