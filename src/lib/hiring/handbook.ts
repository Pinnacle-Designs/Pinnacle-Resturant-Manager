export const HANDBOOK_POLICIES = [
  {
    key: "employee_handbook",
    title: "Employee handbook",
    summary:
      "I have received and read the restaurant employee handbook, including policies on attendance, breaks, and workplace conduct.",
  },
  {
    key: "anti_harassment",
    title: "Anti-harassment policy",
    summary:
      "I understand the zero-tolerance anti-harassment policy and know how to report concerns to management.",
  },
  {
    key: "dress_code",
    title: "Dress code & appearance",
    summary:
      "I agree to follow dress code standards including uniform, footwear, grooming, and name tag requirements.",
  },
  {
    key: "food_safety",
    title: "Food safety & hygiene",
    summary:
      "I will follow food safety rules including hand washing, illness reporting, and safe food handling.",
  },
] as const;

export type HandbookPolicyKey = (typeof HANDBOOK_POLICIES)[number]["key"];
