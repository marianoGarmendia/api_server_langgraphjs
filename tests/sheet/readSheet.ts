import { google, sheets_v4 } from "googleapis";
import dotenv from "dotenv";
dotenv.config();

// Alcance necesario para leer y escribir en Google Sheets
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

export const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID_KOMBAT;
export const SHEET_NAME = process.env.GOOGLE_SHEET_NAME_KOMBAT;
/**
 * Inicializa el cliente autenticado de Google Sheets usando un service account.
 * Debes configurar estas variables de entorno:
 *
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL
 * - GOOGLE_PRIVATE_KEY  (puede llevar \\n para saltos de línea)
 */
export function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT; // gimnasio-manager@gimnasio-478603.iam.gserviceaccount.com
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Faltan variables de entorno GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_PRIVATE_KEY"
    );
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: SCOPES,
  });

  return google.sheets({ version: "v4", auth });
}

export type SheetProperties = sheets_v4.Schema$SheetProperties;

export enum LeadCalificacion {
  SinInteres = "sin_interes",
  BajoInteres = "bajo_interes",
  Interesado = "interesado",
  MuyInteresado = "muy_interesado",
}

export interface KombatCustomerRow {
    cliente?: string;
   resumen?:string
   calificacion?: LeadCalificacion;
    telefono: string;
    productos_mencionados?: string[];
    siguiente_accion?: string;
    motivo_calificacion?: string;
    fecha?: string;
  }

  export interface KombatCustomerRowWithRow extends KombatCustomerRow {
    rowNumber: number; // número de fila en el sheet
  }

export interface AppendCustomerOptions {
  spreadsheetId: string;
  sheetName: string;
  customer?: KombatCustomerRow;
}

/**
 * Agrega un cliente de ejemplo en la primera fila libre del sheet.
 * Usa append para que siempre inserte debajo de la última fila con datos.
 * El spreadsheetId lo sacás de la URL del Google Sheet (la parte entre /d/ y /edit).
El sheetName es el nombre de la pestaña dentro del Sheet (por ejemplo “Hoja 1”, “Clientes”, etc.).
 */
export async function appendMockCustomerToSheet({
  spreadsheetId,
  sheetName,
  customer,
}: AppendCustomerOptions) {
  const sheets = getSheetsClient();

  const mockCustomer: KombatCustomerRow = customer ?? {
    cliente: "Juan Perez",
    telefono: "+54 11 1234 5678",
    resumen: "Consulta sobre planes y horarios.",
    calificacion: LeadCalificacion.MuyInteresado,
    productos_mencionados: ["hunter"],
    siguiente_accion: "llamar pronto",
    motivo_calificacion: "porque mencionó hunter",
    fecha: new Date().toISOString(),
  };

  const productosMencionados = Array.isArray(mockCustomer.productos_mencionados)
    ? mockCustomer.productos_mencionados.join(", ")
    : "";

  const values = [
    [
      mockCustomer.cliente,
      mockCustomer.telefono,
      mockCustomer.resumen,
      mockCustomer.calificacion,
      productosMencionados,
      mockCustomer.siguiente_accion,
      mockCustomer.motivo_calificacion,
      mockCustomer.fecha,
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:H`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values,
    },
  });
}