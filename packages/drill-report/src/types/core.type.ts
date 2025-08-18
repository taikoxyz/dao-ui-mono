export type ID = string | number;

export enum ThemeColors {
	Primary = 'primary',
	Secondary = 'secondary',
	Accent = 'accent',
	Success = 'success',
	Error = 'error',
	Info = 'info',
	Warning = 'warning',
	Neutral = 'neutral'
}

export const ColorsToBackgrounds: Record<ThemeColors, string> = {
	[ThemeColors.Primary]: 'bg-primary',
	[ThemeColors.Secondary]: 'bg-secondary',
	[ThemeColors.Accent]: 'bg-accent',
	[ThemeColors.Success]: 'bg-success',
	[ThemeColors.Error]: 'bg-error',
	[ThemeColors.Info]: 'bg-info',
	[ThemeColors.Warning]: 'bg-warning',
	[ThemeColors.Neutral]: 'bg-neutral'
};

export const ColorsToText: Record<ThemeColors, string> = {
	[ThemeColors.Primary]: 'text-primary',
	[ThemeColors.Secondary]: 'text-secondary',
	[ThemeColors.Accent]: 'text-accent',
	[ThemeColors.Success]: 'text-success',
	[ThemeColors.Error]: 'text-error',
	[ThemeColors.Info]: 'text-info',
	[ThemeColors.Warning]: 'text-warning',
	[ThemeColors.Neutral]: ''
};

export enum ThemeSizes {
	XSmall = 'xs',
	Small = 'sm',
	Medium = 'md',
	Large = 'lg',
	XLarge = 'xl'
}
