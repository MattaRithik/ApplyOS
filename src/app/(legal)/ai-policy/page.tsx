import { LegalPage, policyMetadata } from "@/components/legal/legal-page";

export const dynamic = "force-dynamic";
export const metadata = policyMetadata("ai-policy");

export default function Page() {
  return <LegalPage slug="ai-policy" />;
}
