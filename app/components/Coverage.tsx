import { fieldCoverage } from '@/lib/progress';
import type { Coverage as CoverageValue } from '@/lib/progress';
import type { Customer } from '@/lib/types';

/**
 * カルテの「どこまで確かめられているか」。
 *
 * 情報源には 確認済み > 担当者の報告 > AIの仮説 という確からしさの順序があるので、
 * 色は identity（別々のもの）ではなく ordinal（順序のある1色の濃淡）で表す。
 * 濃いほど確か。未確認は色を持たせず、track（下地）として置く。
 *
 * 数字は必ず文字でも出す。色だけで意味を運ばない。
 */

const SEGMENTS = [
  { key: 'confirmed', label: '確認済み' },
  { key: 'reported', label: '担当者の報告' },
  { key: 'hypothesis', label: 'AIの仮説' },
] as const;

function describe(coverage: CoverageValue): string {
  const parts = SEGMENTS.map((s) => `${s.label}${coverage[s.key]}件`);
  return `全${coverage.total}項目のうち、${parts.join('、')}、未確認${coverage.open}件`;
}

function Bar({ coverage }: { coverage: CoverageValue }) {
  return (
    <div className="cov-bar" role="img" aria-label={describe(coverage)}>
      {SEGMENTS.map((segment) =>
        coverage[segment.key] > 0 ? (
          <span
            key={segment.key}
            className="cov-seg"
            data-kind={segment.key}
            style={{ flexGrow: coverage[segment.key] }}
          />
        ) : null,
      )}
      {coverage.open > 0 && (
        <span className="cov-seg" data-kind="open" style={{ flexGrow: coverage.open }} />
      )}
    </div>
  );
}

/** 一覧の行に置く小さい版。数字は隣のセルにあるので、ここでは棒だけ。 */
export function CoverageMini({ customer }: { customer: Customer }) {
  const coverage = fieldCoverage(customer.fields);
  return (
    <span className="cov-mini">
      <Bar coverage={coverage} />
      <span className="cov-mini-num">
        {coverage.confirmed}/{coverage.total}
      </span>
    </span>
  );
}

/** カルテ本体に置く版。確認済みの件数を主役にする。 */
export default function Coverage({ customer }: { customer: Customer }) {
  const coverage = fieldCoverage(customer.fields);
  return (
    <div className="cov">
      <div className="cov-head">
        <div>
          <span className="cov-value">{coverage.confirmed}</span>
          <span className="cov-unit"> / {coverage.total} 項目が確認済み</span>
        </div>
        <p className="cov-caption">
          {coverage.open === 0
            ? '未確認の項目はありません'
            : `未確認はあと${coverage.open}項目`}
        </p>
      </div>

      <Bar coverage={coverage} />

      <ul className="cov-legend">
        {SEGMENTS.map((segment) => (
          <li key={segment.key}>
            <i className="cov-key" data-kind={segment.key} aria-hidden="true" />
            {segment.label}
            <b>{coverage[segment.key]}</b>
          </li>
        ))}
        <li>
          <i className="cov-key" data-kind="open" aria-hidden="true" />
          未確認
          <b>{coverage.open}</b>
        </li>
      </ul>
    </div>
  );
}
