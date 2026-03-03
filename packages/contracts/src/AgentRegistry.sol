// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {
    ERC721URIStorage
} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @title AgentRegistry — ERC-8004 Agent Identity NFTs
/// @notice Each token represents an AI agent identity with metadata URI, active flag, and wallet binding.
contract AgentRegistry is ERC721URIStorage {
    uint256 private _nextTokenId = 1;

    mapping(uint256 => bool) private _active;
    mapping(uint256 => address) private _agentWallet;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI);
    event AgentActiveToggled(uint256 indexed agentId, bool active);
    event AgentWalletSet(uint256 indexed agentId, address wallet);

    error NotTokenOwner(uint256 tokenId);

    modifier onlyTokenOwner(uint256 tokenId) {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner(tokenId);
        _;
    }

    constructor() ERC721("OrbitMem Agent", "OMA") {}

    /// @notice Register a new agent, minting an NFT to the caller.
    function register(string calldata agentURI) external returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, agentURI);
        _active[tokenId] = true;

        emit AgentRegistered(tokenId, msg.sender, agentURI);
        return tokenId;
    }

    /// @notice Update the metadata URI for an agent.
    function setAgentURI(uint256 tokenId, string calldata agentURI)
        external
        onlyTokenOwner(tokenId)
    {
        _setTokenURI(tokenId, agentURI);
    }

    /// @notice Toggle the active status of an agent.
    function setActive(uint256 tokenId, bool active) external onlyTokenOwner(tokenId) {
        _active[tokenId] = active;
        emit AgentActiveToggled(tokenId, active);
    }

    /// @notice Bind an EVM wallet address to an agent token.
    function setAgentWallet(uint256 tokenId, address wallet) external onlyTokenOwner(tokenId) {
        _agentWallet[tokenId] = wallet;
        emit AgentWalletSet(tokenId, wallet);
    }

    /// @notice Get the wallet address bound to an agent.
    function getAgentWallet(uint256 tokenId) external view returns (address) {
        ownerOf(tokenId); // reverts if nonexistent
        return _agentWallet[tokenId];
    }

    /// @notice Check if an agent is active.
    function isActive(uint256 tokenId) external view returns (bool) {
        ownerOf(tokenId); // reverts if nonexistent
        return _active[tokenId];
    }
}
