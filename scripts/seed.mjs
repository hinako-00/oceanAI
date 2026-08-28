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

// ownerRepId は初期設定で作られる最初の管理者（IDは rep-default を引き継ぐ）に一致させる。
const customer = {
  id: customerId,
  displayName: '田中 一郎',
  fields: {
    customerName: { value: '田中 一郎', source: 'confirmed', updatedAt: now },
    companyName: { value: '会社員（IT系・共働き）', source: 'confirmed', updatedAt: now },
    demographics: { value: '30代後半・配偶者と子ども2人・賃貸', source: 'confirmed', updatedAt: now },
    leadSource: { value: 'InstagramのPR投稿から問い合わせ', source: 'rep_report', updatedAt: now },
    currentSituation: {
      value: '家計簿アプリを入れたが続かず、毎月の支出を把握できていない',
      source: 'confirmed',
      evidence: '家計簿は三日坊主で終わってしまって',
      updatedAt: now,
    },
    surfaceRequest: { value: '毎月の支出を自動で把握したい', source: 'confirmed', updatedAt: now },
    coreIssue: {
      value: '教育費の見通しが立たず、貯蓄できているのか不安な状態が続いている',
      source: 'ai_hypothesis',
      evidence: '「このままで足りるのか分からない」という発言からの推測',
      updatedAt: now,
    },
  },
  openQuestions: ['月々に出せる金額', '始めたい時期', '比較検討している他社', '配偶者への相談状況'],
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
    '担当：本日はお時間ありがとうございます。まず今の家計の管理について教えていただけますか。',
    'お客様：家計簿アプリを入れたんですが、三日坊主で終わってしまって。今いくら使っているかも把握できていません。',
    '担当：そうなんですね。弊社のサービスなら口座と連携して自動で集計されますし、スマホで完結します。',
    'お客様：なるほど。ただ、毎月の固定費が増えるのは正直こわくて。',
    '担当：月々のご負担は抑えられますので大丈夫ですよ。多くの方にご利用いただいています。',
    'お客様：そうですか。一度、妻と相談してみます。',
    '担当：ぜひご検討ください。来週あらためてご連絡します。',
  ].join('\n'),
  outcome: '検討中',
  createdAt: now,
};

const knowledge = [
  {
    id: randomUUID(),
    type: 'rule',
    title: '割引の承認ルール',
    body: '定価からの割引は10%までは担当判断で可能。10%超は上長承認が必要。割引の前に、まずプランの見直し（機能を絞る・開始時期をずらす）を提案すること。金額の話に入る前に、月々いくらなら無理がないかを必ず確認する。',
    tags: ['価格', '社内ルール'],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: randomUUID(),
    type: 'case',
    title: '30代共働き世帯の成約事例',
    body: '「毎月いくら貯められていないか」を一緒に計算したことで、支出の曖昧さが本人の言葉で具体化され、必要性が腑に落ちた。固定費が増えることへの不安には、初月無料と「いつでも解約できる」ことを先に伝えて解消した。配偶者への相談が必要だったため、その場で決めさせず、説明用の資料を渡して1週間後に再連絡した。',
    tags: ['共働き世帯', '成功事例', '不安対応'],
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
console.log('  ※ 担当者は初期設定で作成する最初の管理者になります');
console.log('  顧客情報 1件（未確認事項つき）');
console.log('  アポ履歴 1件（文字起こし）');
console.log(`  自社営業知識 ${knowledge.length}件`);
