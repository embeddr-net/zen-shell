// @ts-check
import { tanstackConfig } from "@tanstack/eslint-config";

export default [
  ...tanstackConfig,
  {
    ignores: ["dist/**", "build/**", ".vite/**", "coverage/**", "*.config.{js,ts,mjs,cjs}"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // pending eslint-plugin-react-hooks v7 + tanstack-config compatibility
      "react-hooks/exhaustive-deps": "off",
      // Too aggressive for code that handles localStorage / untyped JSON
      // (e.g. version-checking parsed values where TS narrows to a literal).
      "@typescript-eslint/no-unnecessary-condition": "off",
    },
  },
];
