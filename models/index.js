const sequelize = require("../config/database");
const AccountType = require("./AccountType");
const Account = require("./Account");
const TransactionType = require("./TransactionType");
const Property = require("./Property");
const Transaction = require("./Transaction");

// Relationships
AccountType.hasMany(Account, { foreignKey: "accountTypeId" });
Account.belongsTo(AccountType, { foreignKey: "accountTypeId" });

Account.hasMany(Transaction, { foreignKey: "accountId" });
Transaction.belongsTo(Account, { foreignKey: "accountId" });

TransactionType.hasMany(Transaction, { foreignKey: "transactionTypeId" });
Transaction.belongsTo(TransactionType, { foreignKey: "transactionTypeId" });

Property.hasMany(Transaction, { foreignKey: "propertyId" });
Transaction.belongsTo(Property, { foreignKey: "propertyId" });

module.exports = {
  sequelize,
  AccountType,
  Account,
  TransactionType,
  Property,
  Transaction,
};
