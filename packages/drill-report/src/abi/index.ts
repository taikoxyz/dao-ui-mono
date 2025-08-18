import { default as SecurityCouncilDrill } from './SecurityCouncilDrill.sol/SecurityCouncilDrill.json';

// Using unknown[] for ABI type since JSON imports are untyped
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ABIs: Record<string, any[]> = {
  SecurityCouncilDrill: SecurityCouncilDrill.abi,
};
