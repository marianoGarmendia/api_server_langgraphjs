import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ProductoKombat } from "./schemas.mjs";
import { getMongo, getVectorStore } from "./kb/mongoVector.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import dotenv from "dotenv";
dotenv.config();



export const KATALOGO_PRODUCTOS_KOMBAT = {
  palas: [
    { nombre: "Todas las palas", keywords: ["palas", "todas", "catalogo", "ver palas"], url: "https://kombatpadel.com.ar/es/palas-padel" },
    { nombre: "Krakatoa", keywords: ["krakatoa", "redonda", "control"], url: "https://kombatpadel.com.ar/es/palas-padel/kombat-krakatoa" },
    { nombre: "Osorno", keywords: ["osorno", "lagrima", "blanda"], url: "https://kombatpadel.com.ar/es/palas-padel/kombat-osorno" },
    { nombre: "Fuji", keywords: ["fuji", "lagrima", "media"], url: "https://kombatpadel.com.ar/es/palas-padel/kombat-fuji" },
    { nombre: "Galeras", keywords: ["galeras", "lagrima", "blanda", "control"], url: "https://kombatpadel.com.ar/es/palas-padel/kombat-galeras" },
    { nombre: "Teide", keywords: ["teide", "diamante", "media", "potencia"], url: "https://kombatpadel.com.ar/es/palas-padel/kombat-teide" },
    { nombre: "Vesubio", keywords: ["vesubio", "diamante", "blanda", "potencia"], url: "https://kombatpadel.com.ar/es/palas-padel/kombat-vesubio" },
    { nombre: "Etna", keywords: ["etna", "diamante", "dura", "potencia"], url: "https://kombatpadel.com.ar/es/palas-padel/kombat-etna" },
    { nombre: "Pampa", keywords: ["pampa", "economica", "principiante"], url: "https://kombatpadel.com.ar/es/palas-padel/kombat-ia-63-pampa" },
    { nombre: "Hunter", keywords: ["hunter", "lagrima", "dura", "3k"], url: "https://kombatpadel.com.ar/es/palas-padel/kombat-hunter-3k" },
  ],
  accesorios: [
    { nombre: "Todos los accesorios", keywords: ["accesorios", "todos", "catalogo"], url: "https://kombatpadel.com.ar/es/accesorios-padel" },
    { nombre: "Bolso paletero Aqua", keywords: ["bolso", "paletero", "aqua", "manu martin"], url: "https://kombatpadel.com.ar/es/inicio/bolso-paletero-aqua-x-manu-martin" },
    { nombre: "Bolso paletero Vulcano", keywords: ["bolso", "paletero", "vulcano"], url: "https://kombatpadel.com.ar/es/inicio/bolso-paletero-vulcano" },
    { nombre: "Mochila Krakatoa", keywords: ["mochila", "krakatoa"], url: "https://kombatpadel.com.ar/es/ropa-y-accesorios/mochila-krakatoa" },
    { nombre: "Mochila Osorno", keywords: ["mochila", "osorno"], url: "https://kombatpadel.com.ar/es/ropa-y-accesorios/mochila-osorno" },
    { nombre: "Mochila Fuji", keywords: ["mochila", "fuji"], url: "https://kombatpadel.com.ar/es/ropa-y-accesorios/mochila-fuji" },
    { nombre: "Mochila Teide", keywords: ["mochila", "teide"], url: "https://kombatpadel.com.ar/es/ropa-y-accesorios/mochila-teide" },
    { nombre: "Mochila Vesubio", keywords: ["mochila", "vesubio"], url: "https://kombatpadel.com.ar/es/ropa-y-accesorios/mochila-vesubio" },
    { nombre: "Mochila Etna", keywords: ["mochila", "etna"], url: "https://kombatpadel.com.ar/es/accesorios-padel/mochila-etna" },
    { nombre: "Tubo de bolas", keywords: ["tubo", "bolas", "pelotas"], url: "https://kombatpadel.com.ar/es/accesorios-padel/bote-de-bolas-kombat-padel" },
    { nombre: "Overgrip", keywords: ["overgrip", "grip", "cinta"], url: "https://kombatpadel.com.ar/es/accesorios-padel/overgrip-individual-blanco-kombat" },
    { nombre: "Protector transparente", keywords: ["protector", "transparente", "marco"], url: "https://kombatpadel.com.ar/es/accesorios-padel/protector-kombat" },
  ],
  indumentaria: [
    { nombre: "Equipo deportivo negro y verde", keywords: ["equipo", "conjunto", "negro", "verde"], url: "https://kombatpadel.com.ar/es/indumentaria/equipo-deportivo-kombat#/18-talla-xs" },
    { nombre: "Equipo deportivo Belluati", keywords: ["equipo", "conjunto", "belluati", "celeste"], url: "https://kombatpadel.com.ar/es/indumentaria/equipo-deportivo-kombat-belluati#/10-talla-s" },
    { nombre: "Campera Direct (mujer)", keywords: ["campera", "direct", "mujer"], url: "https://kombatpadel.com.ar/es/indumentaria/campera-direct#/2-talla-l" },
    { nombre: "Buzo Camp negro", keywords: ["buzo", "camp", "negro", "unisex"], url: "https://kombatpadel.com.ar/es/indumentaria/buzo-camp-negro#/2-talla-l" },
    { nombre: "Buzo gris Belluati", keywords: ["buzo", "gris", "belluati", "capucha"], url: "https://kombatpadel.com.ar/es/indumentaria/buzo-capucha-gris#/10-talla-s" },
    { nombre: "Remera gris LTD Herat", keywords: ["remera", "gris", "herat", "hombre"], url: "https://kombatpadel.com.ar/es/indumentaria/remera-ltd-herat#/3-talla-xl" },
    { nombre: "Remera rosa LTD Magnesia", keywords: ["remera", "rosa", "magnesia", "hombre"], url: "https://kombatpadel.com.ar/es/indumentaria/remera-ltd-magnesia#/1-talla-m" },
    { nombre: "Remera verde LTD Opis", keywords: ["remera", "verde", "opis", "hombre"], url: "https://kombatpadel.com.ar/es/indumentaria/remera-ltd-opis#/20-talla-xxxl" },
    { nombre: "Remera azul LTD Phintias", keywords: ["remera", "azul", "phintias", "hombre"], url: "https://kombatpadel.com.ar/es/indumentaria/remera-ltd-phintias#/3-talla-xl" },
    { nombre: "Remera blanca Captain", keywords: ["remera", "blanca", "captain", "hombre"], url: "https://kombatpadel.com.ar/es/indumentaria/remera-captain-blanco#/2-talla-l" },
    { nombre: "Remera negra Captain", keywords: ["remera", "negra", "captain", "hombre"], url: "https://kombatpadel.com.ar/es/indumentaria/remera-captain-negro#/2-talla-l" },
    { nombre: "Short Capture negro", keywords: ["short", "capture", "negro"], url: "https://kombatpadel.com.ar/es/indumentaria/remera-captain-negro#/2-talla-l" },
    { nombre: "Remera Division celeste (mujer)", keywords: ["remera", "division", "celeste", "mujer"], url: "https://kombatpadel.com.ar/es/indumentaria/remera-juego-division#/2-talla-l" },
    { nombre: "Musculosa Draft negra (mujer)", keywords: ["musculosa", "draft", "negra", "mujer"], url: "https://kombatpadel.com.ar/es/ropa-y-accesorios/musculosa-juego-draft#/2-talla-l" },
    { nombre: "Pollera Drag celeste", keywords: ["pollera", "drag", "celeste"], url: "https://kombatpadel.com.ar/es/indumentaria/pollera-drag#/2-talla-l" },
    { nombre: "Pollera Depot negra", keywords: ["pollera", "depot", "negra"], url: "https://kombatpadel.com.ar/es/indumentaria/pollera-depot#/2-talla-l" },
  ],
};


// Función auxiliar para normalizar texto
const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Función de búsqueda
function buscarProductos(
  query: string,
  categoria: "palas" | "accesorios" | "indumentaria" | "todas" = "todas"
): ProductoKombat[] {
  const queryNorm = normalize(query);
  const queryTerms = queryNorm.split(" ").filter((t) => t.length > 1);

  // Obtener productos según categoría
  let productos: ProductoKombat[] = [];

  if (categoria === "todas" || categoria === "palas") {
    productos.push(
      ...KATALOGO_PRODUCTOS_KOMBAT.palas.map((p) => ({ ...p, categoria: "palas" as const }))
    );
  }
  if (categoria === "todas" || categoria === "accesorios") {
    productos.push(
      ...KATALOGO_PRODUCTOS_KOMBAT.accesorios.map((p) => ({ ...p, categoria: "accesorios" as const }))
    );
  }
  if (categoria === "todas" || categoria === "indumentaria") {
    productos.push(
      ...KATALOGO_PRODUCTOS_KOMBAT.indumentaria.map((p) => ({ ...p, categoria: "indumentaria" as const }))
    );
  }

  // Buscar coincidencias
  const resultados = productos
    .map((producto) => {
      const nombreNorm = normalize(producto.nombre);
      const keywordsNorm = producto.keywords.map(normalize);

      // Calcular relevancia
      let relevancia = 0;

      // Match exacto en nombre
      if (nombreNorm.includes(queryNorm)) {
        relevancia += 10;
      }

      // Match en keywords
      for (const kw of keywordsNorm) {
        if (queryNorm.includes(kw) || kw.includes(queryNorm)) {
          relevancia += 5;
        }
      }

      // Match parcial por términos
      for (const term of queryTerms) {
        if (nombreNorm.includes(term)) relevancia += 2;
        if (keywordsNorm.some((kw) => kw.includes(term))) relevancia += 1;
      }

      return { ...producto, relevancia };
    })
    .filter((p) => p.relevancia > 0)
    .sort((a, b) => b.relevancia - a.relevancia)
    .slice(0, 5); // Top 5 resultados

  return resultados;
}

// Tool definition
export const linkProductoTool = tool(
  async ({ query, categoria = "todas" }) => {
    const resultados = buscarProductos(query, categoria);

    if (resultados.length === 0) {
      return {
        encontrado: false,
        productos: [],
        mensaje: `No encontré productos que coincidan con "${query}". Podés ver todo el catálogo en: https://kombatpadel.com.ar`,
      };
    }

    const productosFormateados = resultados.map((p) => ({
      nombre: p.nombre,
      url: p.url,
      categoria: p.categoria,
      
    }));

    // Generar mensaje amigable
    const topProducto = productosFormateados[0];
    let mensaje = `Encontré: ${topProducto.nombre}\n👉 ${topProducto.url}`;

    if (productosFormateados.length > 1) {
      mensaje += `\n\nTambién podría interesarte:\n`;
      mensaje += productosFormateados
        .slice(1, 3)
        .map((p) => `- ${p.nombre}: ${p.url}`)
        .join("\n");
    }

    console.log("mensaje", mensaje);

    return {
      encontrado: true,
      productos: productosFormateados,
      mensaje,
    };
  },
  {
    name: "link_producto_kombat",
    description:
      "Busca el link directo a un producto específico de KOMBAT (palas, accesorios, indumentaria). Usar cuando el cliente pregunta por un producto específico y se necesita el link para comprarlo o verlo.",
    schema: z.object({
      query: z
        .string()
        .describe("Nombre del producto o keywords (ej: 'osorno', 'mochila', 'bolso vulcano', 'pampa', 'hunter', 'vulcano', 'etna', 'vesubio', 'teide', 'fuji', 'galeras', 'krakatoa')"),
      categoria: z
        .enum(["palas", "accesorios", "indumentaria", "todas"])
        .default("todas")
        .describe("Categoría donde buscar"),
    }),
  }
);

const tema = `
Eres un subAgente de ventas de KOMBAT Padel que respondes al agente principal, eres encargado de resolver una consulta relacionada con la oferta comercial de la tienda Kombat, basandote en la informacion que tienes a continuación:

   
## TONO Y FORMA DE RESPUESTA
- "En base a la consulta del cliente: <query> , mi respuesta es: <respuesta>"


- Oferta válida: FEBRERO
- Disponible solo en la web: https://www.kombatpadel.com.ar
- Pago contado (medios): transferencia, débito, crédito en 1 cuota, efectivo
- No hay cuotas sin interés

PRECIOS (ya incluyen descuento):
- Palas línea Vulcano: $279.500 (lista $430.000, -35%)
- Palas Pampa y Hunter: $215.000 (lista $430.000, -50%)
- Pack Hunter + Bolso Vulcano: $283.500 (lista $630.000, -55%)
- Pack Hunter + Mochila Vesubio: $252.000 (lista $560.000, -55%) [sujeto a stock]
- Pack Pala Vulcano + Mochila Vulcano: $336.000 (lista $560.000, -40%)
- Pack KOMBATIENTE PREMIUM: $437.400 (lista $729.000, -40%)
  Incluye: 1 Pala Vulcano (Etna, Vesubio, Osorno o Krakatoa) + 1 Bolso Vulcano + 1 Remera + 1 Short

Tu objetivo: responder rápido, claro y con actitud de venta.
Reglas:
1) Si preguntan “¿dónde compro?” => responder con el link a la web.
2) Si preguntan “¿cuotas?” => aclarar que es contado (transferencia/débito/crédito 1 cuota/efectivo) y que no hay cuotas sin interés.
3) Si preguntan “¿incluye descuento?” => confirmar que el precio ya es final.
4) Siempre cerrá con una pregunta para avanzar (ej: “¿Qué pala o pack te interesa y para qué nivel jugás?”).


`

export const tiendaKombatTool = tool(
  async ({ query }: { query: string }) => {
    const model = new ChatOpenAI({
      model: "gpt-4o",
      apiKey: process.env.OPENAI_API_KEY,
    });

    // 1. Definir el template con variables entre llaves
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "Eres un asistente experto en {tema}."],
      ["human", "{query}."],
    ]);

    // 2. Crear la cadena
    const chain = prompt.pipe(model);

    // 3. Invocar con la información dinámica
    const response = await chain.invoke({
      tema: tema,
      query: query,
    });

    console.log("response", response.content as string);

    return `${response.content}`
  },
  {
    name: "tienda_kombat_oferta_comercial",
    description: "Obtiene la información relacionada con la oferta comercial de la tienda Kombat, sin cuotas, solo pago contado, transferencias, débito, crédito en 1 cuota, efectivo",
    schema: z.object({
      query: z.string().describe("La consulta del cliente relacionada sobre precios de la tienda Kombat sin cuotas "),
    }),
  }
)

export const priceTool = tool(
  async ({ query }: { query: string }) => {
    const model = new ChatOpenAI({
      model: "gpt-5-mini",
      apiKey: process.env.OPENAI_API_KEY,
    });

    const KOMBAT_PRECIOS_PROMOCIONES_FEBRERO = `
    # DATOS OFICIALES KOMBAT — FEBRERO 2025
    
    ## TIENDA OFICIAL KOMBAT
    - Web: www.kombatpadel.com.ar
    - Pago: SOLO CONTADO (transferencia / débito / crédito 1 cuota / efectivo)
    - Cuotas sin interés: NO DISPONIBLE
    
    {
  "meta": {
    "moneda": "ARS",
    "mes": "febrero",
    "anio_asumido": 2026,
    "notas": [
      "Montos en enteros (ej: 430000).",
      "Pampa y Hunter se separan como líneas individuales aunque compartan valores.",
      "Rangos de fecha dentro de febrero del anio_asumido."
    ]
  },
  "productos": [
    {
      "id": "palas_pampa",
      "tipo": "producto",
      "nombre": "Palas Pampa",
      "linea": "Pampa",
      "precio_lista": 430000,
      "descuento_porcentaje": 50,
      "precio_final": 215000,
      "nota": null
    },
    {
      "id": "palas_hunter",
      "tipo": "producto",
      "nombre": "Palas Hunter",
      "linea": "Hunter",
      "precio_lista": 430000,
      "descuento_porcentaje": 50,
      "precio_final": 215000,
      "nota": null
    },
    {
      "id": "palas_vulcano",
      "tipo": "producto",
      "nombre": "Palas Línea Vulcano",
      "linea": "Vulcano",
      "precio_lista": 430000,
      "descuento_porcentaje": 35,
      "precio_final": 279500,
      "nota": null
    },
    {
      "id": "pack_hunter_bolso_vulcano",
      "tipo": "pack",
      "nombre": "Pack Hunter + Bolso Vulcano",
      "incluye": ["Pala Hunter", "Bolso Vulcano"],
      "precio_lista": 630000,
      "descuento_porcentaje": 55,
      "precio_final": 283500,
      "nota": null
    },
    {
      "id": "pack_hunter_mochila_vesubio",
      "tipo": "pack",
      "nombre": "Pack Hunter + Mochila Vesubio",
      "incluye": ["Pala Hunter", "Mochila Vesubio"],
      "precio_lista": 560000,
      "descuento_porcentaje": 55,
      "precio_final": 252000,
      "nota": "Sujeto a stock"
    },
    {
      "id": "pack_vulcano_mochila_vulcano",
      "tipo": "pack",
      "nombre": "Pack Pala Vulcano + Mochila Vulcano",
      "incluye": ["Pala Vulcano", "Mochila Vulcano"],
      "precio_lista": 560000,
      "descuento_porcentaje": 40,
      "precio_final": 336000,
      "nota": null
    },
    {
      "id": "pack_kombatiente_premium",
      "tipo": "pack",
      "nombre": "Pack KOMBATIENTE PREMIUM",
      "incluye": [
        "Pala Vulcano (Etna/Vesubio/Osorno/Krakatoa)",
        "Bolso Vulcano",
        "Remera",
        "Short"
      ],
      "precio_lista": 729000,
      "descuento_porcentaje": 40,
      "precio_final": 437400,
      "nota": "Incluye: Pala Vulcano (Etna/Vesubio/Osorno/Krakatoa) + Bolso Vulcano + Remera + Short"
    }
  ],
  "bancos": [
    {
      "nombre_banco": "BANCO NACIÓN",
      "link_de_compra": "https://www.tiendabna.com.ar/catalog?sh=3401",
      "exclusividad": "Exclusivo clientes Banco Nación",
      "ofertas": [
        {
          "etiqueta": "todo_febrero",
          "rango_fechas": { "inicio": "2026-02-01", "fin": "2026-02-29" },
          "cuotas": { "cantidad": 12, "condicion": "sin_interes" },
          "lineas": [
            { "linea": "Pampa", "valor_cuota_desde": 25083 },
            { "linea": "Hunter", "valor_cuota_desde": 25083 },
            { "linea": "Vulcano", "valor_cuota_desde": 30458 }
          ]
        },
        {
          "etiqueta": "del_9_al_13_febrero",
          "rango_fechas": { "inicio": "2026-02-09", "fin": "2026-02-13" },
          "cuotas": { "cantidad": 24, "condicion": "sin_interes" },
          "lineas": [
            { "linea": "Pampa", "valor_cuota_desde": 15229 },
            { "linea": "Hunter", "valor_cuota_desde": 15229 },
            { "linea": "Vulcano", "valor_cuota_desde": 17917 }
          ]
        },
        {
          "etiqueta": "del_25_al_27_febrero",
          "rango_fechas": { "inicio": "2026-02-25", "fin": "2026-02-27" },
          "cuotas": { "cantidad": 24, "condicion": "sin_interes" },
          "lineas": [
            { "linea": "Pampa", "valor_cuota_desde": 15229 },
            { "linea": "Hunter", "valor_cuota_desde": 15229 },
            { "linea": "Vulcano", "valor_cuota_desde": 17917 }
          ]
        }
      ]
    },
    {
      "nombre_banco": "BANCO PROVINCIA",
      "link_de_compra": "https://www.provinciacompras.com.ar/kombat077?map=seller",
      "exclusividad": "Exclusivo clientes Banco Provincia",
      "ofertas": [
        {
          "etiqueta": "todo_febrero",
          "rango_fechas": { "inicio": "2026-02-01", "fin": "2026-02-29" },
          "cuotas": { "cantidad": 6, "condicion": "sin_interes" },
          "lineas": [
            { "linea": "Pampa", "valor_cuota_desde": 46583 },
            { "linea": "Hunter", "valor_cuota_desde": 46583 },
            { "linea": "Vulcano", "valor_cuota_desde": 53750 }
          ]
        },
        {
          "etiqueta": "del_10_al_12_febrero",
          "rango_fechas": { "inicio": "2026-02-10", "fin": "2026-02-12" },
          "cuotas": { "cantidad": 18, "condicion": "sin_interes" },
          "lineas": [
            { "linea": "Pampa", "valor_cuota_desde": 20306 },
            { "linea": "Hunter", "valor_cuota_desde": 20306 },
            { "linea": "Vulcano", "valor_cuota_desde": 23889 }
          ]
        }
      ]
    }
  ]
}

    ---
    
    ## RESUMEN RÁPIDO POR LÍNEA
    
    ### Pampa  (línea económica/intermedia)
    - Tienda Oficial: $215.000 (50% OFF) — contado
    - Banco Nación Feb: 12 cuotas de $25.083 | 24 cuotas de $15.229 (fechas especiales)
    - Banco Provincia Feb: 6 cuotas de $46.583 | 18 cuotas de $20.306 (fechas especiales)

    ### Hunter  (línea económica/intermedia)
    - Tienda Oficial: $215.000 (50% OFF) — contado
    - Banco Nación Feb: 12 cuotas de $25.083 | 24 cuotas de $15.229 (fechas especiales)
    - Banco Provincia Feb: 6 cuotas de $46.583 | 18 cuotas de $20.306 (fechas especiales)
    
    ### Vulcano (línea premium)
    - Tienda Oficial: $279.500 (35% OFF) — contado
    - Banco Nación Feb: 12 cuotas de $30.458 | 24 cuotas de $17.917 (fechas especiales)
    - Banco Provincia Feb: 6 cuotas de $53.750 | 18 cuotas de $23.889 (fechas especiales)
    
    ---
    
    ## PRECIOS TOTALES ESTIMADOS (para comparar)
    
    | Producto | Contado (Tienda) | 12 cuotas BNA | 24 cuotas BNA | 6 cuotas BAPRO | 18 cuotas BAPRO |
    |----------|------------------|---------------|---------------|----------------|-----------------|
    | Pampa | $215.000 | $301.000 | $365.500 | $279.500 | $365.500 |
    | Hunter | $215.000 | $301.000 | $365.500 | $279.500 | $365.500 |
    | Vulcano | $279.500 | $365.500 | $430.000 | $322.500 | $430.000 |
    
    Nota: El mejor precio siempre es contado en Tienda Oficial. Los bancos ofrecen financiación sin interés pero sobre precio de lista.
    `;

    const PRICE_TOOL_SYSTEM_PROMPT = `
# ROL
Sos un asistente especializado en responder consultas sobre precios y promociones de KOMBAT Padel. Tu única función es extraer y devolver información precisa de los datos oficiales.

# DATOS OFICIALES
${KOMBAT_PRECIOS_PROMOCIONES_FEBRERO}

# INSTRUCCIONES

## Qué hacer
1. Analizar la consulta del usuario
2. Identificar qué busca: precio específico, comparativa, mejor oferta, cuotas, etc.
3. Responder SOLO con información de los datos oficiales
4. Incluir siempre el link de compra correspondiente

## Formato de respuesta
- Respuestas concisas (máximo 3-4 oraciones)
- Incluir precio/cuota relevante
- Incluir link de compra
- Si aplica, mencionar vigencia de la promo

## Lógica de canal
- Si pregunta por CUOTAS → responder con opciones de BANCOS
- Si pregunta por PRECIO FINAL / DESCUENTO / CONTADO → responder con TIENDA OFICIAL
- Si pregunta genérico "ofertas" → mostrar ambas opciones empezando por la más económica

## Qué NO hacer
- No inventar precios ni promociones
- No mencionar productos que no estén en los datos
- No decir "voy a buscar" o "según mis datos"
- No usar bullet points ni listas largas
- No exceder 50 palabras en la respuesta

## Ejemplos

Query: "cuanto sale la vulcano"
Respuesta: "La Vulcano está $279.500 (35% OFF) en tienda oficial, pago contado. Si preferís cuotas, con Banco Nación son 12 cuotas de $30.458. Link tienda: www.kombatpadel.com.ar"

Query: "tienen cuotas sin interes"
Respuesta: "Sí, con Banco Nación tenés hasta 24 cuotas sin interés (en fechas especiales) y con Banco Provincia hasta 18 cuotas. ¿Qué línea te interesa, Pampa/Hunter o Vulcano?"

Query: "cual es la opcion mas barata"
Respuesta: "La más económica es la línea Pampa & Hunter a $215.000 (50% OFF) en tienda oficial, pago contado. Es ideal para jugadores principiantes/intermedios. Link: www.kombatpadel.com.ar"

Query: "que promos hay con banco nacion"
Respuesta: "Con Banco Nación tenés 12 cuotas sin interés todo febrero (Pampa/Hunter desde $25.083, Vulcano desde $30.458). Del 9-13 y 25-27 de febrero, 24 cuotas sin interés. Link: https://www.tiendabna.com.ar/catalog?sh=3401"

Query: "que incluye el pack kombatiente"
Respuesta: "El Pack KOMBATIENTE PREMIUM incluye: 1 Pala Vulcano (elegís entre Etna, Vesubio, Osorno o Krakatoa) + Bolso Vulcano + Remera + Short. Precio: $437.400 (40% OFF). Link: www.kombatpadel.com.ar"
`;

    const response = await model.invoke([
      new SystemMessage(PRICE_TOOL_SYSTEM_PROMPT),
      new HumanMessage(query),
    ]);

    console.log("response", response);
    return response;
  },
  {
    name: "precios_y_promociones_vigentes",
    description:
      "Obtiene la información relacionada sobre precios, cuotas, promociones vigentes",
    schema: z.object({
      query: z
        .string()
        .describe(
          "La consulta del cliente relacionada sobre precios, cuotas, promociones vigentes, lo mas detallada y estructurada posible para que el modelo pueda responder de la mejor manera posible, debe ser como un mensaje del usuario",
        ),
    }),
  },
);

export const infoCatalogoVulcano = tool(
  async ({ query }: { query: string }) => {
    const CATALOGO_VULCANO = {
      lineas: [
        {
          nombre_linea: "Línea Vulcano",
          palas: [
            {
              tipo_de_pala: "Arenal",
              forma: "Diamante",
              dureza: "Blanda",
              balance: "Alto",
              potencia: "Alto",
              control: "Alto",
              nucleo: "Goma Black EVA",
              peso: "350g-360g",
              material: "Carbono 18K Rugoso",
            },
            {
              tipo_de_pala: "Etna",
              forma: "Diamante",
              dureza: "Dura",
              balance: "Alto",
              potencia: "Alto",
              control: "Medio",
              nucleo: "Black EVA Pro",
              peso: "360g-370g",
              material: "Carbono 12k Rugoso",
            },
            {
              tipo_de_pala: "Fuji",
              forma: "Lágrima",
              dureza: "Media",
              balance: "Medio",
              potencia: "Alto",
              control: "Alto",
              nucleo: "Black EVA",
              peso: "360g-370g",
              material: "Carbono 18K Aluminizado Rugoso",
            },
            {
              tipo_de_pala: "Galeras",
              forma: "Lágrima",
              dureza: "Blanda",
              balance: "Medio",
              potencia: "Medio",
              control: "Alto",
              nucleo: "Black EVA",
              peso: "350g-360g",
              material: "Carbono 18K Rugoso",
            },
            {
              tipo_de_pala: "Krakatoa",
              forma: "Redonda",
              dureza: "Dura",
              balance: "Bajo",
              potencia: "Alto",
              control: "Alto",
              nucleo: "Black EVA",
              peso: "360g-370g",
              material: "Carbono 12K Rugoso",
            },
            {
              tipo_de_pala: "Osorno",
              forma: "Lágrima",
              dureza: "Blanda",
              balance: "Medio",
              potencia: "Medio",
              control: "Alto",
              nucleo: "Goma EVA de doble densidad",
              peso: "360g-370g",
              material: "3D Carbon Rugoso",
            },
            {
              tipo_de_pala: "Teide",
              forma: "Diamante",
              dureza: "Media",
              balance: "Alto",
              potencia: "Alto",
              control: "Alto",
              nucleo: "Black EVA",
              peso: "360g-370g",
              material: "Carbono 18K Blue Rugoso",
            },
            {
              tipo_de_pala: "Vesubio",
              forma: "Diamante",
              dureza: "Blanda",
              balance: "Alto",
              potencia: "Alto",
              control: "Alto",
              nucleo: "Goma Eva de doble densidad",
              peso: "360g-370g370g",
              material: "3D Carbon Rugoso",
            },
          ],
        },
        {
          nombre_linea: "Línea VULCANO 2024",
          palas: [
            {
              tipo_de_pala: "Navy Seal",
              forma: "Diamante",
              dureza: "Media",
              balance: "Alto",
              potencia: "Alto",
              control: "Alto",
              nucleo: "Black Eva",
              peso: "365g",
              material: "Carbono 18K Rugoso",
            },
            {
              tipo_de_pala: "Hunter",
              forma: "Lágrima",
              dureza: "Dura",
              balance: "Medio",
              potencia: "Alto",
              control: "Alto",
              nucleo: "Black Eva",
              peso: "365g",
              material: "Carbono 3K",
            },
            {
              tipo_de_pala: "Magnum",
              forma: "Diamante",
              dureza: "Blanda",
              balance: "Alto",
              potencia: "Alto",
              control: "Alto",
              nucleo: "Black Eva",
              peso: "365g",
              material: "Carbono 18K Rugoso",
            },
          ],
        },
      ],
    };

    const normalize = (text: string) =>
      text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const q = normalize(query);
    const includes = (value: string) => q.includes(normalize(value));

    const shape =
      (q.includes("lagrima") && "Lágrima") ||
      (q.includes("diamante") && "Diamante") ||
      (q.includes("redonda") && "Redonda") ||
      undefined;

    const hardness =
      (q.includes("blanda") && "Blanda") ||
      (q.includes("media") && "Media") ||
      (q.includes("dura") && "Dura") ||
      undefined;

    const balance =
      (q.includes("alto") && q.includes("balance") && "Alto") ||
      (q.includes("medio") && q.includes("balance") && "Medio") ||
      (q.includes("bajo") && q.includes("balance") && "Bajo") ||
      undefined;

    const potencia =
      q.includes("potencia") && q.includes("alto")
        ? "Alto"
        : q.includes("potencia") && q.includes("medio")
          ? "Medio"
          : q.includes("potencia") && q.includes("bajo")
            ? "Bajo"
            : q.includes("potencia")
              ? "Alto"
              : undefined;

    const control =
      q.includes("control") && q.includes("alto")
        ? "Alto"
        : q.includes("control") && q.includes("medio")
          ? "Medio"
          : q.includes("control") && q.includes("bajo")
            ? "Bajo"
            : q.includes("control")
              ? "Alto"
              : undefined;

    const allPalas = CATALOGO_VULCANO.lineas.flatMap((l) =>
      l.palas.map((p) => ({ ...p, linea: l.nombre_linea })),
    );

    const exactName = allPalas.find((p) => includes(p.tipo_de_pala));

    const matches = allPalas.filter((p) => {
      if (shape && normalize(p.forma) !== normalize(shape)) return false;
      if (hardness && normalize(p.dureza) !== normalize(hardness)) return false;
      if (balance && normalize(p.balance) !== normalize(balance)) return false;
      if (potencia && normalize(p.potencia) !== normalize(potencia))
        return false;
      if (control && normalize(p.control) !== normalize(control)) return false;
      return true;
    });

    const ranked = (
      exactName ? [exactName] : matches.length ? matches : allPalas
    )
      .map((p) => {
        const haystack = normalize(
          [
            p.tipo_de_pala,
            p.forma,
            p.dureza,
            p.balance,
            p.potencia,
            p.control,
            p.nucleo,
            p.material,
            p.linea,
          ].join(" "),
        );
        const score = q
          .split(" ")
          .filter((t) => t.length > 2)
          .reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
        return { ...p, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const header = `Resultados para: "${query}"`;
    const body = ranked
      .map(
        (p) =>
          `- ${p.tipo_de_pala} (${p.linea}) | forma: ${p.forma}, dureza: ${p.dureza}, balance: ${p.balance}, potencia: ${p.potencia}, control: ${p.control}, nucleo: ${p.nucleo}, material: ${p.material}, peso: ${p.peso}`,
      )
      .join("\n");

    console.log("tool info_catalogo_vulcano");
    console.log(header);
    console.log(body);

    return `${header}\n${body}`;
  },
  {
    name: "info_catalogo_vulcano",
    description:
      "Obtiene la información relacionada sobre el catálogo de palas Vulcano",
    schema: z.object({
      query: z
        .string()
        .describe(
          "La consulta del cliente relacionada sobre el catálogo de palas Vulcano, o tambien una query para buscar en el catálogo sin que el usuario haya preguntado específicamente sobre el catálogo, trata de ser lo más específico posible",
        ),
    }),
  },
);

// Tool: búsqueda vectorial con preFilter
const SearchInput = z.object({
  query: z.string().min(1),
  
});
export const infoPalasKombat = tool(
  async (input, config: LangGraphRunnableConfig) => {
    const { client, collection } = await getMongo();
    // const { orgId, agentId, title } = config.configurable as any;
    // console.log("orgId", orgId);
    // console.log("agentId", agentId);
    // console.log("title", title);
    const orgId = "kombatpadel";
    const agentId = "agent_wsp";
    const title = "como_elegir_palas_kombat";
    try {
      const vectorStore = await getVectorStore(collection);

      // IMPORTANTÍSIMO: preFilter (requiere que esos campos estén como type:"filter" en el índice)
      const and: any[] = [
        { orgId: { $eq: orgId } },
        { agentId: { $eq: agentId } },
      ];
      // if (input.category) and.push({ category: { $eq: input.category } });
      if (title) and.push({ title: { $eq: title } });
      // if (input.brands?.length) and.push({ brand: { $in: input.brands } });

      const results = await vectorStore.similaritySearchWithScore(
        input.query,
        6,
        { preFilter: { $and: and } },
      );

      // Para excluir ids de una busqueda
      //       const excludedIds = results.map((r) => r.metadata._id);

      // const results2 = await vectorStore.similaritySearchWithScore(
      //   input.query,
      //   input.k,
      //   {
      //     preFilter: {
      //       $and: [
      //         ...and, // tus filtros habituales (orgId, agentId, etc.)
      //         { _id: { $nin: excludedIds } }, // excluye esos documentos
      //       ],
      //     },
      //   }
      // );

      // Mongo (y el vector store) entiende { _id: { $nin: [...] } } como “todos menos estos”, así que los chunks ya vistos no volverán a aparecer en el segundo intento. Si no tienes otros filtros, puedes omitir el resto del $and y usar directamente { preFilter: { _id: { $nin: excludedIds } } }.

      // devolvés texto + metadata para que el LLM cite páginas/fuente
      const payload = results.map(([doc, score]) => ({
        id: doc.metadata._id,
        score,
        text: doc.pageContent,
        metadata: doc.metadata,
      }));

      console.log("payload", payload);

      return payload
        .map((p) => {
          return `
          ${p.text}
          `;
        })
        .join("\n\n");
    } finally {
      await client.close();
    }
  },
  {
    name: "como_elegir_palas_kombat",
    description:
      "Busca contexto relevante para responder preguntas sobre como elegir palas kombat.",
    schema: SearchInput,
  },
);

// Probamos crear un retriever manual
