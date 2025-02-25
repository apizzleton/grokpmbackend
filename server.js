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

// Function to check if a table exists
const tableExists = async (tableName) => {
  try {
    const { rows } = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public' AND tablename = $1
      )
    `, [tableName]);
    return rows[0].exists;
  } catch (err) {
    console.error(`Error checking if ${tableName} exists:`, err);
    return false;
  }
};

// Function to drop tables with retry for deadlocks
const dropTablesWithRetry = async (retries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Attempt ${attempt} to drop tables...`);
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
      return;
    } catch (err) {
      if (err.code === '40P01' && attempt < retries) { // Deadlock detected
        console.error(`Deadlock detected on attempt ${attempt}, retrying in ${delay}ms...`, err);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      console.error('Error dropping tables after retries:', err);
      throw err;
    }
  }
};

// Create and populate all tables and data in a single transaction
(async () => {
  try {
    console.log('Starting transaction for schema and data creation...');
    await pool.query('BEGIN');

    console.log('Checking current schema before dropping tables...');
    const propertiesSchema = await checkTableSchema('properties');
    const paymentsSchema = await checkTableSchema('payments');
    const maintenanceSchema = await checkTableSchema('maintenance');

    console.log('Dropping tables with retry for deadlocks...');
    await dropTablesWithRetry();

    console.log('Creating tables sequentially with dependency checks...');
    // Users
    if (!(await tableExists('users'))) {
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'tenant'))
        )
      `);
    }
    console.log('Users table created or already exists');

    // Insert users to ensure id = 1 exists
    await pool.query(`
      INSERT INTO users (email, password, role) VALUES
      ('admin@example.com', 'password123', 'owner'),
      ('manager@example.com', 'password123', 'manager'),
      ('tenant@example.com', 'password123', 'tenant')
      ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id
    `);
    console.log('Users dummy data inserted or updated');

    // Properties (depends on users)
    if (!(await tableExists('properties'))) {
      await pool.query(`
        CREATE TABLE properties (
          id SERIAL PRIMARY KEY,
          address TEXT NOT NULL,
          city TEXT NOT NULL,
          state TEXT NOT NULL,
          zip TEXT NOT NULL,
          owner_id INTEGER REFERENCES users(id),
          value REAL NOT NULL
        )
      `);
    }
    console.log('Properties table created or already exists');

    // Units (depends on properties)
    if (!(await tableExists('units'))) {
      await pool.query(`
        CREATE TABLE units (
          id SERIAL PRIMARY KEY,
          property_id INTEGER REFERENCES properties(id) NOT NULL,
          unit_number TEXT NOT NULL,
          rent_amount REAL NOT NULL,
          status TEXT DEFAULT 'vacant' CHECK (status IN ('occupied', 'vacant'))
        )
      `);
    }
    console.log('Units table created or already exists');

    // Tenants (depends on units)
    if (!(await tableExists('tenants'))) {
      await pool.query(`
        CREATE TABLE tenants (
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
    }
    console.log('Tenants table created or already exists');

    // Payments (depends on tenants)
    if (!(await tableExists('payments'))) {
      await pool.query(`
        CREATE TABLE payments (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER REFERENCES tenants(id) NOT NULL,
          amount REAL NOT NULL,
          payment_date DATE NOT NULL,
          status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'late', 'pending'))
        )
      `);
    }
    console.log('Payments table created or already exists');

    // Maintenance (depends on tenants and properties)
    if (!(await tableExists('maintenance'))) {
      await pool.query(`
        CREATE TABLE maintenance (
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
    }
    console.log('Maintenance table created or already exists');

    // Associations (depends on properties)
    if (!(await tableExists('associations'))) {
      await pool.query(`
        CREATE TABLE associations (
          id SERIAL PRIMARY KEY,
          property_id INTEGER REFERENCES properties(id) NOT NULL,
          name TEXT NOT NULL,
          contact_info TEXT NOT NULL,
          fee REAL NOT NULL,
          due_date DATE NOT NULL
        )
      `);
    }
    console.log('Associations table created or already exists');

    // Owners (depends on properties)
    if (!(await tableExists('owners'))) {
      await pool.query(`
        CREATE TABLE owners (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT NOT NULL,
          property_id INTEGER REFERENCES properties(id) NOT NULL
        )
      `);
    }
    console.log('Owners table created or already exists');

    // Board Members (depends on associations)
    if (!(await tableExists('board_members'))) {
      await pool.query(`
        CREATE TABLE board_members (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT NOT NULL,
          association_id INTEGER REFERENCES associations(id) NOT NULL
        )
      `);
    }
    console.log('Board Members table created or already exists');

    console.log('All tables created or already exist');

    // Insert dummy data within the same transaction
    console.log('Inserting dummy data sequentially with dependency checks...');
    // Users (already inserted above to ensure id = 1 exists)

    // Properties (depends on users)
    const userCheck = await pool.query('SELECT id FROM users WHERE id = 1');
    if (userCheck.rows.length === 0) {
      throw new Error('User with ID 1 does not exist for properties insertion');
    }
    await pool.query(`
      INSERT INTO properties (address, city, state, zip, owner_id, value) VALUES
      ('123 Main St', 'New York', 'NY', '10001', 1, 500000),
      ('456 Oak Ave', 'Los Angeles', 'CA', '90001', 1, 600000)
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Properties dummy data inserted or already exists');

    // Units (depends on properties)
    await pool.query(`
      INSERT INTO units (property_id, unit_number, rent_amount, status) VALUES
      (1, '1A', 1500, 'occupied'),
      (1, '1B', 1400, 'vacant'),
      (2, '2A', 1600, 'occupied'),
      (2, '2B', 1450, 'vacant')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Units dummy data inserted or already exists');

    // Tenants (depends on units)
    await pool.query(`
      INSERT INTO tenants (unit_id, name, email, phone, lease_start_date, lease_end_date, rent) VALUES
      (1, 'John Doe', 'john@example.com', '555-0101', '2024-01-01', '2025-12-31', 1500),
      (3, 'Jane Smith', 'jane@example.com', '555-0102', '2024-02-01', '2025-12-31', 1600)
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Tenants dummy data inserted or already exists');

    // Payments (depends on tenants)
    await pool.query(`
      INSERT INTO payments (tenant_id, amount, payment_date, status) VALUES
      (1, 1500, '2025-02-01', 'paid'),
      (2, 1600, '2025-02-01', 'paid'),
      (1, 1500, '2025-01-01', 'paid')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Payments dummy data inserted or already exists');

    // Maintenance (depends on tenants and properties)
    const tenantCheck = await pool.query('SELECT id FROM tenants WHERE id IN (1, 2)');
    const propertyCheck = await pool.query('SELECT id FROM properties WHERE id IN (1, 2)');
    if (tenantCheck.rows.length < 2 || propertyCheck.rows.length < 2) {
      throw new Error('Required tenants or properties missing for maintenance insertion');
    }
    await pool.query(`
      INSERT INTO maintenance (tenant_id, property_id, description, request_date, status, cost, completion_date) VALUES
      (1, 1, 'Fix leaky faucet', '2025-01-15', 'completed', 150, '2025-01-20'),
      (2, 2, 'Repair AC', '2025-02-10', 'in-progress', 300, NULL)
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Maintenance dummy data inserted or already exists');

    // Associations (depends on properties)
    await pool.query(`
      INSERT INTO associations (property_id, name, contact_info, fee, due_date) VALUES
      (1, 'Main St HOA', 'hoa@mainst.com, 555-0201', 200, '2025-03-01'),
      (2, 'Oak Ave Association', 'oa@oakave.com, 555-0202', 250, '2025-03-01')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Associations dummy data inserted or already exists');

    // Owners (depends on properties)
    await pool.query(`
      INSERT INTO owners (name, email, phone, property_id) VALUES
      ('Alice Johnson', 'alice@example.com', '555-0301', 1),
      ('Bob Wilson', 'bob@example.com', '555-0302', 2)
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Owners dummy data inserted or already exists');

    // Board Members (depends on associations)
    await pool.query(`
      INSERT INTO board_members (name, email, phone, association_id) VALUES
      ('Carol Davis', 'carol@example.com', '555-0401', 1),
      ('David Brown', 'david@example.com', '555-0402', 2)
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Board Members dummy data inserted or already exists');

    console.log('All dummy data inserted or already exists');
    await pool.query('COMMIT');
    console.log('Transaction committed successfully');
  } catch (err) {
    console.error('Error in schema and data creation, rolling back transaction:', err);
    await pool.query('ROLLBACK');
    throw err; // Re-throw to stop the process and log the error
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

// Diagnostic endpoint to check payments table schema
app.get('/schema/payments', async (req, res) => {
  try {
    const schema = await checkTableSchema('payments');
    res.json(schema);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Diagnostic endpoint to check maintenance table schema
app.get('/schema/maintenance', async (req, res) => {
  try {
    const schema = await checkTableSchema('maintenance');
    res.json(schema);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Diagnostic endpoint to return all data from a table
app.get('/data/:table', async (req, res) => {
  const { table } = req.params;
  try {
    const { rows } = await pool.query(`SELECT * FROM ${table}`);
    res.json(rows);
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