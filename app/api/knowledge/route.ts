import { NextResponse } from 'next/server';

import { addKnowledge, listKnowledge } from '@/lib/repo';
import type { KnowledgeType } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await listKnowledge());
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    type?: KnowledgeType;
    title?: string;
    body?: string;
    tags?: string[];
  };
  if (!body.title?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: 'タイトルと本文を入力してください。' }, { status: 400 });
  }
  const item = await addKnowledge({
    type: body.type ?? 'product',
    title: body.title.trim(),
    body: body.body,
    tags: body.tags ?? [],
  });
  return NextResponse.json(item, { status: 201 });
}
