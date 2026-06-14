import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { LOCATION_COOKIE_NAME } from "./location-constants";

export { LOCATION_COOKIE_NAME };

export async function getLocationId(): Promise<string> {
  const cookieStore = await cookies();
  const cookieId = cookieStore.get(LOCATION_COOKIE_NAME)?.value;

  if (cookieId) {
    const exists = await prisma.location.findUnique({ where: { id: cookieId } });
    if (exists) return cookieId;
  }

  const defaultLocation = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  if (defaultLocation) return defaultLocation.id;

  const created = await prisma.location.create({
    data: { name: "Main Location", address: "123 Restaurant Row" },
  });
  return created.id;
}

export async function getLocationIdFromRequest(request: Request): Promise<string> {
  const headerId = request.headers.get("x-location-id");
  if (headerId) {
    const exists = await prisma.location.findUnique({ where: { id: headerId } });
    if (exists) return headerId;
  }
  return getLocationId();
}
