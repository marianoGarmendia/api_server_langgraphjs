// run the server for CLI
import { fileURLToPath } from "node:url";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parse } from "dotenv";



const argvConfigPath = process.argv.find((arg) => arg.endsWith(".json"));
const envConfigPath = process.env.LANGGRAPH_CONFIG_PATH;
const defaultRootConfigPath = fileURLToPath(
  new URL("../langgraph.json", import.meta.url),
);
const defaultTestConfigPath = fileURLToPath(
  new URL("./graphs/langgraph.json", import.meta.url),
);

const pickFirstExistingPath = async (paths: Array<string | undefined>) => {
  for (const candidate of paths) {
    if (!candidate) continue;
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  return defaultTestConfigPath;
};

const configPath = await pickFirstExistingPath([
  argvConfigPath,
  envConfigPath,
  defaultRootConfigPath,
  defaultTestConfigPath,
]);
const config = JSON.parse(await readFile(configPath, "utf-8"));

let env = {} as NodeJS.ProcessEnv;
if (typeof config.env === "string") {
  const targetEnvFile = resolve(dirname(configPath), config.env);
  env = parse(await readFile(targetEnvFile, "utf-8")) as NodeJS.ProcessEnv;
} else if (config.env != null) {
  env = config.env;
}

const { spawnServer } = (
  process.argv.includes("--dev")
    ? await import("../src/cli/spawn.mjs")
    : // @ts-ignore May not exist
      await import("../dist/cli/spawn.mjs")
) as typeof import("../src/cli/spawn.mjs");

// await spawnServer(
//   { port: "2024", nJobsPerWorker: "10", host: "localhost" },
//   { config, env, hostUrl: "https://smith.langchain.com" },
//   { pid: process.pid, projectCwd: dirname(configPath) },
// );

const port = process.env.PORT ?? "5001";
const host = process.env.HOST ?? "0.0.0.0";
const hostUrl = process.env.HOST_URL ?? `http://localhost:${port}`;

await spawnServer(
  {
    port,
    nJobsPerWorker: "10",
    host,
  },
  {
    config,
    env,
    hostUrl,
  },
  {
    pid: process.pid,
    projectCwd: dirname(configPath),
  },
);

// await spawnServer(
//   {
//     port: process.env.PORT || "2024",
//     nJobsPerWorker: "10",
//     host: "0.0.0.0"
//   },
//   {
//     config,
//     env,
//     hostUrl: process.env.HOST_URL || "https://smith.langchain.com"
//   },
//   {
//     pid: process.pid,
//     projectCwd: dirname(configPath)
//   }
// );
