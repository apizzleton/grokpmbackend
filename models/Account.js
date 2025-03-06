const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const AccountType = require("./AccountType");

const Account = sequelize.define("Account", {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  accountTypeId: {
    type: DataTypes.INTEGER,
    references: {
      model: AccountType,
      key: "id",
    },
    allowNull: false,
  },
});

module.exports = Account;
