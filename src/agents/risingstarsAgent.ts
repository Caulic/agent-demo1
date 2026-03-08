import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";
import type { ProcessInputArgs, ProcessorMessageResult } from "@mastra/core/processors";
import { MessageList } from "@mastra/core/agent";
import type { MastraDBMessage } from "@mastra/core/agent";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("Missing environment variable: OPENAI_API_KEY");

const provider = createOpenAI({
  baseURL: "https://api.n.cv/v1",
  apiKey,
});

const BESTOFJS_API = "https://bestofjs-static-api.vercel.app/projects.json";

async function fetchTopProjects(limit = 30) {
  const res = await fetch(BESTOFJS_API);
  const data = (await res.json()) as {
    date: string;
    projects: Array<{
      name: string;
      full_name: string;
      description: string;
      stars: number;
      trends: { yearly?: number };
      tags: string[];
      url?: string;
    }>;
    tags: Record<string, { name: string }>;
  };

  return data.projects
    .filter((p) => (p.trends?.yearly ?? 0) > 0)
    .sort((a, b) => (b.trends?.yearly ?? 0) - (a.trends?.yearly ?? 0))
    .slice(0, limit)
    .map((p) => ({
      name: p.name,
      repo: p.full_name,
      description: p.description,
      totalStars: p.stars,
      yearlyGain: p.trends?.yearly ?? 0,
      tags: p.tags.map((t) => data.tags[t]?.name ?? t),
      url: p.url ?? `https://github.com/${p.full_name}`,
    }));
}

const injectRisingStarsData = {
  id: "inject-rising-stars",
  async processInput({ messages }: ProcessInputArgs): Promise<ProcessorMessageResult> {
    const projects = await fetchTopProjects();
    const dataContext = `以下是来自 risingstars.js.org 的最新热门项目数据（按年度 star 增长排序）：\n\`\`\`json\n${JSON.stringify(projects, null, 2)}\n\`\`\`\n请基于以上数据回答用户的问题。`;

    if (messages instanceof MessageList) {
      messages.addSystem(dataContext, "rising-stars-data");
      return messages;
    }

    // messages is MastraDBMessage[]
    const systemMsg: MastraDBMessage = {
      id: crypto.randomUUID(),
      role: "system",
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [{ type: "text", text: dataContext }],
      },
    };
    return [systemMsg, ...(messages as MastraDBMessage[])];
  },
};

export const risingStarsAgent = new Agent({
  id: "rising-stars-agent",
  name: "JS Rising Stars Agent",
  instructions: `你是一名 JavaScript 生态系统专家分析师，帮助用户了解来自 risingstars.js.org 的热门开源项目。
根据提供的项目数据进行分析：
- 按类别分组介绍
- 说明项目受欢迎的原因
- 用清晰的 Markdown 格式输出
- 始终用中文回答`,
  model: provider.responses("gpt-5.3-codex"),
  inputProcessors: [injectRisingStarsData],
});
