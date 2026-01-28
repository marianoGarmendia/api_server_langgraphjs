import type { ObjectId } from "mongodb";

export type NutrientsObject = Record<string, number | null>;

export type IngredientTranslate = {
  spanish?: string | null;
  french?: string | null;
  portuguese?: string | null;
  catalan?: string | null;
  italian?: string | null;
  english?: string | null;
};

export interface IngredientBestMatch {
  // En algunos flujos (p.ej. imports parciales) puede venir null.
  fdcId: number | null;
  description: string;
  foodCategory?: string;
  dataType: string;
  matchedQuery?: string;
  nutrients?: NutrientsObject;
}

// Documento tal como quedó guardado en la colección `ingredientes`
export interface IngredientDoc {
  _id: ObjectId;
  totalHits?: number;
  foodsReturned?: number;
  bestMatch: IngredientBestMatch | null;
  translate?: IngredientTranslate;
}

export interface IngredientCard {
  _id: ObjectId;
  description: string;
  foodCategory?: string;
  matchedQuery?: string;
}

export interface IngredientDetailedCard extends IngredientCard {
  totalHits?: number;
  foodsReturned?: number;
  nutrients?: NutrientsObject | null;
}
