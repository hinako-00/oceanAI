'use client';

import { formatDate } from '@/lib/client';
import {
  CONFIDENCE_LABEL,
  SKILL_AXIS_LABEL,
  TENDENCY_CATEGORY_LABEL,
} from '@/lib/types';
import type { Confidence, TendencyCategory, Tendency } from '@/lib/types';

export const CATEGORY_ORDER: TendencyCategory[] = [
  'strength',
  'habit',
  'improve',
  'goodFit',
  'hardFit',
  'nextTry',
  'change',
];

const CONFIDENCE_CLASS: Record<Confidence, string> = {
  low: 'badge badge-ai',
  mid: 'badge badge-rep',
  high: 'badge badge-confirmed',
};

/** 営業傾向の一覧。根拠・データ数・信頼度を必ず一緒に表示する。 */
export default function TendencyList({
  tendencies,
  onDelete,
}: {
  tendencies: Tendency[];
  onDelete?: (id: string) => void;
}) {
  if (tendencies.length === 0) {
    return (
      <div className="empty">
        まだ傾向データがありません。アポの振り返りを重ね、保存候補を承認すると蓄積されます。
      </div>
    );
  }

  return (
    <>
      {CATEGORY_ORDER.map((category) => {
        const list = tendencies
          .filter((t) => t.category === category)
          .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
        if (list.length === 0) return null;
        return (
          <section key={category} style={{ marginBottom: 14 }}>
            <div className="nav-label" style={{ padding: '0 0 4px' }}>
              {TENDENCY_CATEGORY_LABEL[category]}
            </div>
            {list.map((tendency) => (
              <div key={tendency.id} className="spread" style={{ padding: '8px 0', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <span className="badge">{SKILL_AXIS_LABEL[tendency.axis]}</span>{' '}
                  <span className={CONFIDENCE_CLASS[tendency.confidence]}>
                    信頼度 {CONFIDENCE_LABEL[tendency.confidence]}
                  </span>{' '}
                  {tendency.text}
                  <div className="faint">
                    根拠: {tendency.basis || '未記載'} ／ 分析データ {tendency.dataCount}件 ／{' '}
                    {formatDate(tendency.observedAt)}
                    {tendency.neededData && ` ／ 必要な追加データ: ${tendency.neededData}`}
                  </div>
                </div>
                {onDelete && (
                  <button
                    type="button"
                    className="btn-danger btn-sm"
                    style={{ flex: 'none' }}
                    onClick={() => onDelete(tendency.id)}
                  >
                    削除
                  </button>
                )}
              </div>
            ))}
          </section>
        );
      })}
    </>
  );
}
