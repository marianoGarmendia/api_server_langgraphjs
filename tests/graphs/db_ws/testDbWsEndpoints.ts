import "dotenv/config";

type JsonValue = unknown;

const BASE_URL = (process.env.SERVER_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  ""
);

async function fetchJson(
  url: string,
  timeoutMs = 20_000
): Promise<{
  status: number;
  statusText: string;
  data: JsonValue | null;
  rawText: string;
}> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const rawText = await res.text();
    let data: JsonValue | null = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      // ignore
    }

    return { status: res.status, statusText: res.statusText, data, rawText };
  } finally {
    clearTimeout(t);
  }
}

export async function testDbWsEndpoints(): Promise<void> {
  console.log(`[db_ws:endpoints] BASE_URL=${BASE_URL}`);

  // 1) meal-types
  const mealTypesUrl = `${BASE_URL}/db_ws/meal-types`;
  const mt = await fetchJson(mealTypesUrl);
  console.log(`GET ${mealTypesUrl} -> ${mt.status} ${mt.statusText}`);
  if (mt.status >= 400) {
    console.log(mt.data ?? mt.rawText);
    return;
  }

  const mealTypes = (mt.data as any)?.mealTypes;
  if (!Array.isArray(mealTypes) || mealTypes.length === 0) {
    console.log("[db_ws:endpoints] No se encontraron mealTypes:", mt.data);
    return;
  }

  console.log("[db_ws:endpoints] mealTypes:", mealTypes);

  // 2) platos por meal_type (probamos con el primero)
  const mealType = String(mealTypes[0]);
  const platosUrl = `${BASE_URL}/db_ws/platos?meal_type=${encodeURIComponent(
    mealType
  )}`;

  const platos = await fetchJson(platosUrl);
  console.log(`GET ${platosUrl} -> ${platos.status} ${platos.statusText}`);
  if (platos.status >= 400) {
    console.log(platos.data ?? platos.rawText);
    return;
  }

  const count = (platos.data as any)?.count;
  const platosArr = (platos.data as any)?.platos;
  console.log(`[db_ws:endpoints] count=${count}`);
  if (Array.isArray(platosArr)) {
    console.log("[db_ws:endpoints] sample nombres:");
    console.log("total platos:", platosArr.length);
  } else {
    console.log("[db_ws:endpoints] respuesta inesperada:", platos.data);
  }
}

async function main() {
  try {
    await testDbWsEndpoints();
  } catch (err: any) {
    console.error("[db_ws:endpoints] ERROR:", err?.message ?? err);
    process.exitCode = 1;
  }
}

main();
