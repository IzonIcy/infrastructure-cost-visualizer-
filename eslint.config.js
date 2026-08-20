import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
  {
    ignores: ["node_modules/"],
  },
  {
    // Browser dashboard code
    files: ["app.js"],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Node server, build config, and tests
    files: ["server/**/*.js", "tests/**/*.js", "*.config.js"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
