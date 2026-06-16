import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";

export async function seedCrystalBallSample(locationId: string) {
  const upcoming = await prisma.externalFactor.count({
    where: { locationId, date: { gte: new Date() } },
  });
  if (upcoming >= 2) return;

  const now = new Date();
  await prisma.externalFactor.createMany({
    data: [
      {
        locationId,
        date: addDays(now, 2),
        factorType: "weather",
        description: "Rain forecast — patio down, delivery up",
        impactPct: 18,
      },
      {
        locationId,
        date: addDays(now, 4),
        factorType: "event",
        description: "Live music block party — foot traffic +35%",
        impactPct: 35,
      },
      {
        locationId,
        date: addDays(now, 6),
        factorType: "weather",
        description: "First 80°F sunny weekend — patio season kickoff",
        impactPct: 22,
      },
    ],
  });
}
