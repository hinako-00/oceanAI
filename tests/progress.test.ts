import assert from 'node:assert/strict';
import test from 'node:test';

import { fieldCoverage, localDateKey, weeklySummary } from '../lib/progress';
import { CUSTOMER_FIELD_KEYS } from '../lib/types';
import type { Customer, FactSource } from '../lib/types';

/** ローカル時刻の指定日時をISO文字列にする（テスト用の入力を作るため）。 */
function localStamp(y: number, m: number, d: number, hour = 12): string {
  return new Date(y, m - 1, d, hour).toISOString();
}

function field(value: string, source: FactSource) {
  return { value, source, updatedAt: localStamp(2026, 9, 1) };
}

test('直近7日を今日まで並べ、古いものは数えない', () => {
  const now = new Date(2026, 8, 10, 15); // 2026-09-10（ローカル）
  const summary = weeklySummary(
    {
      meetings: [
        localStamp(2026, 9, 10, 9), // 今日
        localStamp(2026, 9, 10, 20), // 今日（同じ日に2件）
        localStamp(2026, 9, 4, 10), // 7日前の枠内（9/4〜9/10）
        localStamp(2026, 9, 3, 10), // 枠の外
      ],
      knowledge: [localStamp(2026, 9, 8, 10)],
      openQuestions: 0,
      customers: 0,
    },
    now,
  );

  assert.equal(summary.days.length, 7);
  assert.equal(summary.days[0].date, '2026-09-04');
  assert.equal(summary.days[6].date, '2026-09-10');
  assert.equal(summary.days[6].isToday, true);
  assert.equal(summary.days[0].isToday, false);

  // 9/3 の1件は枠外なので数えない。
  assert.equal(summary.meetings, 3);
  assert.equal(summary.knowledge, 1);
  assert.equal(summary.total, 4);
  assert.equal(summary.days[6].meetings, 2);
  assert.equal(summary.days[4].knowledge, 1); // 9/8
  assert.equal(summary.activeDays, 3); // 9/4・9/8・9/10
});

test('記録がなくても7日ぶんの枠は返す', () => {
  const summary = weeklySummary(
    { meetings: [], knowledge: [], openQuestions: 0, customers: 0 },
    new Date(2026, 8, 10),
  );
  assert.equal(summary.days.length, 7);
  assert.equal(summary.total, 0);
  assert.equal(summary.activeDays, 0);
  assert.ok(summary.days.every((day) => day.weekday.length === 1));
});

test('壊れた日付は落として数える', () => {
  const summary = weeklySummary(
    { meetings: ['', 'not-a-date', localStamp(2026, 9, 10)], knowledge: [], openQuestions: 0, customers: 0 },
    new Date(2026, 8, 10),
  );
  assert.equal(summary.meetings, 1);
});

test('月をまたいでも7日ぶんが連続する', () => {
  const summary = weeklySummary(
    { meetings: [], knowledge: [], openQuestions: 0, customers: 0 },
    new Date(2026, 9, 2), // 2026-10-02
  );
  assert.deepEqual(
    summary.days.map((day) => day.date),
    ['2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'],
  );
});

test('ローカル時刻で日付を区切る（UTCへずらさない）', () => {
  // ローカルの 23:30 は、日本時間ならUTCでは前日になる。前日に寄せない。
  const late = new Date(2026, 8, 10, 23, 30);
  assert.equal(localDateKey(late), '2026-09-10');
});

test('カルテの埋まり具合を情報源ごとに数える', () => {
  const fields: Customer['fields'] = {
    gender: field('女性', 'confirmed'),
    age: field('30代', 'confirmed'),
    industry: field('IT・通信', 'rep_report'),
    personality: field('慎重そう', 'ai_hypothesis'),
  };
  const coverage = fieldCoverage(fields);
  assert.equal(coverage.confirmed, 2);
  assert.equal(coverage.reported, 1);
  assert.equal(coverage.hypothesis, 1);
  assert.equal(coverage.known, 4);
  assert.equal(coverage.total, CUSTOMER_FIELD_KEYS.length);
  assert.equal(coverage.open, CUSTOMER_FIELD_KEYS.length - 4);
});

test('値があっても情報源が未確認なら未確認として数える', () => {
  // ここを「埋まっている」と数えると、何も確認できていないカルテが完成に見える。
  const coverage = fieldCoverage({
    gender: field('女性', 'unconfirmed'),
    age: field('   ', 'confirmed'),
    industry: field('IT・通信', 'confirmed'),
  });
  assert.equal(coverage.known, 1);
  assert.equal(coverage.confirmed, 1);
  assert.equal(coverage.open, CUSTOMER_FIELD_KEYS.length - 1);
});

test('空のカルテは確認済みの割合が0', () => {
  const coverage = fieldCoverage({});
  assert.equal(coverage.known, 0);
  assert.equal(coverage.confirmedRatio, 0);
  assert.equal(coverage.open, CUSTOMER_FIELD_KEYS.length);
});
