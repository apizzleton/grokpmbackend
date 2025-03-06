const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { sequelize, AccountType, Account, TransactionType, Property, Transaction } = require("./models/index");
const app = express();

app.use(express.json());

// Enable CORS for local development and production
app.use(cors({
  origin: ['http://localhost:3000', 'https://grokpmfrontend.onrender.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Sync models and define relationships
const syncModels = async () => {
  try {
    await sequelize.sync({ force: false });
    console.log("Database synced successfully");

    const accountTypes = await AccountType.findAll();
    if (accountTypes.length === 0) {
      await AccountType.bulkCreate([{ name: "Asset" }, { name: "Liability" }, { name: "Income" }, { name: "Expense" }]);
      await TransactionType.bulkCreate([{ name: "Income" }, { name: "Expense" }, { name: "Transfer" }]);
      await Property.bulkCreate([{ name: "Main St Property", address: "123 Main St", status: "active" }, { name: "Oak Ave Property", address: "456 Oak Ave", status: "active" }]);
      await Account.bulkCreate([{ name: "Rent Income", accountTypeId: 3 }, { name: "Maintenance Expense", accountTypeId: 4 }]);
      console.log("Initial data seeded successfully");
    }
  } catch (error) {
    console.error("Error syncing models or seeding data:", error);
  }
};

syncModels();

// API Routes
app.get("/api/properties", async (req, res) => { try { res.json(await Property.findAll()); } catch (error) { res.status(500).send(error.message); } });
app.post("/api/properties", async (req, res) => { try { res.status(201).json(await Property.create(req.body)); } catch (error) { res.status(400).json({ error: error.message }); } });
app.get("/api/accounts", async (req, res) => { try { res.json(await Account.findAll({ include: AccountType })); } catch (error) { res.status(500).send(error.message); } });
app.post("/api/accounts", async (req, res) => { try { res.status(201).json(await Account.create(req.body)); } catch (error) { res.status(400).json({ error: error.message }); } });
app.get("/api/transaction-types", async (req, res) => { try { res.json(await TransactionType.findAll()); } catch (error) { res.status(500).send(error.message); } });
app.post("/api/transaction-types", async (req, res) => { try { res.status(201).json(await TransactionType.create(req.body)); } catch (error) { res.status(400).json({ error: error.message }); } });
app.get("/api/transactions", async (req, res) => { try { res.json(await Transaction.findAll({ include: [Account, AccountType, TransactionType, Property] })); } catch (error) { res.status(500).send(error.message); } });
app.post("/api/transactions", async (req, res) => { try { res.status(201).json(await Transaction.create(req.body)); } catch (error) { res.status(400).json({ error: error.message }); } });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));