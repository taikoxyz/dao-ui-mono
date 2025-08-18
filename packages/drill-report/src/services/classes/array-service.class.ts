/* eslint-disable @typescript-eslint/no-explicit-any */

import { get, type Writable } from 'svelte/store';
import localStorageWritableStore from '$utils/localStorageWritableStore';
import type { ID } from '$types/core.type';

export class ArrayServiceClass<T extends { id: ID }> {
	id: string;
	store: Writable<T[]>;
	data: T[];
	constructor(id: string, storeInitialValue: T[]) {
		this.id = `array-service:${id}`;
		this.store = localStorageWritableStore<T[]>(this.id, storeInitialValue);
		this.log(`Service ${this.id} initialized`);
		this.data = storeInitialValue;
		this.store.subscribe((store) => {
			this.data = store;
			this.log(`Service ${this.id} updated`, store);
		});
	}

	log(...args: any[]): void {
		console.info(...args);
	}

	error(...args: any[]): void {
		throw new Error(`Service ${this.id} error: ${args}`);
	}

	add(item: T): T {
		this.store.update((items) => {
			if (items.find((i) => i.id === item.id)) {
				this.error(`Item ${item} already exists in service ${this.id}`);
			}
			return [...items, item];
		});
		return item;
	}
	remove(item: T): void {
		this.store.update((items) => {
			if (!items.find((i) => i.id === item.id)) {
				this.error(`Item ${item} not found in service ${this.id}`);
			}
			return items.filter((i) => i !== item);
		});
	}
	update(item: T): T {
		this.store.update((items) => {
			const index = items.findIndex((i) => i.id === item.id);
			if (index === -1) {
				this.error(`Item ${item} not found in service ${this.id}`);
			}
			items[index] = item;
			return [...items];
		});
		return item;
	}

	exists(id: ID): T | null {
		return get(this.store).find((i) => i.id === id) || null;
	}

	all(): T[] {
		return get(this.store);
	}

	find(predicate: (item: T) => boolean): T | null {
		return get(this.store).find(predicate) || null;
	}

	filter(predicate: (item: T) => boolean): T[] {
		return get(this.store).filter(predicate);
	}
}
