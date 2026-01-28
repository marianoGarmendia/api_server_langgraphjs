export const buildMealsPrompt = (
  ingredients_info: any[],
  plateOptions: any[]
) => {
  const ingredientsInfoText = JSON.stringify(ingredients_info ?? [], null, 2);
  const plateOptionsText = JSON.stringify(plateOptions ?? [], null, 2);
  const allowedTags = [
    "fat_loss",
    "muscle_gain",
    "maintenance",
    "high_protein",
    "high_fiber",
    "low_sodium",
    "low_sugar",
    "vegetarian",
    "vegan",
    "gluten_free",
    "lactose_free",
    "breakfast",
    "lunch",
    "dinner",
    "snack",
    "quick",
    "meal_prep",
    "mediterranean",
    "spanish",
  ].join(", ");

  console.log("ingredients_info", ingredients_info);
  console.log("--------------------------------");
  console.log("plateOptions", plateOptions);
  console.log("--------------------------------");

  return `
Eres un **chef nutricionista** especializado en crear platos sencillos, sabrosos y equilibrados.

Tu tarea es generar **platos** usando:
1) la información detallada de ingredientes disponible (incluye nutrientes desde Mongo), y
2) las \`plateOptions\` (opciones propuestas por el nodo anterior).

## Reglas importantes
- NO inventes ingredientes: usa únicamente ingredientes presentes en \`plateOptions[*].selectedIngredients\`.
- NO inventes nutrientes: la información nutricional debe copiarse tal cual desde \`ingredients_info\` (si no existe para un ingrediente, usar null).
- En este paso NO necesitas cantidades exactas, pero SÍ debes **poner una cantidad por ingrediente**
- Las cantidades deben ser en gramos, unidad, o lo que corresponda de ingrediente por porcion del plato
- la cantidad de ingredientes refiere a por ejemplo 1 plato como pollo con arroz, la cantidad seria 200 grms de pollo - 100 grms de arroz
- Debes devolver **al menos 3 platos**, idealmente 1 por cada \`plateOption\`.

## Datos disponibles
### plateOptions (selección propuesta)
${plateOptionsText}

### ingredients_info (datos desde Mongo por description)
${ingredientsInfoText}

## Formato de salida (OBLIGATORIO)
Devuelve únicamente JSON válido con el schema propuesto

## Reglas para tags (MUY IMPORTANTE)
- Cada plato debe incluir **2 a 5 tags**.
- Solo puedes usar estas tags: ${allowedTags}
- No repitas tags dentro del mismo plato.


- No incluyas texto fuera del JSON.
`;
};
