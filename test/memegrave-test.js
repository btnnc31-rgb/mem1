const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MemeGrave", function () {
  let owner, alice, bob;
  let token, priceFeed, vrfCoordinator, meme;
  const DECIMALS = 8;
  const INITIAL_PRICE = 100000000;
  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("Mock Token", "MCK");
    await token.deployed();

    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    priceFeed = await MockV3Aggregator.deploy(DECIMALS, INITIAL_PRICE);
    await priceFeed.deployed();

    const VRFCoordinatorV2Mock = await ethers.getContractFactory("VRFCoordinatorV2Mock");
    vrfCoordinator = await VRFCoordinatorV2Mock.deploy(1, 1);
    await vrfCoordinator.deployed();

    const subId = await vrfCoordinator.createSubscription();
    await vrfCoordinator.fundSubscription(subId, ethers.utils.parseEther("2"));

    const MemeGrave = await ethers.getContractFactory("MemeGrave");
    const MIN_USD = ethers.BigNumber.from(5).mul(ethers.BigNumber.from(10).pow(DECIMALS));
    meme = await MemeGrave.deploy(vrfCoordinator.address, ethers.constants.HashZero, subId, MIN_USD);
    await meme.deployed();

    await vrfCoordinator.addConsumer(subId, meme.address);
    await meme.setPriceFeed(token.address, priceFeed.address);

    await token.mint(alice.address, ethers.utils.parseUnits("1000"));
    await token.mint(bob.address, ethers.utils.parseUnits("1000"));
  });

  it("accepts deposit, records entry and splits pools", async function () {
    await token.connect(alice).approve(meme.address, ethers.utils.parseUnits("10"));
    await meme.connect(alice).deposit(token.address, ethers.utils.parseUnits("10"));
    const count = await meme.getEntriesCount();
    expect(count).to.equal(1);
    const prize = await meme.prizePool(token.address);
    const eco = await meme.ecosystemPool(token.address);
    const dev = await meme.developerPool(token.address);
    const rev = await meme.revivalPool(token.address);
    expect(prize).to.equal(ethers.utils.parseUnits("5"));
    expect(eco).to.equal(ethers.utils.parseUnits("3"));
    expect(dev).to.equal(ethers.utils.parseUnits("1"));
    expect(rev).to.equal(ethers.utils.parseUnits("1"));
  });

  it("requests VRF and picks a winner transferring prizePool tokens", async function () {
    await token.connect(alice).approve(meme.address, ethers.utils.parseUnits("10"));
    await meme.connect(alice).deposit(token.address, ethers.utils.parseUnits("10"));
    await token.connect(bob).approve(meme.address, ethers.utils.parseUnits("20"));
    await meme.connect(bob).deposit(token.address, ethers.utils.parseUnits("20"));
    const prizeBefore = await meme.prizePool(token.address);
    expect(prizeBefore).to.equal(ethers.utils.parseUnits("15"));
    const tx = await meme.requestDraw();
    const rc = await tx.wait();
    const ev = rc.events.find(e => e.event === 'DrawRequested');
    const requestId = ev.args.requestId;
    const tx2 = await vrfCoordinator.fulfillRandomWords(requestId, meme.address);
    await tx2.wait();
    const prizeAfter = await meme.prizePool(token.address);
    expect(prizeAfter).to.equal(0);
    const aliceBal = await token.balanceOf(alice.address);
    const bobBal = await token.balanceOf(bob.address);
    const aliceDiff = aliceBal.sub(ethers.utils.parseUnits("1000"));
    const bobDiff = bobBal.sub(ethers.utils.parseUnits("1000"));
    const gotPrize = (aliceDiff.eq(ethers.utils.parseUnits("15")) || bobDiff.eq(ethers.utils.parseUnits("15")));
    expect(gotPrize).to.equal(true);
  });
});