export const TaikoBridgeL2Abi = [
  {
    type: "function",
    name: "processMessage",
    inputs: [
      {
        name: "_message",
        type: "tuple",
        components: [
          { name: "id", type: "uint64" },
          { name: "fee", type: "uint64" },
          { name: "gasLimit", type: "uint32" },
          { name: "from", type: "address" },
          { name: "srcChainId", type: "uint64" },
          { name: "srcOwner", type: "address" },
          { name: "destChainId", type: "uint64" },
          { name: "destOwner", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
      { name: "_proof", type: "bytes" },
    ],
    outputs: [
      { name: "", type: "uint8" },
      { name: "", type: "uint8" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "messageStatus",
    inputs: [{ name: "msgHash", type: "bytes32" }],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
] as const;
