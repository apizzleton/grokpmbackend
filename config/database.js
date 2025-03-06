const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(process.env.DB_CONNECTION_STRING, {
  dialect: "postgres",
  logging: false,
  ssl: { rejectUnauthorized: false }, // Required for Render’s PostgreSQL
  pool: {
    max: 5, // Maximum number of connections in the pool
    min: 0, // Minimum number of connections in the pool
    acquire: 30000, // Maximum time (ms) to wait for a connection
    idle: 10000, // Maximum time (ms) that a connection can be idle before being released
  },
  dialectOptions: {
    connectTimeout: 30000, // Timeout for establishing a connection (ms)
  },
});

module.exports = sequelize;