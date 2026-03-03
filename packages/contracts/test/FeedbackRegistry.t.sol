// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {FeedbackRegistry} from "../src/FeedbackRegistry.sol";

contract FeedbackRegistryTest is Test {
    AgentRegistry public agentReg;
    FeedbackRegistry public feedback;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address dave = makeAddr("dave");

    uint256 agentId;

    function setUp() public {
        agentReg = new AgentRegistry();
        feedback = new FeedbackRegistry();

        vm.prank(alice);
        agentId = agentReg.register("ipfs://agent-1");
    }

    function test_giveFeedback_emits_event_and_updates_score() public {
        vm.prank(bob);
        vm.expectEmit(true, true, true, true);
        emit FeedbackRegistry.FeedbackGiven(
            address(agentReg), agentId, bob, 85, 0, "accurate", "", "", bytes32(0)
        );
        feedback.giveFeedback(address(agentReg), agentId, 85, 0, "accurate", "", "", bytes32(0));

        (int256 total, uint256 count) = feedback.getScore(address(agentReg), agentId);
        assertEq(total, 85);
        assertEq(count, 1);
    }

    function test_selfFeedback_reverts() public {
        vm.prank(alice);
        vm.expectRevert(FeedbackRegistry.SelfFeedbackNotAllowed.selector);
        feedback.giveFeedback(address(agentReg), agentId, 90, 0, "", "", "", bytes32(0));
    }

    function test_nonexistent_entity_reverts() public {
        vm.prank(bob);
        vm.expectRevert(); // ownerOf reverts for nonexistent token
        feedback.giveFeedback(address(agentReg), 999, 50, 0, "", "", "", bytes32(0));
    }

    function test_multiple_raters_aggregate_correctly() public {
        vm.prank(bob);
        feedback.giveFeedback(address(agentReg), agentId, 80, 0, "", "", "", bytes32(0));

        vm.prank(carol);
        feedback.giveFeedback(address(agentReg), agentId, 90, 0, "", "", "", bytes32(0));

        vm.prank(dave);
        feedback.giveFeedback(address(agentReg), agentId, 70, 0, "", "", "", bytes32(0));

        (int256 total, uint256 count) = feedback.getScore(address(agentReg), agentId);
        assertEq(total, 240); // 80+90+70
        assertEq(count, 3);
        // Average: 240/3 = 80
    }

    function test_per_tag_scores_tracked_separately() public {
        vm.prank(bob);
        feedback.giveFeedback(address(agentReg), agentId, 90, 0, "accurate", "", "", bytes32(0));

        vm.prank(carol);
        feedback.giveFeedback(address(agentReg), agentId, 60, 0, "fresh", "", "", bytes32(0));

        vm.prank(dave);
        feedback.giveFeedback(address(agentReg), agentId, 80, 0, "accurate", "", "", bytes32(0));

        (int256 accurateTotal, uint256 accurateCount) =
            feedback.getTagScore(address(agentReg), agentId, "accurate");
        assertEq(accurateTotal, 170); // 90+80
        assertEq(accurateCount, 2);

        (int256 freshTotal, uint256 freshCount) =
            feedback.getTagScore(address(agentReg), agentId, "fresh");
        assertEq(freshTotal, 60);
        assertEq(freshCount, 1);

        // Overall score includes all
        (int256 total, uint256 count) = feedback.getScore(address(agentReg), agentId);
        assertEq(total, 230); // 90+60+80
        assertEq(count, 3);
    }

    function test_revokeFeedback_decrements_score() public {
        vm.prank(bob);
        feedback.giveFeedback(address(agentReg), agentId, 80, 0, "accurate", "", "", bytes32(0));

        vm.prank(carol);
        feedback.giveFeedback(address(agentReg), agentId, 90, 0, "accurate", "", "", bytes32(0));

        // Bob revokes their feedback (index 0)
        vm.prank(bob);
        feedback.revokeFeedback(address(agentReg), agentId, 0);

        (int256 total, uint256 count) = feedback.getScore(address(agentReg), agentId);
        assertEq(total, 90);
        assertEq(count, 1);

        // Tag score also decremented
        (int256 tagTotal, uint256 tagCount) =
            feedback.getTagScore(address(agentReg), agentId, "accurate");
        assertEq(tagTotal, 90);
        assertEq(tagCount, 1);

        // The entry is marked as revoked
        FeedbackRegistry.FeedbackEntry memory entry =
            feedback.getFeedback(address(agentReg), agentId, bob, 0);
        assertTrue(entry.isRevoked);
    }

    function test_only_original_giver_can_revoke() public {
        vm.prank(bob);
        feedback.giveFeedback(address(agentReg), agentId, 80, 0, "", "", "", bytes32(0));

        // Carol tries to revoke Bob's feedback
        vm.prank(carol);
        vm.expectRevert(FeedbackRegistry.FeedbackIndexOutOfBounds.selector);
        feedback.revokeFeedback(address(agentReg), agentId, 0);
    }

    function test_cannot_revoke_already_revoked() public {
        vm.prank(bob);
        feedback.giveFeedback(address(agentReg), agentId, 80, 0, "", "", "", bytes32(0));

        vm.prank(bob);
        feedback.revokeFeedback(address(agentReg), agentId, 0);

        vm.prank(bob);
        vm.expectRevert(FeedbackRegistry.FeedbackAlreadyRevoked.selector);
        feedback.revokeFeedback(address(agentReg), agentId, 0);
    }

    function test_getFeedbackCount() public {
        vm.prank(bob);
        feedback.giveFeedback(address(agentReg), agentId, 80, 0, "", "", "", bytes32(0));
        vm.prank(bob);
        feedback.giveFeedback(address(agentReg), agentId, 90, 0, "", "", "", bytes32(0));

        assertEq(feedback.getFeedbackCount(address(agentReg), agentId, bob), 2);
        assertEq(feedback.getFeedbackCount(address(agentReg), agentId, carol), 0);
    }

    function test_revokeFeedback_emits_event() public {
        vm.prank(bob);
        feedback.giveFeedback(address(agentReg), agentId, 80, 0, "", "", "", bytes32(0));

        vm.prank(bob);
        vm.expectEmit(true, true, true, true);
        emit FeedbackRegistry.FeedbackRevoked(address(agentReg), agentId, bob, 0);
        feedback.revokeFeedback(address(agentReg), agentId, 0);
    }
}
