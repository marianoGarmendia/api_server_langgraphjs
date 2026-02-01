import path from "path";
import { fileURLToPath } from "url";
import {ingestPdfToMongo} from "./kb/ingestPDF.ts";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pdfPath = path.join(
  __dirname,
  "./docs/palas_kombat.pdf"
);

const main = async () => {
await ingestPdfToMongo({
  filePath: pdfPath,
  orgId: "kombatpadel",
  agentId: "agent_wsp",
  title: "como_elegir_palas_kombat",
  product: "palas_kombat",
  category: "info_general",
  

});

}

// main().catch((error) => {
//   console.error(error);
//   process.exit(1);
// });