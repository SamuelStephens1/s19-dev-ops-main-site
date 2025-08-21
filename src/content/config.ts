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
    // Accept either a public-path (starts with "/") or a full URL
    heroImage: z
      .string()
      .refine((s) => s.startsWith("/") || /^https?:\/\//.test(s), {
        message: "heroImage must be a public path (/...) or http(s) URL",
      })
      .optional(),
  }),
});

export const collections = { blog };
