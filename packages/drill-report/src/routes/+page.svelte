<script lang="ts">
	import { onMount } from 'svelte';
	import { createPublicClient, http, type PublicClient, parseAbiItem, type Log } from 'viem';
	import { mainnet } from 'viem/chains';
	import { ABIs } from '../abi';
	import config from '../config/mainnet.config.json';
	import securityCouncilProfiles from '../../../ui/src/data/security-council-profiles.json';

	let maxDrillNonce: bigint | null = null;
	let currentDrillNonce: bigint = 1n;
	let loading = false;
	let loadingTargets = false;
	let error: string | null = null;
	let client: PublicClient;
	let targets: string[] = [];
	let pingStatuses: Record<string, boolean | 'loading'> = {};
	let pingDetails: Record<
		string,
		{ blockNumber: bigint; timestamp: bigint; transactionHash: string } | null
	> = {};
	let drillStartBlock: bigint | null = null;
	let drillStartTimestamp: bigint | null = null;
	let targetAccounts: Record<string, string | null> = {}; // Maps delegated address to main account

	// Create a map of addresses to names from the profiles
	const profileMap: Record<string, string> = {};
	securityCouncilProfiles.forEach((profile: { address: string; name: string }) => {
		profileMap[profile.address.toLowerCase()] = profile.name;
	});

	async function fetchMaxDrillNonce() {
		loading = true;
		error = null;
		maxDrillNonce = null;

		try {
			client = createPublicClient({
				chain: mainnet,
				transport: http(config.urls.rpc)
			});

			const result = await client.readContract({
				address: config.contracts.SecurityCouncilDrill as `0x${string}`,
				abi: ABIs.SecurityCouncilDrill,
				functionName: 'drillNonce',
				args: []
			});

			maxDrillNonce = result as unknown as bigint;

			// Start with the highest (most recent) nonce
			if (maxDrillNonce && maxDrillNonce > 0n) {
				currentDrillNonce = maxDrillNonce;
				await fetchDrillData();
			}
		} catch (err) {
			console.error('Error fetching max drill nonce:', err);
			error = err instanceof Error ? err.message : 'Unknown error occurred';
		} finally {
			loading = false;
		}
	}

	async function fetchDrillData() {
		if (!client || !maxDrillNonce) return;

		loadingTargets = true;
		targets = [];
		pingStatuses = {};
		pingDetails = {};
		targetAccounts = {};
		drillStartBlock = null;
		drillStartTimestamp = null;

		try {
			// Fetch targets for current drill nonce
			const targetsResult = await client.readContract({
				address: config.contracts.SecurityCouncilDrill as `0x${string}`,
				abi: ABIs.SecurityCouncilDrill,
				functionName: 'getTargets',
				args: [currentDrillNonce]
			});

			targets = targetsResult as string[];

			// Initialize all targets as loading
			targets.forEach((target) => {
				pingStatuses[target] = 'loading';
				pingDetails[target] = null;
				targetAccounts[target] = null;
			});

			// Fetch account associations from SignerList for each target
			const accountPromises = targets.map(async (target) => {
				try {
					// Get the latest block number and use a slightly older one to avoid "block not yet mined" errors
					const latestBlock = await client.getBlockNumber();
					const queryBlock = latestBlock - 10n; // Use a block that's definitely been mined

					// Get the owner account for this delegated address
					const owner = await client.readContract({
						address: config.contracts.SignerList as `0x${string}`,
						abi: ABIs.SignerList,
						functionName: 'getListedEncryptionOwnerAtBlock',
						args: [target, queryBlock]
					});

					if (
						owner &&
						(owner as unknown as string) !== '0x0000000000000000000000000000000000000000'
					) {
						targetAccounts[target] = owner as unknown as string;
					}

					// Trigger reactivity
					targetAccounts = { ...targetAccounts };
				} catch (err) {
					console.error(`Error fetching account for ${target}:`, err);
				}
			});

			// Fetch accounts in parallel with other data
			Promise.all(accountPromises).catch(console.error);

			// Mark that we're done loading the target list
			loadingTargets = false;

			// Fetch DrillStarted event to get the start block
			// We'll search in chunks to avoid exceeding block range limits
			try {
				const latestBlock = await client.getBlockNumber();
				const contractDeployBlock = 20000000n; // Approximate deployment block for the contract
				let searchFromBlock = contractDeployBlock;
				let drillStartedLogs: Log[] = [];

				// Search in chunks of 40,000 blocks to stay under the 50,000 limit
				const chunkSize = 40000n;

				// For drill #3 and other older drills, we need to search further back
				// Drill #3 is likely much older, so we need a wider search range
				if (currentDrillNonce <= 3n) {
					// For very old drills, search from contract deployment
					searchFromBlock = contractDeployBlock;
				} else {
					// For all other drills, search from ~6 months back (~1.3M blocks)
					// This ensures we catch drills that may have started a while ago
					searchFromBlock = latestBlock - 1300000n;
					if (searchFromBlock < contractDeployBlock) {
						searchFromBlock = contractDeployBlock;
					}
				}

				console.log('[DEBUG] DrillStarted search:', {
					currentDrillNonce: currentDrillNonce.toString(),
					maxDrillNonce: maxDrillNonce.toString(),
					latestBlock: latestBlock.toString(),
					searchFromBlock: searchFromBlock.toString()
				});

				let attempts = 0;
				const maxAttempts = 100; // Allow more attempts for older drills

				while (
					searchFromBlock < latestBlock &&
					drillStartedLogs.length === 0 &&
					attempts < maxAttempts
				) {
					const searchToBlock =
						searchFromBlock + chunkSize > latestBlock ? latestBlock : searchFromBlock + chunkSize;

					try {
						const logs = await client.getLogs({
							address: config.contracts.SecurityCouncilDrill as `0x${string}`,
							event: parseAbiItem(
								'event DrillStarted(uint256 indexed drillNonce, address[] targets)'
							),
							args: {
								drillNonce: currentDrillNonce
							},
							fromBlock: searchFromBlock,
							toBlock: searchToBlock
						});

						if (logs.length > 0) {
							drillStartedLogs = logs;
							console.log('[DEBUG] Found DrillStarted event at attempt', attempts, 'block:', logs[0].blockNumber.toString());
							break;
						}
					} catch (chunkErr) {
						console.log('[DEBUG] Chunk error at attempt', attempts, ':', chunkErr);
					}

					searchFromBlock = searchToBlock + 1n;
					attempts++;
				}

				console.log('[DEBUG] DrillStarted search completed:', {
					attempts,
					found: drillStartedLogs.length > 0,
					drillStartedLogs: drillStartedLogs.length
				});

				if (drillStartedLogs.length > 0) {
					drillStartBlock = drillStartedLogs[0].blockNumber;
					// Get the timestamp of the start block
					const startBlock = await client.getBlock({ blockNumber: drillStartBlock! });
					drillStartTimestamp = startBlock.timestamp;
					console.log('[DEBUG] drillStartTimestamp set to:', drillStartTimestamp.toString());
				} else {
					console.log('[DEBUG] No DrillStarted event found after', attempts, 'attempts');
				}
			} catch (err) {
				console.error('Error fetching drill start event:', err);
			}

			// Fetch ping status and events for each target in parallel
			const pingPromises = targets.map(async (target) => {
				try {
					const hasPinged = await client.readContract({
						address: config.contracts.SecurityCouncilDrill as `0x${string}`,
						abi: ABIs.SecurityCouncilDrill,
						functionName: 'hasPinged',
						args: [currentDrillNonce, target]
					});

					pingStatuses[target] = Boolean(hasPinged);
					console.log('[DEBUG] hasPinged for', target.slice(0, 10), ':', hasPinged);

					// If pinged, fetch the event details
					if (hasPinged) {
						try {
							const latestBlock = await client.getBlockNumber();
							let searchFromBlock = drillStartBlock || latestBlock - 500000n;
							let pingLogs: Log[] = [];

							console.log('[DEBUG] Searching DrillPinged for', target.slice(0, 10), 'from block:', searchFromBlock.toString(), 'drillStartBlock:', drillStartBlock?.toString() || 'null');

							// Search in chunks to handle large block ranges
							const chunkSize = 40000n;
							let attempts = 0;
							const maxAttempts = 20; // Limit search to prevent infinite loops

							while (
								searchFromBlock < latestBlock &&
								pingLogs.length === 0 &&
								attempts < maxAttempts
							) {
								const searchToBlock =
									searchFromBlock + chunkSize > latestBlock
										? latestBlock
										: searchFromBlock + chunkSize;

								try {
									const logs = await client.getLogs({
										address: config.contracts.SecurityCouncilDrill as `0x${string}`,
										event: parseAbiItem(
											'event DrillPinged(uint256 indexed drillNonce, address indexed member)'
										),
										args: {
											drillNonce: currentDrillNonce,
											member: target as `0x${string}`
										},
										fromBlock: searchFromBlock,
										toBlock: searchToBlock
									});

									if (logs.length > 0) {
										pingLogs = logs;
										console.log('[DEBUG] Found DrillPinged for', target.slice(0, 10), 'at block:', logs[0].blockNumber.toString());
										break;
									}
								} catch (chunkErr) {
									console.log('[DEBUG] DrillPinged chunk error for', target.slice(0, 10), ':', chunkErr);
								}

								searchFromBlock = searchToBlock + 1n;
								attempts++;
							}

							if (pingLogs.length > 0) {
								const pingBlock = await client.getBlock({ blockNumber: pingLogs[0].blockNumber });
								pingDetails[target] = {
									blockNumber: pingLogs[0].blockNumber,
									timestamp: pingBlock.timestamp,
									transactionHash: pingLogs[0].transactionHash
								};
								console.log('[DEBUG] pingDetails set for', target.slice(0, 10), ':', pingDetails[target]);
							} else {
								console.log('[DEBUG] No DrillPinged found for', target.slice(0, 10), 'after', attempts, 'attempts');
							}
						} catch (err) {
							console.error(`Error fetching ping event for ${target}:`, err);
						}
					}

					// Trigger reactivity
					pingStatuses = { ...pingStatuses };
					pingDetails = { ...pingDetails };
				} catch (err) {
					console.error(`Error fetching ping status for ${target}:`, err);
					pingStatuses[target] = false;
					// Trigger reactivity
					pingStatuses = { ...pingStatuses };
				}
			});

			// Wait for all ping status fetches to complete
			await Promise.all(pingPromises);
			console.log('[DEBUG] All ping fetches complete. drillStartTimestamp:', drillStartTimestamp?.toString() || 'null', 'pingDetails:', Object.keys(pingDetails).length);
		} catch (err) {
			console.error('Error fetching drill data:', err);
			error = err instanceof Error ? err.message : 'Unknown error occurred fetching drill data';
			loadingTargets = false;
		}
	}

	function formatResponseTime(startTimestamp: bigint, endTimestamp: bigint): string {
		const seconds = Number(endTimestamp - startTimestamp);
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);

		if (days > 0) {
			return `${days}d ${hours}h`;
		} else if (hours > 0) {
			return `${hours}h ${minutes}m`;
		} else {
			return `${minutes}m`;
		}
	}

	function navigateToDrill(nonce: bigint) {
		if (nonce >= 1n && nonce <= (maxDrillNonce || 0n)) {
			currentDrillNonce = nonce;
			fetchDrillData();
		}
	}

	function previousDrill() {
		if (maxDrillNonce && currentDrillNonce < maxDrillNonce) {
			navigateToDrill(currentDrillNonce + 1n);
		}
	}

	function nextDrill() {
		if (currentDrillNonce > 1n) {
			navigateToDrill(currentDrillNonce - 1n);
		}
	}

	onMount(() => {
		fetchMaxDrillNonce();
	});
</script>

<div class="p-8">
	{#if loading}
		<div class="card bg-base-200 shadow-xl">
			<div class="card-body">
				<div class="flex items-center gap-2">
					<span class="loading loading-spinner loading-md"></span>
					<span>Fetching maximum drill nonce...</span>
				</div>
			</div>
		</div>
	{:else if error && !maxDrillNonce}
		<div class="alert alert-error">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6 shrink-0 stroke-current"
				fill="none"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span>{error}</span>
		</div>
	{:else if maxDrillNonce !== null}
		<!-- Drill Navigation -->
		<div class="card bg-base-200 mb-6 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">Drill Navigation</h2>

				<div class="mb-4 flex items-center justify-between">
					<div class="flex flex-col items-center">
						<button
							class="btn btn-circle btn-primary"
							on:click={previousDrill}
							disabled={currentDrillNonce >= maxDrillNonce || loadingTargets}
							title="View newer drill"
							aria-label="View newer drill"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-6 w-6"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15 19l-7-7 7-7"
								/>
							</svg>
						</button>
						<span class="mt-1 text-xs">Newer</span>
					</div>

					<div class="text-center">
						<div class="text-sm">Viewing Drill</div>
						<div class="text-3xl font-bold">#{currentDrillNonce.toString()}</div>
						<div class="text-xs">(Most recent: #{maxDrillNonce.toString()})</div>
					</div>

					<div class="flex flex-col items-center">
						<button
							class="btn btn-circle btn-primary"
							on:click={nextDrill}
							disabled={currentDrillNonce <= 1n || loadingTargets}
							title="View older drill"
							aria-label="View older drill"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-6 w-6"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 5l7 7-7 7"
								/>
							</svg>
						</button>
						<span class="mt-1 text-xs">Older</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Drill Data -->
		<div class="card bg-base-200 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">Drill #{currentDrillNonce.toString()} Details</h2>

				{#if drillStartBlock && drillStartTimestamp}
					<div class="alert alert-info mb-4">
						<div class="flex items-start gap-2">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								class="mt-0.5 h-5 w-5"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									stroke="currentColor"
									d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								></path>
							</svg>
							<div class="text-sm">
								<span class="font-semibold">Drill Started:</span> Block
								<a
									href="{config.urls.explorer}block/{drillStartBlock}"
									target="_blank"
									rel="noopener noreferrer"
									class="underline"
								>
									{drillStartBlock.toString()}
								</a>
								<span class="ml-2">
									({new Date(Number(drillStartTimestamp) * 1000).toLocaleString()})
								</span>
							</div>
						</div>
					</div>
				{/if}

				{#if loadingTargets}
					<div class="flex items-center gap-2">
						<span class="loading loading-spinner loading-md"></span>
						<span>Loading drill data...</span>
					</div>
				{:else if targets.length === 0}
					<div class="alert alert-warning">
						<div class="flex items-center gap-2">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								class="h-5 w-5"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									stroke="currentColor"
									d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								></path>
							</svg>
							<span>No targets found for this drill</span>
						</div>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="table-zebra table w-full">
							<thead>
								<tr>
									<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">#</th
									>
									<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
										>Account</th
									>
									<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
										>Response Time</th
									>
									<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
										>Status</th
									>
								</tr>
							</thead>
							<tbody class="divide-y">
								{#each targets.slice().sort((a, b) => {
									// Sort by block number (ascending - quickest first)
									const aBlock = pingDetails[a]?.blockNumber;
									const bBlock = pingDetails[b]?.blockNumber;

									// Put pinged items first (those with block numbers)
									if (aBlock && bBlock) {
										// Both have blocks, sort by block number ascending
										return Number(aBlock - bBlock);
									} else if (aBlock) {
										// Only a has block, put it first
										return -1;
									} else if (bBlock) {
										// Only b has block, put it first
										return 1;
									} else {
										// Neither has block, maintain original order
										return targets.indexOf(a) - targets.indexOf(b);
									}
								}) as target, index (target)}
									<tr class="hover:opacity-80">
										<td class="px-4 py-3 text-sm">{index + 1}</td>
										<td class="px-4 py-3">
											{#if targetAccounts[target] && profileMap[targetAccounts[target].toLowerCase()]}
												{#if pingDetails[target] && pingDetails[target].transactionHash}
													<a
														href="{config.urls.explorer}tx/{pingDetails[target].transactionHash}"
														target="_blank"
														rel="noopener noreferrer"
														class="font-medium underline"
														title="View ping transaction"
													>
														{profileMap[targetAccounts[target].toLowerCase()]}
													</a>
												{:else}
													<span class="font-medium">
														{profileMap[targetAccounts[target].toLowerCase()]}
													</span>
												{/if}
											{:else if pingDetails[target] && pingDetails[target].transactionHash}
												<a
													href="{config.urls.explorer}tx/{pingDetails[target].transactionHash}"
													target="_blank"
													rel="noopener noreferrer"
													class="underline"
													title="View ping transaction"
												>
													<code class="text-sm">{target}</code>
												</a>
											{:else}
												<code class="text-sm">{target}</code>
											{/if}
										</td>
										<td class="px-4 py-3 text-sm">
											{#if pingDetails[target] && drillStartTimestamp}
												<span class="font-medium">
													{formatResponseTime(drillStartTimestamp, pingDetails[target].timestamp)}
												</span>
											{:else if pingStatuses[target] === 'loading'}
												<span class="opacity-50">-</span>
											{:else}
												<span class="opacity-50">N/A</span>
											{/if}
										</td>
										<td class="px-4 py-3">
											{#if pingStatuses[target] === 'loading'}
												<span class="badge badge-ghost gap-1">
													<svg
														class="-ml-0.5 mr-1.5 h-3 w-3 animate-spin"
														xmlns="http://www.w3.org/2000/svg"
														fill="none"
														viewBox="0 0 24 24"
													>
														<circle
															class="opacity-25"
															cx="12"
															cy="12"
															r="10"
															stroke="currentColor"
															stroke-width="4"
														></circle>
														<path
															class="opacity-75"
															fill="currentColor"
															d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
														></path>
													</svg>
													Loading
												</span>
											{:else if pingStatuses[target] === true}
												<span class="badge badge-ghost gap-1">
													<svg
														xmlns="http://www.w3.org/2000/svg"
														fill="none"
														viewBox="0 0 24 24"
														stroke-width="2"
														stroke="currentColor"
														class="mr-1 h-3 w-3"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															d="M4.5 12.75l6 6 9-13.5"
														/>
													</svg>
													Pinged
												</span>
											{:else}
												<span class="badge badge-ghost gap-1">
													<svg
														xmlns="http://www.w3.org/2000/svg"
														fill="none"
														viewBox="0 0 24 24"
														stroke-width="2"
														stroke="currentColor"
														class="mr-1 h-3 w-3"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
														/>
													</svg>
													Not Pinged
												</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Statistics -->
					<div class="stats stats-vertical lg:stats-horizontal mt-6 w-full shadow">
						<div class="stat">
							<div class="stat-title">Total Targets</div>
							<div class="stat-value">{targets.length}</div>
						</div>
						<div class="stat">
							<div class="stat-title">Pinged</div>
							<div class="stat-value text-success">
								{Object.values(pingStatuses).filter((p) => p === true).length}
							</div>
						</div>
						<div class="stat">
							<div class="stat-title">Not Pinged</div>
							<div class="stat-value text-warning">
								{Object.values(pingStatuses).filter((p) => p === false).length}
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Contract Actions Section -->
	<div class="card bg-base-200 mt-8 shadow-xl">
		<div class="card-body">
			<h2 class="mb-4 text-xl font-bold">Contract Actions</h2>
			<p class="mb-4">To interact with the Security Council Drill contract directly:</p>
			<div class="space-y-2">
				<p>
					<strong>View Contract:</strong> Access the contract on Etherscan to see all available functions
				</p>
				<p>
					<strong>Start Drill:</strong> Initiate a new drill (requires appropriate permissions)
				</p>
				<p>
					<strong>Ping Drill:</strong> Respond to a drill if you're a target
				</p>
			</div>
			<div class="mt-6">
				<a
					href="{config.urls.explorer}address/{config.contracts.SecurityCouncilDrill}"
					target="_blank"
					rel="noopener noreferrer"
					class="btn btn-primary"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="2"
						stroke="currentColor"
						class="h-5 w-5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
						/>
					</svg>
					Open Contract on Etherscan
				</a>
			</div>
		</div>
	</div>
</div>
