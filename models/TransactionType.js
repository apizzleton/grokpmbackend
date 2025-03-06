const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const TransactionType = sequelize.define("TransactionType", {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
});

module.exports = TransactionType;
