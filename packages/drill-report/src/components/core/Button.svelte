<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import GameIcon from './GameIcon.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';

	export let label: string = '';
	export let href: string = '';
	export let color: ThemeColors = ThemeColors.Primary;
	export let outline: boolean = false;
	export let disabled: boolean = false;
	export let wide: boolean = false;
	export let tall: boolean = false;
	export let size: ThemeSizes = ThemeSizes.Medium;
	export let target: string = '_self';
	export let join: boolean = false;
	export let icon: string = '';
	export let classes = '';
	const dispatch = createEventDispatcher();

	const typesToClasses: Record<string, string> = {
		primary: 'btn-primary',
		secondary: 'btn-secondary',
		tertiary: 'btn-tertiary',
		success: 'btn-success',
		error: 'btn-error',
		info: 'btn-info',
		warning: 'btn-warning',
		neutral: 'btn-neutral'
	};

	const sizesToClasses: Record<string, string> = {
		sm: 'btn-sm',
		md: 'btn-md',
		lg: 'btn-lg'
	};

	$: wrapperClasses = classNames(
		'btn',
		'relative',
		typesToClasses[color || ThemeColors.Neutral],
		sizesToClasses[size || 'md'],
		outline ? 'btn-outline' : null,
		wide ? 'w-full' : null,
		tall ? 'h-full' : null,
		join ? 'join-item' : null,
		classes,
		'pointer',
		'justify-center flex'
	);

	function handleClick() {
		dispatch('click');
	}
</script>

{#if href && !disabled}
	<a {href} class={wrapperClasses} {target}>
		{#if icon}
			<GameIcon {size} name={icon} />
		{:else if label}
			{label}
		{:else}
			<slot />
		{/if}</a
	>
{:else}
	<button
		on:touchstart|preventDefault={(e) => dispatch('touchstart', { e })}
		on:touchend|preventDefault={(e) => dispatch('touchend', { e })}
		on:mousedown={(e) => dispatch('mousedown', { e })}
		on:mouseup={(e) => dispatch('mouseup', { e })}
		on:mouseenter={() => dispatch('mouseenter')}
		on:mouseleave={() => dispatch('mouseleave')}
		on:click={handleClick}
		{disabled}
		class={wrapperClasses}
	>
		{#if icon}
			<div class="absolute right-2">
				<GameIcon {size} name={icon} />
			</div>
		{/if}
		{#if label}
			{label}
		{:else}
			<slot />
		{/if}</button
	>
{/if}
