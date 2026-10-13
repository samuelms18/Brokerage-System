// In-memory store standing in for PostgreSQL in the prototype. Kept on
// globalThis so route handlers and server components share one copy in dev.
// Data resets when the server restarts.

import * as seed from "./seed";
import type { Refund, Assignment, AuditEntry, Broker, BrokerageDisclosure, BrokerageOverride, BrokeragePolicy, BrokerageRecord, Lead, Owner, Payment, Property, Student, User, Visit } from "./model";

export interface Session { token: string; userId: string; expiresAt: number }
export interface OtpChallenge { id: string; phone: string; code: string; attempts: number; expiresAt: number; consumed: boolean }

export interface Store {
  users: Map<string, User>;
  students: Map<string, Student>;
  brokers: Map<string, Broker>;
  owners: Map<string, Owner>;
  properties: Property[];
  sessions: Map<string, Session>;
  otps: Map<string, OtpChallenge>;
  leads: Lead[];
  visits: Visit[];
  shortlists: Map<string, Set<string>>; // studentId -> property ids
  idempotency: Map<string, { at: number; body: unknown }>;
  assignments: Assignment[];
  policies: BrokeragePolicy[];
  overrides: BrokerageOverride[];
  disclosures: BrokerageDisclosure[];
  brokerages: BrokerageRecord[];
  payments: Payment[];
  refunds: Refund[];
  audit: AuditEntry[];
  seq: { lead: number; assignment: number; receipt: number };
}

function fresh(): Store {
  const clone = <T>(v: T): T => structuredClone(v);
  return {
    users: new Map(seed.staffUsers.map((u) => [u.id, clone(u)])),
    students: new Map(),
    brokers: new Map(seed.brokers.map((b) => [b.userId, clone(b)])),
    owners: new Map(seed.owners.map((o) => [o.id, clone(o)])),
    properties: clone(seed.properties),
    sessions: new Map(),
    otps: new Map(),
    leads: [],
    visits: [],
    shortlists: new Map(),
    idempotency: new Map(),
    assignments: [],
    policies: clone(seed.brokeragePolicies),
    overrides: [],
    disclosures: [],
    brokerages: [],
    payments: [],
    refunds: [],
    audit: [],
    seq: { lead: 20480, assignment: 3300, receipt: 0 },
  };
}

const g = globalThis as unknown as { __brokerageStore?: Store };

export function store(): Store {
  if (!g.__brokerageStore) g.__brokerageStore = fresh();
  return g.__brokerageStore;
}

/** Tests only. */
export function resetStore(): Store {
  g.__brokerageStore = fresh();
  return g.__brokerageStore;
}

export const lookups = { areas: seed.areas, colleges: seed.colleges, amenities: seed.amenities };

export function audit(actorId: string | null, action: string, entityType: string, entityId: string, metadata?: Record<string, unknown>) {
  store().audit.push({ at: Date.now(), actorId, action, entityType, entityId, metadata });
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
