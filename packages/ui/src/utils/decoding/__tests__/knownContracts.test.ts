import { describe, it, expect, vi } from "vitest";
import type { DecodedNode } from "../types";

// Real Taiko mainnet addresses, captured from on-chain verification:
//  - TaikoDAOController proxy 0x75Ba… (impl verified name "TaikoDAOController")
//  - the OSx DAO proxy 0x9CDf… (impl verified name "DAO")
// Standard proposals route execute() through the CONTROLLER, whose address is NOT
// the DAO address — the regression these tests lock in was gating on the DAO
// address alone, which collapsed real batches to raw calldata.
const DAO = "0x9CDf589C941ee81D75F34d3755671d614f7cf261" as const;
const CONTROLLER = "0x75Ba76403b13b26AD1beC70D6eE937314eeaCD0a" as const;
const RANDOM = "0x000000000000000000000000000000000000dEaD" as const;
const TAIKO_L2_BRIDGE = "0x1670000000000000000000000000000000000001" as const;
const TAIKO_L2_SIGNAL = "0x1670000000000000000000000000000000000005" as const;

// Populate the env-derived address sets so the strict (prod-like) branch is
// exercised: PUB_DAO_ADDRESS set, real L1/L2 bridge + signal addresses present.
vi.mock("@/constants", () => ({
  PUB_DAO_ADDRESS: DAO,
  PUB_TAIKO_BRIDGE_ADDRESS: "0xd60247c6848B7Ca29eDdF63AA924E53dB6Ddd8EC",
  L1_SIGNAL_SERVICE_ADDRESS: "0x9e0a24964e5397B566c1ed39258e21aB5E35C77C",
  TAIKO_DAO_CONTROLLER_ADDRESS: CONTROLLER,
  DELEGATE_CONTROLLER_ADDRESS: "0xfA06E15B8b4c5BF3FC5d9cfD083d45c53Cbe8C7C",
  TAIKO_L2_BRIDGE_ADDRESS: TAIKO_L2_BRIDGE,
  TAIKO_L2_SIGNAL_SERVICE_ADDRESS: TAIKO_L2_SIGNAL,
  TAIKO_L2_CHAIN_ID: 167000,
}));

const { isKnownExecutor, isKnownBridge } = await import("../knownContracts");

function node(over: Partial<DecodedNode>): Pick<DecodedNode, "to" | "name"> {
  return { to: RANDOM, ...over } as Pick<DecodedNode, "to" | "name">;
}

describe("isKnownExecutor (address-gated)", () => {
  it("recognizes the TaikoDAOController by its checked-in address (the real standard-proposal executor, NOT the DAO address)", () => {
    expect(isKnownExecutor(node({ to: CONTROLLER, name: "TaikoDAOController" }))).toBe(true);
    // Address is the boundary: a verified name is neither required nor relied upon.
    expect(isKnownExecutor(node({ to: CONTROLLER, name: undefined }))).toBe(true);
  });

  it("recognizes the OSx DAO by its configured address", () => {
    expect(isKnownExecutor(node({ to: DAO, name: undefined }))).toBe(true);
  });

  it("REJECTS name spoofing: a foreign address with a trusted-looking verified name is not dressed up as a batch", () => {
    expect(isKnownExecutor(node({ to: RANDOM, name: "DAO" }))).toBe(false);
    expect(isKnownExecutor(node({ to: RANDOM, name: "TaikoDAOController" }))).toBe(false);
    expect(isKnownExecutor(node({ to: RANDOM, name: undefined }))).toBe(false);
  });
});

describe("isKnownBridge", () => {
  it("recognizes the Taiko bridge + signal-service addresses (case-insensitive)", () => {
    expect(isKnownBridge(TAIKO_L2_BRIDGE)).toBe(true);
    expect(isKnownBridge(TAIKO_L2_SIGNAL)).toBe(true);
    expect(isKnownBridge(TAIKO_L2_BRIDGE.toUpperCase() as `0x${string}`)).toBe(true);
  });

  it("rejects a non-bridge address", () => {
    expect(isKnownBridge(RANDOM)).toBe(false);
    expect(isKnownBridge(CONTROLLER)).toBe(false);
  });
});
