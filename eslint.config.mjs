import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next (broadened to ** so nested copies
    // inside local git worktrees are ignored too, matching a clean CI checkout):
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "next-env.d.ts",
    // Local-only git worktrees created by the agent harness (not app code).
    ".claude/**",
    // Standalone load-test harness scripts (CommonJS Node scripts, run manually).
    "loadtest/**",
    // CommonJS runtime helper invoked by the Docker entrypoint (not app code).
    "db/baseline-adopt.cjs",
    // CommonJS operator script (run manually against prod before the cutover).
    "scripts/preflight-cutover.cjs",
  ]),
]);

export default eslintConfig;
