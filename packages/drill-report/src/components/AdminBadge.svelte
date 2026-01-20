<script lang="ts">
	import { adminStore } from '../stores/admin';
</script>

{#if $adminStore.address}
	{#if $adminStore.isLoading}
		<div class="badge badge-ghost gap-2">
			<span class="loading loading-spinner loading-xs"></span>
			Checking role...
		</div>
	{:else if $adminStore.isAdmin}
		<div class="badge badge-success gap-2">
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="h-4 w-4">
				<path
					stroke="currentColor"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			Admin
		</div>
	{:else if $adminStore.error}
		<div class="badge badge-error" title={$adminStore.error}>Error</div>
	{/if}
{/if}
