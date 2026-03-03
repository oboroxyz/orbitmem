// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title FeedbackRegistry — ERC-8004 Shared Reputation Ledger
/// @notice Registry-agnostic feedback system. Callers pass a registry address + entity ID.
///         Works with DataRegistry or any ERC-721 registry.
contract FeedbackRegistry {
    struct FeedbackEntry {
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        bool isRevoked;
    }

    struct Score {
        int256 totalValue;
        uint256 count;
    }

    /// @dev feedback[registry][entityId][client] → FeedbackEntry[]
    mapping(address => mapping(uint256 => mapping(address => FeedbackEntry[]))) private _feedback;

    /// @dev Aggregated scores per entity: scores[registry][entityId]
    mapping(address => mapping(uint256 => Score)) private _scores;

    /// @dev Per-tag scores: tagScores[registry][entityId][keccak256(tag1)]
    mapping(address => mapping(uint256 => mapping(bytes32 => Score))) private _tagScores;

    event FeedbackGiven(
        address indexed registry,
        uint256 indexed entityId,
        address indexed client,
        int128 value,
        uint8 valueDecimals,
        string tag1,
        string tag2,
        string feedbackURI,
        bytes32 feedbackHash
    );

    event FeedbackRevoked(
        address indexed registry, uint256 indexed entityId, address indexed client, uint256 index
    );

    error EntityDoesNotExist();
    error SelfFeedbackNotAllowed();
    error NotFeedbackGiver();
    error FeedbackAlreadyRevoked();
    error FeedbackIndexOutOfBounds();

    /// @notice Submit feedback for an entity in a given registry.
    /// @param registry Address of the ERC-721 registry (e.g. DataRegistry).
    /// @param entityId Token ID of the entity being rated.
    /// @param value Feedback value (e.g. 0–100 quality score, signed for flexibility).
    /// @param valueDecimals Decimal places for the value.
    /// @param tag1 Primary category tag (e.g. "accurate", "complete", "fresh").
    /// @param tag2 Secondary tag for additional context.
    /// @param feedbackURI Off-chain URI with detailed feedback (can be empty).
    /// @param feedbackHash Content hash of the feedback URI data (can be zero).
    function giveFeedback(
        address registry,
        uint256 entityId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external {
        // Validate entity exists via ownerOf (reverts for nonexistent tokens)
        address entityOwner = IERC721(registry).ownerOf(entityId);
        if (entityOwner == msg.sender) revert SelfFeedbackNotAllowed();

        _feedback[registry][entityId][msg.sender].push(
            FeedbackEntry({
                value: value, valueDecimals: valueDecimals, tag1: tag1, tag2: tag2, isRevoked: false
            })
        );

        // Update aggregated score
        _scores[registry][entityId].totalValue += value;
        _scores[registry][entityId].count += 1;

        // Update per-tag score if tag1 is non-empty
        if (bytes(tag1).length > 0) {
            bytes32 tagKey = keccak256(bytes(tag1));
            _tagScores[registry][entityId][tagKey].totalValue += value;
            _tagScores[registry][entityId][tagKey].count += 1;
        }

        emit FeedbackGiven(
            registry,
            entityId,
            msg.sender,
            value,
            valueDecimals,
            tag1,
            tag2,
            feedbackURI,
            feedbackHash
        );
    }

    /// @notice Revoke a previously given feedback entry.
    /// @param registry Address of the ERC-721 registry.
    /// @param entityId Token ID of the entity.
    /// @param index Index of the feedback entry in the caller's feedback array.
    function revokeFeedback(address registry, uint256 entityId, uint256 index) external {
        FeedbackEntry[] storage entries = _feedback[registry][entityId][msg.sender];
        if (index >= entries.length) revert FeedbackIndexOutOfBounds();

        FeedbackEntry storage entry = entries[index];
        if (entry.isRevoked) revert FeedbackAlreadyRevoked();

        entry.isRevoked = true;

        // Decrement aggregated score
        _scores[registry][entityId].totalValue -= entry.value;
        _scores[registry][entityId].count -= 1;

        // Decrement per-tag score
        if (bytes(entry.tag1).length > 0) {
            bytes32 tagKey = keccak256(bytes(entry.tag1));
            _tagScores[registry][entityId][tagKey].totalValue -= entry.value;
            _tagScores[registry][entityId][tagKey].count -= 1;
        }

        emit FeedbackRevoked(registry, entityId, msg.sender, index);
    }

    /// @notice Get the aggregated score for an entity.
    /// @return totalValue Sum of all non-revoked feedback values.
    /// @return count Number of non-revoked feedback entries.
    function getScore(address registry, uint256 entityId)
        external
        view
        returns (int256 totalValue, uint256 count)
    {
        Score storage s = _scores[registry][entityId];
        return (s.totalValue, s.count);
    }

    /// @notice Get the aggregated score for a specific tag on an entity.
    function getTagScore(address registry, uint256 entityId, string calldata tag1)
        external
        view
        returns (int256 totalValue, uint256 count)
    {
        bytes32 tagKey = keccak256(bytes(tag1));
        Score storage s = _tagScores[registry][entityId][tagKey];
        return (s.totalValue, s.count);
    }

    /// @notice Get a specific feedback entry.
    function getFeedback(address registry, uint256 entityId, address client, uint256 index)
        external
        view
        returns (FeedbackEntry memory)
    {
        return _feedback[registry][entityId][client][index];
    }

    /// @notice Get the number of feedback entries from a specific client.
    function getFeedbackCount(address registry, uint256 entityId, address client)
        external
        view
        returns (uint256)
    {
        return _feedback[registry][entityId][client].length;
    }
}
