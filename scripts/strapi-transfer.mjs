import { spawn } from "node:child_process";
import { lookup } from "node:dns/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const cmsDir = join(root, "apps", "cms");

dotenv.config({ path: join(root, ".env.local"), override: true });

const red = (text) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const bold = (text) => `\x1b[1m${text}\x1b[0m`;
const dim = (text) => `\x1b[2m${text}\x1b[0m`;

const args = process.argv.slice(2);
const direction = args.find((arg) => arg === "push" || arg === "pull");
const skipConfirm = args.includes("--yes") || args.includes("-y");

if (!direction) {
  console.error(
    "Usage: node scripts/strapi-transfer.mjs <push|pull> [--yes|-y]\n\n" +
      "  push  — overwrite CLOUD with local data\n" +
      "  pull  — overwrite LOCAL with cloud data\n\n" +
      "  --yes, -y  — skip typed confirmation (CI/non-interactive only)",
  );
  process.exit(1);
}

const strapiUrl = (
  process.env.STRAPI_CLOUD_URL ?? process.env.STRAPI_URL
)?.replace(/\/$/, "");
const transferToken = process.env.STRAPI_TRANSFER_TOKEN;

if (!strapiUrl || !transferToken) {
  console.error(
    "STRAPI_CLOUD_URL (or STRAPI_URL) and STRAPI_TRANSFER_TOKEN must be set in .env.local",
  );
  process.exit(1);
}

if (/localhost|127\.0\.0\.1/.test(strapiUrl)) {
  console.error(
    red(
      "\nCloud URL resolves to localhost — transfer would target your local Strapi, not Strapi Cloud.\n" +
        "Set STRAPI_CLOUD_URL to your Strapi Cloud URL in .env.local\n" +
        "(Find it in Strapi Cloud → Project → Settings → Domains.)\n",
    ),
  );
  process.exit(1);
}

const transferEndpoint = `${strapiUrl}/admin`;
const cloudHostname = new URL(strapiUrl).hostname;

async function verifyCloudReachable() {
  try {
    await lookup(cloudHostname);
  } catch {
    console.error(
      red(
        `\nCannot resolve "${cloudHostname}" — this hostname does not exist in DNS.\n\n` +
          "STRAPI_CLOUD_URL in .env.local is wrong or the custom domain is not set up yet.\n\n" +
          "Find the correct URL in Strapi Cloud:\n" +
          "  1. Open https://cloud.strapi.io\n" +
          "  2. Select your project\n" +
          "  3. Settings → Domains (or copy the admin URL, e.g. https://your-project.strapiapp.com)\n" +
          "  4. Set STRAPI_CLOUD_URL to that base URL (no /admin suffix)\n",
      ),
    );
    process.exit(1);
  }
}

const warnings = {
  push: {
    source: "LOCAL (apps/cms)",
    target: "CLOUD",
    targetUrl: strapiUrl,
    message:
      "This DELETES ALL existing data, assets and config on the CLOUD and replaces it with your LOCAL data.",
    confirmPhrase: "push to cloud",
  },
  pull: {
    source: "CLOUD",
    target: "LOCAL (apps/cms)",
    targetUrl: strapiUrl,
    message:
      "This DELETES ALL your LOCAL data, assets and config and replaces it with CLOUD data.",
    confirmPhrase: "pull from cloud",
  },
};

const { source, target, targetUrl, message, confirmPhrase } = warnings[direction];

function printWarning() {
  const line = "═".repeat(72);
  console.log("");
  console.log(red(bold(line)));
  console.log(red(bold("  ⚠  STRAPI TRANSFER — DESTRUCTIVE OPERATION")));
  console.log(red(bold(line)));
  console.log("");
  console.log(yellow(bold(`  Direction:  ${source}  →  ${target}`)));
  console.log(dim(`  Cloud URL:   ${targetUrl}`));
  console.log("");
  console.log(red(bold(`  ${message}`)));
  console.log(red(bold("  This is IRREVERSIBLE.")));
  console.log("");
  console.log(dim("  Content-type schemas (models) are NOT transferred."));
  console.log(dim("  Local and cloud schemas must already match."));
  console.log("");
  console.log(red(bold(line)));
  console.log("");
}

async function confirm() {
  if (skipConfirm) {
    return;
  }

  if (!process.stdin.isTTY) {
    console.error(
      red(
        "Non-interactive terminal detected. Pass --yes to confirm, or run interactively.",
      ),
    );
    process.exit(1);
  }

  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(
      yellow(
        `Type "${bold(confirmPhrase)}" to proceed (anything else aborts): `,
      ),
    );

    if (answer.trim() !== confirmPhrase) {
      console.log("");
      console.log(yellow("Aborted, nothing changed."));
      process.exit(1);
    }
  } finally {
    rl.close();
  }
}

function runTransfer() {
  const transferArgs = ["transfer", "--force"];

  if (direction === "push") {
    transferArgs.push("--to", transferEndpoint, "--to-token", transferToken);
  } else {
    transferArgs.push(
      "--from",
      transferEndpoint,
      "--from-token",
      transferToken,
    );
  }

  const strapiCli = join(
    cmsDir,
    "node_modules",
    "@strapi",
    "strapi",
    "bin",
    "strapi.js",
  );

  console.log(
    dim(
      `Running: node strapi.js transfer --force … ${transferEndpoint} (cwd: apps/cms)\n`,
    ),
  );

  const child = spawn(process.execPath, [strapiCli, ...transferArgs], {
    cwd: cmsDir,
    stdio: "inherit",
  });

  child.on("close", (code) => {
    process.exit(code ?? 1);
  });

  child.on("error", (err) => {
    console.error(red(`Failed to start strapi transfer: ${err.message}`));
    process.exit(1);
  });
}

printWarning();
await verifyCloudReachable();
await confirm();
runTransfer();
