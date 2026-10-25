import { useEffect, useRef, useState } from "react";

// A figure that rolls to its new value when it changes (Apple: motion starts
// from the value on screen, never jumps). Feedback only: the first value
// appears at once, nothing animates on page load. Interruptible: a new
// target mid-roll continues from wherever the number is now.
const DURATION = 380;
const easeOut = (t) => 1 - (1 - t) ** 3; // smooth settle, no overshoot

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export default function useRollingNumber(target) {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  const frame = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(frame.current);
    const from = shownRef.current;
    const valid = Number.isFinite(target) && Number.isFinite(from);
    if (!valid || from === target || reducedMotion()) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / DURATION);
      const v = from + (target - from) * easeOut(t);
      shownRef.current = v;
      setShown(v);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else { shownRef.current = target; setShown(target); }
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target]);

  return shown;
}
