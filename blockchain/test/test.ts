import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("Lock Contract", function () {
  let lock: any;
  let unlockTime: number;
  let signers: Signer[];

  beforeEach(async function () {
    // Get the list of signers
    signers = await ethers.getSigners();

    // Calculate unlock time (1 minute from now)
    unlockTime = Math.floor(Date.now() / 1000) + 600;
    console.log(`🔐 Unlock time: ${unlockTime}`);

    // Deploy the Lock contract
    const LockFactory = await ethers.getContractFactory("Lock");
    lock = await LockFactory.deploy(unlockTime);
    await lock.waitForDeployment();
  });

  it("should deploy the contract", async function () {
    // Check if contract is deployed
    expect(await lock.getAddress()).to.not.be.undefined;
    console.log(`✅ Lock contract deployed to: ${lock.address}`);
  });

  it("should have the correct unlock time", async function () {
    // Verify that the unlock time is correctly set
    const storedUnlockTime = await lock.unlockTime();
    expect(storedUnlockTime).to.equal(unlockTime);
  });

  it("should be able to access the contract by its address", async function () {
    // Verify that the contract address can be accessed
    const contractAddress = await lock.getAddress();
    expect(contractAddress).to.equal(await lock.getAddress());
  });

  // Add other tests as needed (e.g., for functionality like locking/unlocking)
});
