import React, { useEffect, useRef } from "react";
import lottie from "lottie-web/build/player/lottie_light";
import {
  LOTTIE_SUCCESS,
  LOTTIE_LOADING,
  LOTTIE_ERROR,
  LOTTIE_WARNING,
} from "./lottieAssets.js";

const ASSET_MAP = {
  success: { data: LOTTIE_SUCCESS, loop: false },
  loading: { data: LOTTIE_LOADING, loop: true },
  error: { data: LOTTIE_ERROR, loop: false },
  warning: { data: LOTTIE_WARNING, loop: true },
};

/**
 * Lightweight 60fps Lottie status icon (success | loading | error | warning).
 * Automatically freezes on final frame if user prefers reduced motion.
 */
export default function StatusLottie({ variant = "loading", size = 24, className = "" }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const config = ASSET_MAP[variant] || ASSET_MAP.loading;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    const anim = lottie.loadAnimation({
      container: el,
      renderer: "svg",
      loop: reduced ? false : config.loop,
      autoplay: !reduced,
      animationData: JSON.parse(JSON.stringify(config.data)),
      rendererSettings: {
        progressiveLoad: false,
        preserveAspectRatio: "xMidYMid meet",
      },
    });

    if (reduced) {
      // Jump straight to resting/completed frame cleanly
      const total = anim.totalFrames || 30;
      anim.goToAndStop(Math.max(0, total - 1), true);
    }

    return () => {
      anim.destroy();
    };
  }, [variant]);

  return (
    <span
      ref={containerRef}
      style={{ width: size, height: size }}
      className={`inline-flex items-center justify-center shrink-0 pointer-events-none select-none ${className}`}
      aria-hidden="true"
    />
  );
}
