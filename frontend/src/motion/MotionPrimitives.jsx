import React, { useEffect, useRef, useState } from "react";
import StatusLottie from "./StatusLottie.jsx";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

/**
 * TabStage — Exit-before-enter choreography (old tab exits ~110ms cleanly before new tab enters)
 * inside an overflow-clipped boundary without layout jumps, scrollbar flicker, or edge wobble.
 */
export function TabStage({ activeKey, onStageChange, renderTab }) {
  const [renderedKey, setRenderedKey] = useState(activeKey);
  const [phase, setPhase] = useState("enter"); // "enter" | "exit"
  const timerRef = useRef(null);
  const phaseRef = useRef("enter");
  const onStageChangeRef = useRef(onStageChange);
  onStageChangeRef.current = onStageChange;

  useEffect(() => {
    if (activeKey === renderedKey) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (phaseRef.current !== "enter") {
        phaseRef.current = "enter";
        setPhase("enter");
        onStageChangeRef.current?.(activeKey, "enter");
      }
      return;
    }

    if (prefersReducedMotion()) {
      phaseRef.current = "enter";
      setRenderedKey(activeKey);
      setPhase("enter");
      onStageChangeRef.current?.(activeKey, "enter");
      return;
    }

    phaseRef.current = "exit";
    setPhase("exit");
    onStageChangeRef.current?.(renderedKey, "exit");
    if (timerRef.current) clearTimeout(timerRef.current);

    // Wait strictly for exit fade (110ms) before swapping tab content cleanly
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (typeof document !== "undefined") {
        const scrollRoot = document.getElementById("masar-scroll-root");
        if (scrollRoot && scrollRoot.scrollTop > 0) {
          scrollRoot.scrollTo(0, 0);
        }
      }
      phaseRef.current = "enter";
      setRenderedKey(activeKey);
      setPhase("enter");
      onStageChangeRef.current?.(activeKey, "enter");
    }, 115);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeKey, renderedKey]);

  return (
    <div className="flex-1 flex flex-col overflow-x-clip">
      <div
        key={renderedKey}
        className={
          phase === "exit"
            ? "masar-page-exit flex-1 flex flex-col"
            : "masar-page-enter flex-1 flex flex-col"
        }
      >
        {renderTab(renderedKey)}
      </div>
    </div>
  );
}

/**
 * AnimatedModal — Smooth Apple-glass blurred backdrop + spring panel enter AND graceful exit before unmount.
 */
export function AnimatedModal({
  open,
  onClose,
  backdropClassName = "fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6",
  panelClassName = "",
  children,
}) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      if (prefersReducedMotion()) {
        setMounted(false);
        setClosing(false);
      } else {
        setClosing(true);
        const timer = setTimeout(() => {
          setMounted(false);
          setClosing(false);
        }, 165);
        return () => clearTimeout(timer);
      }
    }
  }, [open, mounted]);

  if (!mounted) return null;

  return (
    <div
      className={`${backdropClassName} ${
        closing ? "masar-modal-backdrop-out" : "masar-modal-backdrop-in"
      }`}
      onClick={onClose}
    >
      <div
        className={`${panelClassName} ${
          closing ? "masar-modal-panel-out" : "masar-modal-panel-in"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * GoDataLoader — Sleek Apple-glass loader pill/card displayed while Go backend runs active telemetry.
 */
export function GoDataLoader({ label, sublabel = "" }) {
  return (
    <div className="masar-page-enter inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-sky-500/10 border border-sky-500/25 backdrop-blur-xl shadow-lg shadow-sky-500/5">
      <StatusLottie variant="loading" size={24} />
      <div className="flex flex-col text-start">
        <span className="text-xs font-bold text-sky-300 leading-tight">{label}</span>
        {sublabel ? (
          <span className="text-[10px] text-slate-400 leading-tight mt-0.5">{sublabel}</span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * MorphLabel — Smoothly interpolates inline width & opacity between compact and full labels.
 */
export function MorphLabel({ compact, compactText, fullText, className = "" }) {
  return (
    <span className="inline-flex items-center">
      <span
        className="masar-collapse-track"
        data-open={compact ? "true" : "false"}
        aria-hidden={!compact}
      >
        <span className={className}>{compactText}</span>
      </span>
      <span
        className="masar-collapse-track"
        data-open={compact ? "false" : "true"}
        aria-hidden={compact}
      >
        <span className={className}>{fullText}</span>
      </span>
    </span>
  );
}
