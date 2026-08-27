import { NextResponse } from 'next/server';

import { getDefaultRep, updateRep } from '@/lib/repo';
import type { RepProfile } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getDefaultRep());
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Partial<RepProfile>;
  const rep = await getDefaultRep();
  const updated = await updateRep(rep.id, {
    name: body.name,
    experienceYears: Number.isFinite(Number(body.experienceYears))
      ? Number(body.experienceYears)
      : undefined,
    product: body.product,
    territory: body.territory,
    note: body.note,
  });
  return NextResponse.json(updated);
}
