// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {
    ERC721URIStorage
} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @title DataRegistry — ERC-8004 Data Entry NFTs
/// @notice Each token represents a data entry with metadata URI and active flag.
contract DataRegistry is ERC721URIStorage {
    uint256 private _nextTokenId = 1;

    mapping(uint256 => bool) private _active;

    event DataRegistered(uint256 indexed dataId, address indexed owner, string dataURI);
    event DataActiveToggled(uint256 indexed dataId, bool active);

    error NotTokenOwner(uint256 tokenId);

    modifier onlyTokenOwner(uint256 tokenId) {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner(tokenId);
        _;
    }

    constructor() ERC721("OrbitMem Data", "OMD") {}

    /// @notice Register a new data entry, minting an NFT to the caller.
    function register(string calldata dataURI) external returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, dataURI);
        _active[tokenId] = true;

        emit DataRegistered(tokenId, msg.sender, dataURI);
        return tokenId;
    }

    /// @notice Update the metadata URI for a data entry.
    function setDataURI(uint256 tokenId, string calldata dataURI) external onlyTokenOwner(tokenId) {
        _setTokenURI(tokenId, dataURI);
    }

    /// @notice Toggle the active status of a data entry.
    function setActive(uint256 tokenId, bool active) external onlyTokenOwner(tokenId) {
        _active[tokenId] = active;
        emit DataActiveToggled(tokenId, active);
    }

    /// @notice Check if a data entry is active.
    function isActive(uint256 tokenId) external view returns (bool) {
        ownerOf(tokenId); // reverts if nonexistent
        return _active[tokenId];
    }
}
