import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Pure logic/decoder suites run on the fast `node` env by default.
    environment: "node",
    // Single canonical glob: every *.test.ts(x) under src is picked up, so no
    // suite can be silently excluded. New React render tests (*.test.tsx) are
    // matched automatically and get jsdom via environmentMatchGlobs below.
    include: ["src/**/*.test.{ts,tsx}"],
    // React render tests (*.test.tsx) opt into jsdom automatically; keeping
    // node as the default avoids slowing the pure logic/decoder suites. A
    // *.test.ts that needs a DOM can opt in with `// @vitest-environment jsdom`.
    environmentMatchGlobs: [["**/*.test.tsx", "jsdom"]],
  },
});
