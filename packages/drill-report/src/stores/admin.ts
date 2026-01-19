import { writable, derived } from 'svelte/store';
import { watchAccount, getAccount } from '@wagmi/core';
import { config } from '$lib/wagmi';
import { checkAdminRole, type AdminStatus } from '../services/drill-admin';
import type { Address } from 'viem';

let unwatch: (() => void) | null = null;

function createAdminStore() {
	const { subscribe, set, update } = writable<AdminStatus>({
		isAdmin: false,
		address: undefined,
		isLoading: false,
		error: null
	});

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

	// Initialize watcher - call this from a component's onMount
	function init() {
		if (typeof window === 'undefined' || unwatch) return;

		// Check current account immediately
		const account = getAccount(config);
		if (account.address) {
			checkAdmin(account.address);
		}

		// Watch for account changes
		unwatch = watchAccount(config, {
			onChange(account) {
				if (account.address) {
					checkAdmin(account.address);
				} else {
					set({
						isAdmin: false,
						address: undefined,
						isLoading: false,
						error: null
					});
				}
			}
		});
	}

	// Cleanup watcher - call this from a component's onDestroy
	function cleanup() {
		if (unwatch) {
			unwatch();
			unwatch = null;
		}
	}

	return {
		subscribe,
		checkAdmin,
		init,
		cleanup,
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
