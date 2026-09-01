'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { tap } from '@/lib/haptics';

/** 表示しておく時間。読み終わる前に消えないだけの長さにする。 */
const HOLD_MS = 2400;

/**
 * 「保存できた」手ごたえ。
 *
 * これまでは保存してもバッジが出るだけで、押した操作が効いたのか
 * 分かりにくかった。チェックが描かれる短い合図と、対応端末では
 * ごく短い振動を返す。
 */
export function useSaveFlash() {
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const celebrate = useCallback((message: string) => {
    setNote(message);
    tap();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), HOLD_MS);
  }, []);

  // 画面を離れるときにタイマーを片付ける。
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { note, celebrate };
}

export default function SaveFlash({ note }: { note: string | null }) {
  return (
    // 中身が空でも要素は残す。読み上げの領域が出たり消えたりすると読まれない。
    <div className="save-flash-area" role="status" aria-live="polite">
      {note && (
        // key を本文にすると、続けて保存したときにアニメーションがやり直される。
        <div className="save-flash" key={note}>
          <svg className="save-flash-mark" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M7.5 12.4l3.2 3.2 6-6.4" />
          </svg>
          {note}
        </div>
      )}
    </div>
  );
}
