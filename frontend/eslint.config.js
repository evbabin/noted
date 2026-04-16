import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  // Ignore build output and dependencies
  { ignores: ["dist", "node_modules"] },

  // Main config for TypeScript + React source files
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // Enforce React Hooks rules
      ...reactHooks.configs.recommended.rules,
      // Allow setState inside effects — the codebase uses this pattern
      // intentionally for resetting derived state when dependencies change.
      "react-hooks/set-state-in-effect": "off",
      // Warn on components that can't be hot-reloaded
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Allow prefixed unused vars (e.g. _unusedParam)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // Disable style rules that conflict with Prettier
  eslintConfigPrettier
);
