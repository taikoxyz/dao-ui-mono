import { getAccount, reconnect } from '@wagmi/core';
import { config } from './wagmi';

/**
 * Attempt to reconnect to previously connected wallet and return the account
 */
export async function reconnectWallet() {
	try {
		console.log('Attempting to reconnect wallet...');

		// Try to reconnect
		await reconnect(config);

		// Get the account after reconnect
		const account = getAccount(config);
		console.log('Reconnect result:', account);

		return account;
	} catch (error) {
		console.error('Failed to reconnect wallet:', error);
		return getAccount(config);
	}
}

/**
 * Wait for wallet to be ready and return the account
 */
export async function waitForWallet(maxAttempts = 10): Promise<ReturnType<typeof getAccount>> {
	for (let i = 0; i < maxAttempts; i++) {
		const account = getAccount(config);

		if (account.address) {
			console.log(`Wallet ready after ${i + 1} attempts:`, account.address);
			return account;
		}

		// Try reconnecting on first few attempts
		if (i < 3) {
			await reconnect(config).catch(() => {});
		}

		// Wait before next attempt
		await new Promise(resolve => setTimeout(resolve, 500));
	}

	console.log('Wallet not ready after max attempts');
	return getAccount(config);
}