// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {DataRegistry} from "../src/DataRegistry.sol";
import {FeedbackRegistry} from "../src/FeedbackRegistry.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        AgentRegistry agentReg = new AgentRegistry();
        console.log("AgentRegistry deployed at:", address(agentReg));

        DataRegistry dataReg = new DataRegistry();
        console.log("DataRegistry deployed at:", address(dataReg));

        FeedbackRegistry feedbackReg = new FeedbackRegistry();
        console.log("FeedbackRegistry deployed at:", address(feedbackReg));

        vm.stopBroadcast();
    }
}
