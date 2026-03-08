import "dotenv/config";
import { Mastra } from "@mastra/core";
import { CloudflareDeployer } from "@mastra/deployer-cloudflare";
import { risingStarsAgent } from "../agents/risingstarsAgent.js";

export const mastra = new Mastra({
  agents: {
    risingStarsAgent,
  },
  deployer: new CloudflareDeployer({
    name: "agent-demo1",
  }),
});
