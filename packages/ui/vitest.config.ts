import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/utils/decoding/**/*.test.ts"],
  },
});
