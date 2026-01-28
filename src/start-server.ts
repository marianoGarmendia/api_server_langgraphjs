import { startServer, StartServerSchema } from "./server.mjs";
import { config } from "dotenv";
import fs from "fs/promises";

config()

// import path from "path";
// import { cwd } from "process";

// config();

// const configPath = path.resolve(cwd(), "langgraph.json");

// Leer variables del .env y del entorno
// const env = {
//   ...process.env,
//   ...parse(resolve(__dirname, ".env")),
// };

const configPath = process.env.LANGGRAPH_CONFIG || "./langgraph.json";
const configJson = await fs.readFile(configPath, "utf-8");
const configo = JSON.parse(configJson);

// Validar y estructurar la configuración
const configu = StartServerSchema.parse({
    port: Number(process.env.PORT) || 8080,
    host: "0.0.0.0",
    nWorkers: 1,
    cwd: process.cwd(),
    graphs: configo.graphs,
    auth: {
      disable_studio_auth: true,
    },
    // UI definitions come from `langgraph.json`'s `ui` section (not from `graphs`).
    ui: configo.ui,
    ui_config: {
      shared: [],
    },
  });

// Iniciar el servidor
await startServer(configu);
