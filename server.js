const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();
const app = express();
app.use(express.json());

// Enable CORS for localhost:3000 (and optionally all origins)
app.use(cors({
  origin: 'http://localhost:3000' // Allow only localhost:3000 for now
  // For all origins, use: origin: '*'
}));

const pool = new Pool({
  connectionString: process.env.DB_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false }
});

// Create tenants and properties tables
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        address TEXT,
        units INTEGER,
        owner_id INTEGER,
        value REAL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        name TEXT,
        property_id INTEGER REFERENCES properties(id),
        rent REAL
      )
    `);
    console.log('Properties and Tenants tables created or already exist');
  } catch (err) {
    console.error('Table creation failed:', err);
  }
})();

// Get all properties
app.get('/properties', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM properties');
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Add a property
app.post('/properties', async (req, res) => {
  const { address, units, owner_id, value } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO properties (address, units, owner_id, value) VALUES ($1, $2, $3, $4) RETURNING *',
      [address, units, owner_id, value]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

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