const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
});

pool.on("error", (err) => {
  console.error("Unexpected database error:", err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
