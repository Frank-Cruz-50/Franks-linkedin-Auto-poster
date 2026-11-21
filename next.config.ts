import type { NextConfig } from "next";

const config: NextConfig = {
  // Server-only packages that spawn processes or ship native/large code.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "@prisma/client", "heic-convert"],
};
export default config;
