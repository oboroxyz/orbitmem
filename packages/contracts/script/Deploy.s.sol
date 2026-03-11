// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {DataRegistry} from "../src/DataRegistry.sol";
import {FeedbackRegistry} from "../src/FeedbackRegistry.sol";

contract Deploy is Script {
    function run() external {
        address owner = vm.envAddress("OWNER");

        vm.startBroadcast();

        DataRegistry dataReg = new DataRegistry(owner);
        console.log("DataRegistry deployed at:", address(dataReg));

        FeedbackRegistry feedbackReg = new FeedbackRegistry(owner);
        console.log("FeedbackRegistry deployed at:", address(feedbackReg));

        console.log("Owner:", owner);

        vm.stopBroadcast();
    }
}
