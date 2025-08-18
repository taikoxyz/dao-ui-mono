import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export default function localStorageWritableStore<T>(key: string, initialValue: T) {
	if (!browser) {
		return writable(initialValue);
	}
	const storedValue = localStorage.getItem(key);
	const parsedValue = storedValue ? JSON.parse(storedValue) : initialValue;
	const store = writable<T>(parsedValue);
	store.subscribe((value) => {
		localStorage.setItem(key, JSON.stringify(value));
	});
	return store;
}
