const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();
const app = express();
app.use(express.json());

// Enable CORS for localhost:3000 and production URL
app.use(cors({
  origin: ['http://localhost:3000', 'https://grokpmfrontend.onrender.com']
}));

// Configure PostgreSQL pool for Render (SSL required)
const pool = new Pool({
  connectionString: process.env.DB_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false } // Required for Render’s PostgreSQL
});

// Function to check current schema of a table
const checkTableSchema = async (tableName) => {
  try {
    const { rows } = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = $1
    `, [tableName]);
    console.log(`Current schema for ${tableName}:`, rows);
    return rows;
  } catch (err) {
    console.error(`Error checking schema for ${tableName}:`, err);
    return [];
  }
};

// Function to drop and recreate tables (for Render deployment)
const recreateTables = async () => {
  try {
    console.log('Checking current schema before dropping tables...');
    const propertiesSchema = await checkTableSchema('properties');
    console.log('Dropping existing tables...');
    await pool.query('DROP TABLE IF EXISTS board_members CASCADE');
    await pool.query('DROP TABLE IF EXISTS owners CASCADE');
    await pool.query('DROP TABLE IF EXISTS associations CASCADE');
    await pool.query('DROP TABLE IF EXISTS maintenance CASCADE');
    await pool.query('DROP TABLE IF EXISTS payments CASCADE');
    await pool.query('DROP TABLE IF EXISTS tenants CASCADE');
    await pool.query('DROP TABLE IF EXISTS units CASCADE');
    await pool.query('DROP TABLE IF EXISTS properties CASCADE');
    await pool.query('DROP TABLE IF EXISTS users CASCADE');
    console.log('Tables dropped successfully.');
  } catch (err) {
    console.error('Error dropping tables:', err);
  }
};

// Create tables for all entities
(async () => {
  try {
    // Drop and recreate tables to ensure schema matches
    await recreateTables();

    console.log('Creating tables...');
    // Users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'tenant'))
      )
    `);
    // Properties
    await pool.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        zip TEXT NOT NULL,
        owner_id INTEGER REFERENCES users(id),
        value REAL NOT NULL
      )
    `);
    // Units
    await pool.query(`
      CREATE TABLE IF NOT EXISTS units (
        id SERIAL PRIMARY KEY,
        property_id INTEGER REFERENCES properties(id) NOT NULL,
        unit_number TEXT NOT NULL,
        rent_amount REAL NOT NULL,
        status TEXT DEFAULT 'vacant' CHECK (status IN ('occupied', 'vacant'))
      )
    `);
    // Tenants
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        unit_id INTEGER REFERENCES units(id) NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        lease_start_date DATE NOT NULL,
        lease_end_date DATE NOT NULL,
        rent REAL NOT NULL
      )
    `);
    // Payments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) NOT NULL,
        amount REAL NOT NULL,
        payment_date DATE NOT NULL,
        status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'late', 'pending'))
      )
    `);
    // Maintenance
    await pool.query(`
      CREATE TABLE IF NOT EXISTS maintenance (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) NOT NULL,
        property_id INTEGER REFERENCES properties(id) NOT NULL,
        description TEXT NOT NULL,
        request_date DATE NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed')),
        cost REAL DEFAULT 0,
        completion_date DATE
      )
    `);
    // Associations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS associations (
        id SERIAL PRIMARY KEY,
        property_id INTEGER REFERENCES properties(id) NOT NULL,
        name TEXT NOT NULL,
        contact_info TEXT NOT NULL,
        fee REAL NOT NULL,
        due_date DATE NOT NULL
      )
    `);
    // Owners
    await pool.query(`
      CREATE TABLE IF NOT EXISTS owners (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        property_id INTEGER REFERENCES properties(id) NOT NULL
      )
    `);
    // Board Members
    await pool.query(`
      CREATE TABLE IF NOT EXISTS board_members (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        association_id INTEGER REFERENCES associations(id) NOT NULL
      )
    `);
    console.log('All tables created or already exist');
  } catch (err) {
    console.error('Table creation failed:', err);
  }
})();

// Insert dummy data
(async () => {
  try {
    console.log('Inserting dummy data...');
    // Users
    await pool.query(`
      INSERT INTO users (email, password, role) VALUES
      ('admin@example.com', 'password123', 'owner'),
      ('manager@example.com', 'password123', 'manager'),
      ('tenant@example.com', 'password123', 'tenant')
      ON CONFLICT (email) DO NOTHING
    `);

    // Properties
    await pool.query(`
      INSERT INTO properties (address, city, state, zip, owner_id, value) VALUES
      ('123 Main St', 'New York', 'NY', '10001', 1, 500000),
      ('456 Oak Ave', 'Los Angeles', 'CA', '90001', 1, 600000)
      ON CONFLICT (id) DO NOTHING
    `);

    // Units
    await pool.query(`
      INSERT INTO units (property_id, unit_number, rent_amount, status) VALUES
      (1, '1A', 1500, 'occupied'),
      (1, '1B', 1400, 'vacant'),
      (2, '2A', 1600, 'occupied'),
      (2, '2B', 1450, 'vacant')
      ON CONFLICT (id) DO NOTHING
    `);

    // Tenants
    await pool.query(`
      INSERT INTO tenants (unit_id, name, email, phone, lease_start_date, lease_end_date, rent) VALUES
      (1, 'John Doe', 'john@example.com', '555-0101', '2024-01-01', '2025-12-31', 1500),
      (3, 'Jane Smith', 'jane@example.com', '555-0102', '2024-02-01', '2025-12-31', 1600)
      ON CONFLICT (id) DO NOTHING
    `);

    // Payments
    await pool.query(`
      INSERT INTO payments (tenant_id, amount, payment_date, status) VALUES
      (1, 1500, '2025-02-01', 'paid'),
      (2, 1600, '2025-02-01', 'paid'),
      (1, 1500, '2025-01-01', 'paid')
      ON CONFLICT (id) DO NOTHING
    `);

    // Maintenance
    await pool.query(`
      INSERT INTO maintenance (tenant_id, property_id, description, request_date, status, cost, completion_date) VALUES
      (1, 1, 'Fix leaky faucet', '2025-01-15', 'completed', 150, '2025-01-20'),
      (2, 2, 'Repair AC', '2025-02-10', 'in-progress', 300, NULL)
      ON CONFLICT (id) DO NOTHING
    `);

    // Associations
    await pool.query(`
      INSERT INTO associations (property_id, name, contact_info, fee, due_date) VALUES
      (1, 'Main St HOA', 'hoa@mainst.com, 555-0201', 200, '2025-03-01'),
      (2, 'Oak Ave Association', 'oa@oakave.com, 555-0202', 250, '2025-03-01')
      ON CONFLICT (id) DO NOTHING
    `);

    // Owners
    await pool.query(`
      INSERT INTO owners (name, email, phone, property_id) VALUES
      ('Alice Johnson', 'alice@example.com', '555-0301', 1),
      ('Bob Wilson', 'bob@example.com', '555-0302', 2)
      ON CONFLICT (id) DO NOTHING
    `);

    // Board Members
    await pool.query(`
      INSERT INTO board_members (name, email, phone, association_id) VALUES
      ('Carol Davis', 'carol@example.com', '555-0401', 1),
      ('David Brown', 'david@example.com', '555-0402', 2)
      ON CONFLICT (id) DO NOTHING
    `);

    console.log('Dummy data inserted or already exists');
  } catch (err) {
    console.error('Dummy data insertion failed:', err);
  }
})();

// User Authentication (Kept but bypassed for development)
const jwt = require('jsonwebtoken');
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: rows[0].id, role: rows[0].role }, 'MySecretKey2025!', { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Middleware for authentication (commented out for development)
/*
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, 'MySecretKey2025!', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};
*/

// Bypass authentication for development (remove authenticateToken from endpoints)
app.get('/properties', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM properties');
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Diagnostic endpoint to check properties table schema
app.get('/schema/properties', async (req, res) => {
  try {
    const schema = await checkTableSchema('properties');
    res.json(schema);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/properties', async (req, res) => {
  const { address, city, state, zip, owner_id, value } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO properties (address, city, state, zip, owner_id, value) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [address, city, state, zip, owner_id, value]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/units', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM units');
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/units', async (req, res) => {
  const { property_id, unit_number, rent_amount, status } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO units (property_id, unit_number, rent_amount, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [property_id, unit_number, rent_amount, status || 'vacant']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/tenants', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tenants');
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/tenants', async (req, res) => {
  const { unit_id, name, email, phone, lease_start_date, lease_end_date, rent } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO tenants (unit_id, name, email, phone, lease_start_date, lease_end_date, rent) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [unit_id, name, email, phone, lease_start_date, lease_end_date, rent]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/payments', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM payments');
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/payments', async (req, res) => {
  const { tenant_id, amount, payment_date, status } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO payments (tenant_id, amount, payment_date, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [tenant_id, amount, payment_date, status || 'paid']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/maintenance', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM maintenance');
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/maintenance', async (req, res) => {
  const { tenant_id, property_id, description, request_date, status, cost, completion_date } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO maintenance (tenant_id, property_id, description, request_date, status, cost, completion_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [tenant_id, property_id, description, request_date, status || 'pending', cost || 0, completion_date]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/associations', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM associations');
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/associations', async (req, res) => {
  const { property_id, name, contact_info, fee, due_date } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO associations (property_id, name, contact_info, fee, due_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [property_id, name, contact_info, fee, due_date]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/owners', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM owners');
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/owners', async (req, res) => {
  const { name, email, phone, property_id } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO owners (name, email, phone, property_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, phone, property_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/board-members', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM board_members');
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/board-members', async (req, res) => {
  const { name, email, phone, association_id } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO board_members (name, email, phone, association_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, phone, association_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/reports', async (req, res) => {
  try {
    const { rows: paymentRows } = await pool.query('SELECT SUM(amount) AS total_rent FROM payments WHERE status = $1', ['paid']);
    const { rows: tenantRows } = await pool.query('SELECT COUNT(*) AS total_tenants FROM tenants');
    const { rows: propertyRows } = await pool.query('SELECT COUNT(*) AS total_properties FROM properties');
    res.json({
      totalRent: paymentRows[0].total_rent || 0,
      totalTenants: tenantRows[0].total_tenants || 0,
      totalProperties: propertyRows[0].total_properties || 0,
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(5000, () => console.log('Server running on port 5000'));