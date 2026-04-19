import { NextResponse } from "next/server";
import { browseLan } from "@/server/discovery";

export const dynamic = "force-dynamic";

export async function GET() {
  const servers = await browseLan(1500);
  return NextResponse.json({ servers });
}
