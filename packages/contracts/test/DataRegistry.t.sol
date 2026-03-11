// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {DataRegistry} from "../src/DataRegistry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract DataRegistryTest is Test {
    DataRegistry public registry;
    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        registry = new DataRegistry(owner);
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

    // --- Ownable tests ---

    function test_owner_is_set() public view {
        assertEq(registry.owner(), owner);
    }

    function test_non_owner_cannot_pause() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        registry.pause();
    }

    // --- Pausable tests ---

    function test_pause_blocks_register() public {
        vm.prank(owner);
        registry.pause();

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        registry.register("ipfs://data-1");
    }

    function test_pause_blocks_setDataURI() public {
        vm.prank(alice);
        uint256 id = registry.register("ipfs://data-1");

        vm.prank(owner);
        registry.pause();

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        registry.setDataURI(id, "ipfs://data-2");
    }

    function test_pause_blocks_setActive() public {
        vm.prank(alice);
        uint256 id = registry.register("ipfs://data-1");

        vm.prank(owner);
        registry.pause();

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        registry.setActive(id, false);
    }

    function test_unpause_restores_functionality() public {
        vm.prank(owner);
        registry.pause();

        vm.prank(owner);
        registry.unpause();

        vm.prank(alice);
        uint256 id = registry.register("ipfs://data-1");
        assertEq(id, 1);
    }
}
