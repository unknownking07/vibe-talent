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

    // Generated output and local tooling that are not part of the app.
    ".open-next/**",
    ".wrangler/**",
    ".agents/**",
    ".claude/**",
    "vibecoders/**",
    "skills/**",
    "demo-video/**",
    "vibetalent-video/**",
    "infographics/**",
    "seo-audit/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
