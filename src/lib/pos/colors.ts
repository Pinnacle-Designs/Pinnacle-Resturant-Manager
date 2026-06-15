/** Default POS button colors by menu category — operators can override per location. */
export const DEFAULT_CATEGORY_COLORS: Record<string, { color: string; icon: string }> = {
  "Smoked Meats": { color: "#b45309", icon: "🔥" },
  Sandwiches: { color: "#d97706", icon: "🥪" },
  Sides: { color: "#65a30d", icon: "🍟" },
  Appetizers: { color: "#ca8a04", icon: "🧀" },
  Desserts: { color: "#db2777", icon: "🥧" },
  Beverages: { color: "#059669", icon: "🍹" },
  Cocktails: { color: "#ec4899", icon: "🍸" },
  Beer: { color: "#15803d", icon: "🍺" },
  // Legacy categories from older seeds
  Breakfast: { color: "#f59e0b", icon: "🥞" },
  Entrees: { color: "#ea580c", icon: "🥩" },
  Burgers: { color: "#d97706", icon: "🍔" },
  Salads: { color: "#16a34a", icon: "🥗" },
  Pizza: { color: "#dc2626", icon: "🍕" },
  Wine: { color: "#7c3aed", icon: "🍷" },
};

export function resolveItemColor(
  category: string,
  itemColor: string | null | undefined,
  categoryStyles: Record<string, { color: string; icon?: string | null }>
): { color: string; icon: string } {
  if (itemColor) {
    const style = categoryStyles[category];
    return { color: itemColor, icon: style?.icon ?? DEFAULT_CATEGORY_COLORS[category]?.icon ?? "🍽️" };
  }
  const custom = categoryStyles[category];
  if (custom) return { color: custom.color, icon: custom.icon ?? "🍽️" };
  const fallback = DEFAULT_CATEGORY_COLORS[category];
  return fallback ?? { color: "#64748b", icon: "🍽️" };
}
