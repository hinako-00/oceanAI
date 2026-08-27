import 'server-only';
import { NextResponse } from 'next/server';

import { AuthError } from './auth';

/** APIルートの例外を共通の形式に変換する。 */
export function handleError(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : 'サーバーエラーが発生しました。';
  return NextResponse.json({ error: message }, { status: 400 });
}
