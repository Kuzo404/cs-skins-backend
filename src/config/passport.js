const passport = require("passport");
const SteamStrategy = require("passport-steam").Strategy;
const db = require("./db");

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    done(null, result.rows[0] || null);
  } catch (err) {
    done(err, null);
  }
});

passport.use(
  new SteamStrategy(
    {
      returnURL: `${process.env.BACKEND_URL}/api/auth/steam/return`,
      realm: process.env.BACKEND_URL,
      apiKey: process.env.STEAM_API_KEY,
    },
    async (identifier, profile, done) => {
      try {
        const steamId = profile.id;
        const username = profile.displayName;
        const avatar = profile._json.avatarfull || profile._json.avatar || "";
        const profileUrl = profile._json.profileurl || "";

        // Check if user exists
        let result = await db.query(
          "SELECT * FROM users WHERE steam_id = $1",
          [steamId]
        );

        if (result.rows.length > 0) {
          // Update existing user info
          result = await db.query(
            `UPDATE users SET username = $1, avatar = $2, profile_url = $3, updated_at = NOW()
             WHERE steam_id = $4 RETURNING *`,
            [username, avatar, profileUrl, steamId]
          );
          return done(null, result.rows[0]);
        }

        // Create new user
        result = await db.query(
          `INSERT INTO users (steam_id, username, avatar, profile_url)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [steamId, username, avatar, profileUrl]
        );

        return done(null, result.rows[0]);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

module.exports = passport;
