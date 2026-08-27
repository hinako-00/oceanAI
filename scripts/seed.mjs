#!/usr/bin/env node
/**
 * デモ用データの投入。
 * APIキーがなくても画面の使い方を確認できるようにするためのもの。
 * 既存データがある場合は上書きしないので、安全に実行できる。
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR ?? './data');
const now = new Date().toISOString();
const today = now.slice(0, 10);

async function read(file) {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, file), 'utf8'));
  } catch {
    return [];
  }
}

async function write(file, rows) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, file), `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
}

const customerId = randomUUID();

const customer = {
  id: customerId,
  displayName: '株式会社みなと製作所',
  fields: {
    companyName: { value: '株式会社みなと製作所', source: 'confirmed', updatedAt: now },
    demographics: { value: '総務部長（40代）', source: 'confirmed', updatedAt: now },
    leadSource: { value: '展示会での名刺交換', source: 'rep_report', updatedAt: now },
    currentSituation: {
      value: '勤怠管理をExcelで運用。月次の締めに総務3名で3日かかっている',
      source: 'confirmed',
      evidence: '締めのたびに総務が3日かかっています',
      updatedAt: now,
    },
    surfaceRequest: { value: '勤怠の集計を自動化したい', source: 'confirmed', updatedAt: now },
    coreIssue: {
      value: '締め作業の属人化により、担当者の休職時に業務が止まるリスクがある',
      source: 'ai_hypothesis',
      evidence: '「担当が休むと回らない」という発言からの推測',
      updatedAt: now,
    },
  },
  openQuestions: ['予算の上限', '導入希望時期', '比較検討している他社', '決裁フローと決裁者'],
  ownerRepId: 'rep-default',
  createdAt: now,
  updatedAt: now,
};

const meeting = {
  id: randomUUID(),
  customerId,
  repId: 'rep-default',
  date: today,
  title: '初回ヒアリング',
  stage: 'ヒアリング',
  inputType: 'transcript',
  rawInput: [
    '担当：本日はお時間ありがとうございます。まず現在の勤怠管理について教えていただけますか。',
    '顧客：Excelでやっています。締めのたびに総務が3日かかっていて、正直しんどいですね。',
    '担当：3日ですか。それは大変ですね。弊社のサービスなら集計は自動化できますし、承認もスマホで完結します。',
    '顧客：なるほど。ただ、うちは現場がITに強くないので、使いこなせるか不安で。',
    '担当：操作は簡単なので大丈夫ですよ。導入企業様でも問題なく使えています。',
    '顧客：そうですか。一度社内で相談してみます。',
    '担当：ぜひご検討ください。来週あらためてご連絡します。',
  ].join('\n'),
  outcome: '検討中',
  createdAt: now,
};

const knowledge = [
  {
    id: randomUUID(),
    type: 'rule',
    title: '値引きの承認ルール',
    body: '定価からの値引きは10%までは担当判断で可能。10%超は部長承認、20%超は本部長承認が必要。値引きの前に、まず導入範囲の調整を提案すること。',
    tags: ['価格', '社内ルール'],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: randomUUID(),
    type: 'case',
    title: '製造業（従業員80名）の受注事例',
    body: '締め作業の工数を「1回あたり何人日か」で数値化してもらったことで、年間コストが可視化され稟議が通った。現場のIT習熟への不安には、初回3か月の伴走サポートを提示して解消した。',
    tags: ['製造業', '成功事例', '不安対応'],
    createdAt: now,
    updatedAt: now,
  },
];

const customers = await read('customers.json');
if (customers.length > 0) {
  console.log('既にデータがあるため、デモデータの投入をスキップしました。');
  process.exit(0);
}

await write('customers.json', [customer]);
await write('meetings.json', [meeting]);
await write('knowledge.json', knowledge);
console.log('デモデータを投入しました:');
console.log('  顧客カルテ 1件（未確認事項つき）');
console.log('  商談履歴 1件（文字起こし）');
console.log(`  自社営業知識 ${knowledge.length}件`);
