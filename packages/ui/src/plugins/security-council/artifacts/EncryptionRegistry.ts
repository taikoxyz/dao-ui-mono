export const EncryptionRegistryAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "_addresslist",
        type: "address",
        internalType: "contract Addresslist",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "accountList",
    inputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "accounts",
    inputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "appointedAgent",
        type: "address",
        internalType: "address",
      },
      {
        name: "publicKey",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "appointAgent",
    inputs: [
      {
        name: "_newAgent",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "appointerOf",
    inputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAppointedAgent",
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
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRegisteredAccounts",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address[]",
        internalType: "address[]",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setOwnPublicKey",
    inputs: [
      {
        name: "_publicKey",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setPublicKey",
    inputs: [
      {
        name: "_accountOwner",
        type: "address",
        internalType: "address",
      },
      {
        name: "_publicKey",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
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
    type: "event",
    name: "AgentAppointed",
    inputs: [
      {
        name: "account",
        type: "address",
        indexed: false,
        internalType: "address",
      },
      {
        name: "agent",
        type: "address",
        indexed: false,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PublicKeySet",
    inputs: [
      {
        name: "account",
        type: "address",
        indexed: false,
        internalType: "address",
      },
      {
        name: "publicKey",
        type: "bytes32",
        indexed: false,
        internalType: "bytes32",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "AlreadyAppointed",
    inputs: [],
  },
  {
    type: "error",
    name: "AlreadyListed",
    inputs: [],
  },
  {
    type: "error",
    name: "CannotAppointContracts",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidAddressList",
    inputs: [],
  },
  {
    type: "error",
    name: "MustBeAppointed",
    inputs: [],
  },
  {
    type: "error",
    name: "MustBeListed",
    inputs: [],
  },
  {
    type: "error",
    name: "MustResetAppointedAgent",
    inputs: [],
  },
] as const;
