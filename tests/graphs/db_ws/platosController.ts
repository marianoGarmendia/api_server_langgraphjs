import express from "express";
import {
  getPlatoWsById,
  getPlatoWsByNombre,
  listPlatosWsNombreMealType,
  listMealTypesWs,
  listPlatosWsByMealType,
} from "./platosRepository.js";

export function createDbWsPlatosRouter(): express.Router {
  const router = express.Router();

  // GET /db_ws/meal-types
  router.get("/meal-types", async (_req, res) => {
    try {
      const mealTypes = await listMealTypesWs();
      return res.json({ mealTypes });
    } catch (err: any) {
      console.error("[db_ws] Error leyendo meal-types:", err?.message ?? err);
      return res.status(500).json({ error: err?.message ?? String(err) });
    }
  });

  // GET /db_ws/platos?meal_type=almuerzo&limit=20&skip=0
  router.get("/platos", async (req, res) => {
    try {
      const meal_type = String(req.query.meal_type ?? "").trim();
      if (!meal_type) {
        return res
          .status(400)
          .json({ error: "Query inválida: se requiere ?meal_type=..." });
      }

      const limitRaw = Number(req.query.limit ?? 50);
      const skipRaw = Number(req.query.skip ?? 0);
      const limit = Number.isFinite(limitRaw)
        ? Math.max(1, Math.min(200, limitRaw))
        : 50;
      const skip = Number.isFinite(skipRaw) ? Math.max(0, skipRaw) : 0;

      const platos = await listPlatosWsByMealType({ meal_type, limit, skip });
      return res.json({ meal_type, count: platos.length, platos });
    } catch (err: any) {
      console.error(
        "[db_ws] Error leyendo platos por meal_type:",
        err?.message ?? err
      );
      return res.status(500).json({ error: err?.message ?? String(err) });
    }
  });

  // GET /db_ws/platos/by-id/:id
  router.get("/platos/by-id/:id", async (req, res) => {
    try {
      const id = String(req.params.id ?? "").trim();
      if (!id)
        return res.status(400).json({ error: "Parámetro inválido: :id" });

      const plato = await getPlatoWsById(id);
      if (!plato) return res.status(404).json({ error: "Plato no encontrado" });

      return res.json(plato);
    } catch (err: any) {
      console.error("[db_ws] Error leyendo plato por id:", err?.message ?? err);
      return res.status(500).json({ error: err?.message ?? String(err) });
    }
  });

  // GET /db_ws/platos/by-nombre?nombre=...
  router.get("/platos/by-nombre", async (req, res) => {
    try {
      const nombre = String(req.query.nombre ?? "").trim();
      if (!nombre) {
        return res
          .status(400)
          .json({ error: "Query inválida: se requiere ?nombre=..." });
      }

      const plato = await getPlatoWsByNombre(nombre);
      if (!plato) return res.status(404).json({ error: "Plato no encontrado" });

      return res.json(plato);
    } catch (err: any) {
      console.error(
        "[db_ws] Error leyendo plato por nombre:",
        err?.message ?? err
      );
      return res.status(500).json({ error: err?.message ?? String(err) });
    }
  });

  // GET /db_ws/platos/nombre-mealtype
  // Devuelve un array de objetos: [{ nombre, meal_type }]
  router.get("/platos/nombre-mealtype", async (_req, res) => {
    try {
      const items = await listPlatosWsNombreMealType();
      return res.json(items);
    } catch (err: any) {
      console.error(
        "[db_ws] Error leyendo platos nombre/meal_type:",
        err?.message ?? err
      );
      return res.status(500).json({ error: err?.message ?? String(err) });
    }
  });

  return router;
}
