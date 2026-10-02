/* The team's member order: shuffled per visit, same people every time, and stable within one visit. */
import { shuffle } from "../components/site/Shuffled";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const xs = Array.from({ length: 12 }, (_, i) => i);
ok("seed 0 (the server) keeps the written order", shuffle(xs, 0).join() === xs.join());
ok("a shuffle has the same people", [...shuffle(xs, 42)].sort((a, b) => a - b).join() === xs.join());
ok("the same seed gives the same order (one visit agrees with itself)", shuffle(xs, 7).join() === shuffle(xs, 7).join());
const orders = new Set(Array.from({ length: 50 }, (_, s) => shuffle(xs, s + 1).join()));
ok("different visits see different orders", orders.size > 40);
const firsts = new Set(Array.from({ length: 200 }, (_, s) => shuffle(xs, s + 1)[0]));
ok("everyone gets a turn at the front", firsts.size === xs.length);
ok("the input isn't modified", xs.join() === Array.from({ length: 12 }, (_, i) => i).join());
if (fails) { console.log(`${fails} shuffle check(s) failed`); process.exit(1); }
console.log("all shuffle checks passed");
