/**
 * 「どれだけ積み上がったか」を数えるための純粋関数。
 *
 * 画面に出す数字はここだけで作る。保存も通信もしないので、
 * tests/progress.test.ts でそのまま検証できる。
 *
 * 数え方の前提:
 * - 件数は「行動の量」であって成果ではない。アポの結果とは結び付けない。
 * - 日付の区切りは利用者の端末のローカル時刻で行う。サーバー（UTC）で
 *   区切ると、日本時間の夜に入れた記録が前日に寄ってしまう。
 */

import { CUSTOMER_FIELD_KEYS } from './types';
import type { Customer } from './types';

/** 積み上げの元データ。作成時刻の一覧だけを受け取る。 */
export interface ActivityLog {
  /** 自分が記録したアポの作成時刻（ISO）。 */
  meetings: string[];
  /** 自分が登録した知識の作成時刻（ISO）。 */
  knowledge: string[];
  /** 自分が担当するクライアントの未確認事項の合計（現在値）。 */
  openQuestions: number;
  /** 自分が担当するクライアント数（現在値）。 */
  customers: number;
}

export interface DayBucket {
  /** ローカル時刻での YYYY-MM-DD。 */
  date: string;
  /** 曜日1文字（日〜土）。 */
  weekday: string;
  meetings: number;
  knowledge: number;
  total: number;
  isToday: boolean;
}

export interface WeeklySummary {
  /** 古い順に7日ぶん。右端が今日。 */
  days: DayBucket[];
  meetings: number;
  knowledge: number;
  total: number;
  /** 7日のうち、何か記録した日の数。 */
  activeDays: number;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** ローカル時刻での YYYY-MM-DD。Date#toISOString はUTCになるので使わない。 */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 直近7日（今日を含む）の積み上げ。
 * 読めない日付や7日より前のものは黙って捨てる。
 */
export function weeklySummary(activity: ActivityLog, now: Date = new Date()): WeeklySummary {
  const days: DayBucket[] = [];
  const index = new Map<string, DayBucket>();
  const todayKey = localDateKey(now);

  for (let back = 6; back >= 0; back -= 1) {
    // 日付だけを動かす。時刻を引くと、夏時間のある地域で1日ずれる。
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const key = localDateKey(day);
    const bucket: DayBucket = {
      date: key,
      weekday: WEEKDAYS[day.getDay()],
      meetings: 0,
      knowledge: 0,
      total: 0,
      isToday: key === todayKey,
    };
    days.push(bucket);
    index.set(key, bucket);
  }

  const count = (stamps: string[], kind: 'meetings' | 'knowledge') => {
    for (const stamp of stamps) {
      const at = new Date(stamp);
      if (Number.isNaN(at.getTime())) continue;
      const bucket = index.get(localDateKey(at));
      if (!bucket) continue;
      bucket[kind] += 1;
      bucket.total += 1;
    }
  };

  count(activity.meetings, 'meetings');
  count(activity.knowledge, 'knowledge');

  const meetings = days.reduce((sum, day) => sum + day.meetings, 0);
  const knowledge = days.reduce((sum, day) => sum + day.knowledge, 0);

  return {
    days,
    meetings,
    knowledge,
    total: meetings + knowledge,
    activeDays: days.filter((day) => day.total > 0).length,
  };
}

/**
 * カルテの埋まり具合。
 *
 * 「何項目埋まったか」ではなく「どのくらい確からしいか」で数える。
 * AIの仮説と確認済みの事実を同じ1件として数えると、
 * 埋まっているのに何も確認できていないカルテが「完成」に見えてしまう。
 * 値があっても情報源が「未確認」のものは未確認として扱う。
 */
export interface Coverage {
  confirmed: number;
  reported: number;
  hypothesis: number;
  /** 何らかの情報が入っている項目数（confirmed + reported + hypothesis）。 */
  known: number;
  /** 未入力、または情報源が未確認の項目数。 */
  open: number;
  total: number;
  /** 確認済みの事実の割合（0〜1）。カルテの「確からしさ」の代表値。 */
  confirmedRatio: number;
}

export function fieldCoverage(fields: Customer['fields']): Coverage {
  let confirmed = 0;
  let reported = 0;
  let hypothesis = 0;

  for (const key of CUSTOMER_FIELD_KEYS) {
    const field = fields[key];
    if (!field || !field.value.trim()) continue;
    if (field.source === 'confirmed') confirmed += 1;
    else if (field.source === 'rep_report') reported += 1;
    else if (field.source === 'ai_hypothesis') hypothesis += 1;
    // source === 'unconfirmed' は値があっても未確認として数える。
  }

  const total = CUSTOMER_FIELD_KEYS.length;
  const known = confirmed + reported + hypothesis;
  return {
    confirmed,
    reported,
    hypothesis,
    known,
    open: total - known,
    total,
    confirmedRatio: total === 0 ? 0 : confirmed / total,
  };
}
