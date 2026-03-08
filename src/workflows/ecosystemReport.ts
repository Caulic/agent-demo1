import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { fetchProjects } from "../tools/risingstars.js";

// ── Shared schemas ────────────────────────────────────────────────────────────

const projectSchema = z.object({
  name: z.string(),
  repo: z.string(),
  description: z.string(),
  totalStars: z.number(),
  yearlyStarGain: z.number(),
  tags: z.array(z.string()),
  url: z.string(),
});

const categorySchema = z.object({
  name: z.string(),
  count: z.number(),
  totalYearlyGain: z.number(),
  topProject: z.string(),
});

// ── Step 1: Fetch top trending projects ───────────────────────────────────────

const fetchProjectsStep = createStep({
  id: "fetch-projects",
  description: "Fetch top trending JS projects from risingstars.js.org",
  inputSchema: z.object({
    limit: z.number().default(50),
    tag: z.string().optional(),
  }),
  outputSchema: z.object({
    projects: z.array(projectSchema),
    updatedAt: z.string(),
    totalTracked: z.number(),
  }),
  execute: async ({ inputData }) => {
    const data = await fetchProjects();

    let projects = data.projects.filter((p) => p.delta > 0);

    if (inputData.tag) {
      projects = projects.filter((p) => p.tags.includes(inputData.tag!));
    }

    projects.sort((a, b) => b.delta - a.delta);

    const top = projects.slice(0, inputData.limit).map((p) => ({
      name: p.name,
      repo: p.full_name,
      description: p.description,
      totalStars: p.stars,
      yearlyStarGain: p.delta,
      tags: p.tags,
      url: p.url ?? `https://github.com/${p.full_name}`,
    }));

    return {
      projects: top,
      updatedAt: data.date,
      totalTracked: data.projects.length,
    };
  },
});

// ── Step 2: Analyze and categorize the fetched projects ───────────────────────

const analyzeProjectsStep = createStep({
  id: "analyze-projects",
  description: "Categorize projects by tag and compute ecosystem stats",
  inputSchema: z.object({
    projects: z.array(projectSchema),
    updatedAt: z.string(),
    totalTracked: z.number(),
  }),
  outputSchema: z.object({
    topCategories: z.array(categorySchema),
    topProjects: z.array(projectSchema),
    totalYearlyStars: z.number(),
    updatedAt: z.string(),
    projectsJson: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { projects, updatedAt } = inputData;

    // Build category breakdown
    const categoryMap: Record<
      string,
      { count: number; totalYearlyGain: number; topProject: string }
    > = {};

    for (const p of projects) {
      for (const tag of p.tags) {
        if (!categoryMap[tag]) {
          categoryMap[tag] = {
            count: 0,
            totalYearlyGain: 0,
            topProject: p.name,
          };
        }
        categoryMap[tag].count++;
        categoryMap[tag].totalYearlyGain += p.yearlyStarGain;
      }
    }

    const topCategories = Object.entries(categoryMap)
      .sort((a, b) => b[1].totalYearlyGain - a[1].totalYearlyGain)
      .slice(0, 8)
      .map(([name, stats]) => ({ name, ...stats }));

    const totalYearlyStars = projects.reduce(
      (sum, p) => sum + p.yearlyStarGain,
      0
    );

    return {
      topCategories,
      topProjects: projects.slice(0, 10),
      totalYearlyStars,
      updatedAt,
      // Serialize full data for the AI generation step
      projectsJson: JSON.stringify(projects.slice(0, 30), null, 2),
    };
  },
});

// ── Step 3: Generate AI-powered report ───────────────────────────────────────

const generateReportStep = createStep({
  id: "generate-report",
  description: "Use AI agent to generate a human-readable ecosystem report",
  inputSchema: z.object({
    topCategories: z.array(categorySchema),
    topProjects: z.array(projectSchema),
    totalYearlyStars: z.number(),
    updatedAt: z.string(),
    projectsJson: z.string(),
  }),
  outputSchema: z.object({
    report: z.string(),
    generatedAt: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { topCategories, topProjects, totalYearlyStars, updatedAt, projectsJson } =
      inputData;

    const prompt = `你是一名 JavaScript 生态系统分析师。请根据以下数据生成一份专业的 JS 生态系统趋势报告。

## 数据概览
- 数据更新时间：${updatedAt}
- 分析项目总 star 年增长：${totalYearlyStars.toLocaleString()}

## 热门分类（按年度 star 增长排序）
${topCategories.map((c, i) => `${i + 1}. **${c.name}** - ${c.count} 个项目，年增 ${c.totalYearlyGain.toLocaleString()} stars，代表项目：${c.topProject}`).join("\n")}

## TOP 10 项目
${topProjects.map((p, i) => `${i + 1}. **${p.name}** (${p.repo}) - ${p.description}，年增 ${p.yearlyStarGain.toLocaleString()} stars`).join("\n")}

## 完整 TOP 30 项目数据
\`\`\`json
${projectsJson}
\`\`\`

请生成一份结构清晰的 Markdown 报告，包含：
1. 执行摘要（3-5句话概括本年度 JS 生态趋势）
2. 热门分类深度分析
3. 明星项目点评（前5名）
4. 趋势洞察与预测`;

    const agent = mastra.getAgent("risingStarsAgent");
    const result = await agent.generate([{ role: "user", content: prompt }]);

    return {
      report: result.text,
      generatedAt: new Date().toISOString(),
    };
  },
});

// ── Workflow definition ───────────────────────────────────────────────────────

export const ecosystemReportWorkflow = createWorkflow({
  id: "ecosystem-report",
  inputSchema: z.object({
    limit: z.number().default(50).describe("Number of projects to analyze"),
    tag: z.string().optional().describe("Optional tag filter (e.g. 'react')"),
  }),
  outputSchema: z.object({
    report: z.string(),
    generatedAt: z.string(),
  }),
})
  .then(fetchProjectsStep)
  .then(analyzeProjectsStep)
  .then(generateReportStep)
  .commit();
