import { defineConfig } from "vite-plus/test/config";

export default defineConfig({
  oxc: {
    target: "node22",
  },
  test: {
    environment: "node",
    include: ["./src/__tests__/**/*.test.ts"],
  },
});
