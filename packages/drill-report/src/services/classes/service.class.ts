/* eslint-disable @typescript-eslint/no-explicit-any */

import { get, type Writable } from 'svelte/store';
import localStorageWritableStore from '$utils/localStorageWritableStore';
import type { ID } from '$types/core.type';

export class ObjectServiceClass<T extends { id: ID }> {
	id: string;
	store: Writable<T>;
	data: T;
	constructor(id: ID, storeInitialValue: T) {
		this.id = `object-service:${id}`;
		this.store = localStorageWritableStore<T>(this.id, storeInitialValue);
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

	add(item: T): void {
		this.store.update((currentItem) => {
			if (currentItem) {
				this.error(`Item ${item} already exists in service ${this.id}`);
			}
			return item;
		});
	}

	update(item: T): void {
		this.store.update((currentItem) => {
			if (!currentItem) {
				this.error(`Item not found in service ${this.id}`);
			}
			return item;
		});
	}

	get(): T {
		return get(this.store);
	}

	set(item: T): void {
		this.store.set(item);
	}
}
