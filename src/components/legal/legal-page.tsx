import type { Metadata } from "next";
import { getPolicyDocument } from "@/lib/legal/documents";
import { PolicyDocumentView } from "./policy-document";

export function policyMetadata(slug: string): Metadata {
  const document = getPolicyDocument(slug);
  if (!document) throw new Error("Unknown legal document.");
  return {
    title: `${document.title} | ApplyOS`,
    description: document.description,
    alternates: { canonical: `/${slug}` },
  };
}

export function LegalPage({ slug }: { slug: string }) {
  const document = getPolicyDocument(slug);
  if (!document) throw new Error("Unknown legal document.");
  return <PolicyDocumentView document={document} />;
}
