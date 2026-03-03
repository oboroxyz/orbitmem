export const FeedbackRegistryAbi = [
  {
    "type": "function",
    "name": "getFeedback",
    "inputs": [
      {
        "name": "registry",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "entityId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "client",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "index",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct FeedbackRegistry.FeedbackEntry",
        "components": [
          {
            "name": "value",
            "type": "int128",
            "internalType": "int128"
          },
          {
            "name": "valueDecimals",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "tag1",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "tag2",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "isRevoked",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getFeedbackCount",
    "inputs": [
      {
        "name": "registry",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "entityId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "client",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getScore",
    "inputs": [
      {
        "name": "registry",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "entityId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "totalValue",
        "type": "int256",
        "internalType": "int256"
      },
      {
        "name": "count",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTagScore",
    "inputs": [
      {
        "name": "registry",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "entityId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "tag1",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "totalValue",
        "type": "int256",
        "internalType": "int256"
      },
      {
        "name": "count",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "giveFeedback",
    "inputs": [
      {
        "name": "registry",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "entityId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "value",
        "type": "int128",
        "internalType": "int128"
      },
      {
        "name": "valueDecimals",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "tag1",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "tag2",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "feedbackURI",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "feedbackHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "revokeFeedback",
    "inputs": [
      {
        "name": "registry",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "entityId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "index",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "FeedbackGiven",
    "inputs": [
      {
        "name": "registry",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "entityId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "client",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "int128",
        "indexed": false,
        "internalType": "int128"
      },
      {
        "name": "valueDecimals",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "tag1",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "tag2",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "feedbackURI",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "feedbackHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "FeedbackRevoked",
    "inputs": [
      {
        "name": "registry",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "entityId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "client",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "index",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "EntityDoesNotExist",
    "inputs": []
  },
  {
    "type": "error",
    "name": "FeedbackAlreadyRevoked",
    "inputs": []
  },
  {
    "type": "error",
    "name": "FeedbackIndexOutOfBounds",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotFeedbackGiver",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SelfFeedbackNotAllowed",
    "inputs": []
  }
] as const;
