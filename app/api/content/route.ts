import { NextResponse } from 'next/server';
import { getContent } from '@/src/lib/content';

export const dynamic = 'force-dynamic';

// the café's current menu and dialogue as JSON; "source" says whether it came from Neon or the defaults
export async function GET() {
  return NextResponse.json(await getContent(), { headers: { 'Cache-Control': 'no-store' } });
}
