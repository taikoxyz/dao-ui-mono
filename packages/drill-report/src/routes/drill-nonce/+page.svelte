<script lang="ts">
  import { onMount } from 'svelte';
  import { createPublicClient, http, type PublicClient, parseAbiItem } from 'viem';
  import { mainnet } from 'viem/chains';
  import { ABIs } from '../../abi';
  import config from '../../config/mainnet.config.json';

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
      });
      
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
  <h1 class="text-3xl font-bold mb-6">Security Council Drill Explorer</h1>
  
  <div class="rounded-lg bg-gray-100 shadow-xl mb-6">
    <div class="p-6">
      <h2 class="text-xl font-bold mb-4">Contract Information</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p class="text-sm opacity-70">Contract Address:</p>
          <code class="text-xs break-all">{config.contracts.SecurityCouncilDrill}</code>
        </div>
        <div>
          <p class="text-sm opacity-70">RPC Endpoint:</p>
          <code class="text-xs break-all">{config.urls.rpc}</code>
        </div>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="rounded-lg bg-gray-100 shadow-xl">
      <div class="p-6">
        <div class="flex items-center gap-2">
          <svg class="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Fetching maximum drill nonce...</span>
        </div>
      </div>
    </div>
  {:else if error && !maxDrillNonce}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6 inline mr-2" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{error}</span>
    </div>
  {:else if maxDrillNonce !== null}
    <!-- Drill Navigation -->
    <div class="rounded-lg bg-gray-100 shadow-xl mb-6">
      <div class="p-6">
        <h2 class="text-xl font-bold mb-4">Drill Navigation</h2>
        
        <div class="flex items-center justify-between">
          <div class="flex flex-col items-center">
            <button 
              class="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              on:click={previousDrill}
              disabled={currentDrillNonce >= maxDrillNonce || loadingTargets}
              title="View newer drill"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span class="text-xs mt-1 opacity-70">Newer</span>
          </div>
          
          <div class="text-center">
            <div class="text-sm opacity-70">Viewing Drill</div>
            <div class="text-2xl font-bold">#{currentDrillNonce.toString()}</div>
            <div class="text-xs opacity-70">(Most recent: #{maxDrillNonce.toString()})</div>
          </div>
          
          <div class="flex flex-col items-center">
            <button 
              class="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              on:click={nextDrill}
              disabled={currentDrillNonce <= 1n || loadingTargets}
              title="View older drill"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <span class="text-xs mt-1 opacity-70">Older</span>
          </div>
        </div>

        <!-- Quick Jump -->
        <div class="form-control w-full max-w-xs mx-auto mt-4">
          <label class="block mb-2" for="jump-input">
            <span class="text-sm font-medium">Jump to Drill</span>
          </label>
          <div class="flex">
            <input 
              id="jump-input"
              type="number" 
              min="1" 
              max={maxDrillNonce.toString()}
              value={currentDrillNonce.toString()}
              class="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              on:input={(e) => {
                const value = BigInt(e.currentTarget.value || 1);
                if (value >= 1n && value <= maxDrillNonce) {
                  navigateToDrill(value);
                }
              }}
              disabled={loadingTargets}
            />
            <button 
              class="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 disabled:bg-gray-300"
              on:click={() => fetchDrillData()}
              disabled={loadingTargets}
            >
              Go
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Drill Data -->
    <div class="rounded-lg bg-gray-100 shadow-xl">
      <div class="p-6">
        <h2 class="text-xl font-bold mb-4">Drill #{currentDrillNonce.toString()} Details</h2>
        
        {#if drillStartBlock && drillStartTimestamp}
          <div class="mb-4 p-3 bg-blue-50 rounded-lg">
            <div class="text-sm text-gray-600">
              <span class="font-medium">Drill Started:</span> Block 
              <a 
                href="{config.urls.explorer}block/{drillStartBlock}" 
                target="_blank" 
                rel="noopener noreferrer"
                class="text-blue-600 hover:text-blue-800 hover:underline"
              >
                {drillStartBlock.toString()}
              </a>
              <span class="ml-2">
                ({new Date(Number(drillStartTimestamp) * 1000).toLocaleString()})
              </span>
            </div>
          </div>
        {/if}
        
        {#if loadingTargets}
          <div class="flex items-center gap-2">
            <svg class="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading drill data...</span>
          </div>
        {:else if targets.length === 0}
          <div class="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span>No targets found for this drill</span>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Address</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Block</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Response Time</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each targets as target, index}
                  <tr>
                    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                    <td class="px-4 py-4 whitespace-nowrap">
                      {#if pingDetails[target] && pingDetails[target].transactionHash}
                        <a 
                          href="{config.urls.explorer}tx/{pingDetails[target].transactionHash}" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          class="text-blue-600 hover:text-blue-800 hover:underline"
                          title="View ping transaction"
                        >
                          <code class="text-xs font-mono">{target}</code>
                        </a>
                      {:else}
                        <code class="text-xs font-mono text-gray-600">{target}</code>
                      {/if}
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap">
                      {#if pingStatuses[target] === 'loading'}
                        <div class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 gap-1">
                          <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Loading...
                        </div>
                      {:else if pingStatuses[target] === true}
                        <div class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          Pinged
                        </div>
                      {:else}
                        <div class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Not Pinged
                        </div>
                      {/if}
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                      {#if pingDetails[target]}
                        <a 
                          href="{config.urls.explorer}block/{pingDetails[target].blockNumber}" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          class="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {pingDetails[target].blockNumber.toString()}
                        </a>
                      {:else if pingStatuses[target] === 'loading'}
                        <span class="text-gray-400">-</span>
                      {:else}
                        <span class="text-gray-400">N/A</span>
                      {/if}
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                      {#if pingDetails[target] && drillStartTimestamp}
                        <span class="font-medium">
                          {formatResponseTime(drillStartTimestamp, pingDetails[target].timestamp)}
                        </span>
                      {:else if pingStatuses[target] === 'loading'}
                        <span class="text-gray-400">-</span>
                      {:else}
                        <span class="text-gray-400">N/A</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          
          <div class="grid grid-cols-3 gap-4 mt-4">
            <div class="bg-white p-4 rounded-lg shadow">
              <div class="text-sm text-gray-500">Total Targets</div>
              <div class="text-2xl font-bold">{targets.length}</div>
            </div>
            <div class="bg-white p-4 rounded-lg shadow">
              <div class="text-sm text-gray-500">Pinged</div>
              <div class="text-2xl font-bold text-green-600">
                {Object.values(pingStatuses).filter(p => p === true).length}
              </div>
            </div>
            <div class="bg-white p-4 rounded-lg shadow">
              <div class="text-sm text-gray-500">Not Pinged</div>
              <div class="text-2xl font-bold text-yellow-600">
                {Object.values(pingStatuses).filter(p => p === false).length}
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <div class="mt-8 rounded-lg bg-gray-100 shadow-xl">
    <div class="p-6">
      <h2 class="text-xl font-bold mb-4">About Security Council Drills</h2>
      <p class="text-sm opacity-80">
        This explorer shows Security Council drills starting with the most recent (highest nonce) by default.
        You can navigate through historical drills to see participation over time. For each drill, you can see:
      </p>
      <ul class="list-disc list-inside text-sm opacity-80 mt-2">
        <li>All target addresses assigned to that drill</li>
        <li>Whether each target has successfully pinged (responded to) the drill</li>
        <li>Overall statistics for drill participation</li>
      </ul>
      <p class="text-sm opacity-80 mt-2">
        This data is read directly from the blockchain without requiring any wallet connection.
      </p>
    </div>
  </div>
</div>

