<script lang="ts">
  import { onMount } from 'svelte';
  import { createPublicClient, http, type PublicClient, parseAbiItem } from 'viem';
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
  let pingDetails: Record<string, { blockNumber: bigint; timestamp: bigint; transactionHash: string } | null> = {};
  let drillStartBlock: bigint | null = null;
  let drillStartTimestamp: bigint | null = null;
  let targetAccounts: Record<string, string | null> = {}; // Maps delegated address to main account
  
  // Create a map of addresses to names from the profiles
  const profileMap: Record<string, string> = {};
  securityCouncilProfiles.forEach((profile: any) => {
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
        functionName: 'drillNonce'
      });

      maxDrillNonce = result as bigint;
      
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
      targets.forEach(target => {
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
          
          if (owner && owner !== '0x0000000000000000000000000000000000000000') {
            targetAccounts[target] = owner as string;
          }
          
          // Trigger reactivity
          targetAccounts = {...targetAccounts};
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
        let drillStartedLogs: any[] = [];
        
        // Search in chunks of 40,000 blocks to stay under the 50,000 limit
        const chunkSize = 40000n;
        
        // Start from a reasonable recent block if looking for recent drills
        if (currentDrillNonce > maxDrillNonce - 10n) {
          // For recent drills, only search last ~2 months of blocks
          searchFromBlock = latestBlock - 500000n;
        }
        
        while (searchFromBlock < latestBlock && drillStartedLogs.length === 0) {
          const searchToBlock = searchFromBlock + chunkSize > latestBlock ? latestBlock : searchFromBlock + chunkSize;
          
          try {
            const logs = await client.getLogs({
              address: config.contracts.SecurityCouncilDrill as `0x${string}`,
              event: parseAbiItem('event DrillStarted(uint256 indexed drillNonce, address[] targets)'),
              args: {
                drillNonce: currentDrillNonce
              },
              fromBlock: searchFromBlock,
              toBlock: searchToBlock
            });
            
            if (logs.length > 0) {
              drillStartedLogs = logs;
              break;
            }
          } catch (chunkErr) {
            console.error(`Error fetching logs in range ${searchFromBlock}-${searchToBlock}:`, chunkErr);
          }
          
          searchFromBlock = searchToBlock + 1n;
        }
        
        if (drillStartedLogs.length > 0) {
          drillStartBlock = drillStartedLogs[0].blockNumber;
          // Get the timestamp of the start block
          const startBlock = await client.getBlock({ blockNumber: drillStartBlock });
          drillStartTimestamp = startBlock.timestamp;
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
          
          pingStatuses[target] = hasPinged as boolean;
          
          // If pinged, fetch the event details
          if (hasPinged) {
            try {
              // Use the drill start block if we have it, otherwise search from a reasonable range
              const latestBlock = await client.getBlockNumber();
              let searchFromBlock = drillStartBlock || (latestBlock - 500000n);
              
              // Make sure we don't exceed the block range limit
              if (latestBlock - searchFromBlock > 45000n) {
                searchFromBlock = latestBlock - 45000n;
              }
              
              const pingLogs = await client.getLogs({
                address: config.contracts.SecurityCouncilDrill as `0x${string}`,
                event: parseAbiItem('event DrillPinged(uint256 indexed drillNonce, address indexed member)'),
                args: {
                  drillNonce: currentDrillNonce,
                  member: target as `0x${string}`
                },
                fromBlock: searchFromBlock,
                toBlock: latestBlock
              });
              
              if (pingLogs.length > 0) {
                const pingBlock = await client.getBlock({ blockNumber: pingLogs[0].blockNumber });
                pingDetails[target] = {
                  blockNumber: pingLogs[0].blockNumber,
                  timestamp: pingBlock.timestamp,
                  transactionHash: pingLogs[0].transactionHash
                };
              }
            } catch (err) {
              console.error(`Error fetching ping event for ${target}:`, err);
            }
          }
          
          // Trigger reactivity
          pingStatuses = {...pingStatuses};
          pingDetails = {...pingDetails};
        } catch (err) {
          console.error(`Error fetching ping status for ${target}:`, err);
          pingStatuses[target] = false;
          // Trigger reactivity
          pingStatuses = {...pingStatuses};
        }
      });
      
      // Wait for all ping status fetches to complete
      await Promise.all(pingPromises);
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

<div class="container mx-auto p-8">

  {#if loading}
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
      <div class="flex items-center gap-2">
        <svg class="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-gray-700 dark:text-gray-300">Fetching maximum drill nonce...</span>
      </div>
    </div>
  {:else if error && !maxDrillNonce}
    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{error}</span>
      </div>
    </div>
  {:else if maxDrillNonce !== null}
    <!-- Drill Navigation -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl mb-6 p-6">
      <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Drill Navigation</h2>
      
      <div class="flex items-center justify-between mb-4">
        <div class="flex flex-col items-center">
          <button 
            class="p-3 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            on:click={previousDrill}
            disabled={currentDrillNonce >= maxDrillNonce || loadingTargets}
            title="View newer drill"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span class="text-xs mt-1 text-gray-600 dark:text-gray-400">Newer</span>
        </div>
        
        <div class="text-center">
          <div class="text-sm text-gray-600 dark:text-gray-400">Viewing Drill</div>
          <div class="text-3xl font-bold text-gray-900 dark:text-white">#{currentDrillNonce.toString()}</div>
          <div class="text-xs text-gray-500 dark:text-gray-500">(Most recent: #{maxDrillNonce.toString()})</div>
        </div>
        
        <div class="flex flex-col items-center">
          <button 
            class="p-3 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            on:click={nextDrill}
            disabled={currentDrillNonce <= 1n || loadingTargets}
            title="View older drill"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span class="text-xs mt-1 text-gray-600 dark:text-gray-400">Older</span>
        </div>
      </div>

      <!-- Quick Jump -->
      <div class="max-w-xs mx-auto">
        <label for="jump-input" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Jump to Drill
        </label>
        <div class="flex">
          <input 
            id="jump-input"
            type="number" 
            min="1" 
            max={maxDrillNonce.toString()}
            value={currentDrillNonce.toString()}
            class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            on:input={(e) => {
              const value = BigInt(e.currentTarget.value || 1);
              if (value >= 1n && value <= maxDrillNonce) {
                navigateToDrill(value);
              }
            }}
            disabled={loadingTargets}
          />
          <button 
            class="px-4 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            on:click={() => fetchDrillData()}
            disabled={loadingTargets}
          >
            Go
          </button>
        </div>
      </div>
    </div>

    <!-- Drill Data -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
      <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Drill #{currentDrillNonce.toString()} Details</h2>
      
      {#if drillStartBlock && drillStartTimestamp}
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <div class="flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" stroke="currentColor" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div class="text-sm text-gray-700 dark:text-gray-300">
              <span class="font-semibold">Drill Started:</span> Block 
              <a 
                href="{config.urls.explorer}block/{drillStartBlock}" 
                target="_blank" 
                rel="noopener noreferrer"
                class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
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
          <svg class="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-gray-700 dark:text-gray-300">Loading drill data...</span>
        </div>
      {:else if targets.length === 0}
        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" stroke="currentColor" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span>No targets found for this drill</span>
          </div>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Account</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Response Time</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
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
              }) as target, index}
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{index + 1}</td>
                  <td class="px-4 py-3">
                    {#if targetAccounts[target] && profileMap[targetAccounts[target].toLowerCase()]}
                      {#if pingDetails[target] && pingDetails[target].transactionHash}
                        <a 
                          href="{config.urls.explorer}tx/{pingDetails[target].transactionHash}" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline font-medium"
                          title="View ping transaction"
                        >
                          {profileMap[targetAccounts[target].toLowerCase()]}
                        </a>
                      {:else}
                        <span class="font-medium text-gray-900 dark:text-gray-100">
                          {profileMap[targetAccounts[target].toLowerCase()]}
                        </span>
                      {/if}
                    {:else}
                      {#if pingDetails[target] && pingDetails[target].transactionHash}
                        <a 
                          href="{config.urls.explorer}tx/{pingDetails[target].transactionHash}" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                          title="View ping transaction"
                        >
                          <code class="text-sm">{target}</code>
                        </a>
                      {:else}
                        <code class="text-sm text-gray-700 dark:text-gray-300">{target}</code>
                      {/if}
                    {/if}
                  </td>
                  <td class="px-4 py-3 text-sm">
                    {#if pingDetails[target] && drillStartTimestamp}
                      <span class="font-medium text-gray-900 dark:text-gray-100">
                        {formatResponseTime(drillStartTimestamp, pingDetails[target].timestamp)}
                      </span>
                    {:else if pingStatuses[target] === 'loading'}
                      <span class="text-gray-400 dark:text-gray-500">-</span>
                    {:else}
                      <span class="text-gray-400 dark:text-gray-500">N/A</span>
                    {/if}
                  </td>
                  <td class="px-4 py-3">
                    {#if pingStatuses[target] === 'loading'}
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                        <svg class="animate-spin -ml-0.5 mr-1.5 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Loading
                      </span>
                    {:else if pingStatuses[target] === true}
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3 mr-1">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Pinged
                      </span>
                    {:else}
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3 mr-1">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
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
        <div class="grid grid-cols-3 gap-4 mt-6">
          <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
            <div class="text-sm text-gray-600 dark:text-gray-400">Total Targets</div>
            <div class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{targets.length}</div>
          </div>
          <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
            <div class="text-sm text-gray-600 dark:text-gray-400">Pinged</div>
            <div class="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
              {Object.values(pingStatuses).filter(p => p === true).length}
            </div>
          </div>
          <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
            <div class="text-sm text-gray-600 dark:text-gray-400">Not Pinged</div>
            <div class="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
              {Object.values(pingStatuses).filter(p => p === false).length}
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- About Section -->
  <div class="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
    <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">About Security Council Drills</h2>
    <p class="text-gray-600 dark:text-gray-300 mb-2">
      This explorer shows Security Council drills starting with the most recent (highest nonce) by default.
      You can navigate through historical drills to see participation over time. For each drill, you can see:
    </p>
    <ul class="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
      <li>All target addresses assigned to that drill</li>
      <li>Whether each target has successfully pinged (responded to) the drill</li>
      <li>Overall statistics for drill participation</li>
    </ul>
    <p class="text-gray-600 dark:text-gray-300 mt-3">
      This data is read directly from the blockchain without requiring any wallet connection.
    </p>
  </div>
</div>