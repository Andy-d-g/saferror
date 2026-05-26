import { defineConfig } from "vite-plus/test/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["./src/__tests__/**/*.test.ts"],
  },
});
