import { NextResponse } from "next/server";

// Retired permanently. Do not authenticate, look up users, or access private data.
export async function GET() {
  return NextResponse.json({ error: "Not found." }, {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}
