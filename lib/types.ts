/**
 * ドメイン型定義
 *
 * 設計上の最重要ルール:
 * 顧客に関するあらゆる情報は「誰が言ったか（情報源）」を必ず持つ。
 * 確認済みの事実 / 営業担当者からの報告 / AIによる仮説 を混同させないため、
 * value と source を分離できない構造にしている。
 */

/** 情報源の区別。UI・保存・出力のすべてでこの区別を維持する。 */
export type FactSource =
  | 'confirmed' // 確認済みの事実（顧客が明確に発言した内容）
  | 'rep_report' // 営業担当者からの報告（担当者の解釈を含む）
  | 'ai_hypothesis' // AIによる仮説
  | 'unconfirmed'; // 未確認（推測で埋めない）

export const FACT_SOURCE_LABEL: Record<FactSource, string> = {
  confirmed: '確認済みの事実',
  rep_report: '担当者からの報告',
  ai_hypothesis: 'AIによる仮説',
  unconfirmed: '未確認',
};

/** 顧客カルテの1項目。 */
export interface CustomerField {
  value: string;
  source: FactSource;
  /** 根拠。文字起こしがある場合は該当発言を短く引用する。 */
  evidence?: string;
  updatedAt: string;
}

/** 顧客カルテの項目キー（仕様の「顧客情報の整理」に対応）。 */
export type CustomerFieldKey =
  | 'customerName'
  | 'companyName'
  | 'demographics'
  | 'leadSource'
  | 'currentSituation'
  | 'surfaceRequest'
  | 'coreIssue'
  | 'idealState'
  | 'impactIfIgnored'
  | 'triedSolutions'
  | 'productInterest'
  | 'concerns'
  | 'budget'
  | 'timeline'
  | 'decisionMakers'
  | 'competitors'
  | 'trustLevel'
  | 'temperature'
  | 'nextPromise'
  | 'nextAction';

export const CUSTOMER_FIELD_LABEL: Record<CustomerFieldKey, string> = {
  customerName: '顧客名',
  companyName: '会社名',
  demographics: '年齢層・職業・役職',
  leadSource: '流入経路',
  currentSituation: '顧客の現状',
  surfaceRequest: '表面的な要望',
  coreIssue: '本質的な課題',
  idealState: '理想の状態',
  impactIfIgnored: '課題を放置した場合の影響',
  triedSolutions: '過去に試した解決方法',
  productInterest: '商品・サービスへの関心',
  concerns: '不安・懸念・反論',
  budget: '予算',
  timeline: '導入・購入希望時期',
  decisionMakers: '意思決定者・相談相手',
  competitors: '比較対象・競合',
  trustLevel: '信頼関係の状態',
  temperature: '顧客の温度感',
  nextPromise: '次回の約束',
  nextAction: '次回アクション',
};

export const CUSTOMER_FIELD_KEYS = Object.keys(CUSTOMER_FIELD_LABEL) as CustomerFieldKey[];

export interface Customer {
  id: string;
  /** 一覧表示用の見出し。fields.customerName / companyName から導出する。 */
  displayName: string;
  fields: Partial<Record<CustomerFieldKey, CustomerField>>;
  /** 未確認事項（次に確認すべき項目）。 */
  openQuestions: string[];
  ownerRepId: string;
  createdAt: string;
  updatedAt: string;
}

/** 商談記録の入力種別。 */
export type MeetingInputType = 'chat' | 'memo' | 'transcript';

export const MEETING_INPUT_TYPE_LABEL: Record<MeetingInputType, string> = {
  memo: '商談メモ',
  transcript: '録音の文字起こし',
  chat: 'チャット・メールのやりとり',
};

export const MEETING_INPUT_TYPES = Object.keys(MEETING_INPUT_TYPE_LABEL) as MeetingInputType[];

export interface Meeting {
  id: string;
  customerId: string;
  repId: string;
  /** 商談日（YYYY-MM-DD）。 */
  date: string;
  title: string;
  /** 商談段階（初回接触 / ヒアリング / 提案 / クロージング など）。 */
  stage: string;
  inputType: MeetingInputType;
  /** メモ・文字起こしの原文。 */
  rawInput: string;
  /** 商談結果（受注 / 保留 / 失注 / 継続 など）。 */
  outcome: string;
  /** AIの分析結果（商談後の標準出力）。 */
  analysis?: string;
  createdAt: string;
}

/** 営業スキルの評価軸（仕様の「営業担当者の傾向分析」に対応）。 */
export type SkillAxis =
  | 'relationship'
  | 'empathy'
  | 'questioning'
  | 'digging'
  | 'listening'
  | 'logic'
  | 'brevity'
  | 'proposal'
  | 'objection'
  | 'pricing'
  | 'closing'
  | 'nextAction'
  | 'adaptation'
  | 'compliance';

export const SKILL_AXIS_LABEL: Record<SkillAxis, string> = {
  relationship: '関係構築',
  empathy: '共感',
  questioning: '質問力',
  digging: '深掘り力',
  listening: '傾聴',
  logic: '論理的説明',
  brevity: '簡潔さ',
  proposal: '提案力',
  objection: '反論対応',
  pricing: '価格交渉',
  closing: 'クロージング',
  nextAction: '次回行動の設定',
  adaptation: '顧客タイプへの適応',
  compliance: 'コンプライアンス意識',
};

export const SKILL_AXIS_KEYS = Object.keys(SKILL_AXIS_LABEL) as SkillAxis[];

export type TendencyCategory =
  | 'strength' // 現在の強み
  | 'habit' // 繰り返している癖
  | 'improve' // 改善すべき行動
  | 'goodFit' // 得意と考えられる顧客属性
  | 'hardFit' // 苦手と考えられる顧客属性
  | 'nextTry' // 次回試す具体的な行動
  | 'change'; // 前回の改善課題からの変化

export const TENDENCY_CATEGORY_LABEL: Record<TendencyCategory, string> = {
  strength: '現在の強み',
  habit: '繰り返している癖',
  improve: '改善すべき行動',
  goodFit: '得意と考えられる顧客属性',
  hardFit: '苦手と考えられる顧客属性',
  nextTry: '次回試す具体的な行動',
  change: '前回の改善課題からの変化',
};

export const TENDENCY_CATEGORY_KEYS = Object.keys(TENDENCY_CATEGORY_LABEL) as TendencyCategory[];

/** 分析の信頼度。データ数が少ない場合は必ず low とし「暫定的な傾向」として扱う。 */
export type Confidence = 'low' | 'mid' | 'high';

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  low: '低',
  mid: '中',
  high: '高',
};

export interface Tendency {
  id: string;
  axis: SkillAxis;
  category: TendencyCategory;
  text: string;
  /** 判断の根拠。 */
  basis: string;
  confidence: Confidence;
  /** 分析に使ったデータ数（商談・会話の件数）。 */
  dataCount: number;
  /** 判断に必要な追加データ。 */
  neededData?: string;
  observedAt: string;
  sourceSessionId?: string;
}

export interface NextAction {
  id: string;
  repId: string;
  /** 目的（何のための行動か）。 */
  purpose: string;
  action: string;
  /** 期限（YYYY-MM-DD）。 */
  due: string;
  customerId?: string;
  done: boolean;
  createdAt: string;
}

/** 利用者の役割。admin はメンバーの追加・無効化ができる。 */
export type UserRole = 'admin' | 'member';

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  admin: '管理者',
  member: 'メンバー',
};

/**
 * 利用者（営業担当者）。
 * passwordHash はサーバー内部だけで扱う。クライアントへ返すときは必ず toPublicUser() を通す。
 */
export interface User {
  id: string;
  email: string;
  /** scrypt$<salt>$<hash> 形式。 */
  passwordHash: string;
  name: string;
  role: UserRole;
  /** 退職・異動時は false にして残す（過去の商談記録との紐付けを壊さないため）。 */
  active: boolean;
  /** 営業経験年数。 */
  experienceYears: number;
  /** 担当商材。 */
  product: string;
  /** 担当領域・顧客層。 */
  territory: string;
  /** 本人が自覚している課題など。 */
  note: string;
  tendencies: Tendency[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

/** クライアントへ渡してよい利用者情報。 */
export type PublicUser = Omit<User, 'passwordHash'>;

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

/** ログインセッション。トークンそのものは保存せず、ハッシュだけを持つ。 */
export interface AuthSession {
  id: string;
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
}

export type KnowledgeType = 'product' | 'rule' | 'case' | 'talk';

export const KNOWLEDGE_TYPE_LABEL: Record<KnowledgeType, string> = {
  product: '商品資料',
  rule: '営業ルール',
  case: '成功事例',
  talk: 'トークスクリプト',
};

export interface Knowledge {
  id: string;
  type: KnowledgeType;
  title: string;
  body: string;
  tags: string[];
  /** 登録者。削除の権限判定に使う。 */
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

/** 対話モード（仕様の「対話開始時の判断」A〜H）。 */
export type Mode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export const MODE_LABEL: Record<Mode, string> = {
  A: '商談前の準備',
  B: '商談後の振り返り',
  C: '顧客情報の登録・更新',
  D: '営業相談・問題解決',
  E: '営業知識の学習',
  F: '顧客役とのロールプレイ',
  G: '自分の営業傾向の確認',
  H: 'その他',
};

/** ロールプレイの設定（開始前に必ず確認する項目）。 */
export interface RoleplayConfig {
  product: string;
  persona: string;
  stage: string;
  difficulty: '易しい' | '標準' | '難しい';
  focus: string;
  /** true の間はAIは顧客役に徹し、途中で指導しない。 */
  active: boolean;
}

export type Role = 'user' | 'assistant';

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
}

export interface Session {
  id: string;
  repId: string;
  customerId?: string;
  mode: Mode | null;
  title: string;
  messages: Message[];
  roleplay?: RoleplayConfig;
  createdAt: string;
  updatedAt: string;
}

/** 継続学習用の更新候補。保存は必ず人間の承認を挟む。 */
export interface CustomerUpdateProposal {
  customerId?: string;
  displayName?: string;
  fields: Array<{
    key: CustomerFieldKey;
    value: string;
    source: FactSource;
    evidence?: string;
  }>;
  openQuestions: string[];
}

export interface PatternUpdateProposal {
  axis: SkillAxis;
  category: TendencyCategory;
  text: string;
  basis: string;
  confidence: Confidence;
  dataCount: number;
  neededData?: string;
}

export interface NextActionProposal {
  purpose: string;
  action: string;
  due: string;
}

export interface KnowledgeProposal {
  type: KnowledgeType;
  title: string;
  body: string;
  tags: string[];
}

export interface UpdateProposal {
  id: string;
  sessionId: string;
  repId: string;
  status: 'pending' | 'applied' | 'rejected';
  customerUpdate?: CustomerUpdateProposal;
  patternUpdates: PatternUpdateProposal[];
  nextActions: NextActionProposal[];
  knowledgeCandidates: KnowledgeProposal[];
  createdAt: string;
  appliedAt?: string;
}
