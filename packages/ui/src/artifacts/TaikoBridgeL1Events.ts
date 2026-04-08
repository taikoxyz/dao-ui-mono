export const TaikoBridgeL1EventsAbi = [
  {
    type: "event",
    name: "MessageSent",
    inputs: [
      { name: "msgHash", type: "bytes32", indexed: true },
      {
        name: "message",
        type: "tuple",
        indexed: false,
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
    ],
    anonymous: false,
  },
] as const;
