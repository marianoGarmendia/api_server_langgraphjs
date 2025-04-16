import { startServer, StartServerSchema } from "./server.mjs";
import { config } from "dotenv";


config()

// Leer variables del .env y del entorno
// const env = {
//   ...process.env,
//   ...parse(resolve(__dirname, ".env")),
// };

// Validar y estructurar la configuración
const configu = StartServerSchema.parse({
  port: Number(process.env.PORT) || 8080,
  host: "0.0.0.0",
  nWorkers: 1,
  cwd: process.cwd(),
  graphs: {
    default: process.env.LANGGRAPH_CONFIG || "../langgraph.json",
  },
  auth: {
    disable_studio_auth: true,
  },
  ui: {
    default: process.env.LANGGRAPH_CONFIG || "../langgraph.json",
  },
  ui_config: {
    shared: [], // Podés agregar aquí los campos del estado que querés mostrar
  },
});

// Iniciar el servidor
await startServer(configu);
