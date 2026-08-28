import 'server-only';

import { findById, mutate, newId, now, readAll } from './store';
import type {
  Customer,
  CustomerField,
  CustomerFieldKey,
  Knowledge,
  Meeting,
  Message,
  NextAction,
  Session,
  UpdateProposal,
  User,
  UserRole,
} from './types';
import type { ExtractedUpdate } from './proposal';

/** アプリ内で共有するデータ操作。API ルートからはこの層だけを呼ぶ。 */

// --- 利用者 -----------------------------------------------------------------

export async function listUsers(): Promise<User[]> {
  const rows = await readAll('users');
  return rows.sort(
    (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'ja'),
  );
}

export async function getUser(id: string): Promise<User | undefined> {
  return findById('users', id);
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const rows = await readAll('users');
  return rows.find((row) => row.email === email);
}

export interface NewUser {
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  experienceYears?: number;
  product?: string;
  territory?: string;
  note?: string;
}

/**
 * 利用者を追加する。メールアドレスの重複はここで弾く。
 * 既存の担当者IDを引き継ぎたい場合は adoptId を渡す（初期セットアップ時の移行用）。
 */
export async function createUser(input: NewUser, adoptId?: string): Promise<User> {
  return mutate('users', (rows) => {
    if (rows.some((row) => row.email === input.email)) {
      throw new Error('このメールアドレスは既に登録されています。');
    }
    const user: User = {
      id: adoptId ?? newId(),
      email: input.email,
      passwordHash: input.passwordHash,
      name: input.name,
      role: input.role,
      active: true,
      experienceYears: input.experienceYears ?? 0,
      product: input.product ?? '',
      territory: input.territory ?? '',
      note: input.note ?? '',
      tendencies: [],
      createdAt: now(),
      updatedAt: now(),
    };
    rows.push(user);
    return user;
  });
}

export async function updateUser(
  id: string,
  patch: Partial<
    Pick<
      User,
      'name' | 'experienceYears' | 'product' | 'territory' | 'note' | 'role' | 'active' | 'passwordHash' | 'lastLoginAt'
    >
  >,
): Promise<User | undefined> {
  return mutate('users', (rows) => {
    const user = rows.find((row) => row.id === id);
    if (!user) return undefined;
    // undefined のキーで既存値を消さない。
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) (user as unknown as Record<string, unknown>)[key] = value;
    }
    user.updatedAt = now();
    return user;
  });
}

export async function deleteTendency(userId: string, tendencyId: string): Promise<boolean> {
  return mutate('users', (rows) => {
    const user = rows.find((row) => row.id === userId);
    if (!user) return false;
    const before = user.tendencies.length;
    user.tendencies = user.tendencies.filter((t) => t.id !== tendencyId);
    user.updatedAt = now();
    return user.tendencies.length !== before;
  });
}

// --- 顧客 -------------------------------------------------------------------

export async function listCustomers(): Promise<Customer[]> {
  const rows = await readAll('customers');
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  return findById('customers', id);
}

export async function createCustomer(displayName: string, repId: string): Promise<Customer> {
  const customer: Customer = {
    id: newId(),
    displayName: displayName || '名称未設定',
    fields: {},
    openQuestions: [],
    ownerRepId: repId,
    createdAt: now(),
    updatedAt: now(),
  };
  await mutate('customers', (rows) => {
    rows.push(customer);
  });
  return customer;
}

export async function updateCustomer(
  id: string,
  patch: { displayName?: string; fields?: Partial<Record<CustomerFieldKey, CustomerField>>; openQuestions?: string[] },
): Promise<Customer | undefined> {
  return mutate('customers', (rows) => {
    const customer = rows.find((c) => c.id === id);
    if (!customer) return undefined;
    if (patch.displayName !== undefined) customer.displayName = patch.displayName;
    if (patch.fields) customer.fields = { ...customer.fields, ...patch.fields };
    if (patch.openQuestions) customer.openQuestions = patch.openQuestions;
    customer.updatedAt = now();
    return customer;
  });
}

export async function deleteCustomer(id: string): Promise<void> {
  await mutate('customers', (rows) => {
    const index = rows.findIndex((c) => c.id === id);
    if (index >= 0) rows.splice(index, 1);
  });
  await mutate('meetings', (rows) => {
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (rows[i].customerId === id) rows.splice(i, 1);
    }
  });
}

export async function listMeetings(customerId?: string): Promise<Meeting[]> {
  const rows = await readAll('meetings');
  const filtered = customerId ? rows.filter((m) => m.customerId === customerId) : rows;
  return filtered.sort((a, b) => b.date.localeCompare(a.date));
}

export async function findMeeting(id: string): Promise<Meeting | undefined> {
  return findById('meetings', id);
}

export async function addMeeting(input: Omit<Meeting, 'id' | 'createdAt'>): Promise<Meeting> {
  const meeting: Meeting = { ...input, id: newId(), createdAt: now() };
  await mutate('meetings', (rows) => {
    rows.push(meeting);
  });
  return meeting;
}

export async function updateMeeting(
  id: string,
  patch: Partial<Omit<Meeting, 'id' | 'createdAt'>>,
): Promise<Meeting | undefined> {
  return mutate('meetings', (rows) => {
    const meeting = rows.find((m) => m.id === id);
    if (!meeting) return undefined;
    Object.assign(meeting, patch);
    return meeting;
  });
}

export async function deleteMeeting(id: string): Promise<void> {
  await mutate('meetings', (rows) => {
    const index = rows.findIndex((m) => m.id === id);
    if (index >= 0) rows.splice(index, 1);
  });
}

export async function listKnowledge(): Promise<Knowledge[]> {
  const rows = await readAll('knowledge');
  return rows.sort((a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title));
}

export async function findKnowledge(id: string): Promise<Knowledge | undefined> {
  return findById('knowledge', id);
}

export async function addKnowledge(input: Omit<Knowledge, 'id' | 'createdAt' | 'updatedAt'>): Promise<Knowledge> {
  const knowledge: Knowledge = { ...input, id: newId(), createdAt: now(), updatedAt: now() };
  await mutate('knowledge', (rows) => {
    rows.push(knowledge);
  });
  return knowledge;
}

export async function updateKnowledge(
  id: string,
  patch: Partial<Omit<Knowledge, 'id' | 'createdAt'>>,
): Promise<Knowledge | undefined> {
  return mutate('knowledge', (rows) => {
    const item = rows.find((k) => k.id === id);
    if (!item) return undefined;
    Object.assign(item, patch, { updatedAt: now() });
    return item;
  });
}

export async function deleteKnowledge(id: string): Promise<void> {
  await mutate('knowledge', (rows) => {
    const index = rows.findIndex((k) => k.id === id);
    if (index >= 0) rows.splice(index, 1);
  });
}

export async function listNextActions(repId?: string): Promise<NextAction[]> {
  const rows = await readAll('nextActions');
  const filtered = repId ? rows.filter((a) => a.repId === repId) : rows;
  return filtered.sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due));
}

export async function addNextAction(input: Omit<NextAction, 'id' | 'createdAt'>): Promise<NextAction> {
  const action: NextAction = { ...input, id: newId(), createdAt: now() };
  await mutate('nextActions', (rows) => {
    rows.push(action);
  });
  return action;
}

export async function findNextAction(id: string): Promise<NextAction | undefined> {
  return findById('nextActions', id);
}

export async function updateNextAction(
  id: string,
  patch: Partial<Omit<NextAction, 'id' | 'createdAt' | 'repId'>>,
): Promise<NextAction | undefined> {
  return mutate('nextActions', (rows) => {
    const action = rows.find((a) => a.id === id);
    if (!action) return undefined;
    Object.assign(action, patch);
    return action;
  });
}

export async function deleteNextAction(id: string): Promise<void> {
  await mutate('nextActions', (rows) => {
    const index = rows.findIndex((a) => a.id === id);
    if (index >= 0) rows.splice(index, 1);
  });
}

export async function listSessions(repId: string): Promise<Session[]> {
  const rows = await readAll('sessions');
  return rows
    .filter((s) => s.repId === repId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getSession(id: string): Promise<Session | undefined> {
  return findById('sessions', id);
}

export async function createSession(input: Partial<Session> & { repId: string }): Promise<Session> {
  const session: Session = {
    id: newId(),
    repId: input.repId,
    customerId: input.customerId,
    mode: input.mode ?? null,
    title: input.title ?? '新しい相談',
    messages: [],
    roleplay: input.roleplay,
    createdAt: now(),
    updatedAt: now(),
  };
  await mutate('sessions', (rows) => {
    rows.push(session);
  });
  return session;
}

export async function updateSession(
  id: string,
  patch: Partial<Pick<Session, 'title' | 'mode' | 'customerId' | 'roleplay'>>,
): Promise<Session | undefined> {
  return mutate('sessions', (rows) => {
    const session = rows.find((s) => s.id === id);
    if (!session) return undefined;
    Object.assign(session, patch, { updatedAt: now() });
    return session;
  });
}

export async function appendMessages(id: string, messages: Message[]): Promise<Session | undefined> {
  return mutate('sessions', (rows) => {
    const session = rows.find((s) => s.id === id);
    if (!session) return undefined;
    session.messages.push(...messages);
    session.updatedAt = now();
    return session;
  });
}

export async function deleteSession(id: string): Promise<void> {
  await mutate('sessions', (rows) => {
    const index = rows.findIndex((s) => s.id === id);
    if (index >= 0) rows.splice(index, 1);
  });
}

export function makeMessage(role: Message['role'], content: string): Message {
  return { id: newId(), role, content, createdAt: now() };
}

export async function listProposals(repId: string): Promise<UpdateProposal[]> {
  const rows = await readAll('proposals');
  return rows
    .filter((p) => p.repId === repId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveProposal(
  sessionId: string,
  repId: string,
  update: ExtractedUpdate,
): Promise<UpdateProposal> {
  const proposal: UpdateProposal = {
    id: newId(),
    sessionId,
    repId,
    status: 'pending',
    customerUpdate: update.customerUpdate,
    patternUpdates: update.patternUpdates,
    nextActions: update.nextActions,
    knowledgeCandidates: update.knowledgeCandidates,
    createdAt: now(),
  };
  await mutate('proposals', (rows) => {
    rows.push(proposal);
  });
  return proposal;
}

export async function setProposalStatus(
  id: string,
  status: UpdateProposal['status'],
): Promise<UpdateProposal | undefined> {
  return mutate('proposals', (rows) => {
    const proposal = rows.find((p) => p.id === id);
    if (!proposal) return undefined;
    proposal.status = status;
    if (status === 'applied') proposal.appliedAt = now();
    return proposal;
  });
}
