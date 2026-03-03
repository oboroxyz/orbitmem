// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {DataRegistry} from "../src/DataRegistry.sol";

contract DataRegistryTest is Test {
    DataRegistry public registry;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        registry = new DataRegistry();
    }

    function test_register_mints_and_sets_URI() public {
        vm.prank(alice);
        uint256 id = registry.register("ipfs://data-1");

        assertEq(id, 1);
        assertEq(registry.ownerOf(id), alice);
        assertEq(registry.tokenURI(id), "ipfs://data-1");
        assertTrue(registry.isActive(id));
    }

    function test_auto_incrementing_IDs() public {
        vm.prank(alice);
        uint256 id1 = registry.register("ipfs://data-1");
        vm.prank(bob);
        uint256 id2 = registry.register("ipfs://data-2");

        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_setActive_toggles_state() public {
        vm.prank(alice);
        uint256 id = registry.register("ipfs://data-1");

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
        uint256 id = registry.register("ipfs://data-1");

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(DataRegistry.NotTokenOwner.selector, id));
        registry.setDataURI(id, "ipfs://hacked");
    }

    function test_only_owner_can_setActive() public {
        vm.prank(alice);
        uint256 id = registry.register("ipfs://data-1");

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(DataRegistry.NotTokenOwner.selector, id));
        registry.setActive(id, false);
    }

    function test_transfer_preserves_state() public {
        vm.prank(alice);
        uint256 id = registry.register("ipfs://data-1");

        vm.prank(alice);
        registry.transferFrom(alice, bob, id);

        assertEq(registry.ownerOf(id), bob);
        assertTrue(registry.isActive(id));
        assertEq(registry.tokenURI(id), "ipfs://data-1");
    }

    function test_register_emits_event() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit DataRegistry.DataRegistered(1, alice, "ipfs://data-1");
        registry.register("ipfs://data-1");
    }

    function test_setActive_emits_event() public {
        vm.prank(alice);
        uint256 id = registry.register("ipfs://data-1");

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit DataRegistry.DataActiveToggled(id, false);
        registry.setActive(id, false);
    }
}
