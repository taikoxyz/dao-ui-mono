<script lang="ts">
  import { onMount } from 'svelte';
  
  onMount(() => {
    // Always apply dark theme
    document.documentElement.classList.add('dark');
  });
</script>

<header class="bg-gray-800 shadow-lg border-b border-gray-700">
  <div class="container mx-auto px-4">
    <div class="flex items-center justify-center h-16">
      <a href="/" class="text-xl font-bold text-white hover:text-blue-400">
        Taiko DAO Drill Report
      </a>
    </div>
  </div>
</header>