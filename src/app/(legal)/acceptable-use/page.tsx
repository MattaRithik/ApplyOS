import { LegalPage, policyMetadata } from "@/components/legal/legal-page";

export const dynamic = "force-dynamic";
export const metadata = policyMetadata("acceptable-use");

export default function Page() {
  return <LegalPage slug="acceptable-use" />;
}
