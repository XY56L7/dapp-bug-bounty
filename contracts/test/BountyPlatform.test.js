const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BountyPlatform", function () {
  let bountyPlatform;
  let bountyToken;
  let owner;
  let creator;
  let developer1;
  let developer2;
  let feeRecipient;

  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const BOUNTY_REWARD = ethers.parseEther("100");
  const PLATFORM_FEE = 250;

  beforeEach(async function () {
    [owner, creator, developer1, developer2, feeRecipient] = await ethers.getSigners();

    const BountyToken = await ethers.getContractFactory("BountyToken");
    bountyToken = await BountyToken.deploy();
    await bountyToken.waitForDeployment();

    const BountyPlatform = await ethers.getContractFactory("BountyPlatform");
    bountyPlatform = await BountyPlatform.deploy(feeRecipient.address);
    await bountyPlatform.waitForDeployment();

    await bountyToken.transfer(creator.address, ethers.parseEther("10000"));
  });

  describe("Deployment", function () {
    it("Should set the correct fee recipient", async function () {
      expect(await bountyPlatform.feeRecipient()).to.equal(feeRecipient.address);
    });

    it("Should set the correct platform fee", async function () {
      expect(await bountyPlatform.platformFee()).to.equal(PLATFORM_FEE);
    });

    it("Should have correct token initial supply", async function () {
      expect(await bountyToken.totalSupply()).to.equal(INITIAL_SUPPLY);
    });
  });

  describe("Creating Bounties", function () {
    it("Should create a bounty successfully", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      
      await bountyToken.connect(creator).approve(bountyPlatform.target, BOUNTY_REWARD);
      
      const tx = await bountyPlatform.connect(creator).createBounty(
        "Test Bounty",
        "Test Description",
        "Test Requirements",
        bountyToken.target,
        BOUNTY_REWARD,
        deadline
      );

      await expect(tx)
        .to.emit(bountyPlatform, "BountyCreated")
        .withArgs(1, creator.address, "Test Bounty", bountyToken.target, BOUNTY_REWARD, deadline);

      const bounty = await bountyPlatform.getBountyDetails(1);
      expect(bounty[0]).to.equal(1);
      expect(bounty[1]).to.equal(creator.address);
      expect(bounty[2]).to.equal("Test Bounty");
      expect(bounty[6]).to.equal(BOUNTY_REWARD);
    });

    it("Should fail to create bounty with empty title", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      
      await bountyToken.connect(creator).approve(bountyPlatform.target, BOUNTY_REWARD);
      
      await expect(
        bountyPlatform.connect(creator).createBounty(
          "",
          "Test Description",
          "Test Requirements",
          bountyToken.target,
          BOUNTY_REWARD,
          deadline
        )
      ).to.be.revertedWith("Title cannot be empty");
    });

    it("Should fail to create bounty with past deadline", async function () {
      const pastDeadline = Math.floor(Date.now() / 1000) - 86400;
      
      await bountyToken.connect(creator).approve(bountyPlatform.target, BOUNTY_REWARD);
      
      await expect(
        bountyPlatform.connect(creator).createBounty(
          "Test Bounty",
          "Test Description",
          "Test Requirements",
          bountyToken.target,
          BOUNTY_REWARD,
          pastDeadline
        )
      ).to.be.revertedWith("Deadline must be in the future");
    });
  });

  describe("Submitting Solutions", function () {
    let bountyId;
    
    beforeEach(async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      
      await bountyToken.connect(creator).approve(bountyPlatform.target, BOUNTY_REWARD);
      await bountyPlatform.connect(creator).createBounty(
        "Test Bounty",
        "Test Description",
        "Test Requirements",
        bountyToken.target,
        BOUNTY_REWARD,
        deadline
      );
      bountyId = 1;
    });

    it("Should submit solution successfully", async function () {
      const tx = await bountyPlatform.connect(developer1).submitSolution(
        bountyId,
        "https://github.com/test/solution",
        "My solution description"
      );

      await expect(tx)
        .to.emit(bountyPlatform, "SubmissionCreated")
        .withArgs(bountyId, 1, developer1.address, "https://github.com/test/solution");

      const submission = await bountyPlatform.getSubmission(bountyId, 1);
      expect(submission[1]).to.equal(developer1.address);
      expect(submission[2]).to.equal("https://github.com/test/solution");
    });

    it("Should fail to submit solution twice", async function () {
      await bountyPlatform.connect(developer1).submitSolution(
        bountyId,
        "https://github.com/test/solution1",
        "First solution"
      );

      await expect(
        bountyPlatform.connect(developer1).submitSolution(
          bountyId,
          "https://github.com/test/solution2",
          "Second solution"
        )
      ).to.be.revertedWith("Already submitted a solution");
    });

    it("Should fail to submit solution with empty URL", async function () {
      await expect(
        bountyPlatform.connect(developer1).submitSolution(
          bountyId,
          "",
          "My solution description"
        )
      ).to.be.revertedWith("Solution URL cannot be empty");
    });
  });

  describe("Selecting Winners", function () {
    let bountyId;
    
    beforeEach(async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      
      await bountyToken.connect(creator).approve(bountyPlatform.target, BOUNTY_REWARD);
      await bountyPlatform.connect(creator).createBounty(
        "Test Bounty",
        "Test Description",
        "Test Requirements",
        bountyToken.target,
        BOUNTY_REWARD,
        deadline
      );
      bountyId = 1;

      await bountyPlatform.connect(developer1).submitSolution(
        bountyId,
        "https://github.com/dev1/solution",
        "Developer 1 solution"
      );
      await bountyPlatform.connect(developer2).submitSolution(
        bountyId,
        "https://github.com/dev2/solution",
        "Developer 2 solution"
      );
    });

    it("Should select winner successfully", async function () {
      const initialBalance = await bountyToken.balanceOf(developer1.address);
      
      const tx = await bountyPlatform.connect(creator).selectWinner(bountyId, 1);

      const expectedReward = BOUNTY_REWARD - (BOUNTY_REWARD * BigInt(PLATFORM_FEE)) / BigInt(10000);
      
      await expect(tx)
        .to.emit(bountyPlatform, "BountyCompleted")
        .withArgs(bountyId, developer1.address, expectedReward);

      const finalBalance = await bountyToken.balanceOf(developer1.address);
      expect(finalBalance - initialBalance).to.equal(expectedReward);

      const bounty = await bountyPlatform.getBountyDetails(bountyId);
      expect(bounty[8]).to.equal(1);
      expect(bounty[9]).to.equal(developer1.address);
    });

    it("Should fail to select winner twice", async function () {
      await bountyPlatform.connect(creator).selectWinner(bountyId, 1);

      await expect(
        bountyPlatform.connect(creator).selectWinner(bountyId, 2)
      ).to.be.revertedWith("Bounty is not active");
    });

    it("Should fail to select non-existent submission", async function () {
      await expect(
        bountyPlatform.connect(creator).selectWinner(bountyId, 99)
      ).to.be.revertedWith("Invalid submission ID");
    });

    it("Should fail if not bounty creator", async function () {
      await expect(
        bountyPlatform.connect(developer1).selectWinner(bountyId, 1)
      ).to.be.revertedWith("Not the bounty creator");
    });
  });

  describe("Cancelling Bounties", function () {
    let bountyId;
    
    beforeEach(async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      
      await bountyToken.connect(creator).approve(bountyPlatform.target, BOUNTY_REWARD);
      await bountyPlatform.connect(creator).createBounty(
        "Test Bounty",
        "Test Description",
        "Test Requirements",
        bountyToken.target,
        BOUNTY_REWARD,
        deadline
      );
      bountyId = 1;
    });

    it("Should cancel bounty successfully", async function () {
      const initialBalance = await bountyToken.balanceOf(creator.address);
      
      const tx = await bountyPlatform.connect(creator).cancelBounty(bountyId);

      await expect(tx)
        .to.emit(bountyPlatform, "BountyCancelled")
        .withArgs(bountyId);

      const finalBalance = await bountyToken.balanceOf(creator.address);
      expect(finalBalance - initialBalance).to.equal(BOUNTY_REWARD);

      const bounty = await bountyPlatform.getBountyDetails(bountyId);
      expect(bounty[8]).to.equal(2);
    });

    it("Should fail if not bounty creator", async function () {
      await expect(
        bountyPlatform.connect(developer1).cancelBounty(bountyId)
      ).to.be.revertedWith("Not the bounty creator");
    });
  });

  describe("Platform Administration", function () {
    it("Should set platform fee", async function () {
      const newFee = 500;
      await bountyPlatform.connect(owner).setPlatformFee(newFee);
      expect(await bountyPlatform.platformFee()).to.equal(newFee);
    });

    it("Should fail to set fee above 10%", async function () {
      await expect(
        bountyPlatform.connect(owner).setPlatformFee(1001)
      ).to.be.revertedWith("Fee cannot exceed 10%");
    });

    it("Should set fee recipient", async function () {
      const newRecipient = developer1.address;
      await bountyPlatform.connect(owner).setFeeRecipient(newRecipient);
      expect(await bountyPlatform.feeRecipient()).to.equal(newRecipient);
    });
  });
}); 