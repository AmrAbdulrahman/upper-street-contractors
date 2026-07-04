import nextEnv from "@next/env";
import { join } from "node:path";

// Single root env file, same convention as apps/website (see repo README ->
// Environment setup). No per-app .env duplication.
const workspaceRoot = join(process.cwd(), "..", "..");
nextEnv.loadEnvConfig(workspaceRoot);
