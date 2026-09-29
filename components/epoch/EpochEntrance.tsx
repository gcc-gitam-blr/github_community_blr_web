"use client";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

/** The other half of the transformation: the black disc from the club site
    retracts, revealing the fest. Plays once per page load. */
export function EpochEntrance() {
  const [done, setDone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDone(true), 1800); return () => clearTimeout(t); }, []); // never let the curtain stick
  if (done) return null;
  return (
    <motion.div aria-hidden className="pointer-events-none fixed inset-0 z-[200] bg-night"
      initial={{ clipPath: "circle(150vmax at 50% 50%)" }} animate={{ clipPath: "circle(0px at 50% 30%)" }}
      transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1], delay: 0.1 }} onAnimationComplete={() => setDone(true)} />
  );
}
