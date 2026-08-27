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
  RepProfile,
  Session,
  UpdateProposal,
} from './types';
import type { ExtractedUpdate } from './extract';

/** アプリ内で共有するデータ操作。API ルートからはこの層だけを呼ぶ。 */

const DEFAULT_REP_ID = 'rep-default';

/** 単一利用者を想定した既定の担当者。存在しなければ作成する。 */
export async function getDefaultRep(): Promise<RepProfile> {
  const existing = await findById('reps', DEFAULT_REP_ID);
  if (existing) return existing;
  return mutate('reps', (rows) => {
    const found = rows.find((r) => r.id === DEFAULT_REP_ID);
    if (found) return found;
    const rep: RepProfile = {
      id: DEFAULT_REP_ID,
      name: '営業担当者',
      experienceYears: 0,
      product: '',
      territory: '',
      note: '',
      tendencies: [],
      createdAt: now(),
      updatedAt: now(),
    };
    rows.push(rep);
    return rep;
  });
}

export async function updateRep(
  repId: string,
  patch: Partial<Pick<RepProfile, 'name' | 'experienceYears' | 'product' | 'territory' | 'note'>>,
): Promise<RepProfile | undefined> {
  return mutate('reps', (rows) => {
    const rep = rows.find((r) => r.id === repId);
    if (!rep) return undefined;
    Object.assign(rep, patch, { updatedAt: now() });
    return rep;
  });
}

export async function deleteTendency(repId: string, tendencyId: string): Promise<boolean> {
  return mutate('reps', (rows) => {
    const rep = rows.find((r) => r.id === repId);
    if (!rep) return false;
    const before = rep.tendencies.length;
    rep.tendencies = rep.tendencies.filter((t) => t.id !== tendencyId);
    rep.updatedAt = now();
    return rep.tendencies.length !== before;
  });
}

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

export async function listNextActions(repId: string): Promise<NextAction[]> {
  const rows = await readAll('nextActions');
  return rows
    .filter((a) => a.repId === repId)
    .sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due));
}

export async function addNextAction(input: Omit<NextAction, 'id' | 'createdAt'>): Promise<NextAction> {
  const action: NextAction = { ...input, id: newId(), createdAt: now() };
  await mutate('nextActions', (rows) => {
    rows.push(action);
  });
  return action;
}

export async function setNextActionDone(id: string, done: boolean): Promise<NextAction | undefined> {
  return mutate('nextActions', (rows) => {
    const action = rows.find((a) => a.id === id);
    if (!action) return undefined;
    action.done = done;
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
