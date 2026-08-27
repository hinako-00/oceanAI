import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { addKnowledge, listKnowledge } from '@/lib/repo';
import type { KnowledgeType } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireUser();
    return NextResponse.json(await listKnowledge());
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      type?: KnowledgeType;
      title?: string;
      body?: string;
      tags?: string[];
    };
    if (!body.title?.trim() || !body.body?.trim()) {
      throw new Error('タイトルと本文を入力してください。');
    }
    const item = await addKnowledge({
      type: body.type ?? 'product',
      title: body.title.trim(),
      body: body.body,
      tags: body.tags ?? [],
      createdBy: user.id,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
