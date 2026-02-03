import { z } from "zod";
export const routerSchema = z.object({
    area: z
        .enum(["ventas", "soporte_tecnico", "general"])
        .describe("Área a la cual se debe derivar al usuario según lo analizado en la conversación y la consulta realizada"),
    respuesta_sugerida: z
        .string()
        .describe("Respuesta sugerida que le pasas al asistente final para que pueda utilizarla en respuesta  al usuario en base a las políticas oficiales de la empresa"),
    mas_info: z
        .boolean()
        .describe("Indica si se necesita más información de un agente especifico de ventas o soporte técnico, si es 'true' quiere decir que necesita mas información y si es 'false' quiere decir que no necesita más información y la respuesta sugerida es suficiente"),
    reason: z
        .string()
        .describe("Breve explicación del por qué se eligió esta área para que el modelo que lo reciba lo entienda"),
});
export const linkProductoSchema = z.object({
    query: z
        .string()
        .describe("Nombre del producto o keywords para buscar (ej: 'osorno', 'mochila vesubio', 'bolso', 'pampa', 'hunter', 'vulcano', 'etna', 'vesubio', 'teide', 'fuji', 'galeras', 'krakatoa')"),
    categoria: z
        .enum(["palas", "accesorios", "indumentaria", "todas"])
        .optional()
        .default("todas")
        .describe("Categoría donde buscar: palas, accesorios, indumentaria o todas"),
});
export const linkProductoOutputSchema = z.object({
    encontrado: z.boolean(),
    productos: z.array(z.object({
        nombre: z.string(),
        url: z.string(),
        categoria: z.string(),
    })),
    mensaje: z.string(),
});
// Enum de áreas
export const AreaEnum = z.enum([
    "SALUDO",
    "VENTAS_TIENDA",
    "VENTAS_BANCOS",
    "ASESORAMIENTO_PRODUCTO",
    "RECLAMO",
    "ENVIOS_LOGISTICA",
    "MAYORISTA",
    "INFO_GENERAL",
    "FUERA_DE_ALCANCE",
]);
// Enum de herramientas disponibles
export const HerramientaEnum = z.enum([
    "tienda_kombat_oferta_comercial",
    "precios_y_promociones_vigentes",
    "info_catalogo_vulcano",
    "como_elegir_palas_kombat",
]);
// Enum de confianza
export const ConfianzaEnum = z.enum(["alta", "media", "baja"]);
// Schema principal del router
export const routerSchemaV2 = z.object({
    area: AreaEnum.describe(`Área a la cual derivar según la intención del usuario:
    - SALUDO: mensaje inicial sin consulta específica (hola, buenas, etc.)
    - VENTAS_TIENDA: consultas sobre precios, descuentos, pago contado en tienda oficial
    - VENTAS_BANCOS: consultas sobre cuotas, financiación, Banco Nación, Banco Provincia
    - ASESORAMIENTO_PRODUCTO: recomendaciones de palas, características técnicas, comparativas
    - RECLAMO: problemas con pedidos, productos defectuosos, quejas
    - ENVIOS_LOGISTICA: consultas sobre envíos, tiempos, costos de envío
    - MAYORISTA: compras por cantidad para reventa
    - INFO_GENERAL: horarios, contacto, información de la empresa
    - FUERA_DE_ALCANCE: consultas no relacionadas con KOMBAT ni pádel`),
    confianza: ConfianzaEnum.describe(`Nivel de certeza en la clasificación:
    - alta: la intención es clara y sin ambigüedad
    - media: probable pero con cierta ambigüedad
    - baja: difícil de determinar, podría ser otra área`),
    intencion_detectada: z
        .string()
        .min(5)
        .max(100)
        .describe("Descripción breve y concisa de lo que el usuario quiere o necesita (máx 100 caracteres)"),
    requiere_herramienta: z
        .boolean()
        .describe("true si el área necesita consultar una herramienta para responder correctamente, false si se puede responder con información fija"),
    herramienta_sugerida: HerramientaEnum.nullable().describe(`Herramienta a utilizar según el área:
    - tienda_kombat_oferta_comercial: para VENTAS_TIENDA (precios contado, packs, descuentos)
    - precios_y_promociones_vigentes: para VENTAS_BANCOS (cuotas, promos bancarias)
    - info_catalogo_vulcano: para ASESORAMIENTO_PRODUCTO (specs técnicas de palas)
    - como_elegir_palas_kombat: para ASESORAMIENTO_PRODUCTO (recomendación según nivel/estilo)
    - null: cuando no se requiere herramienta`),
    siguiente_accion: z
        .enum([
        "responder_directo",
        "usar_herramienta",
        "derivar_humano",
        "pedir_mas_info",
    ])
        .describe(`Acción recomendada para el siguiente nodo:
    - responder_directo: se puede responder sin herramientas (saludos, info fija)
    - usar_herramienta: necesita consultar una tool antes de responder
    - derivar_humano: derivar a email/teléfono (reclamos, mayoristas)
    - pedir_mas_info: la consulta es ambigua, necesita más contexto del usuario`),
    canal_derivacion: z
        .object({
        tipo: z.enum(["email", "telefono", "web", "ninguno"]),
        valor: z.string().nullable(),
    })
        .nullable()
        .describe(`Canal al que derivar si aplica:
    - email: tienda@kombatpadel.com.ar (reclamos) o julian@ipacsa.com.ar (mayoristas)
    - telefono: +54 9 11 72270778
    - web: www.kombatpadel.com.ar
    - ninguno/null: no requiere derivación`),
});
// Schema simplificado (si preferís menos campos)
export const routerSchemaSimple = z.object({
    area: AreaEnum.describe("Área de destino según la intención del usuario"),
    confianza: ConfianzaEnum.describe("Nivel de certeza en la clasificación"),
    intencion_detectada: z.string().describe("Qué quiere el usuario en una frase corta"),
    requiere_herramienta: z.boolean().describe("Si necesita usar una tool"),
    herramienta_sugerida: HerramientaEnum.nullable().describe("Herramienta a usar o null"),
});
export const faqSchema = z.object({
    isFaq: z
        .boolean()
        .describe("true si la consulta puede responderse con una FAQ existente, false si requiere procesamiento adicional"),
    confianza: z
        .enum(["alta", "media", "baja"])
        .describe("Nivel de certeza de que la FAQ responde correctamente la consulta"),
    faq_detectada: z
        .string()
        .nullable()
        .describe("Pregunta frecuente que matchea con la consulta del usuario, o null si no hay match"),
    answer: z
        .string()
        .nullable()
        .describe("Respuesta consolidada y adaptada al tono de WhatsApp (cálida, breve, con links). Null si isFaq es false"),
    requiere_tool: z
        .boolean()
        .describe("true si aunque sea FAQ, necesita complementar con info de herramientas (ej: precios actualizados)"),
});
