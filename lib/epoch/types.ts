export type Role = "attendee" | "volunteer" | "admin";

export interface Profile {
  id: string;
  handle: string; // GitHub username
  name: string;
  email: string;
  coins: number; // spendable balance
  earned: number; // lifetime earned — drives the leaderboard
  role: Role;
  createdAt: string;
}

export interface Stall {
  id: string;
  name: string;
  kind: "earn" | "spend";
  coins: number; // reward (earn) or price (spend)
  blurb: string;
  zone: string;
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
  ref: string; // stall:<id> | reward:<id> | signup | admin
  at: string;
}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface RegisterInput { handle: string; name: string; email: string }

/** Everything the UI needs. Two implementations: local (demo) and Supabase. */
export interface EpochStore {
  readonly mode: "local" | "supabase";
  me(): Promise<Profile | null>;
  register(input: RegisterInput): Promise<Result<{ profile: Profile }>>;
  signOut(): Promise<void>;
  scanStall(stallId: string): Promise<Result<{ delta: number; balance: number; stall: Stall }>>;
  redeem(rewardId: string): Promise<Result<{ balance: number; reward: Reward }>>;
  history(): Promise<Tx[]>;
  leaderboard(limit?: number): Promise<Pick<Profile, "id" | "handle" | "name" | "earned">[]>;
  stalls(): Promise<Stall[]>;
  rewards(): Promise<Reward[]>;
  /** volunteers/admins: award coins to an attendee by scanning their wallet QR */
  award(userId: string, delta: number, reason: string): Promise<Result<{ profile: Profile }>>;
  lookup(userId: string): Promise<Profile | null>;
  /** demo mode only: unlock organiser tools with a shared code */
  elevate?(code: string): Promise<Result>;
}
