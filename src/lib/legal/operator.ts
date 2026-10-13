import "server-only";

/** Deliberately separate public contact details from the administrator login. */
export function getPublicOperator() {
  const contact = process.env.APP_PUBLIC_CONTACT_EMAIL?.trim() ?? "";
  return {
    name: process.env.APP_PUBLIC_OPERATOR_NAME?.trim() || "the ApplyOS operator",
    location: process.env.APP_PUBLIC_OPERATOR_LOCATION?.trim() || null,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? contact : null,
  };
}
