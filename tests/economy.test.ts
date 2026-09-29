// Runs the demo store against a fake localStorage to check the economy rules from the plan.
const mem: Record<string,string> = {};
(globalThis as any).localStorage = { getItem:(k:string)=>mem[k]??null, setItem:(k:string,v:string)=>{mem[k]=v}, removeItem:(k:string)=>{delete mem[k]} };
import { localStore as s } from "../lib/epoch/local-store";
import { STARTER_COINS, EPOCH } from "../lib/epoch/config";
let fails = 0; const ok = (name:string, cond:boolean) => { console.log((cond?"PASS":"FAIL")+"  "+name); if(!cond) fails++; };

(async () => {
  // organiser
  await s.register({handle:"org",name:"Org",email:"o@x.io"}); await s.elevate!(EPOCH.organiserCode);
  const orgId = (await s.me())!.id;
  // attendee
  const a = await s.register({handle:"ada",name:"Ada",email:"a@x.io"}); if(!a.ok) throw 0;
  const ada = a.profile.id;
  ok("new attendee starts with 0 coins, no ticket", a.profile.coins===0 && !a.profile.ticket);
  ok("cannot scan a booth before ticket is verified", !(await s.scanBooth("vr")).ok);
  ok("attendee cannot issue tickets", !(await s.issueTicket(ada)).ok);

  await s.register({handle:"org",name:"Org",email:"o@x.io"}); // log back in as organiser
  const t = await s.issueTicket(ada); ok(`ticket credits ${STARTER_COINS} coins (₹${EPOCH.ticketPriceINR} × ${EPOCH.coinsPerINR})`, t.ok && t.profile.coins===398);
  ok("ticket can only be issued once", !(await s.issueTicket(ada)).ok);

  await s.register({handle:"ada",name:"Ada",email:"a@x.io"});
  const vr = await s.scanBooth("vr"); ok("VR costs 40 -> 358", vr.ok && vr.delta===-40 && vr.balance===358);
  const vr2 = await s.scanBooth("vr"); ok("immediate second VR scan is blocked (double-scan guard)", !vr2.ok);
  const r1 = await s.scanBooth("recharge-trivia"); ok("recharge point pays +20", r1.ok && r1.delta===20 && r1.balance===378);
  const r2 = await s.scanBooth("recharge-trivia"); ok("recharge point works only ONCE per person", !r2.ok);
  const r3 = await s.scanBooth("recharge-puzzle"); ok("a different recharge point still works", r3.ok);
  ok("free booth has no coin QR", !(await s.scanBooth("startup")).ok);
  ok("unknown booth rejected", !(await s.scanBooth("nope")).ok);
  const h = await s.history(); ok("ledger records ticket, VR and 2 recharges (4 rows)", h.length===4);
  const lb = await s.leaderboard(); ok("leaderboard ranks by earned (recharges only, not the ticket)", lb[0]?.handle==="ada" && lb[0].earned===40);
  // overspend
  for (const id of ["git-escape","retro","octocat-splash"]) await s.scanBooth(id);
  const big = await s.redeem("hoodie"); ok("cannot buy hoodie without enough coins", !big.ok || big.balance>=0);
  console.log(fails? `\n${fails} FAILED` : "\nall economy checks passed");
  process.exit(fails?1:0);
})();
