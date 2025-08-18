<script lang="ts">
	import classNames from 'classnames';
	import capitalize from '$utils/string/capitalize';
	import { ColorsToText, ThemeColors, ThemeSizes } from '$types/core.type';

	export let name: string;
	export let size: ThemeSizes | 'full' = ThemeSizes.Medium;
	export let color: ThemeColors = ThemeColors.Neutral;
	$: wrapperClasses = classNames(
		'aspect-square',
		size === ThemeSizes.XSmall ? 'w-[12px] h-[12px]' : null,
		size === ThemeSizes.Small ? 'w-[20px] h-[20px]' : null,
		size === ThemeSizes.Medium ? 'w-[24px] h-[24px]' : null,
		size === ThemeSizes.Large ? 'w-[32px] h-[32px]' : null,
		size === ThemeSizes.XLarge ? 'w-[40px] h-[40px]' : null,
		size === 'full' ? 'w-full aspect-square' : null,
		ColorsToText[color]
	);

	$: alt = capitalize(name);
</script>

<div
	class={wrapperClasses}
	aria-label={alt}
	style={`-webkit-mask-image: url('/icons/${name}.svg'); mask-image: url('/icons/${name}.svg');background-position:center; background-repeat:none; background-color: currentColor;`}
></div>
