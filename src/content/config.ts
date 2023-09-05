import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string().max(70).min(10),
			description: z.string().max(160).min(10),
			pubDate: z.date(),
			updatedDate: z.date().optional(),
			hero: image(),
			heroAlt: z.string().optional(),
		}),
});

export const collections = {
	blog: blogCollection
};
