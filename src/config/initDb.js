const db = require("./db");
require("dotenv").config();

const schema = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  steam_id VARCHAR(20) UNIQUE NOT NULL,
  username VARCHAR(100) NOT NULL,
  avatar TEXT DEFAULT '',
  profile_url TEXT DEFAULT '',
  balance DECIMAL(12,2) DEFAULT 0.00,
  total_sales DECIMAL(12,2) DEFAULT 0.00,
  total_purchases DECIMAL(12,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Skins (listings) table
CREATE TABLE IF NOT EXISTS skins (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  weapon VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  rarity VARCHAR(50) NOT NULL,
  wear VARCHAR(50) NOT NULL,
  float_value DECIMAL(10,10) DEFAULT 0,
  price DECIMAL(12,2) NOT NULL,
  image_url TEXT DEFAULT '',
  stattrak BOOLEAN DEFAULT FALSE,
  collection VARCHAR(200),
  inspect_link TEXT,
  steam_asset_id VARCHAR(50),
  listed_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'listed' CHECK (status IN ('listed', 'sold', 'cancelled'))
);

-- Cart items table
CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  skin_id INTEGER REFERENCES skins(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, skin_id)
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('purchase', 'sale', 'deposit', 'withdrawal')),
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  skin_id INTEGER REFERENCES skins(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_skins_status ON skins(status);
CREATE INDEX IF NOT EXISTS idx_skins_seller ON skins(seller_id);
CREATE INDEX IF NOT EXISTS idx_skins_category ON skins(category);
CREATE INDEX IF NOT EXISTS idx_skins_rarity ON skins(rarity);
CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
`;

async function initDb() {
  try {
    console.log("Initializing database...");
    await db.query(schema);
    console.log("Database tables created successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Failed to initialize database:", err.message);
    process.exit(1);
  }
}

initDb();
