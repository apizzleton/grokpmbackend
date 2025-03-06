const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Account = require("./Account");
const TransactionType = require("./TransactionType");
const Property = require("./Property");

const Transaction = sequelize.define("Transaction", {
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
  },
  accountId: {
    type: DataTypes.INTEGER,
    references: {
      model: Account,
      key: "id",
    },
    allowNull: false,
  },
  transactionTypeId: {
    type: DataTypes.INTEGER,
    references: {
      model: TransactionType,
      key: "id",
    },
    allowNull: false,
  },
  propertyId: {
    type: DataTypes.INTEGER,
    references: {
      model: Property,
      key: "id",
    },
    allowNull: false, // Ensures all transactions are assigned to a property
  },
});

module.exports = Transaction;
