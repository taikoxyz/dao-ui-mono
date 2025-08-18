export default function capitalize(input?: string | null): string {
	if (!input) return '';
	return (
		input
			// Step 1: Insert a space before each uppercase letter that follows a lowercase letter
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			// Step 2: Replace hyphens with spaces
			.replace(/-/g, ' ')
			// Step 3: Capitalize each word
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ')
	);
}
