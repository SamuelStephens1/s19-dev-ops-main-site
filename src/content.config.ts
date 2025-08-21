// content.config.ts (project root)
import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    draft: z.boolean().optional(),
    author: z.string().optional(),
    tags: z.array(z.string()).optional(),
    heroImage: z.string().optional(),
  }),
});

const resources = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    draft: z.boolean().optional(),
    author: z.string().optional(),
    tags: z.array(z.string()).optional(),
    heroImage: z.string().optional(),

    // resource-specific
    resourceType: z.enum(["download", "tool", "article"]),
    ctaLabel: z.string().optional(),
    downloadUrl: z.string().optional(),
    toolUrl: z.string().optional(),
  }),
});

export const collections = { blog, resources };
