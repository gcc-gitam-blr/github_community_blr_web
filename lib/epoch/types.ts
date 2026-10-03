export type Role = "attendee" | "volunteer" | "admin";

export interface Profile {
  id: string;
  handle: string; // GitHub username
  name: string;
  email: string;
  coins: number; // spendable balance
  earned: number; // lifetime earned from recharge points & awards — drives the leaderboard
  ticket: boolean; // true once the organiser desk has verified the ticket and credited coins
  role: Role;
  booth?: string | null; // volunteers: the one booth they run (set by an admin). None = the desk (check-in only)
  createdAt: string;
}

/** A booth with a QR code. `spend` booths charge per session (repeatable);
    `recharge` points pay out once per attendee. */
export type BoothKind = "spend" | "recharge" | "free";
export type BoothCategory = "Play" | "Make" | "Explore" | "Compete" | "Build";

export interface Booth {
  id: string;
  name: string;
  kind: BoothKind;
  category: BoothCategory;
  coins: number; // price per session (spend) or reward (recharge); 0 for free
  blurb: string;
  optional?: boolean; // marked "(optional)" in the plan
}

export interface Reward {
  id: string;
  name: string;
  cost: number;
  stock: number;
  blurb: string;
}

export interface Tx {
  id: string;
  userId: string;
  delta: number;
  reason: string;
  ref: string; // ticket | booth:<id> | reward:<id> | admin | reverse:<original ref>
  at: string;
  reverses?: string; // on a reversal: the id of the transaction it undoes
  reversedAt?: string; // on the original, once it's been reversed
}

/** One staff action, as the audit log records it (handles, not ids, so it reads on its own). */
export type AuditAction = "ticket" | "award" | "scan" | "reverse" | "role" | "booth";
export interface AuditEntry { id: string; at: string; actor: string; action: AuditAction; target: string | null; booth: string | null; amount: number | null; detail: string }

export interface JoinRequest { id: string; handle: string; email: string; firstEvent: string; createdAt: string }

export interface ClubMessage { id: string; kind: string; name: string; email: string; handle: string; message: string; createdAt: string }

export interface EventFeedback { id: string; event: string; rating: number; liked: string; improve: string; createdAt: string }

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface RegisterInput { handle: string; name: string; email: string }

/** Everything the UI needs. Two implementations: local (demo) and Supabase. */
export interface EpochStore {
  readonly mode: "local" | "supabase";
  me(): Promise<Profile | null>;
  register(input: RegisterInput): Promise<Result<{ profile: Profile }>>;
  signOut(): Promise<void>;
  scanBooth(boothId: string): Promise<Result<{ delta: number; balance: number; booth: Booth }>>;
  redeem(rewardId: string): Promise<Result<{ balance: number; reward: Reward }>>;
  history(): Promise<Tx[]>;
  leaderboard(limit?: number): Promise<Pick<Profile, "id" | "handle" | "name" | "earned">[]>;
  booths(): Promise<Booth[]>;
  rewards(): Promise<Reward[]>;
  /** staff: verify an attendee's ticket and credit coins (price × rate), once */
  issueTicket(userId: string): Promise<Result<{ profile: Profile }>>;
  /** admin: manual award/deduct, e.g. competition prizes */
  award(userId: string, delta: number, reason: string): Promise<Result<{ profile: Profile }>>;
  lookup(userId: string): Promise<Profile | null>;
  /** a booth's volunteer (or an admin) scans an attendee's wallet: charge the session, or pay a recharge point */
  staffScan(userId: string, boothId: string): Promise<Result<{ delta: number; balance: number; booth: Booth }>>;
  /** undo a transaction with its opposite; the rules are in lib/epoch/rules.ts */
  reverse(txId: string, reason: string): Promise<Result<{ delta: number; balance: number }>>;
  /** staff: an attendee's recent transactions they may act on (admins: all; a volunteer: their booth's) */
  staffHistory(userId: string): Promise<Tx[]>;
  /** staff: find attendees by name, GitHub username or email */
  search(q: string): Promise<Profile[]>;
  /** staff: everyone with a volunteer or admin role */
  staff(): Promise<Profile[]>;
  /** admin: give or take organiser access */
  setRole(handle: string, role: Role): Promise<Result>;
  /** admin: put a volunteer on a booth (null = back to the desk) */
  assignBooth(handle: string, booth: string | null): Promise<Result>;
  /** admin: who did what, newest first */
  audit(filter?: { action?: AuditAction; who?: string }): Promise<AuditEntry[]>;
  /** live mode: the outcome of coming back from "Sign in with GitHub" (back = just returned) */
  loginResult?(): Promise<{ back: boolean; error: string | null }>;
  /** demo mode only: unlock organiser tools with a shared code */
  elevate?(code: string): Promise<Result>;
  /** staff, live (Supabase) mode only: club sign-ups from the home page */
  joinRequests?(): Promise<JoinRequest[]>;
  /** staff, live (Supabase) mode only: anonymous event feedback */
  feedback?(): Promise<EventFeedback[]>;
  /** staff, live (Supabase) mode only: "Get involved" messages */
  messages?(): Promise<ClubMessage[]>;
  /** admin, live mode only: email every subscribed sign-up */
  broadcast?(subject: string, message: string): Promise<Result<{ sent: number; failed: number; total: number }>>;
}
