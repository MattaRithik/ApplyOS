import { LegalPage, policyMetadata } from "@/components/legal/legal-page";

export const dynamic = "force-dynamic";
export const metadata = policyMetadata("contact");

export default function Page() {
  return <LegalPage slug="contact" />;
}
