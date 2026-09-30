import { recordHeartbeat } from "@/lib/presence/heartbeat";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return recordHeartbeat(request);
}
