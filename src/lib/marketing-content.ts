export const MARKETING_STATS = [
  { label: "Analytics modules", value: "12" },
  { label: "AI question library", value: "350+" },
  { label: "Staff roles supported", value: "5" },
  { label: "Setup time", value: "< 2 min" },
] as const;

export const CORE_FEATURES = [
  {
    id: "dashboard",
    icon: "layout-dashboard",
    title: "Operations Dashboard",
    description:
      "Revenue, expenses, low-stock alerts, recent activity, and AI insights on one screen. Know what needs attention the moment you log in.",
    href: "/dashboard",
  },
  {
    id: "command-center",
    icon: "brain",
    title: "AI Command Center",
    description:
      "Ask plain-English questions like “What’s hurting my profit this week?” The system cross-checks sales, labor, inventory, vendors, waste, reviews, and staff data together.",
    href: "/insights",
    highlight: true,
  },
  {
    id: "analytics",
    icon: "bar-chart-3",
    title: "12-Tab Analytics Suite",
    description:
      "Sales, food cost, labor, menu engineering, marketing ROI, guest experience, operations, purchasing, forecasting, profitability, external factors, and executive KPIs.",
    href: "/analytics",
    highlight: true,
  },
  {
    id: "orders",
    icon: "clipboard-list",
    title: "Orders & POS Flow",
    description:
      "Create orders, track status from pending to paid, link to tables, and capture channel and guest data for downstream analytics.",
    href: "/orders",
  },
  {
    id: "menu",
    icon: "utensils",
    title: "Menu Management",
    description:
      "Full menu CRUD with categories, pricing, availability, and recipe costs that feed menu engineering and profitability analysis.",
    href: "/menu",
  },
  {
    id: "inventory",
    icon: "package",
    title: "Inventory & Food Cost",
    description:
      "Track stock levels, par minimums, waste logs, vendor pricing, and theoretical vs actual food cost variance.",
    href: "/inventory",
  },
  {
    id: "staff",
    icon: "users",
    title: "Staff & Scheduling",
    description:
      "Manage team members, roles, hourly rates, and shift schedules. Labor analytics tie performance to sales and prime cost.",
    href: "/staff",
  },
  {
    id: "tables",
    icon: "layout-grid",
    title: "Table Floor Plan",
    description:
      "Visual table map with available, occupied, and reserved states. Connect front-of-house flow to order volume.",
    href: "/tables",
  },
  {
    id: "finances",
    icon: "dollar-sign",
    title: "Finances & Receipt OCR",
    description:
      "Expense tracking with AI receipt scanning — extracts vendor, amount, category, and line items from photos automatically.",
    href: "/finances",
  },
  {
    id: "photos",
    icon: "camera",
    title: "Photo Intelligence",
    description:
      "Capture menu items, inventory, receipts, prep, and facility photos. AI categorizes and describes images for your operational record.",
    href: "/photos",
  },
  {
    id: "social",
    icon: "share-2",
    title: "Social & Marketing",
    description:
      "Connect social accounts, schedule posts, sync website content, and measure campaign ROI against real sales data.",
    href: "/social",
  },
  {
    id: "locations",
    icon: "building-2",
    title: "Multi-Location",
    description:
      "Switch between restaurant locations. Every metric, order, and insight is scoped per location with owner-level rollups.",
    href: "/dashboard",
  },
] as const;

export const ANALYTICS_TABS = [
  "Executive Summary",
  "Sales",
  "Food & Inventory",
  "Labor",
  "Menu Engineering",
  "Marketing",
  "Guest Experience",
  "Operations",
  "Purchasing",
  "Forecasting",
  "Profitability",
  "External Factors",
] as const;

export const DEMO_TOUR_STOPS = [
  { id: "dashboard", label: "Dashboard", path: "/dashboard", blurb: "Daily ops overview" },
  { id: "photos", label: "Photos", path: "/photos", blurb: "Menu & facility images" },
  { id: "analytics", label: "Analytics", path: "/analytics", blurb: "12-tab intelligence" },
  { id: "reports", label: "Reports", path: "/reports", blurb: "Exportable reports" },
  { id: "insights", label: "Command Center", path: "/insights", blurb: "AI cross-domain Q&A" },
  { id: "orders", label: "Orders", path: "/orders", blurb: "Live order flow" },
  { id: "tables", label: "Tables", path: "/tables", blurb: "Floor plan & seating" },
  { id: "timeclock", label: "Time Clock", path: "/timeclock", blurb: "Punch in / out" },
  { id: "menu", label: "Menu", path: "/menu", blurb: "Items & pricing" },
  { id: "kitchen", label: "Kitchen", path: "/kitchen", blurb: "Prep & production" },
  { id: "boh", label: "BOH", path: "/boh", blurb: "Back-of-house ops" },
  { id: "kds", label: "KDS", path: "/kds", blurb: "Kitchen display" },
  { id: "inventory", label: "Inventory", path: "/inventory", blurb: "Stock & food cost" },
  { id: "purchase-orders", label: "Purchase Orders", path: "/purchase-orders", blurb: "Vendor ordering" },
  { id: "staff", label: "Staff", path: "/staff", blurb: "Team & schedules" },
  { id: "log-book", label: "Log Book", path: "/log-book", blurb: "Shift notes" },
  { id: "finances", label: "Finances", path: "/finances", blurb: "Expenses & receipts" },
  { id: "back-office", label: "Back Office", path: "/back-office", blurb: "Admin & compliance" },
  { id: "crystal-ball", label: "Crystal Ball", path: "/crystal-ball", blurb: "Forecasting" },
  { id: "social", label: "Social", path: "/social", blurb: "Marketing & posts" },
] as const;

export const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Launch the live demo",
    description: "One click logs you in as owner with a fully seeded restaurant — menu, staff, orders, analytics, and AI data ready to explore.",
  },
  {
    step: "2",
    title: "Run your restaurant",
    description: "Manage orders, inventory, schedules, and finances. Every action feeds the analytics engine in real time.",
  },
  {
    step: "3",
    title: "Ask the Command Center",
    description: "Get cross-domain answers on profit leaks, staffing, waste, and guest issues — with specific numbers and priority actions.",
  },
] as const;
