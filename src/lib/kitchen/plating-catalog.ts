/**
 * Standard portion specs and plating instructions — keyed by menu item name.
 * Seeded demo BBQ items; extend or override per location on Menu later.
 */

export type KitchenPlatingSpec = {
  portionSpec: string;
  platingNotes: string;
  plateware?: string;
  garnish?: string;
};

export const KITCHEN_PLATING_CATALOG: Record<string, KitchenPlatingSpec> = {
  "Smoked Brisket Plate": {
    portionSpec: "6 oz sliced brisket · 4 oz mac · 3 oz slaw",
    plateware: "12\" oval plate",
    garnish: "Pickle spear, 1 oz sauce ramekin",
    platingNotes:
      "Fan brisket slices across center. Mac & cheese NE quadrant, coleslaw SW. Sauce ramekin at 2 o'clock. Wipe rim.",
  },
  "St. Louis Ribs (Half Rack)": {
    portionSpec: "½ rack (4 bones) · 2 oz sauce",
    plateware: "12\" rectangular plate",
    garnish: "Parsley, pickle chips",
    platingNotes:
      "Stack ribs bone-side down, curve toward guest. Brush glaze, cut between bones exposed. Sauce cup at corner.",
  },
  "Pulled Pork Sandwich": {
    portionSpec: "4 oz pulled pork · 1 brioche bun",
    plateware: "8\" square plate + basket liner",
    garnish: "Pickle chips on toothpick",
    platingNotes:
      "Toast bun. Pork piled high, slaw on top. Cut diagonally, lean halves together. Chips or slaw side if ordered.",
  },
  "Smoked Chicken Quarter": {
    portionSpec: "1 quarter leg/thigh · 2 oz white sauce",
    plateware: "10\" round plate",
    garnish: "Lemon wedge",
    platingNotes: "Quarter skin-up, white sauce drizzled in stripe. Sauce ramekin if extra requested.",
  },
  "Mac & Cheese": {
    portionSpec: "8 oz portion",
    plateware: "6\" bowl or side boat",
    garnish: "Paprika dust",
    platingNotes: "Scoop level with rim, golden top visible. Do not over-stir — hold texture.",
  },
  Coleslaw: {
    portionSpec: "4 oz side",
    plateware: "4 oz side cup",
    garnish: "—",
    platingNotes: "Drain excess dressing. Fill cup, level off. Nest in plate corner or serve in cup.",
  },
  "Sweet Tea": {
    portionSpec: "16 oz pour",
    plateware: "16 oz pint glass",
    garnish: "Lemon wheel on rim",
    platingNotes: "Fill with ice to line, pour to ½\" below rim. Lemon on rim, straw optional.",
  },
  "Peach Cobbler": {
    portionSpec: "5 oz cobbler · 3 oz ice cream",
    plateware: "6\" dessert bowl",
    garnish: "Mint sprig",
    platingNotes: "Warm cobbler base, scoop ice cream centered on top. Mint at 12 o'clock.",
  },
  "Brisket Sandwich": {
    portionSpec: "5 oz chopped brisket · 1 brioche bun",
    plateware: "8\" square plate",
    garnish: "Pickle spear",
    platingNotes: "Chop brisket, mix light sauce. Pile on bottom bun, slaw, cap. Halve on bias. Pickle alongside.",
  },
  "Baked Beans": {
    portionSpec: "6 oz side",
    plateware: "4 oz side cup",
    garnish: "Bacon crumble on top",
    platingNotes: "Heat through, bacon on top. Level cup — beans should hold shape when tipped.",
  },
  Cornbread: {
    portionSpec: "1 wedge (¼ skillet)",
    plateware: "Side plate or on entree plate",
    garnish: "Honey drizzle",
    platingNotes: "Warm wedge, honey zigzag. Butter pat optional on side.",
  },
  "Draft Beer": {
    portionSpec: "16 oz pour",
    plateware: "Pint glass",
    garnish: "—",
    platingNotes: "Tilt 45°, pour down side, straighten for 1\" head. Wipe condensation ring.",
  },
  "Bourbon Lemonade": {
    portionSpec: "2 oz bourbon · 6 oz lemonade",
    plateware: "12 oz rocks glass",
    garnish: "Mint sprig + lemon wheel",
    platingNotes: "Build over ice. Stir 4×. Garnish tall — mint and lemon at rim.",
  },
  "Burnt Ends": {
    portionSpec: "8 oz cubed burnt ends",
    plateware: "8\" bowl",
    garnish: "Green onion, sesame (optional)",
    platingNotes: "Mound cubes center-high. Glaze toss before plate. Onions scattered, sauce on side.",
  },
  "Jalapeño Poppers": {
    portionSpec: "5 poppers (app)",
    plateware: "8\" app plate",
    garnish: "Ranch ramekin",
    platingNotes: "Shingle poppers in arc. Ranch at 6 o'clock. Serve hot — hold under heat lamp max 2 min.",
  },
  "Pitmaster Sampler": {
    portionSpec: "4 oz brisket · ½ rack ribs · 3 oz mac · 3 oz slaw",
    plateware: "14\" oval platter",
    garnish: "Pickles, onions, 2 sauce ramekins",
    platingNotes:
      "Brisket 9 o'clock, ribs 3 o'clock. Mac NE, slaw SW. Divider or sauce line between proteins. Family-style presentation.",
  },
};

export function getPlatingSpec(menuItemName: string): KitchenPlatingSpec | null {
  return KITCHEN_PLATING_CATALOG[menuItemName] ?? null;
}
