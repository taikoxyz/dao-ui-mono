import type { AbiFunction, Hex } from "viem";

/**
 * Fallback ABI registry for common function signatures.
 * Used when Etherscan doesn't return a verified ABI.
 */

// Common function ABIs mapped by their 4-byte selector
const FALLBACK_ABI_BY_SELECTOR: Record<string, AbiFunction> = {
  // upgradeTo(address newImplementation)
  "0x3659cfe6": {
    type: "function",
    name: "upgradeTo",
    inputs: [{ name: "newImplementation", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // upgradeToAndCall(address newImplementation, bytes data)
  "0x4f1ef286": {
    type: "function",
    name: "upgradeToAndCall",
    inputs: [
      { name: "newImplementation", type: "address", internalType: "address" },
      { name: "data", type: "bytes", internalType: "bytes" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  // execute(bytes32 _callId, tuple[] _actions, uint256 _allowFailureMap) - DAO execute
  "0xc71bf324": {
    type: "function",
    name: "execute",
    inputs: [
      { name: "_callId", type: "bytes32", internalType: "bytes32" },
      {
        name: "_actions",
        type: "tuple[]",
        internalType: "struct IDAO.Action[]",
        components: [
          { name: "to", type: "address", internalType: "address" },
          { name: "value", type: "uint256", internalType: "uint256" },
          { name: "data", type: "bytes", internalType: "bytes" },
        ],
      },
      { name: "_allowFailureMap", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      { name: "execResults", type: "bytes[]", internalType: "bytes[]" },
      { name: "failureMap", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  // grant(address _where, address _who, bytes32 _permissionId)
  "0x6f0ab882": {
    type: "function",
    name: "grant",
    inputs: [
      { name: "_where", type: "address", internalType: "address" },
      { name: "_who", type: "address", internalType: "address" },
      { name: "_permissionId", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // revoke(address _where, address _who, bytes32 _permissionId)
  "0x8dd14802": {
    type: "function",
    name: "revoke",
    inputs: [
      { name: "_where", type: "address", internalType: "address" },
      { name: "_who", type: "address", internalType: "address" },
      { name: "_permissionId", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // transfer(address to, uint256 amount)
  "0xa9059cbb": {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  // approve(address spender, uint256 amount)
  "0x095ea7b3": {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  // transferFrom(address from, address to, uint256 amount)
  "0x23b872dd": {
    type: "function",
    name: "transferFrom",
    inputs: [
      { name: "from", type: "address", internalType: "address" },
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  // setMetadata(bytes _metadata)
  "0x2b60fdf7": {
    type: "function",
    name: "setMetadata",
    inputs: [{ name: "_metadata", type: "bytes", internalType: "bytes" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // initialize(...)
  "0xc4d66de8": {
    type: "function",
    name: "initialize",
    inputs: [{ name: "_dao", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // applyMultiTargetPermissions(tuple[] _items)
  "0x4f829e8a": {
    type: "function",
    name: "applyMultiTargetPermissions",
    inputs: [
      {
        name: "_items",
        type: "tuple[]",
        internalType: "struct PermissionLib.MultiTargetPermission[]",
        components: [
          { name: "operation", type: "uint8", internalType: "enum PermissionLib.Operation" },
          { name: "where", type: "address", internalType: "address" },
          { name: "who", type: "address", internalType: "address" },
          { name: "condition", type: "address", internalType: "address" },
          { name: "permissionId", type: "bytes32", internalType: "bytes32" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // updateOptimisticGovernanceSettings(tuple _governanceSettings)
  "0xed761581": {
    type: "function",
    name: "updateOptimisticGovernanceSettings",
    inputs: [
      {
        name: "_governanceSettings",
        type: "tuple",
        internalType: "struct OptimisticTokenVotingPlugin.OptimisticGovernanceSettings",
        components: [
          { name: "minVetoRatio", type: "uint32", internalType: "uint32" },
          { name: "minDuration", type: "uint32", internalType: "uint32" },
          { name: "timelockPeriod", type: "uint32", internalType: "uint32" },
          { name: "l2InactivityPeriod", type: "uint32", internalType: "uint32" },
          { name: "l2AggregationGracePeriod", type: "uint32", internalType: "uint32" },
          { name: "skipL2", type: "bool", internalType: "bool" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // updateMultisigSettings(tuple _settings)
  "0xce3a9fa3": {
    type: "function",
    name: "updateMultisigSettings",
    inputs: [
      {
        name: "_settings",
        type: "tuple",
        internalType: "struct Multisig.MultisigSettings",
        components: [
          { name: "onlyListed", type: "bool", internalType: "bool" },
          { name: "minApprovals", type: "uint16", internalType: "uint16" },
          { name: "destinationProposalDuration", type: "uint64", internalType: "uint64" },
          { name: "proposalExpirationPeriod", type: "uint64", internalType: "uint64" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // Multisig execute(uint256 _proposalId)
  "0xfe0d94c1": {
    type: "function",
    name: "execute",
    inputs: [{ name: "_proposalId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // pause()
  "0x8456cb59": {
    type: "function",
    name: "pause",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // unpause()
  "0x3f4ba83a": {
    type: "function",
    name: "unpause",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // setOwner(address)
  "0x13af4035": {
    type: "function",
    name: "setOwner",
    inputs: [{ name: "newOwner", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // setAdmin(address)
  "0x704b6c02": {
    type: "function",
    name: "setAdmin",
    inputs: [{ name: "newAdmin", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // renounceOwnership()
  "0x715018a6": {
    type: "function",
    name: "renounceOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // transferOwnership(address)
  "0xf2fde38b": {
    type: "function",
    name: "transferOwnership",
    inputs: [{ name: "newOwner", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // acceptOwnership()
  "0x79ba5097": {
    type: "function",
    name: "acceptOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
};

/**
 * Get a fallback ABI function for a given selector
 */
export function getFallbackAbiFunction(selector: Hex): AbiFunction | null {
  const normalizedSelector = selector.toLowerCase() as Hex;
  return FALLBACK_ABI_BY_SELECTOR[normalizedSelector] ?? null;
}

/**
 * Get all fallback ABI functions as an array
 */
export function getFallbackAbi(): AbiFunction[] {
  return Object.values(FALLBACK_ABI_BY_SELECTOR);
}

/**
 * Check if we have a fallback for the given selector
 */
export function hasFallbackAbi(selector: Hex): boolean {
  return selector.toLowerCase() in FALLBACK_ABI_BY_SELECTOR;
}
