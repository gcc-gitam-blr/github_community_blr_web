"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PENDING_NAME } from "@/lib/epoch/pending";
import { atHandle } from "@/lib/handle";
import { Frame, Notice } from "./Frame";
import { btnInk, btnSoft, field, glass, label } from "./Bits";
import { useEpoch } from "./EpochProvider";
import { EPOCH, STARTER_COINS } from "@/lib/epoch/config";

const EMAIL_OK = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

/* Getting an Epoch wallet. On the live site: your name and email, then the code we email you (no GitHub account
   needed: lots of first-years don't have one yet); GitHub sign-in is still there for those who'd rather. In demo mode
   (no database) the wallet lives in this browser, so it asks for a handle, name and email instead. */
export function Register() {
  const { store, me, refresh } = useEpoch(); const router = useRouter();
  const [f, setF] = useState({ handle: "", name: "", email: "" });
  const [step, setStep] = useState<"details" | "code">("details");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ k: "err" | "info"; t: string } | null>(null); const [busy, setBusy] = useState(false);
  const remote = store?.mode === "supabase";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  // back from GitHub: show what went wrong, or finish creating the profile with the name typed before leaving
  useEffect(() => {
    if (!store?.loginResult) return;
    let live = true;
    store.loginResult().then(async ({ back, error }) => {
      if (!live || !back) return;
      if (error) return setMsg({ k: "err", t: error });
      let name = ""; try { name = sessionStorage.getItem(PENDING_NAME) ?? ""; sessionStorage.removeItem(PENDING_NAME); } catch { /* fill it in by hand */ }
      if (!name) return;
      setBusy(true); const r = await store.register({ handle: "", name, email: "" }); setBusy(false);
      if (!live) return;
      if (r.ok) { await refresh(); router.push("/epoch/wallet"); } else setMsg({ k: "err", t: r.error });
    });
    return () => { live = false; };
  }, [store, refresh, router]);

  // signed in by now (code or GitHub): make or find the profile, then the wallet
  const finish = async () => {
    const r = await store!.register({ handle: "", name: f.name.trim(), email: "" });
    if (!r.ok) { setBusy(false); return setMsg({ k: "err", t: r.error }); }
    await refresh(); router.push("/epoch/wallet");
  };

  const sendCode = async () => {
    if (!f.name.trim()) return setMsg({ k: "err", t: "Pick a display name first." });
    if (!EMAIL_OK(f.email)) return setMsg({ k: "err", t: "That email doesn't look right." });
    setBusy(true); setMsg(null);
    const { sendEmailCode } = await import("@/lib/epoch/supabase-store");
    const r = await sendEmailCode(f.email);
    setBusy(false);
    if (!r.ok) return setMsg({ k: "err", t: r.error });
    setCode(""); setStep("code");
    setMsg({ k: "info", t: `We emailed a code to ${f.email.trim()}. It can take a minute; check spam if it doesn't arrive.` });
  };

  const checkCode = async () => {
    if (!/^\d{6,10}$/.test(code.replace(/\s+/g, ""))) return setMsg({ k: "err", t: "Type the code from the email: just the digits." });
    setBusy(true); setMsg(null);
    const { verifyEmailCode } = await import("@/lib/epoch/supabase-store");
    const r = await verifyEmailCode(f.email, code);
    if (!r.ok) { setBusy(false); return setMsg({ k: "err", t: r.error }); }
    await finish();
  };

  const withGitHub = async () => {
    if (!store) return;
    if (!f.name.trim()) return setMsg({ k: "err", t: "Pick a display name first." });
    setBusy(true); setMsg(null);
    const r = await store.register({ handle: "", name: f.name, email: "" }); // goes to GitHub and comes back here
    setBusy(false);
    if (!r.ok) return setMsg({ k: r.error.startsWith("Redirecting") ? "info" : "err", t: r.error });
    await refresh(); router.push("/epoch/wallet");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!store) return;
    if (remote) return step === "details" ? sendCode() : checkCode();
    if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(f.handle.replace(/^@/, "")) || !f.name.trim() || !EMAIL_OK(f.email)) return setMsg({ k: "err", t: "Fill in a valid GitHub handle, name and email." });
    setBusy(true); setMsg(null);
    const r = await store.register(f);
    setBusy(false);
    if (!r.ok) return setMsg({ k: "err", t: r.error });
    await refresh(); router.push("/epoch/wallet");
  };

  const who = me ? atHandle(me.handle) || me.name : "";
  return (
    <Frame title="Get your ticket." sub={`Create a profile, then pay at the registration desk and show your QR. ${STARTER_COINS} ${EPOCH.currency} land in your wallet.`}>
      <form onSubmit={submit} noValidate className={`${glass} mx-auto max-w-[560px] space-y-5 p-6 sm:space-y-6 sm:p-10`}>
        {me && <Notice kind="ok">You&apos;re already in as {who}. <Link className="underline" href="/epoch/wallet">Open wallet</Link></Notice>}
        {!remote && <label className="block"><span className={`${label} mb-2 block`}>GitHub handle</span><input className={field} value={f.handle} onChange={set("handle")} placeholder="@your-handle" autoComplete="off" /></label>}
        {step === "details" ? <>
          <label className="block"><span className={`${label} mb-2 block`}>Name</span><input className={field} value={f.name} onChange={set("name")} placeholder="Ada Lovelace" autoComplete="name" /></label>
          <label className="block"><span className={`${label} mb-2 block`}>Email</span><input className={field} type="email" value={f.email} onChange={set("email")} placeholder="you@gitam.in" autoComplete="email" inputMode="email" /></label>
        </> : (
          <label className="block"><span className={`${label} mb-2 block`}>Code from the email</span>
            <input className={`${field} font-mono tracking-[0.3em]`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" autoComplete="one-time-code" inputMode="numeric" autoFocus />
          </label>
        )}
        {msg && <Notice kind={msg.k}>{msg.t}</Notice>}
        <button disabled={busy || !store} className={`${btnInk} w-full`}>{busy ? "Working…" : !remote ? "Create my profile" : step === "details" ? "Email me a code" : "Sign in"}</button>
        {remote && step === "code" && (
          <p className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[14px]">
            <button type="button" disabled={busy} onClick={() => void sendCode()} className="text-mute underline underline-offset-4 hover:text-ink">Send a new code</button>
            <button type="button" disabled={busy} onClick={() => { setStep("details"); setMsg(null); }} className="text-mute underline underline-offset-4 hover:text-ink">Use a different email</button>
          </p>
        )}
        {remote && step === "details" && <>
          <p className="flex items-center gap-3 text-[13px] text-mute" aria-hidden><span className="h-px flex-1 bg-ink/10" />or<span className="h-px flex-1 bg-ink/10" /></p>
          <button type="button" disabled={busy || !store} onClick={() => void withGitHub()} className={`${btnSoft} w-full`}>Continue with GitHub</button>
        </>}
        <p className="text-sm text-mute">{remote ? "One wallet per email address. Been here before? Use the same email. Organisers sign in with GitHub." : "Demo mode: your wallet lives in this browser."} Ticket price is a working figure until the final one is announced.</p>
      </form>
    </Frame>
  );
}
