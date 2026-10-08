import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Preserve the project's authored AGENTS.md without generated additions.
  agentRules: false,
};

export default nextConfig;
