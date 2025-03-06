// server.js (Full Code)

const express = require('express');
const cors = require('cors');
const { sequelize, AccountType, Account, TransactionType, Property, Transaction } = require('./models/index');
require('dotenv').config();

const app = express();

// Enable CORS for local development and production
app.use(cors({
  origin: ['http://localhost:3000', 'https://grokpmfrontend.onrender.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Handle OPTIONS requests explicitly
app.options('*', cors());

// Parse JSON requests
app.use(express.json());

// Sync models and seed initial data if necessary
const syncModels = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully');

    await sequelize.sync({ force: false });
    console.log('Database synced successfully');

    const accountTypes = await AccountType.findAll();
    if (accountTypes.length === 0) {
      await AccountType.bulkCreate([{ name: 'Asset' }, { name: 'Liability' }, { name: 'Income' }, { name: 'Expense' }]);
      await TransactionType.bulkCreate([{ name: 'Income' }, { name: 'Expense' }, { name: 'Transfer' }]);
      await Property.bulkCreate([{ name: 'Main St Property', address: '123 Main St', status: 'active' }, { name: 'Oak Ave Property', address: '456 Oak Ave', status: 'active' }]);
      await Account.bulkCreate([{ name: 'Rent Income', accountTypeId: 3 }, { name: 'Maintenance Expense', accountTypeId: 4 }]);
      console.log('Initial data seeded successfully');
    }
  } catch (error) {
    console.error('Error syncing models or seeding data:', error);
  }
};

syncModels();

// API Routes
app.get('/api/properties', async (req, res) => {
  try {
    const properties = await Property.findAll();
    res.json(properties);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/properties', async (req, res) => {
  try {
    const property = await Property.create(req.body);
    res.status(201).json(property);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await Account.findAll({ include: AccountType });
    res.json(accounts);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/accounts', async (req, res) => {
  try {
    const account = await Account.create(req.body);
    res.status(201).json(account);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/transaction-types', async (req, res) => {
  try {
    const types = await TransactionType.findAll();
    res.json(types);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/transaction-types', async (req, res) => {
  try {
    const type = await TransactionType.create(req.body);
    res.status(201).json(type);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      include: [Account, AccountType, TransactionType, Property],
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const transaction = await Transaction.create(req.body);
    res.status(201).json(transaction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));