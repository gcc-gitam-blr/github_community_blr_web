import { answer, search } from "../lib/epoch/ask";
let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };

ok("how much is VR -> 40 coins per session", /40 coins per session/.test(answer("how much is VR?")?.title ?? ""));
ok("recharge question mentions +20 once", /\+20/.test(answer("how do I recharge")?.title ?? ""));
ok("ticket question -> 398", /398/.test(answer("how many coins do I get for a ticket")?.title ?? ""));
ok("merch question links to shop", answer("do you have a hoodie")?.href === "/epoch/shop");
ok("date question links to the plan", answer("when is day 2")?.href === "/epoch#plan");
ok("Git Escape Challenge price", /60 coins/.test(answer("git escape challenge cost")?.title ?? ""));
ok("startup spotlight is free", /free/i.test(answer("startup spotlight price")?.title ?? ""));
ok("gibberish -> no answer", answer("zzqx") === null);
ok("search 'vr' finds the VR booth", search("vr").some((h) => h.id === "vr"));
ok("search 'hoodie' finds merch", search("hoodie").some((h) => h.kind === "merch"));
ok("empty search gives defaults", search("").length >= 3);
console.log(fails ? `\n${fails} FAILED` : "\nall ask checks passed"); process.exit(fails ? 1 : 0);
