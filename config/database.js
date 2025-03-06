const { Sequelize } = require("sequelize");
require("dotenv").config(); // Ensure dotenv is loaded to access DB_CONNECTION_STRING

const sequelize = new Sequelize(process.env.DB_CONNECTION_STRING, {
  dialect: "postgres",
  logging: false,
  ssl: true, // Explicitly enable SSL
  dialectOptions: {
    ssl: {
      require: true, // Enforce SSL
      rejectUnauthorized: false // Allow self-signed certificates from Render
    },
    connectTimeout: 30000, // Timeout for establishing a connection (ms)
  },
  pool: {
    max: 5, // Maximum number of connections in the pool
    min: 0, // Minimum number of connections in the pool
    acquire: 30000, // Maximum time (ms) to wait for a connection
    idle: 10000, // Maximum time (ms) that a connection can be idle before being released
  },
});

module.exports = sequelize;