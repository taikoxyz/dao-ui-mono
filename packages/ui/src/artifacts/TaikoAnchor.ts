export const TaikoAnchorAbi = [
  {
    type: "function",
    name: "getBlockState",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        name: "",
        components: [
          { name: "anchorBlockNumber", type: "uint48" },
          { name: "ancestorsHash", type: "bytes32" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;
