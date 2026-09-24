import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    // Each test file gets its own database cloned from a migrated template.
    fileParallelism: true,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
