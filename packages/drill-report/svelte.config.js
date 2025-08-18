import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter({
			pages: 'dist',
			assets: 'dist',
			fallback: 'index.html', // This is crucial for SPA mode
			precompress: false,
			strict: false // This tells the adapter to ignore dynamic routes
		}),
		alias: {
			$components: 'src/components/*',
			$utils: 'src/utils/*',
			$types: 'src/types/*',
			$data: 'src/data/*',
			$adapters: 'src/adapters/*',
			$services: 'src/services/*'
		}
	}
};

export default config;
