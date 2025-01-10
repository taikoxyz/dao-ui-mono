export const SignerListAbi = [
  {
    type: "constructor",
    inputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addSigners",
    inputs: [
      {
        name: "_signers",
        type: "address[]",
        internalType: "address[]",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addresslistLength",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "addresslistLengthAtBlock",
    inputs: [
      {
        name: "_blockNumber",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "dao",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IDAO",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getEncryptionAgents",
    inputs: [],
    outputs: [
      {
        name: "result",
        type: "address[]",
        internalType: "address[]",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getListedEncryptionOwnerAtBlock",
    inputs: [
      {
        name: "_address",
        type: "address",
        internalType: "address",
      },
      {
        name: "_blockNumber",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "_owner",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "initialize",
    inputs: [
      {
        name: "_dao",
        type: "address",
        internalType: "contract IDAO",
      },
      {
        name: "_signers",
        type: "address[]",
        internalType: "address[]",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isListed",
    inputs: [
      {
        name: "_account",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isListedAtBlock",
    inputs: [
      {
        name: "_account",
        type: "address",
        internalType: "address",
      },
      {
        name: "_blockNumber",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isListedOrAppointedByListed",
    inputs: [
      {
        name: "_address",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "listedOrAppointedByListed",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "removeSigners",
    inputs: [
      {
        name: "_signers",
        type: "address[]",
        internalType: "address[]",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resolveEncryptionAccountAtBlock",
    inputs: [
      {
        name: "_address",
        type: "address",
        internalType: "address",
      },
      {
        name: "_blockNumber",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "_owner",
        type: "address",
        internalType: "address",
      },
      {
        name: "_agent",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "settings",
    inputs: [],
    outputs: [
      {
        name: "encryptionRegistry",
        type: "address",
        internalType: "contract EncryptionRegistry",
      },
      {
        name: "minSignerListLength",
        type: "uint16",
        internalType: "uint16",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "supportsInterface",
    inputs: [
      {
        name: "_interfaceId",
        type: "bytes4",
        internalType: "bytes4",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "updateSettings",
    inputs: [
      {
        name: "_newSettings",
        type: "tuple",
        internalType: "struct SignerList.Settings",
        components: [
          {
            name: "encryptionRegistry",
            type: "address",
            internalType: "contract EncryptionRegistry",
          },
          {
            name: "minSignerListLength",
            type: "uint16",
            internalType: "uint16",
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Initialized",
    inputs: [
      {
        name: "version",
        type: "uint8",
        indexed: false,
        internalType: "uint8",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SignerListSettingsUpdated",
    inputs: [
      {
        name: "encryptionRegistry",
        type: "address",
        indexed: false,
        internalType: "contract EncryptionRegistry",
      },
      {
        name: "minSignerListLength",
        type: "uint16",
        indexed: false,
        internalType: "uint16",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SignersAdded",
    inputs: [
      {
        name: "signers",
        type: "address[]",
        indexed: false,
        internalType: "address[]",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SignersRemoved",
    inputs: [
      {
        name: "signers",
        type: "address[]",
        indexed: false,
        internalType: "address[]",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "DaoUnauthorized",
    inputs: [
      {
        name: "dao",
        type: "address",
        internalType: "address",
      },
      {
        name: "where",
        type: "address",
        internalType: "address",
      },
      {
        name: "who",
        type: "address",
        internalType: "address",
      },
      {
        name: "permissionId",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
  },
  {
    type: "error",
    name: "InvalidAddresslistUpdate",
    inputs: [
      {
        name: "member",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "InvalidEncryptionRegitry",
    inputs: [
      {
        name: "givenAddress",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "SignerListLengthOutOfBounds",
    inputs: [
      {
        name: "limit",
        type: "uint16",
        internalType: "uint16",
      },
      {
        name: "actual",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
] as const;
