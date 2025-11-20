// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract VRFCoordinatorV2Mock {
    uint96 public baseFee;
    uint96 public gasPriceLink;
    uint64 private currentSubId;
    mapping(uint64 => uint256) public s_balances;
    mapping(uint64 => mapping(address => bool)) public consumers;
    event SubscriptionCreated(uint64 subId, address owner);
    event RandomWordsRequested(uint256 requestId, uint64 subId, address requester);

    constructor(uint96 _baseFee, uint96 _gasPriceLink) {
        baseFee = _baseFee;
        gasPriceLink = _gasPriceLink;
        currentSubId = 1;
    }

    function createSubscription() external returns (uint64) {
        uint64 subId = currentSubId++;
        s_balances[subId] = 0;
        emit SubscriptionCreated(subId, msg.sender);
        return subId;
    }

    function fundSubscription(uint64 subId, uint256 amount) external {
        s_balances[subId] += amount;
    }

    function addConsumer(uint64 subId, address consumer) external {
        consumers[subId][consumer] = true;
    }

    function requestRandomWords(
        bytes32,
        uint64 subId,
        uint16,
        uint32,
        uint32
    ) external returns (uint256 requestId) {
        require(consumers[subId][msg.sender], "Not a consumer");
        requestId = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, subId)));
        emit RandomWordsRequested(requestId, subId, msg.sender);
    }

    function fulfillRandomWords(uint256 requestId, address consumerAddr) external {
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = uint256(keccak256(abi.encodePacked(block.timestamp, requestId, consumerAddr)));
        (bool ok, ) = consumerAddr.call(abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", requestId, randomWords));
        require(ok, "fulfill call failed");
    }
}