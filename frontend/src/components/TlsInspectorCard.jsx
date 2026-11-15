import React from "react";

/**
 * Lazy-loaded TLS/SSL Certificate & Handshake Inspector Card for the Port & Service Diagnostics tab.
 */
const TlsInspectorCard = React.memo(function TlsInspectorCard({
  host,
  tlsPort,
  onChangeTlsPort,
  tlsLoading,
  tlsReport,
  onInspectTls,
  lang = "ar",
}) {
  const isAr = lang === "ar";
  const expiryColor = !tlsReport
    ? ""
    : tlsReport.daysRemaining <= 0 || !tlsReport.verified
    ? "bg-red-500/15 text-red-300 border-red-500/35"
    : tlsReport.daysRemaining <= 30
    ? "bg-amber-500/15 text-amber-300 border-amber-500/35"
    : "bg-emerald-500/15 text-emerald-300 border-emerald-500/35";

  return (
    <div className="masar-stagger-2 relative overflow-hidden bg-slate-900/60 border border-slate-800/90 rounded-2xl p-6 space-y-4 shadow-xl">
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>{isAr ? "فاحص شهادات TLS / SSL وتفاوض التشفير" : "TLS / SSL Certificate & Handshake Inspector"}</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/35">
              X.509 / TLS 1.3
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAr
              ? "يفحص إصدار بروتوكول التشفير وسلسلة الثقة والأسماء المشمولة (SANs) والأيام المتبقية لصلاحية الشهادة."
              : "Verifies negotiated TLS protocol, cipher suite, certificate chain trust, SANs, and expiry countdown."}
          </p>
        </div>

        <form onSubmit={onInspectTls} className="flex items-center gap-2 shrink-0" dir="ltr">
          <input
            type="number"
            min="1"
            max="65535"
            value={tlsPort}
            onChange={(e) => onChangeTlsPort(Number(e.target.value) || 443)}
            className="masar-well w-20 bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none rounded-xl px-2.5 py-1.5 text-sm font-mono text-center"
            title="TLS Port"
          />
          <button
            type="submit"
            disabled={tlsLoading}
            className="masar-cta-sheen masar-action-btn px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 transition disabled:opacity-50"
          >
            {tlsLoading
              ? isAr
                ? "جارٍ فحص TLS..."
                : "Inspecting TLS..."
              : isAr
              ? `فحص شهادة ${host || "المضيف"}`
              : "Inspect TLS Cert"}
          </button>
        </form>
      </div>

      {tlsReport && (
        <div className="relative z-10 masar-well rounded-xl bg-slate-950/75 border border-slate-800/90 p-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
            <div className="flex flex-wrap items-center gap-2" dir="ltr">
              <span className="font-mono font-bold text-slate-100">
                {tlsReport.host}:{tlsReport.port}
              </span>
              <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-mono font-bold">
                {tlsReport.protocolVersion}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700/80 font-mono">
                {tlsReport.cipherSuite}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 text-indigo-300 border border-slate-700/80 font-mono">
                {tlsReport.handshakeMs.toFixed(1)} ms
              </span>
            </div>

            <span className={`px-2.5 py-0.5 rounded-full border font-bold text-[11px] ${expiryColor}`}>
              {tlsReport.verified
                ? isAr
                  ? `موثوق • متبقي ${tlsReport.daysRemaining} يوم`
                  : `Verified • ${tlsReport.daysRemaining}d left`
                : isAr
                ? `تنبيه ثقة/انتهاء (${tlsReport.daysRemaining} يوم)`
                : `Untrusted/Warning (${tlsReport.daysRemaining}d)`}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] uppercase text-slate-400 font-semibold">
                {isAr ? "الجهة الصادرة (Issuer)" : "Issuer"}
              </div>
              <div className="text-slate-200 font-mono truncate">{tlsReport.issuer || "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-slate-400 font-semibold">
                {isAr ? "الموضوع (Subject CN)" : "Subject CN"}
              </div>
              <div className="text-slate-200 font-mono truncate">{tlsReport.subject || "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-slate-400 font-semibold">
                {isAr ? "فترة الصلاحية (UTC)" : "Validity (UTC)"}
              </div>
              <div className="text-slate-200 font-mono" dir="ltr">
                {tlsReport.notBefore} → {tlsReport.notAfter}
              </div>
            </div>
          </div>

          {tlsReport.verifyError && (
            <div className="rounded-lg bg-red-950/40 border border-red-500/40 px-3 py-2 text-red-200 font-mono text-[11px] break-all">
              {tlsReport.verifyError}
            </div>
          )}

          {Array.isArray(tlsReport.sans) && tlsReport.sans.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1" dir="ltr">
              <span className="text-[10px] text-slate-500 uppercase mr-1">SANs:</span>
              {tlsReport.sans.slice(0, 8).map((san, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px]"
                >
                  {san}
                </span>
              ))}
              {tlsReport.sans.length > 8 && (
                <span className="text-[11px] text-slate-500">
                  +{tlsReport.sans.length - 8} more
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default TlsInspectorCard;
