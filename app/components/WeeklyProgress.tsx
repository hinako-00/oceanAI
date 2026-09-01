'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { weeklySummary } from '@/lib/progress';
import type { ActivityLog } from '@/lib/progress';

/**
 * 直近7日の積み上げ。
 *
 * このアプリの約束は「入れた分だけ判断材料が育つ」ことなので、
 * 何がどれだけ増えたかを、相談を始める前に見えるところへ置く。
 *
 * 出しているのは行動の量（記録した件数）だけで、アポの結果は混ぜない。
 * 件数と成果を並べると、記録を盛る動機になるため。
 *
 * 日付の区切りは端末のローカル時刻。サーバー（UTC）で区切ると
 * 日本時間の夜に入れた記録が前日に寄る。
 */
export default function WeeklyProgress({ activity }: { activity: ActivityLog }) {
  // 「今日」はサーバーとクライアントでずれるので、描画後に確定させる。
  // 初回描画をサーバーと揃えないと hydration が食い違う。
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  if (!now) return null;

  const summary = weeklySummary(activity, now);
  const peak = Math.max(1, ...summary.days.map((day) => day.total));
  const today = summary.days[summary.days.length - 1];

  return (
    <section className="card progress" aria-labelledby="progress-title">
      <div className="spread" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 className="card-title" id="progress-title" style={{ margin: 0 }}>
          この7日間の積み上げ
        </h2>
        <span className="faint">{summary.activeDays} / 7 日</span>
      </div>

      <div className="stat-row">
        <div className="stat">
          <span className="stat-value">{summary.meetings}</span>
          <span className="stat-label">記録したアポ</span>
        </div>
        <div className="stat">
          <span className="stat-value">{summary.knowledge}</span>
          <span className="stat-label">増やした知識</span>
        </div>
        <div className="stat">
          <span className="stat-value">{activity.customers}</span>
          <span className="stat-label">クライアント</span>
        </div>
      </div>

      {/* 1系列なので凡例は置かない。見出しが系列名を兼ねる。 */}
      <div className="spark" aria-hidden="true">
        {summary.days.map((day) => (
          <div className="spark-col" key={day.date} title={`${day.date}：${day.total}件`}>
            <div className="spark-track">
              <div
                className="spark-fill"
                data-today={day.isToday}
                data-empty={day.total === 0}
                style={{ height: `${(day.total / peak) * 100}%` }}
              />
            </div>
            <span className="spark-day" data-today={day.isToday}>
              {day.weekday}
            </span>
          </div>
        ))}
      </div>
      {/* 棒は目安。値は必ず文字でも読めるようにしておく。 */}
      <p className="spark-read">
        曜日ごとの記録数（
        {summary.days.map((day) => `${day.weekday}${day.total}`).join('・')}
        ）。今日は{today.total}件です。
      </p>

      {activity.openQuestions > 0 && (
        <Link href="/customers" className="progress-next">
          <span>次に確かめること</span>
          <b>{activity.openQuestions}件</b>
        </Link>
      )}

      <p className="faint" style={{ margin: '10px 0 0' }}>
        ここに出るのは記録した量です。アポの結果の良し悪しとは別のものとして見てください。
      </p>
    </section>
  );
}
