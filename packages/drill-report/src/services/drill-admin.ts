import { readContract, writeContract, waitForTransactionReceipt } from '@wagmi/core';
import { config } from '$lib/wagmi';
import type { Address } from 'viem';
import { ABIs } from '../abi';
import mainnetConfig from '../config/mainnet.config.json';

// Contract addresses
const DRILL_CONTRACT_ADDRESS = mainnetConfig.contracts.SecurityCouncilDrill as Address;

// The DEFAULT_ADMIN_ROLE is typically 0x00... (32 bytes of zeros)
const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

export interface AdminStatus {
	isAdmin: boolean;
	address: Address | undefined;
	isLoading: boolean;
	error: string | null;
}

/**
 * Check if an address has admin role on the SecurityCouncilDrill contract
 */
export async function checkAdminRole(address: Address): Promise<boolean> {
	try {
		const hasRole = await readContract(config, {
			address: DRILL_CONTRACT_ADDRESS,
			abi: ABIs.SecurityCouncilDrill,
			functionName: 'hasRole',
			args: [DEFAULT_ADMIN_ROLE, address],
		});

		return hasRole as boolean;
	} catch (error) {
		console.error('Error checking admin role:', error);
		return false;
	}
}

/**
 * Get the current drill nonce
 */
export async function getDrillNonce(): Promise<bigint> {
	try {
		const nonce = await readContract(config, {
			address: DRILL_CONTRACT_ADDRESS,
			abi: ABIs.SecurityCouncilDrill,
			functionName: 'drillNonce',
		});

		return nonce as bigint;
	} catch (error) {
		console.error('Error getting drill nonce:', error);
		return BigInt(0);
	}
}

/**
 * Get targets for a specific drill
 */
export async function getDrillTargets(drillNonce: bigint): Promise<Address[]> {
	try {
		const targets = await readContract(config, {
			address: DRILL_CONTRACT_ADDRESS,
			abi: ABIs.SecurityCouncilDrill,
			functionName: 'getTargets',
			args: [drillNonce],
		});

		return targets as Address[];
	} catch (error) {
		console.error('Error getting drill targets:', error);
		return [];
	}
}

/**
 * Start a new drill with specified targets
 */
export async function startDrill(targets: Address[]): Promise<{ hash: string; success: boolean; error?: string }> {
	try {
		// Validate targets
		if (!targets || targets.length === 0) {
			return { hash: '', success: false, error: 'No targets provided' };
		}

		if (targets.length > 12) {
			return { hash: '', success: false, error: 'Too many targets (max 12)' };
		}

		// Write to the contract
		const hash = await writeContract(config, {
			address: DRILL_CONTRACT_ADDRESS,
			abi: ABIs.SecurityCouncilDrill,
			functionName: 'start',
			args: [targets],
		});

		// Wait for transaction confirmation
		const receipt = await waitForTransactionReceipt(config, {
			hash,
		});

		return {
			hash,
			success: receipt.status === 'success',
		};
	} catch (error: any) {
		console.error('Error starting drill:', error);
		return {
			hash: '',
			success: false,
			error: error?.message || 'Failed to start drill',
		};
	}
}