import { z } from "zod";

export const routerSchema = z.object({
  area: z
    .enum(["ventas", "soporte_tecnico", "general"])
    .describe(
      "Área a la cual se debe derivar al usuario según lo analizado en la conversación y la consulta realizada",
    ),
  respuesta_sugerida: z
    .string()
    .describe(
      "Respuesta sugerida que le pasas al asistente final para que pueda utilizarla en respuesta  al usuario en base a las políticas oficiales de la empresa",
    ),
  mas_info: z
    .boolean()
    .describe(
      "Indica si se necesita más información de un agente especifico de ventas o soporte técnico, si es 'true' quiere decir que necesita mas información y si es 'false' quiere decir que no necesita más información y la respuesta sugerida es suficiente",
    ),
  reason: z
    .string()
    .describe(
      "Breve explicación del por qué se eligió esta área para que el modelo que lo reciba lo entienda",
    ),
});
