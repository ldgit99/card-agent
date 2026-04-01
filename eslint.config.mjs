import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "app_scaffold_backup/**",
    "tmp-app/**",
  ]),
]);
