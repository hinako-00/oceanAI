/** クライアント側の共通fetchヘルパ。 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    let message = `通信に失敗しました（${response.status}）`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // JSON以外のエラー応答はそのまま既定メッセージを使う。
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export const jsonBody = (data: unknown): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(data),
});

export const patchBody = (data: unknown): RequestInit => ({
  method: 'PATCH',
  body: JSON.stringify(data),
});

export function formatDate(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
