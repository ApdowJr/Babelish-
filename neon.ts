import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  auth: true,
  // aiGateway requires a paid plan — re-add "aiGateway: true," after upgrading.
  // Until then the app's AI tutor uses any OpenAI-compatible endpoint via
  // EXPO_PUBLIC_AI_* env vars, or falls back to scripted demo mode.
  // aiGateway: true,
  functions: {
    hello: { name: "Hello World", source: "./hello.ts" },
    // The app's backend: health, per-user state sync, storage presigning.
    // The mobile client calls it directly with a Managed Auth JWT (Bearer).
    api: { name: "Nativa API", source: "./functions/api/index.ts" },
  },
  buckets: {
    // "private" is the default; use "public_read" for anonymous reads
    assets: { access: "private" },
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
