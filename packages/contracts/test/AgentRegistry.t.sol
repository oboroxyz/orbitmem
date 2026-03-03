// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";

contract AgentRegistryTest is Test {
    AgentRegistry public registry;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        registry = new AgentRegistry();
    }

    function test_register_mints_and_sets_URI() public {
        vm.prank(alice);
        uint256 id = registry.register("ipfs://agent-1");

        assertEq(id, 1);
        assertEq(registry.ownerOf(id), alice);
        assertEq(registry.tokenURI(id), "ipfs://agent-1");
        assertTrue(registry.isActive(id));
    }

    function test_auto_incrementing_IDs() public {
        vm.prank(alice);
        uint256 id1 = registry.register("ipfs://agent-1");
        vm.prank(bob);
        uint256 id2 = registry.register("ipfs://agent-2");

        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_setActive_toggles_state() public {
        vm.prank(alice);
        uint256 id = registry.register("ipfs://agent-1");

        assertTrue(registry.isActive(id));

        vm.prank(alice);
        registry.setActive(id, false);
        assertFalse(registry.isActive(id));

        vm.prank(alice);
        registry.setActive(id, true);
        assertTrue(registry.isActive(id));
    }

    function test_only_owner_can_update_URI() public {
        vm.prank(alice);
        uint256 id = registry.register("ipfs://agent-1");

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.NotTokenOwner.selector, id));
        registry.setAgentURI(id, "ipfs://hacked");
    }

    function test_only_owner_can_setActive() public {
        vm.prank(alice);
        uint256 id = registry.register("ipfs://agent-1");

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.NotTokenOwner.selector, id));
        registry.setActive(id, false);
    }

    function test_only_owner_can_setAgentWallet() public {
        vm.prank(alice);
        uint256 id = registry.register("ipfs://agent-1");

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.NotTokenOwner.selector, id));
        registry.setAgentWallet(id, bob);
    }

    function test_setAgentWallet_and_getAgentWallet() public {
        vm.prank(alice);
        uint256 id = registry.register("ipfs://agent-1");

        vm.prank(alice);
        registry.setAgentWallet(id, bob);
        assertEq(registry.getAgentWallet(id), bob);
    }

    function test_transfer_preserves_state() public {
        vm.prank(alice);
        uint256 id = registry.register("ipfs://agent-1");

        vm.prank(alice);
        registry.setAgentWallet(id, makeAddr("wallet"));

        vm.prank(alice);
        registry.transferFrom(alice, bob, id);

        assertEq(registry.ownerOf(id), bob);
        assertTrue(registry.isActive(id));
        assertEq(registry.getAgentWallet(id), makeAddr("wallet"));
        assertEq(registry.tokenURI(id), "ipfs://agent-1");
    }

    function test_register_emits_event() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit AgentRegistry.AgentRegistered(1, alice, "ipfs://agent-1");
        registry.register("ipfs://agent-1");
    }

    function test_setActive_emits_event() public {
        vm.prank(alice);
        uint256 id = registry.register("ipfs://agent-1");

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit AgentRegistry.AgentActiveToggled(id, false);
        registry.setActive(id, false);
    }

    function test_setAgentWallet_emits_event() public {
        vm.prank(alice);
        uint256 id = registry.register("ipfs://agent-1");

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit AgentRegistry.AgentWalletSet(id, bob);
        registry.setAgentWallet(id, bob);
    }
}
