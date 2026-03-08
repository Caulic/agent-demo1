import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const BESTOFJS_API = "https://bestofjs-static-api.vercel.app/projects.json";

interface Project {
  name: string;
  full_name: string;
  description: string;
  stars: number;
  trends: {
    daily?: number;
    weekly?: number;
    monthly?: number;
    yearly?: number;
  };
  tags: string[];
  url?: string;
  owner_id: number;
}

interface ApiResponse {
  date: string;
  projects: Project[];
  tags: Record<string, { name: string; code: string }>;
}

async function fetchProjects(): Promise<ApiResponse> {
  const res = await fetch(BESTOFJS_API);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.json() as Promise<ApiResponse>;
}

export const getRisingStarsTool = createTool({
  id: "get-rising-stars",
  description:
    "Fetch the most popular and trending JavaScript/TypeScript projects from bestofjs (which powers risingstars.js.org). Returns top projects by yearly star gain.",
  inputSchema: z.object({
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Number of top projects to return (default: 20)"),
    tag: z
      .string()
      .optional()
      .describe(
        "Filter by tag, e.g. 'react', 'vue', 'bundler', 'testing', 'nodejs'"
      ),
  }),
  execute: async (inputData) => {
    const { limit = 20, tag } = inputData;
    const data = await fetchProjects();

    let projects = data.projects.filter(
      (p) => p.trends?.yearly != null && p.trends.yearly > 0
    );

    if (tag) {
      projects = projects.filter((p) => p.tags.includes(tag));
    }

    projects.sort((a, b) => (b.trends?.yearly ?? 0) - (a.trends?.yearly ?? 0));

    const top = projects.slice(0, limit).map((p) => ({
      name: p.name,
      repo: p.full_name,
      description: p.description,
      totalStars: p.stars,
      yearlyStarGain: p.trends?.yearly ?? 0,
      tags: p.tags,
      url: p.url ?? `https://github.com/${p.full_name}`,
    }));

    return {
      updatedAt: data.date,
      totalTracked: data.projects.length,
      results: top,
    };
  },
});

export const getProjectDetailsTool = createTool({
  id: "get-project-details",
  description:
    "Get detailed information about a specific JavaScript project by its GitHub full name (e.g. 'facebook/react').",
  inputSchema: z.object({
    repoFullName: z
      .string()
      .describe("GitHub repository full name, e.g. 'facebook/react'"),
  }),
  execute: async (inputData) => {
    const { repoFullName } = inputData;
    const data = await fetchProjects();

    const project = data.projects.find(
      (p) => p.full_name.toLowerCase() === repoFullName.toLowerCase()
    );
    if (!project) {
      return { error: `Project '${repoFullName}' not found in bestofjs data` };
    }

    const tagNames = project.tags
      .map((t) => data.tags[t]?.name ?? t)
      .join(", ");

    return {
      name: project.name,
      repo: project.full_name,
      description: project.description,
      totalStars: project.stars,
      trends: project.trends,
      categories: tagNames,
      url: project.url ?? `https://github.com/${project.full_name}`,
    };
  },
});
