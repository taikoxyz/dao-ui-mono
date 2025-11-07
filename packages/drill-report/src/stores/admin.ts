import { writable, derived, get } from 'svelte/store';
import { watchAccount, getAccount } from '@wagmi/core';
import { config } from '$lib/wagmi';
import { checkAdminRole, type AdminStatus } from '../services/drill-admin';
import { waitForWallet } from '$lib/wallet-utils';
import type { Address } from 'viem';

function createAdminStore() {
	const { subscribe, set, update } = writable<AdminStatus>({
		isAdmin: false,
		address: undefined,
		isLoading: false,
		error: null
	});

	let checkTimeout: NodeJS.Timeout | null = null;

	// Function to check admin status for an address
	async function checkAdmin(address: Address | undefined) {
		if (!address) {
			set({
				isAdmin: false,
				address: undefined,
				isLoading: false,
				error: null
			});
			return;
		}

		// Set loading state
		update((state) => ({ ...state, isLoading: true, error: null }));

		try {
			const isAdmin = await checkAdminRole(address);
			set({
				isAdmin,
				address,
				isLoading: false,
				error: null
			});
		} catch (error) {
			console.error('Admin check error:', error);
			set({
				isAdmin: false,
				address,
				isLoading: false,
				error: error instanceof Error ? error.message : 'Failed to check admin status'
			});
		}
	}

	// Function to initialize and check wallet
	const initializeWalletCheck = async () => {
		// Wait for wallet to be ready
		const account = await waitForWallet();
		if (account.address) {
			checkAdmin(account.address);
		}
	};

	// Watch for account changes
	if (typeof window !== 'undefined') {
		// Set up the watcher
		const unwatch = watchAccount(config, {
			onChange(account) {
				// Clear any pending check
				if (checkTimeout) {
					clearTimeout(checkTimeout);
				}

				// Debounce the admin check
				if (account.address) {
					checkTimeout = setTimeout(() => {
						checkAdmin(account.address);
					}, 500);
				} else {
					// Reset if disconnected
					set({
						isAdmin: false,
						address: undefined,
						isLoading: false,
						error: null
					});
				}
			}
		});

		// Check after a delay to allow AppKit to initialize
		setTimeout(() => {
			initializeWalletCheck();
		}, 1500);

		// Also check periodically for connection state
		const intervalId = setInterval(() => {
			const account = getAccount(config);
			const currentState = get(adminStore);
			if (account.address && account.address !== currentState.address) {
				checkAdmin(account.address);
			}
		}, 5000);

		// Store cleanup functions
		(window as any).__adminStoreCleanup = () => {
			unwatch();
			clearInterval(intervalId);
			if (checkTimeout) clearTimeout(checkTimeout);
		};
	}

	return {
		subscribe,
		checkAdmin,
		reset: () =>
			set({
				isAdmin: false,
				address: undefined,
				isLoading: false,
				error: null
			})
	};
}

export const adminStore = createAdminStore();

// Derived store for easy access to admin status
export const isAdmin = derived(adminStore, ($adminStore) => $adminStore.isAdmin);
export const isCheckingAdmin = derived(adminStore, ($adminStore) => $adminStore.isLoading);
