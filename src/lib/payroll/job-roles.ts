export const JOB_ROLES = [
  "Head Chef",
  "Sous Chef",
  "Server",
  "Bartender",
  "Host",
  "Manager",
  "Busser",
  "Dishwasher",
] as const;

export type JobRole = (typeof JOB_ROLES)[number];

export const TIPPED_JOB_ROLES = new Set<JobRole>(["Server", "Bartender", "Busser"]);
