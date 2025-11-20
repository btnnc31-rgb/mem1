// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract MemeGrave is Ownable, ReentrancyGuard, VRFConsumerBaseV2 {
    using SafeERC20 for IERC20;

    struct Entry {
        address user;
        address token;
        uint256 amount;
        uint256 ts;
    }

    mapping(address => uint256) public prizePool;
    mapping(address => uint256) public ecosystemPool;
    mapping(address => uint256) public developerPool;
    mapping(address => uint256) public revivalPool;

    Entry[] public entries;

    address[] public trackedTokens;
    mapping(address => bool) public tokenTracked;

    mapping(address => AggregatorV3Interface) public priceFeed;
    uint256 public minUsdScaled;

    VRFCoordinatorV2Interface immutable COORDINATOR;
    bytes32 public keyHash;
    uint64 public subscriptionId;
    uint32 public callbackGasLimit = 200000;
    uint16 public requestConfirmations = 3;
    uint32 public numWords = 1;
    uint256 public lastRequestId;

    event Deposited(address indexed user, address indexed token, uint256 amount, uint256 usdScaled);
    event EntryAdded(address indexed user, uint256 entryIndex);
    event DrawRequested(uint256 requestId, address requester);
    event WinnerPicked(address indexed winner, uint256 indexed entryIndex, uint256 timestamp);
    event Withdrawn(address indexed to, address token, uint256 amount, string reason);
    event PriceFeedSet(address token, address feed);
    event MinUsdScaledSet(uint256 minUsdScaled);

    constructor(
        address vrfCoordinator_,
        bytes32 keyHash_,
        uint64 subscriptionId_,
        uint256 minUsdScaled_
    ) VRFConsumerBaseV2(vrfCoordinator_) {
        COORDINATOR = VRFCoordinatorV2Interface(vrfCoordinator_);
        keyHash = keyHash_;
        subscriptionId = subscriptionId_;
        minUsdScaled = minUsdScaled_;
    }

    function setPriceFeed(address token, address feed) external onlyOwner {
        priceFeed[token] = AggregatorV3Interface(feed);
        emit PriceFeedSet(token, feed);
    }

    function setMinUsdScaled(uint256 minUsdScaled_) external onlyOwner {
        minUsdScaled = minUsdScaled_;
        emit MinUsdScaledSet(minUsdScaled_);
    }

    function setVRFParams(bytes32 keyHash_, uint64 subscriptionId_, uint32 callbackGasLimit_) external onlyOwner {
        keyHash = keyHash_;
        subscriptionId = subscriptionId_;
        callbackGasLimit = callbackGasLimit_;
    }

    function trackToken(address token) internal {
        if (!tokenTracked[token]) {
            tokenTracked[token] = true;
            trackedTokens.push(token);
        }
    }

    function deposit(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount=0");
        AggregatorV3Interface feed = priceFeed[token];
        require(address(feed) != address(0), "No price feed for token");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        uint256 usdScaled = _getTokenUsdScaled(token, amount);
        require(usdScaled >= minUsdScaled, "Deposit < min USD");

        uint256 toPrize = (amount * 50) / 100;
        uint256 toEco = (amount * 30) / 100;
        uint256 toDev = (amount * 10) / 100;
        uint256 toRev = amount - toPrize - toEco - toDev;

        prizePool[token] += toPrize;
        ecosystemPool[token] += toEco;
        developerPool[token] += toDev;
        revivalPool[token] += toRev;

        trackToken(token);

        entries.push(Entry({user: msg.sender, token: token, amount: amount, ts: block.timestamp}));
        uint256 entryIndex = entries.length - 1;

        emit Deposited(msg.sender, token, amount, usdScaled);
        emit EntryAdded(msg.sender, entryIndex);
    }

    function requestDraw() external onlyOwner returns (uint256 requestId) {
        require(entries.length > 0, "No entries");
        requestId = COORDINATOR.requestRandomWords(
            keyHash,
            subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );
        lastRequestId = requestId;
        emit DrawRequested(requestId, msg.sender);
    }

    function fulfillRandomWords(uint256, uint256[] memory randomWords) internal override {
        require(entries.length > 0, "No entries");
        uint256 rand = randomWords[0];
        uint256 idx = rand % entries.length;
        Entry memory winnerEntry = entries[idx];
        address winner = winnerEntry.user;

        for (uint256 i = 0; i < trackedTokens.length; i++) {
            address token = trackedTokens[i];
            uint256 amount = prizePool[token];
            if (amount > 0) {
                prizePool[token] = 0;
                IERC20(token).safeTransfer(winner, amount);
            }
        }

        delete entries;
        emit WinnerPicked(winner, idx, block.timestamp);
    }

    function withdrawEcosystem(address token, address to) external onlyOwner {
        uint256 amt = ecosystemPool[token];
        require(amt > 0, "Zero");
        ecosystemPool[token] = 0;
        IERC20(token).safeTransfer(to, amt);
        emit Withdrawn(to, token, amt, "ecosystem");
    }

    function withdrawDeveloper(address token, address to) external onlyOwner {
        uint256 amt = developerPool[token];
        require(amt > 0, "Zero");
        developerPool[token] = 0;
        IERC20(token).safeTransfer(to, amt);
        emit Withdrawn(to, token, amt, "developer");
    }

    function withdrawRevival(address token, address to) external onlyOwner {
        uint256 amt = revivalPool[token];
        require(amt > 0, "Zero");
        revivalPool[token] = 0;
        IERC20(token).safeTransfer(to, amt);
        emit Withdrawn(to, token, amt, "revival");
    }

    function getEntriesCount() external view returns (uint256) {
        return entries.length;
    }

    function getTrackedTokens() external view returns (address[] memory) {
        return trackedTokens;
    }

    function _getTokenUsdScaled(address token, uint256 amount) internal view returns (uint256) {
        AggregatorV3Interface feed = priceFeed[token];
        require(address(feed) != address(0), "No feed");
        (, int256 price, , , ) = feed.latestRoundData();
        require(price > 0, "Invalid price");

        uint8 tokenDecimals = 18;
        try IERC20Metadata(token).decimals() returns (uint8 d) {
            tokenDecimals = d;
        } catch {
            tokenDecimals = 18;
        }

        uint256 p = uint256(price);
        uint256 usdScaled = (amount * p) / (10 ** tokenDecimals);
        return usdScaled;
    }
}