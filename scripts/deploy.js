const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  const VRFCoordinator = "0x0000000000000000000000000000000000000000";
  const keyHash = hre.ethers.constants.HashZero;
  const subscriptionId = 0;
  const MIN_USD_FEED_DECIMALS = 8;
  const MIN_USD = hre.ethers.BigNumber.from(5).mul(hre.ethers.BigNumber.from(10).pow(MIN_USD_FEED_DECIMALS));
  const MemeGrave = await hre.ethers.getContractFactory("MemeGrave");
  const mg = await MemeGrave.deploy(VRFCoordinator, keyHash, subscriptionId, MIN_USD);
  await mg.deployed();
  console.log("MemeGrave deployed at:", mg.address);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });