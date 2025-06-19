const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy BountyToken first
  console.log("\nDeploying BountyToken...");
  const BountyToken = await ethers.getContractFactory("BountyToken");
  const bountyToken = await BountyToken.deploy();
  await bountyToken.waitForDeployment();
  console.log("BountyToken deployed to:", await bountyToken.getAddress());

  // Deploy BountyPlatform
  console.log("\nDeploying BountyPlatform...");
  const BountyPlatform = await ethers.getContractFactory("BountyPlatform");
  const bountyPlatform = await BountyPlatform.deploy(deployer.address); // Fee recipient is deployer
  await bountyPlatform.waitForDeployment();
  console.log("BountyPlatform deployed to:", await bountyPlatform.getAddress());

  // Transfer some tokens to a test account (if you want to use a different account)
  const testAccount = "0x8cedae1423a74d0a13f09d5192f3b430ec0d88a3"; // Your current MetaMask account
  console.log("\nTransferring ownership and tokens to test account:", testAccount);
  
  // Transfer ownership of BountyToken to test account
  await bountyToken.transferOwnership(testAccount);
  console.log("BountyToken ownership transferred to:", testAccount);
  
  // Mint some tokens to test account
  const mintAmount = ethers.parseEther("1000"); // 1000 tokens
  await bountyToken.mint(testAccount, mintAmount);
  console.log("Minted 1000 BOUNTY tokens to:", testAccount);

  // Save the addresses to a file for frontend
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