// export const MEAL_TAGS = [
//   // objetivo / composición
//   "fat_loss",
//   "muscle_gain",
//   "maintenance",
//   "high_protein",
//   "high_fiber",
//   "low_sodium",
//   "low_sugar",
//   // estilo alimentario / restricciones
//   "vegetarian",
//   "vegan",
//   "gluten_free",
//   "lactose_free",
//   // tipo de plato / practicidad
//   "breakfast",
//   "lunch",
//   "dinner",
//   "snack",
//   "quick",
//   "meal_prep",
//   // cocina
//   "mediterranean",
//   "spanish",
// ] as const;

export const objetivo = [
  "perdida_grasa",
  "ganancia_muscular",
  "mantenimiento",
] as const;

export const composicion = [
  "alto_en_proteina",
  "alto_en_fibra",
  "bajo_en_sodio",
  "bajo_en_azucar",
  "bajo_en_grasa",
  "bajo_en_carbohidratos",
 "alto_en_carbohidratos"
] as const

export const restricciones = [
  "vegetariano",
  "vegano",
  "sin_gluten",
  "sin_lactosa",
] as const

// Tipo de comida del día
export const tipo_de_plato = [
  "desayuno",
  "almuerzo",
  "cena",
  "colacion",
] as const

// Practicidad / uso
export const practicidad = [
  "rapido",
  "preparacion_anticipada",
] as const

// Tipo de cocina
export const cocina = [
  "mediterranea",
  "espanola",
  "argentina",
  "italiana",
  "mexicana",
  "asiatica",
  "japonesa",
  "china",
  "india",
  "arabe",
  "internacional",
  "casera",                    // estilo “comida de casa”
  "gourmet",                   // más elaborado / presentación
  "street_food",               // wraps, tacos, bowls rápidos
] as const

// export type MealTag = (typeof MEAL_TAGS)[number];


