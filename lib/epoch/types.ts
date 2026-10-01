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
  ref: string; // ticket | booth:<id> | reward:<id> | admin
  at: string;
}

export interface JoinRequest { id: string; handle: string; email: string; firstEvent: string; createdAt: string }

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
  /** staff: manual award/deduct, e.g. competition prizes or refunds */
  award(userId: string, delta: number, reason: string): Promise<Result<{ profile: Profile }>>;
  lookup(userId: string): Promise<Profile | null>;
  /** demo mode only: unlock organiser tools with a shared code */
  elevate?(code: string): Promise<Result>;
  /** staff, live (Supabase) mode only: club sign-ups from the home page */
  joinRequests?(): Promise<JoinRequest[]>;
  /** admin, live mode only: email every subscribed sign-up */
  broadcast?(subject: string, message: string): Promise<Result<{ sent: number; failed: number; total: number }>>;
}
