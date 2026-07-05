import { useEffect, useRef, useState } from "react";
import useReducedMotion from "./useReducedMotion";

// Closest closed-form match to the CSS --ease-flex curve cubic-bezier(0.16, 1, 0.3, 1)
const easeOutExpo = (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p));

/**
 * Tween a numeric value toward `target`. Non-finite targets (null, "—" cases)
 * pass through untouched, as does everything under prefers-reduced-motion.
 * First mount animates from 0; later target changes animate from the
 * currently displayed value.
 */
export default function useCountUp(target, { duration = 400 } = {}) {
  const reduced = useReducedMotion();
  const isNumeric = typeof target === "number" && Number.isFinite(target);
  const skip = !isNumeric || reduced || duration <= 0;

  const [display, setDisplay] = useState(isNumeric ? 0 : target);
  const displayRef = useRef(isNumeric ? 0 : target);

  useEffect(() => {
    if (skip) {
      displayRef.current = target;
      return;
    }
    const from =
      typeof displayRef.current === "number" && Number.isFinite(displayRef.current)
        ? displayRef.current
        : 0;
    if (from === target) return;

    let rafId;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      const v = p >= 1 ? target : from + (target - from) * easeOutExpo(p);
      displayRef.current = v;
      setDisplay(v);
      if (p < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, skip, duration]);

  return skip ? target : display;
}
