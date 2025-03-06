const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AccountType = sequelize.define("AccountType", {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
});

module.exports = AccountType;
