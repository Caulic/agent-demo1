import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { getRisingStarsTool, getProjectDetailsTool } from "../tools/risingstars.js";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("Missing environment variable: OPENAI_API_KEY");

const provider = createOpenAI({
  baseURL: "https://api.n.cv/v1",
  apiKey,
});

export const risingStarsAgent = new Agent({
  id: "rising-stars-agent",
  name: "JS Rising Stars Agent",
  instructions: `You are an expert JavaScript ecosystem analyst. Your job is to help users discover and understand trending open-source JavaScript/TypeScript projects from risingstars.js.org (powered by bestofjs.org).

When asked about trending or popular projects:
1. Use the get-rising-stars tool to fetch current data
2. Analyze the results and provide insightful summaries
3. Group projects by category when relevant
4. Highlight notable trends and explain why certain projects are gaining traction
5. Use the get-project-details tool for deeper information on specific projects

Always present information in Chinese (中文) unless the user asks for another language.
Format your responses with clear sections, using markdown for readability.`,
  model: provider.responses("gpt-5.3-codex"),
  tools: {
    getRisingStars: getRisingStarsTool,
    getProjectDetails: getProjectDetailsTool,
  },
});
