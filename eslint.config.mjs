import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Standalone load-test harness scripts (CommonJS Node scripts, run manually).
    "loadtest/**",
    // CommonJS runtime helper invoked by the Docker entrypoint (not app code).
    "db/baseline-adopt.cjs",
  ]),
]);

export default eslintConfig;
