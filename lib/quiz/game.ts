import type { Quiz } from "./parse";
import { isSticker, openRoom, points, stickerFor, type Msg, type Phase, type Result, type Room, type RoomState } from "./room";

/* The host's side of a live quiz, outside React: who's playing, who answered what and when, the scores.
   The host screen reads it through useSyncExternalStore; every change makes a new snapshot. */

export type Player = { id: string; name: string; sticker: string; score: number; streak: number; gained: number; right: number; joined: number };
export type Round = { counts: number[]; answered: number };
export type Saved = { code: string; quiz: Quiz; phase: Phase; index: number; players: Player[]; kicked: string[]; rounds?: Round[]; started?: number };
export type Snapshot = {
  phase: Phase; index: number; live: boolean; deadline: number;
  players: Player[]; // best first
  answered: number; answeredIds: string[]; counts: number[];
  before: string[] | null; // the order before this round's points, so the board can slide into the new one
};

export const SAVE = "quiz:host";

export class HostGame {
  readonly code: string; readonly quiz: Quiz;
  private phase: Phase; private index: number;
  private players: Map<string, Player>; private kicked: Set<string>;
  private answers = new Map<string, { choice: number; ms: number }>();
  private shownAt = 0; private deadline = 0; private seq = 0; private live = false;
  private before: string[] | null = null;
  private rounds: Round[]; readonly started: number;
  private room: Room | null = null;
  private pending?: ReturnType<typeof setTimeout>;
  private subs = new Set<() => void>();
  private snap!: Snapshot;

  constructor(s: Saved, private store: Pick<Storage, "setItem"> | null = typeof localStorage === "undefined" ? null : localStorage) {
    this.code = s.code; this.quiz = s.quiz; this.phase = s.phase; this.index = s.index;
    this.players = new Map(s.players.map((p) => [p.id, { ...p, sticker: p.sticker || stickerFor(p.id) }])); this.kicked = new Set(s.kicked);
    this.rounds = s.rounds ?? []; this.started = s.started ?? Date.now();
    // after a refresh mid-question, that question gets its full time again
    if (this.phase === "question") this.ask(this.index, false); else this.changed(false);
  }

  subscribe = (fn: () => void) => { this.subs.add(fn); return () => { this.subs.delete(fn); }; };
  get = () => this.snap;

  /** Opens the room and starts the clock; returns the cleanup. */
  connect() {
    let gone = false;
    void openRoom(this.code, "host", (m) => this.hear(m), (ok) => { if (gone) return; this.live = ok; if (ok) this.send(); this.changed(false); })
      .then((r) => { if (gone) r.close(); else { this.room = r; this.send(); } });
    const clock = setInterval(() => { if (this.phase === "question" && Date.now() >= this.deadline) this.reveal(); }, 200);
    return () => { gone = true; clearInterval(clock); clearTimeout(this.pending); this.room?.close(); this.room = null; };
  }

  /** Space on the host's keyboard: lobby → question → reveal → board → next question … → end. */
  next() {
    if (this.phase === "lobby") { if (this.players.size) this.ask(0); }
    else if (this.phase === "question") this.reveal();
    else if (this.phase === "reveal") { this.phase = this.index + 1 < this.quiz.questions.length ? "board" : "end"; this.changed(); }
    else if (this.phase === "board") this.ask(this.index + 1);
  }

  kick(id: string) { this.kicked.add(id); this.players.delete(id); this.answers.delete(id); this.changed(); }

  hear(m: Msg) {
    if (m.t === "hello") {
      if (this.kicked.has(m.id) || typeof m.id !== "string") return;
      if (!this.players.has(m.id)) {
        const want = String(m.name ?? "").replace(/\s+/g, " ").trim().slice(0, 20) || "anon";
        const taken = new Set([...this.players.values()].map((p) => p.name.toLowerCase()));
        let name = want;
        for (let k = 2; taken.has(name.toLowerCase()); k++) name = `${want.slice(0, 17)} ${k}`;
        this.players.set(m.id, { id: m.id, name, sticker: isSticker(m.sticker) ? m.sticker : stickerFor(m.id), score: 0, streak: 0, gained: 0, right: 0, joined: Date.now() });
        this.changed(false);
      }
      this.send(true); // a burst of people joining is answered with one update, not one each
    } else if (m.t === "answer") {
      if (this.phase !== "question" || m.index !== this.index || !this.players.has(m.id) || this.answers.has(m.id)) return;
      if (!Number.isInteger(m.choice) || m.choice < 0 || m.choice >= this.quiz.questions[this.index].options.length) return;
      this.answers.set(m.id, { choice: m.choice, ms: Date.now() - this.shownAt });
      this.changed(false);
      if (this.answers.size >= this.players.size) setTimeout(() => this.reveal(), 600); // everyone's in: don't make them wait
    }
  }

  private ask(index: number, broadcast = true) {
    this.answers.clear();
    this.players.forEach((p) => { p.gained = 0; });
    this.index = index; this.phase = "question";
    this.shownAt = Date.now(); this.deadline = this.shownAt + this.quiz.questions[index].time * 1000;
    this.changed(broadcast);
  }

  reveal() {
    if (this.phase !== "question") return;
    const q = this.quiz.questions[this.index];
    this.before = this.ranked().map((p) => p.id);
    this.players.forEach((p) => {
      const a = this.answers.get(p.id);
      if (a && a.choice === q.answer) { p.streak++; p.right++; p.gained = points(a.ms, q.time, p.streak); p.score += p.gained; }
      else { p.streak = 0; p.gained = 0; }
    });
    this.rounds[this.index] = { counts: this.tally(), answered: this.answers.size };
    this.phase = "reveal"; this.changed();
  }

  private ranked() { return [...this.players.values()].sort((a, b) => b.score - a.score || a.joined - b.joined); }
  private tally() {
    const c = this.quiz.questions[this.index].options.map(() => 0);
    this.answers.forEach((a) => { c[a.choice]++; });
    return c;
  }

  /** What every phone sees: the question (never its answer until the reveal) and each player's own line. */
  state(): RoomState {
    const { phase, index } = this, q = this.quiz.questions[index];
    const results: Record<string, Result> = {}, people: Record<string, [string, string]> = {};
    this.ranked().forEach((p, i) => {
      const a = this.answers.get(p.id), open = phase === "lobby" || phase === "question";
      results[p.id] = [p.score, i + 1, p.gained, open || !a ? -1 : a.choice === q.answer ? 1 : 0, p.streak];
      people[p.id] = [p.name, p.sticker];
    });
    return {
      phase, title: this.quiz.title, index, total: this.quiz.questions.length, seq: ++this.seq, results, people,
      ...(phase === "question" || phase === "reveal" ? { question: { q: q.q, options: q.options, time: q.time } } : {}),
      ...(phase === "question" ? { remaining: Math.max(0, this.deadline - Date.now()) } : {}),
      ...(phase === "reveal" ? { answer: q.answer, counts: this.tally() } : {}),
    };
  }

  private send(soon = false) {
    clearTimeout(this.pending);
    if (soon) { this.pending = setTimeout(() => this.send(), 350); return; }
    this.room?.send({ t: "state", state: this.state() });
  }

  private changed(broadcast = true) {
    this.snap = { phase: this.phase, index: this.index, live: this.live, deadline: this.deadline, players: this.ranked().map((p) => ({ ...p })), answered: this.answers.size, answeredIds: [...this.answers.keys()], counts: this.tally(), before: this.before };
    if (broadcast) this.send();
    try { this.store?.setItem(SAVE, JSON.stringify({ code: this.code, quiz: this.quiz, phase: this.phase, index: this.index, players: [...this.players.values()], kicked: [...this.kicked], rounds: this.rounds, started: this.started } satisfies Saved)); }
    catch { /* a refresh just starts over */ }
    this.subs.forEach((f) => f());
  }

  /** The finished quiz, for the host's history: the final table and how each question went. */
  summary(): Run {
    return {
      id: `${this.code}-${this.started}`, code: this.code, title: this.quiz.title, at: new Date(this.started).toISOString(),
      players: this.ranked().map((p) => ({ name: p.name, sticker: p.sticker, score: p.score, right: p.right })),
      questions: this.quiz.questions.map((q, i) => ({ q: q.q, options: q.options, answer: q.answer, counts: this.rounds[i]?.counts ?? q.options.map(() => 0), answered: this.rounds[i]?.answered ?? 0 })),
    };
  }
}

export type Run = {
  id: string; code: string; title: string; at: string;
  players: { name: string; sticker: string; score: number; right: number }[];
  questions: { q: string; options: string[]; answer: number; counts: number[]; answered: number }[];
};
