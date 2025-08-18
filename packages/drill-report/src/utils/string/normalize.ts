export default function normalize(input: string): string {
	return input
		.trim()
		.replace(/<[^>]*>/g, '') // Remove HTML tags
		.toLowerCase()
		.split(' ')
		.join('-');
}
