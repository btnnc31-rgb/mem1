require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.18",
  networks: {
    hardhat: {}
  },
  mocha: {
    timeout: 200000
  }
};