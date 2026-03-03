// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {DataRegistry} from "../src/DataRegistry.sol";
import {FeedbackRegistry} from "../src/FeedbackRegistry.sol";

/// @title IntegrationTest — Data discovery & reputation flow
contract IntegrationTest is Test {
    DataRegistry public dataReg;
    FeedbackRegistry public feedback;

    address alice = makeAddr("alice"); // data owner
    address bob = makeAddr("bob"); // agent / rater
    address carol = makeAddr("carol"); // additional rater
    address dave = makeAddr("dave"); // additional rater

    uint256 dataId;

    function setUp() public {
        dataReg = new DataRegistry();
        feedback = new FeedbackRegistry();

        // Alice registers data
        vm.prank(alice);
        dataId = dataReg.register("ipfs://data-alice");
    }

    function test_data_discovery_and_rating_flow() public {
        // Step 1: Bob rates Alice's data (score: 90)
        vm.prank(bob);
        feedback.giveFeedback(address(dataReg), dataId, 90, 0, "accurate", "", "", bytes32(0));

        // Step 2: Verify data score = 90
        (int256 dataTotal, uint256 dataCount) = feedback.getScore(address(dataReg), dataId);
        assertEq(dataTotal, 90);
        assertEq(dataCount, 1);
    }

    function test_multiple_raters_converge_score() public {
        // Bob, Carol, Dave all rate Alice's data
        vm.prank(bob);
        feedback.giveFeedback(address(dataReg), dataId, 95, 0, "accurate", "", "", bytes32(0));
        vm.prank(carol);
        feedback.giveFeedback(address(dataReg), dataId, 88, 0, "complete", "", "", bytes32(0));
        vm.prank(dave);
        feedback.giveFeedback(address(dataReg), dataId, 92, 0, "accurate", "", "", bytes32(0));

        // Data score: (95+88+92)/3 ≈ 91.67 average, total=275, count=3
        (int256 dataTotal, uint256 dataCount) = feedback.getScore(address(dataReg), dataId);
        assertEq(dataTotal, 275);
        assertEq(dataCount, 3);

        // Per-tag: "accurate" on data = 95+92 = 187, count=2
        (int256 accurateTotal, uint256 accurateCount) =
            feedback.getTagScore(address(dataReg), dataId, "accurate");
        assertEq(accurateTotal, 187);
        assertEq(accurateCount, 2);

        // Per-tag: "complete" on data = 88, count=1
        (int256 completeTotal, uint256 completeCount) =
            feedback.getTagScore(address(dataReg), dataId, "complete");
        assertEq(completeTotal, 88);
        assertEq(completeCount, 1);
    }

    function test_revoke_and_re_rate_flow() public {
        // Bob rates Alice's data
        vm.prank(bob);
        feedback.giveFeedback(address(dataReg), dataId, 50, 0, "incomplete", "", "", bytes32(0));

        // Check score
        (int256 total, uint256 count) = feedback.getScore(address(dataReg), dataId);
        assertEq(total, 50);
        assertEq(count, 1);

        // Bob revokes and gives a better score
        vm.prank(bob);
        feedback.revokeFeedback(address(dataReg), dataId, 0);

        (total, count) = feedback.getScore(address(dataReg), dataId);
        assertEq(total, 0);
        assertEq(count, 0);

        // Bob gives new feedback
        vm.prank(bob);
        feedback.giveFeedback(address(dataReg), dataId, 85, 0, "accurate", "", "", bytes32(0));

        (total, count) = feedback.getScore(address(dataReg), dataId);
        assertEq(total, 85);
        assertEq(count, 1);
    }
}
