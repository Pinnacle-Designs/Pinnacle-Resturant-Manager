import { prisma } from "@/lib/prisma";
import { NAV_ITEMS } from "@/lib/constants";
import type { Permission } from "@/lib/permissions";
import { hasResolvedPermission } from "@/lib/permission-resolve";
import type { AppRole } from "@/lib/app-role";
import type { PlanId } from "@/lib/plans";
import { filterNavForUser } from "@/lib/permissions";

export interface SearchResult {
  type: string;
  id: string;
  label: string;
  href: string;
  meta?: string;
}

export async function searchRecords(
  locationId: string,
  query: string,
  limit = 8
): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const qLower = q.toLowerCase();
  const perType = Math.max(3, Math.ceil(limit / 4));

  const [menu, inventory, staff, logs, orders, tables] = await Promise.all([
    prisma.menuItem.findMany({
      where: {
        locationId,
        OR: [
          { name: { contains: q } },
          { category: { contains: q } },
          { description: { contains: q } },
        ],
      },
      select: { id: true, name: true, category: true, price: true },
      take: perType,
      orderBy: { name: "asc" },
    }),
    prisma.inventoryItem.findMany({
      where: {
        locationId,
        OR: [
          { name: { contains: q } },
          { barcode: { contains: q } },
          { supplier: { contains: q } },
        ],
      },
      select: { id: true, name: true, unit: true, barcode: true },
      take: perType,
      orderBy: { name: "asc" },
    }),
    prisma.staffMember.findMany({
      where: {
        locationId,
        active: true,
        OR: [
          { name: { contains: q } },
          { role: { contains: q } },
          { email: { contains: q } },
        ],
      },
      select: { id: true, name: true, role: true },
      take: perType,
      orderBy: { name: "asc" },
    }),
    prisma.logBookEntry.findMany({
      where: {
        locationId,
        OR: [
          { searchText: { contains: qLower } },
          { title: { contains: q } },
          { content: { contains: q } },
        ],
      },
      select: { id: true, title: true, category: true, logDate: true },
      take: perType,
      orderBy: { logDate: "desc" },
    }),
    prisma.order.findMany({
      where: {
        locationId,
        OR: [
          { partyName: { contains: q } },
          { notes: { contains: q } },
          { table: { label: { contains: q } } },
        ],
      },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        table: { select: { number: true } },
      },
      take: perType,
      orderBy: { createdAt: "desc" },
    }),
    prisma.table.findMany({
      where: {
        locationId,
        OR: [{ label: { contains: q } }],
      },
      select: { id: true, number: true, label: true, section: true },
      take: perType,
      orderBy: { number: "asc" },
    }),
  ]);

  const results: SearchResult[] = [];

  for (const item of menu) {
    results.push({
      type: "menu",
      id: item.id,
      label: item.name,
      href: `/menu?q=${encodeURIComponent(item.name)}`,
      meta: `${item.category} · $${item.price.toFixed(2)}`,
    });
  }
  for (const item of inventory) {
    results.push({
      type: "inventory",
      id: item.id,
      label: item.name,
      href: `/inventory?q=${encodeURIComponent(item.name)}`,
      meta: [item.barcode, item.unit].filter(Boolean).join(" · "),
    });
  }
  for (const member of staff) {
    results.push({
      type: "staff",
      id: member.id,
      label: member.name,
      href: `/staff?tab=team&q=${encodeURIComponent(member.name)}`,
      meta: member.role,
    });
  }
  for (const entry of logs) {
    results.push({
      type: "log",
      id: entry.id,
      label: entry.title || entry.category,
      href: `/log-book?q=${encodeURIComponent(q)}`,
      meta: entry.category,
    });
  }
  for (const order of orders) {
    const tableNum = order.table?.number;
    results.push({
      type: "order",
      id: order.id,
      label: tableNum ? `Table ${tableNum}` : `Order ${order.id.slice(-6)}`,
      href: `/orders?view=checks&q=${encodeURIComponent(q)}`,
      meta: `${order.status} · $${order.totalAmount.toFixed(2)}`,
    });
  }
  for (const table of tables) {
    results.push({
      type: "table",
      id: table.id,
      label: table.label || `Table ${table.number}`,
      href: `/tables?q=${encodeURIComponent(table.label || String(table.number))}`,
      meta: table.section ?? undefined,
    });
  }

  return results.slice(0, limit);
}

export function searchNavItems(
  query: string,
  role: AppRole,
  plan: PlanId | null | undefined,
  permissions?: Permission[] | null
): SearchResult[] {
  const q = query.trim().toLowerCase();
  const items = filterNavForUser(role, plan, NAV_ITEMS, permissions);
  const matched = q
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) || item.href.toLowerCase().includes(q)
      )
    : items;

  return matched.map((item) => ({
    type: "nav",
    id: item.href,
    label: item.label,
    href: item.href,
    meta: "Go to page",
  }));
}

const TYPE_PERMISSION: Record<string, Permission | null> = {
  nav: null,
  menu: "manage_menu",
  inventory: "manage_inventory",
  staff: "edit_staff",
  log: "view_log_book",
  order: "manage_orders",
  table: "manage_tables",
};

export function canSearchType(type: string, permissions: Permission[]): boolean {
  const required = TYPE_PERMISSION[type];
  if (!required) return true;
  return hasResolvedPermission(permissions, required);
}
