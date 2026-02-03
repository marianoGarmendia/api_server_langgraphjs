import { appendMockCustomerToSheet, LeadCalificacion, SHEET_NAME, SPREADSHEET_ID } from "./readSheet.js";


export const appendCustomer = async ({cliente, telefono, resumen, calificacion,motivo_calificacion,productos_mencionados,siguiente_accion, fecha}: {cliente: string, telefono: string, resumen: string, calificacion: string, motivo_calificacion: string, productos_mencionados: string[],siguiente_accion: string, fecha: string}) => {
  if (!SPREADSHEET_ID || !SHEET_NAME) {
    console.error("Faltan variables de entorno: GOOGLE_SHEET_ID_KOMBAT o GOOGLE_SHEET_NAME_KOMBAT");
    return;
  }

  try {
    await appendMockCustomerToSheet({
      spreadsheetId: SPREADSHEET_ID,
      sheetName: SHEET_NAME,
      customer: {
          calificacion: LeadCalificacion[calificacion as keyof typeof LeadCalificacion],
        cliente: cliente,
        telefono: telefono,
        resumen: resumen,
        productos_mencionados: productos_mencionados,
        siguiente_accion: siguiente_accion,
        motivo_calificacion: motivo_calificacion,
        fecha: fecha,
      },
    });

    console.log("Cliente agregado correctamente en Google Sheets.");
    return true;
  } catch (error) {
    console.error("Error al agregar cliente en Google Sheets:", error);
    return false;
  }
};

