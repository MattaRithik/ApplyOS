export const POLICY_VERSION = "2026-10-13";
export const POLICY_UPDATED_LABEL = "October 13, 2026";

export const POLICY_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/cookies", label: "Cookie & Storage Notice" },
  { href: "/acceptable-use", label: "Acceptable Use Policy" },
  { href: "/ai-policy", label: "AI Disclosure" },
  { href: "/contact", label: "Contact & Data Requests" },
] as const;

export const PUBLIC_LEGAL_PATHS = ["/legal", ...POLICY_LINKS.map((link) => link.href)];
