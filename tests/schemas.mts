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
  reason: z
    .string()
    .describe(
      "Breve explicación del por qué se eligió esta área para que el modelo que lo reciba lo entienda",
    ),
});
