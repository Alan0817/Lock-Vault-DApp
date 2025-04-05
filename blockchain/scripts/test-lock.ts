import { ethers } from "hardhat";
import { Lock } from "../typechain-types"; // Update this path if needed

function delay(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const unlockTime = Math.floor(Date.now() / 1000) + 10; // 30 seconds from now
  const valueToSend = ethers.parseEther("0.01"); // small testnet amount

  console.log(`🔐 Unlock time set to: ${unlockTime} (in 10s)`);
  console.log(`📤 Deployer: ${deployer.address}`);

  const LockFactory = await ethers.getContractFactory("Lock");
  const lock = await LockFactory.deploy(unlockTime, {
    value: valueToSend,
  });

  await lock.waitForDeployment();
  const lockAddress = await lock.getAddress();

  console.log(`✅ Lock contract deployed at: ${lockAddress}`);
  console.log(`💰 Contract balance: ${await ethers.provider.getBalance(lockAddress)} wei`);

  // Test early withdrawal (should fail)
  console.log("⛔ Attempting early withdrawal...");
  try {
    await lock.withdraw();
  } catch (err: any) {
    console.log(`Expected failure: ${err.message}`);
  }

  // Wait until unlock time
  const now = Math.floor(Date.now() / 1000);
  const waitSeconds = unlockTime - now + 1;
  console.log(`⏳ Waiting ${waitSeconds} seconds until unlock...`);
  await delay(waitSeconds);

  // Withdraw after unlockTime
  console.log("🔓 Attempting withdrawal after unlock...");
  const tx = await lock.withdraw();
  await tx.wait();

  console.log(`✅ Withdraw successful!`);
  const finalBalance = await ethers.provider.getBalance(lockAddress);
  console.log(`💸 Final contract balance: ${finalBalance} wei`);
}

main().catch((error) => {
  console.error("❌ Script failed:", error);
  process.exitCode = 1;
});
