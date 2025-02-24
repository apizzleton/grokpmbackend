const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();
const app = express();
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DB_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  });

// Create tenants table
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        name TEXT,
        property_id INTEGER,
        rent REAL
      )
    `);
    console.log('Tenants table created or already exists');
  } catch (err) {
    console.error('Table creation failed:', err);
  }
})();

// Get all tenants
app.get('/tenants', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tenants');
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Add a tenant
app.post('/tenants', async (req, res) => {
  const { name, property_id, rent } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO tenants (name, property_id, rent) VALUES ($1, $2, $3) RETURNING *',
      [name, property_id, rent]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(5000, () => console.log('Server running on port 5000'));