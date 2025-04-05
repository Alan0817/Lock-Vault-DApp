const hre = require("hardhat");

async function main() {
  const unlockTime = Math.floor(Date.now() / 1000) + 600; // 10 min from now
  const Lock = await hre.ethers.getContractFactory("Lock");
  const lock = await Lock.deploy(unlockTime, {
    value: hre.ethers.utils.parseEther("0.1")
  });

  await lock.deployed();

  console.log("✅ Lock deployed to:", lock.address);
  console.log("🔐 Unlock time:", unlockTime);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
