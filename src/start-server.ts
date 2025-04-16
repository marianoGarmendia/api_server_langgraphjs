import { startServer, StartServerSchema } from "./server.mjs";
import { parse } from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";

// Leer variables del .env y del entorno
const env = {
  ...process.env,
  ...parse(readFileSync(resolve(process.cwd(), ".env"), "utf-8")),
};

// Validar y estructurar la configuración
const config = StartServerSchema.parse({
  port: Number(env.PORT) || 8080,
  host: "0.0.0.0",
  nWorkers: 1,
  cwd: process.cwd(),
  graphs: {
    default: env.LANGGRAPH_CONFIG || "../langgraph.json",
  },
  auth: {
    disable_studio_auth: true,
  },
  ui: {
    default: env.LANGGRAPH_CONFIG || "../langgraph.json",
  },
  ui_config: {
    shared: [], // Podés agregar aquí los campos del estado que querés mostrar
  },
});

// Iniciar el servidor
await startServer(config);
