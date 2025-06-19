const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  console.log("\nDeploying BountyToken...");
  const BountyToken = await ethers.getContractFactory("BountyToken");
  const bountyToken = await BountyToken.deploy();
  await bountyToken.waitForDeployment();
  console.log("BountyToken deployed to:", await bountyToken.getAddress());

  console.log("\nDeploying BountyPlatform...");
  const BountyPlatform = await ethers.getContractFactory("BountyPlatform");
  const bountyPlatform = await BountyPlatform.deploy(deployer.address);
  await bountyPlatform.waitForDeployment();
  console.log("BountyPlatform deployed to:", await bountyPlatform.getAddress());

  const testAccount = "0x8cedae1423a74d0a13f09d5192f3b430ec0d88a3";
  console.log("\nTransferring ownership and tokens to test account:", testAccount);
  
  await bountyToken.transferOwnership(testAccount);
  console.log("BountyToken ownership transferred to:", testAccount);
  
  const mintAmount = ethers.parseEther("1000");
  await bountyToken.mint(testAccount, mintAmount);
  console.log("Minted 1000 BOUNTY tokens to:", testAccount);

  const fs = require('fs');
  const contractAddresses = {
    BountyToken: await bountyToken.getAddress(),
    BountyPlatform: await bountyPlatform.getAddress(),
    deployer: deployer.address,
    owner: testAccount
  };

  fs.writeFileSync(
    './deployments.json',
    JSON.stringify(contractAddresses, null, 2)
  );

  console.log("\nDeployment summary:");
  console.log("==================");
  console.log("BountyToken:", await bountyToken.getAddress());
  console.log("BountyPlatform:", await bountyPlatform.getAddress());
  console.log("Deployer:", deployer.address);
  console.log("New Owner:", testAccount);
  console.log("\nContract addresses saved to deployments.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 