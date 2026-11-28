import React, { useEffect, useRef, useState } from "react";

/**
 * Interactive High-DPI HTML5 Canvas MTR Timeline showing up to 5 minutes (300s)
 * of rolling destination RTT, packet loss spikes, VoIP MOS, and ECMP/route shifts.
 */
const MtrTimelineCanvas = React.memo(function MtrTimelineCanvas({
  points = [],
  uiTheme = "dark",
  lang = "ar",
  onClear,
}) {
  const canvasRef = useRef(null);
  const [hoverIdx, setHoverIdx] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const isAr = lang === "ar";
  const isLight = uiTheme === "light";

  useEffect(() => {
    if (collapsed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return;

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;
    const padL = 44;
    const padR = 14;
    const padT = 14;
    const padB = 22;
    const plotW = Math.max(10, W - padL - padR);
    const plotH = Math.max(10, H - padT - padB);

    ctx.clearRect(0, 0, W, H);

    const gridColor = isLight ? "rgba(15,23,42,0.08)" : "rgba(148,163,184,0.14)";
    const axisTextColor = isLight ? "#475569" : "#cbd5e1";

    const maxRttRaw = points.reduce(
      (mx, p) => Math.max(mx, p.avgMs || 0, p.worstMs || 0),
      10
    );
    const maxRtt = Math.max(20, Math.ceil((maxRttRaw * 1.15) / 10) * 10);

    ctx.font = '600 11px "JetBrains Mono", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= 4; i++) {
      const yVal = (maxRtt * (4 - i)) / 4;
      const y = Math.round(padT + (plotH * i) / 4) + 0.5;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();

      ctx.fillStyle = axisTextColor;
      ctx.fillText(`${Math.round(yVal)}ms`, padL - 6, y);
    }

    if (points.length === 0) {
      return;
    }

    const totalSlots = Math.max(points.length - 1, 1);
    const xOf = (idx) => padL + (idx / totalSlots) * plotW;
    const yOf = (ms) => {
      const clamped = Math.max(0, Math.min(maxRtt, ms || 0));
      return padT + plotH - (clamped / maxRtt) * plotH;
    };

    // Draw packet loss bars from bottom baseline
    const barW = Math.max(2, Math.min(8, plotW / Math.max(points.length, 20)));
    for (let i = 0; i < points.length; i++) {
      const loss = points[i].lossPercent || 0;
      if (loss > 0) {
        const x = xOf(i);
        const h = Math.max(4, Math.min(plotH, (loss / 100) * plotH));
        ctx.fillStyle =
          loss > 5
            ? isLight
              ? "rgba(220,38,38,0.70)"
              : "rgba(239,68,68,0.65)"
            : isLight
            ? "rgba(217,119,6,0.62)"
            : "rgba(245,158,11,0.55)";
        ctx.fillRect(x - barW / 2, padT + plotH - h, barW, h);
      }
    }

    // Draw Worst-to-0 subtle jitter envelope if >= 2 points
    if (points.length >= 2) {
      const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
      grad.addColorStop(0, isLight ? "rgba(2,132,199,0.20)" : "rgba(56,189,248,0.28)");
      grad.addColorStop(1, isLight ? "rgba(2,132,199,0.01)" : "rgba(56,189,248,0.01)");
      ctx.beginPath();
      ctx.moveTo(xOf(0), padT + plotH);
      for (let i = 0; i < points.length; i++) {
        ctx.lineTo(xOf(i), yOf(points[i].avgMs));
      }
      ctx.lineTo(xOf(points.length - 1), padT + plotH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Dashed upper jitter/worst peak trace
      ctx.save();
      ctx.strokeStyle = isLight ? "rgba(147,51,234,0.60)" : "rgba(168,85,247,0.45)";
      ctx.lineWidth = isLight ? 1.25 : 1.1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const px = xOf(i);
        const py = yOf(points[i].worstMs || points[i].avgMs);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Primary Avg RTT Curve
    ctx.strokeStyle = isLight ? "#0284c7" : "#38bdf8";
    ctx.lineWidth = isLight ? 2.2 : 2;
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const px = xOf(i);
      const py = yOf(points[i].avgMs);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Route / ECMP shift vertical markers
    for (let i = 0; i < points.length; i++) {
      if (points[i].routeShift) {
        const px = xOf(i);
        ctx.strokeStyle = isLight ? "rgba(126,34,206,0.75)" : "rgba(192,132,252,0.85)";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(px, padT);
        ctx.lineTo(px, padT + plotH);
        ctx.stroke();

        ctx.fillStyle = isLight ? "#9333ea" : "#c084fc";
        ctx.beginPath();
        ctx.arc(px, padT + 4, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Time labels along bottom axis
    ctx.fillStyle = axisTextColor;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(points[0].ts || "", padL, padT + plotH + 6);
    if (points.length > 2) {
      ctx.textAlign = "center";
      ctx.fillText(
        points[Math.floor(points.length / 2)].ts || "",
        padL + plotW / 2,
        padT + plotH + 6
      );
    }
    ctx.textAlign = "right";
    ctx.fillText(points[points.length - 1].ts || "", padL + plotW, padT + plotH + 6);

    // Interactive Hover Crosshair
    if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < points.length) {
      const p = points[hoverIdx];
      const hx = xOf(hoverIdx);
      const hy = yOf(p.avgMs);

      ctx.strokeStyle = isLight ? "rgba(15,23,42,0.28)" : "rgba(226,232,240,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, padT);
      ctx.lineTo(hx, padT + plotH);
      ctx.stroke();

      ctx.fillStyle = isLight ? "#0284c7" : "#38bdf8";
      ctx.beginPath();
      ctx.arc(hx, hy, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [points, hoverIdx, uiTheme, collapsed, isAr, isLight]);

  const handleMouseMove = (e) => {
    if (!canvasRef.current || points.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const padL = 44;
    const padR = 14;
    const plotW = Math.max(10, rect.width - padL - padR);
    const relX = Math.max(0, Math.min(plotW, e.clientX - rect.left - padL));
    const idx = Math.round((relX / plotW) * Math.max(points.length - 1, 0));
    setHoverIdx(idx);
  };

  const hovered =
    hoverIdx !== null && hoverIdx >= 0 && hoverIdx < points.length
      ? points[hoverIdx]
      : null;

  return (
    <section className="masar-stagger-3 relative bg-slate-900/60 border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl">
      <div className="px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-900/90">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-200">
            {isAr
              ? "الخط الزمني التفاعلي طويل المدى (5 دقائق)"
              : "Interactive Long-Window Timeline (5m Rolling)"}
          </h3>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30" dir="ltr">
            {points.length} / 300s
          </span>
          {hovered && (
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200" dir="ltr">
              {hovered.ts} • Avg {hovered.avgMs.toFixed(1)}ms • Loss {hovered.lossPercent.toFixed(1)}%
              {hovered.mosScore > 0 ? ` • MOS ${hovered.mosScore.toFixed(2)}` : ""}
              {hovered.routeShift ? " • ECMP/Route Shift" : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <span className={`w-2.5 h-0.5 inline-block ${isLight ? "bg-sky-600" : "bg-sky-400"}`} />
            {isAr ? "المتوسط ms" : "Avg ms"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <span className={`w-2.5 h-0.5 inline-block ${isLight ? "bg-purple-600" : "bg-purple-400"}`} />
            {isAr ? "ذروة التذبذب" : "Peak RTT"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <span className={`w-2 h-2 rounded-full inline-block ${isLight ? "bg-purple-600" : "bg-purple-400"}`} />
            {isAr ? "تغيّر المسار" : "Route Shift"}
          </span>
          {points.length > 0 && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-700/80 text-slate-300 hover:text-white text-[11px]"
            >
              {isAr ? "مسح" : "Clear"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-700/80 text-slate-300 hover:text-white text-[11px]"
          >
            {collapsed ? (isAr ? "إظهار" : "Expand") : (isAr ? "طي" : "Collapse")}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className={isLight ? "p-3 bg-[#f8fafc]" : "p-3 bg-slate-950/35"}>
          <div className="relative">
            <canvas
              ref={canvasRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverIdx(null)}
              className="w-full h-36 cursor-crosshair block"
            />
            {points.length === 0 && (
              <div
                dir={isAr ? "rtl" : "ltr"}
                className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center"
              >
                <span
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-sans font-medium border backdrop-blur-sm ${
                    isLight
                      ? "bg-white/85 border-slate-200 text-slate-700 shadow-sm"
                      : "bg-slate-900/85 border-slate-700/70 text-slate-200 masar-text-glow-sky shadow-sm"
                  }`}
                >
                  {isAr
                    ? "سيبدأ رسم الخط الزمني تلقائياً فور بدء الفحص"
                    : "Timeline graph starts automatically when tracing begins"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
});

export default MtrTimelineCanvas;
