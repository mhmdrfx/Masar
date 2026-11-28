import React from "react";

function formatArabicCount(n, singular, dual, pluralFew, pluralMany) {
  const count = Number(n) || 0;
  if (count === 0) return `0 ${singular}`;
  if (count === 1) return `${singular} (${count})`;
  if (count === 2) return `${dual} (${count})`;
  if (count >= 3 && count <= 10) return `${count} ${pluralFew}`;
  return `${count} ${pluralMany}`;
}

function formatEnglishCount(n, singular, plural) {
  const count = Number(n) || 0;
  return `${count} ${count === 1 ? singular : plural}`;
}

export function buildBrowserDetailedReport(snap, lang = "ar", localizedHealth = null, customVersion = "") {
  const isAr = lang === "ar";
  const hops = snap?.hops || [];
  const health = snap?.health || { score: 100, severity: "idle", status: "", detail: "" };
  const verdictTitle = localizedHealth?.status || health.status || "";
  const verdictDetail = localizedHealth?.detail || health.detail || "";
  const verStr = customVersion ? `v${customVersion}` : "v1.x";

  const hop1 = hops.find((h) => h.hop === 1) || null;
  const ispHop =
    hops.find((h) => (h.hop === 2 || h.hop === 3) && h.received > 0) ||
    hops.find((h) => h.hop === 2 || h.hop === 3) ||
    null;
  const destHop =
    hops.find((h) => h.reachedDest) || (hops.length > 0 ? hops[hops.length - 1] : null);
  const silentCount = hops.filter(
    (h) => !h.ip || (h.received === 0 && h.lossPercent === 0)
  ).length;

  const readiness = evaluateReadinessFront(destHop, isAr);
  const nowStr = new Date().toLocaleString(isAr ? "ar-SA" : "en-US");

  if (isAr) {
    const hopsText = formatArabicCount(
      hops.length,
      "قفزة واحدة",
      "قفزتان",
      "قفزات",
      "قفزة"
    );
    const lines = [
      "================================================================================================================",
      `                    مسار (الإصدار ${customVersion || "الرسمي"}) — التقرير التشخيصي الشامل ومفسر البيانات المستخرجة                        `,
      "================================================================================================================",
      "[أولاً] الملخص التنفيذي للفحص",
      `• الهدف المفحوص          : ${snap?.target || "—"} (${snap?.resolvedIp || "—"})`,
      `• وقت استخراج التقرير    : ${nowStr} (آخر تحديث: ${snap?.updatedAt || "—"})`,
      `• مؤشر جودة الاتصال      : ${health.score}%`,
      `• التشخيص الذكي التلقائي : ${verdictTitle}`,
      `• التفسير الفني المفصل   : ${verdictDetail}`,
      "----------------------------------------------------------------------------------------------------------------",
      "[ثانياً] تحليل مقاطع المسار وعزل مصدر الخلل",
      hop1 && hop1.received > 0
        ? `• الراوتر المحلي (القفزة 1) : ${hop1.ip} — المتوسط ${hop1.avgMs.toFixed(1)} ms | الفقد ${hop1.lossPercent.toFixed(1)}% | التذبذب ${hop1.jitterMs.toFixed(1)} ms`
        : "• الراوتر المحلي (القفزة 1) : صامت ICMP أو لم يستجب مباشرة (لا يؤثر طالما الوجهة سليمة)",
      ispHop && ispHop.received > 0
        ? `• بوابة المزود (القفزة ${ispHop.hop}) : ${ispHop.ip} — المتوسط ${ispHop.avgMs.toFixed(1)} ms | الفقد ${ispHop.lossPercent.toFixed(1)}% | التذبذب ${ispHop.jitterMs.toFixed(1)} ms`
        : "• بوابة المزود              : عبور مباشر نحو الشبكة الدولية",
      destHop && destHop.received > 0
        ? `• الوجهة النهائية (#${destHop.hop})      : ${destHop.ip} — المتوسط ${destHop.avgMs.toFixed(1)} ms (الأفضل ${destHop.bestMs.toFixed(1)} / الأسوأ ${destHop.worstMs.toFixed(1)} ms) | الفقد ${destHop.lossPercent.toFixed(1)}%`
        : "• الوجهة النهائية           : لا توجد ردود مستلمة بعد",
      `• إجمالي القفزات المكتشفة   : ${hopsText} (منها ${silentCount} عقد عبور صامتة تتجاهل ICMP بشكل طبيعي)`,
      "----------------------------------------------------------------------------------------------------------------",
      "[ثالثاً] كفاءة الاتصال للاستخدامات العملية",
      `• الألعاب التنافسية         : ${readiness.gaming.badge} — ${readiness.gaming.desc}`,
      `• المكالمات والاجتماعات     : ${readiness.calls.badge} — ${readiness.calls.desc}`,
      `• البث فائق الدقة 4K        : ${readiness.streaming.badge} — ${readiness.streaming.desc}`,
      "----------------------------------------------------------------------------------------------------------------",
      "[رابعاً] سجل قراءات القفزات التفصيلي",
    ];

    for (const h of hops) {
      const host = h.hostname ? `${h.ip} (${h.hostname})` : h.ip || "* * * (عقدة صامتة ICMP)";
      const ev = evaluateSingleHopFront(h, true);
      lines.push(
        `  - القفزة #${String(h.hop).padStart(2, "0")}: ${host} | الفقد: ${h.lossPercent.toFixed(1)}% (${h.sent}/${h.received}) | الحالي: ${h.lastMs.toFixed(1)} ms | المتوسط: ${h.avgMs.toFixed(1)} ms | التذبذب: ${h.jitterMs.toFixed(1)} ms | الحالة: ${ev.status}`
      );
    }

    lines.push(
      "----------------------------------------------------------------------------------------------------------------",
      "[خامساً] دليل شرح البيانات المستخرجة",
      "• نسبة الفقد %        : من 0% إلى 2% سليم تماماً | من 2% إلى 5% تحذير متوسط | أكثر من 5% خلل يسبب تقطيعاً واضحاً.",
      "• متوسط الاستجابة     : زمن الذهاب والعودة بالمللي ثانية؛ أقل من 35 مللي ثانية ممتاز، ومن 35 إلى 85 مللي ثانية جيد جداً دولياً.",
      "• تباين الاستجابة     : مدى استقرار زمن الاستجابة بين كل نبضة وأخرى؛ أقل من 10 مللي ثانية مثالي للألعاب والصوت.",
      "• العقد الصامتة ICMP  : راوتر عبور يتجاهل رسائل الفحص أمنياً؛ لا يمثل أي عطل طالما استجابت الوجهة النهائية دون فقد.",
      "================================================================================================================"
    );
    return lines.join("\n");
  }

  const hopsEn = formatEnglishCount(hops.length, "Hop", "Hops");
  const silentEn = formatEnglishCount(silentCount, "harmless ICMP-filtered transit hop", "harmless ICMP-filtered transit hops");

  const lines = [
    "================================================================================================================",
    `                 MASAR ${verStr} — EXECUTIVE NETWORK DIAGNOSTIC REPORT & EXTRACTED METRIC GUIDE                      `,
    "================================================================================================================",
    "[1] EXECUTIVE SUMMARY",
    `• Target Endpoint        : ${snap?.target || "—"} (${snap?.resolvedIp || "—"})`,
    `• Generated At           : ${nowStr} (Last Sample: ${snap?.updatedAt || "—"})`,
    `• Connection Health Score: ${health.score}% [${(health.severity || "idle").toUpperCase()}]`,
    `• Automated Verdict      : ${verdictTitle}`,
    `• Technical Detail       : ${verdictDetail}`,
    "----------------------------------------------------------------------------------------------------------------",
    "[2] SEGMENT ISOLATION ANALYSIS",
    hop1 && hop1.received > 0
      ? `• Local Gateway (Hop 1)  : ${hop1.ip} — Avg ${hop1.avgMs.toFixed(1)} ms | Loss ${hop1.lossPercent.toFixed(1)}% | Jitter ${hop1.jitterMs.toFixed(1)} ms`
      : "• Local Gateway (Hop 1)  : ICMP silent or awaiting reply",
    ispHop && ispHop.received > 0
      ? `• ISP Gateway (Hop ${ispHop.hop})    : ${ispHop.ip} — Avg ${ispHop.avgMs.toFixed(1)} ms | Loss ${ispHop.lossPercent.toFixed(1)}% | Jitter ${ispHop.jitterMs.toFixed(1)} ms`
      : "• ISP Gateway            : Direct transit routing",
    destHop && destHop.received > 0
      ? `• Final Target (Hop ${destHop.hop})   : ${destHop.ip} — Avg ${destHop.avgMs.toFixed(1)} ms (Best ${destHop.bestMs.toFixed(1)} / Worst ${destHop.worstMs.toFixed(1)} ms) | Loss ${destHop.lossPercent.toFixed(1)}%`
      : "• Final Target           : Awaiting probe responses",
    `• Total Discovered Hops  : ${hopsEn} (${silentEn})`,
    "----------------------------------------------------------------------------------------------------------------",
    "[3] APPLICATION READINESS",
    `• Competitive Gaming     : ${readiness.gaming.badge} — ${readiness.gaming.desc}`,
    `• VoIP & Video Calls     : ${readiness.calls.badge} — ${readiness.calls.desc}`,
    `• 4K Streaming & Cloud   : ${readiness.streaming.badge} — ${readiness.streaming.desc}`,
    "----------------------------------------------------------------------------------------------------------------",
    "[4] HOP-BY-HOP TELEMETRY TABLE",
    "Hop  | IP / Hostname                  | Loss %  | Sent/Recv  | Last    | Avg     | Jitter  | Verdict",
    "-----+--------------------------------+---------+------------+---------+---------+---------+----------------------------",
  ];

  for (const h of hops) {
    const host = h.hostname ? `${h.ip} (${h.hostname})` : h.ip || "* * * (ICMP Silent)";
    const ev = evaluateSingleHopFront(h, false);
    lines.push(
      `${String(h.hop).padEnd(4)} | ${host.slice(0, 30).padEnd(30)} | ${h.lossPercent
        .toFixed(1)
        .padStart(5)}%  | ${`${h.sent}/${h.received}`.padEnd(10)} | ${h.lastMs
        .toFixed(1)
        .padStart(5)}ms | ${h.avgMs.toFixed(1).padStart(5)}ms | ${h.jitterMs
        .toFixed(1)
        .padStart(5)}ms | ${ev.status}`
    );
  }

  lines.push(
    "----------------------------------------------------------------------------------------------------------------",
    "[5] EXTRACTED METRIC GUIDE",
    "• Loss %      : 0%–2% Healthy | 2%–5% Warning | >5% Critical packet drops causing stalls and lag.",
    "• Avg RTT (ms): Round-Trip Time in milliseconds (<35 ms Optimal, 35–85 ms Good international, >150 ms High).",
    "• Jitter (ms) : Mean packet-to-packet RTT variance (<10 ms ideal for gaming and real-time voice).",
    "• ICMP Silent : Transit router filtering ICMP Time-Exceeded replies; harmless when destination loss is 0%.",
    "================================================================================================================"
  );
  return lines.join("\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildBrowserCSVReport(snap) {
  const hops = snap?.hops || [];
  const rows = [
    ["Hop", "IP", "Hostname", "ASN", "Location", "AltIPs", "LossPercent", "Sent", "Received", "LastMs", "AvgMs", "BestMs", "WorstMs", "JitterMs"],
    ...hops.map((h) => [
      h.hop,
      h.ip || "*",
      h.hostname || "",
      h.asn || "",
      h.location || "",
      Array.isArray(h.altIps) ? h.altIps.join(";") : "",
      Number(h.lossPercent || 0).toFixed(2),
      h.sent || 0,
      h.received || 0,
      Number(h.lastMs || 0).toFixed(2),
      Number(h.avgMs || 0).toFixed(2),
      Number(h.bestMs || 0).toFixed(2),
      Number(h.worstMs || 0).toFixed(2),
      Number(h.jitterMs || 0).toFixed(2),
    ]),
  ];
  return rows
    .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
}

export function buildBrowserHTMLReport(snap, lang = "ar", localizedHealth = null, customVersion = "") {
  const isAr = lang === "ar";
  const ver = customVersion ? `v${String(customVersion).replace(/^v/i, "")}` : "v1.0.0";
  const hops = snap?.hops || [];
  const health = localizedHealth || snap?.health || {};
  const proto = snap?.protocol || (snap?.ipVersion === 6 ? "ICMPv6" : "ICMPv4");
  const rowsHtml = hops
    .map((h) => {
      const ev = evaluateSingleHopFront(h, isAr);
      const ecmp = Array.isArray(h.altIps) && h.altIps.length > 0 ? ` (+${h.altIps.length} ECMP)` : "";
      return `<tr>
        <td>${h.hop}</td>
        <td dir="ltr" class="mono">${escapeHtml(h.ip || "* * *")}${escapeHtml(ecmp)}${h.hostname ? `<br><small>${escapeHtml(h.hostname)}</small>` : ""}</td>
        <td>${escapeHtml([h.asn, h.location].filter(Boolean).join(" • ") || "—")}</td>
        <td dir="ltr" class="mono">${Number(h.lossPercent || 0).toFixed(1)}%</td>
        <td dir="ltr" class="mono">${h.sent || 0}/${h.received || 0}</td>
        <td dir="ltr" class="mono">${Number(h.lastMs || 0).toFixed(1)} ms</td>
        <td dir="ltr" class="mono">${Number(h.avgMs || 0).toFixed(1)} ms</td>
        <td dir="ltr" class="mono">${Number(h.jitterMs || 0).toFixed(1)} ms</td>
        <td>${escapeHtml(ev.status)}</td>
      </tr>`;
    })
    .join("");
  return `<!DOCTYPE html>
<html lang="${isAr ? "ar" : "en"}" dir="${isAr ? "rtl" : "ltr"}">
<head>
<meta charset="UTF-8" />
<title>Masar Report — ${escapeHtml(snap?.target || "Diagnostic")}</title>
<style>
  body { font-family: "IBM Plex Sans Arabic", "Inter", system-ui, sans-serif; margin: 28px; color: #0f172a; background: #f8fafc; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 18px; }
  h1 { margin: 0 0 8px; font-size: 20px; }
  .meta { font-size: 13px; color: #475569; }
  table { width: 100%; border-collapse: collapse; background: #fff; font-size: 12px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; text-align: start; }
  th { background: #f1f5f9; font-weight: 700; }
  .mono { font-family: "JetBrains Mono", Consolas, monospace; }
  @media print { body { background: #fff; margin: 12px; } }
</style>
</head>
<body>
  <div class="card">
    <h1>${isAr ? "تقرير مسار التشخيصي" : "Masar Network Diagnostic Report"} (${escapeHtml(ver)})</h1>
    <div class="meta">${isAr ? "الهدف" : "Target"}: <span class="mono" dir="ltr">${escapeHtml(snap?.target || "—")}</span> • ${escapeHtml(proto)} • ${escapeHtml(snap?.updatedAt || "")}</div>
    <p><strong>${escapeHtml(health.status || "")}</strong> — ${escapeHtml(health.detail || "")}</p>
  </div>
  <div class="card">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>${isAr ? "العنوان / المضيف" : "IP / Hostname"}</th>
          <th>Geo / ASN</th>
          <th>${isAr ? "الفقد" : "Loss %"}</th>
          <th>${isAr ? "المرسل/المستلم" : "Sent/Recv"}</th>
          <th>${isAr ? "اللحظي" : "Last"}</th>
          <th>${isAr ? "المتوسط" : "Avg"}</th>
          <th>${isAr ? "التذبذب" : "Jitter"}</th>
          <th>${isAr ? "التقييم" : "Verdict"}</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
</body>
</html>`;
}

function evaluateSingleHopFront(h, isAr) {
  if (!h || !h.ip || (h.received === 0 && h.lossPercent === 0)) {
    return {
      tone: "slate",
      status: isAr ? "صامت ICMP — فلترة طبيعية" : "ICMP Silent — Harmless",
    };
  }
  if (h.lossPercent > 5.0) {
    return {
      tone: "red",
      status: isAr ? "فقد حزم مرتفع (أكثر من 5%)" : "Critical Loss (>5%)",
    };
  }
  if (h.lossPercent > 2.0 || h.jitterMs > 20.0) {
    return {
      tone: "amber",
      status: isAr ? "تذبذب متوسط يحتاج إلى مراقبة" : "Moderate Jitter / Loss",
    };
  }
  return {
    tone: "emerald",
    status: isAr ? "مستقر وسليم تماماً" : "Healthy & Stable",
  };
}

export function evaluateReadinessFront(destHop, isAr) {
  if (!destHop || destHop.received === 0) {
    return isAr
      ? {
          gaming: {
            tone: "slate",
            badge: "بانتظار القراءات",
            desc: "ابدأ فحص المسار لقياس كفاءة زمن الاستجابة وثباتها للألعاب التنافسية.",
          },
          calls: {
            tone: "slate",
            badge: "بانتظار القراءات",
            desc: "ابدأ فحص المسار لتقييم ثبات الصوت والفيديو اللحظي.",
          },
          streaming: {
            tone: "slate",
            badge: "بانتظار القراءات",
            desc: "ابدأ فحص المسار لتحليل استقرار نقل البيانات وجودة البث.",
          },
        }
      : {
          gaming: {
            tone: "slate",
            badge: "Awaiting Telemetry",
            desc: "Start a trace to evaluate RTT and jitter for online gaming.",
          },
          calls: {
            tone: "slate",
            badge: "Awaiting Telemetry",
            desc: "Start a trace to measure voice and video stability.",
          },
          streaming: {
            tone: "slate",
            badge: "Awaiting Telemetry",
            desc: "Start a trace to verify packet delivery stability.",
          },
        };
  }

  const loss = destHop.lossPercent || 0;
  const avg = destHop.avgMs || 0;
  const jit = destHop.jitterMs || 0;

  let gaming, calls, streaming;

  if (loss <= 0.5 && avg <= 45 && jit <= 6) {
    gaming = isAr
      ? {
          tone: "emerald",
          badge: "ممتاز (احترافي)",
          desc: `استجابة فورية (${avg.toFixed(1)} مللي ثانية) وتباين شبه معدوم (${jit.toFixed(1)} مللي ثانية) دون أي تقطيع.`,
        }
      : {
          tone: "emerald",
          badge: "Pro Grade",
          desc: `Ultra-responsive ${avg.toFixed(1)} ms RTT and ${jit.toFixed(1)} ms jitter with crisp hit registration.`,
        };
  } else if (loss <= 2.0 && avg <= 95 && jit <= 15) {
    gaming = isAr
      ? {
          tone: "sky",
          badge: "جيد ومستقر",
          desc: `مناسب للعب عبر الخوادم الإقليمية والدولية (${avg.toFixed(1)} مللي ثانية) باستقرار جيد.`,
        }
      : {
          tone: "sky",
          badge: "Playable & Stable",
          desc: `Solid international routing (${avg.toFixed(1)} ms RTT, ${loss.toFixed(1)}% loss).`,
        };
  } else {
    gaming = isAr
      ? {
          tone: "red",
          badge: "غير مستقر للألعاب",
          desc: `يوجد فقد (${loss.toFixed(1)}%) أو تذبذب (${jit.toFixed(1)} مللي ثانية) قد يسبب تأخراً أو ارتداداً أثناء اللعب.`,
        }
      : {
          tone: "red",
          badge: "Lag / Rubber-Banding Risk",
          desc: `Elevated loss (${loss.toFixed(1)}%) or jitter (${jit.toFixed(1)} ms) impacts real-time sync.`,
        };
  }

  if (loss <= 1.0 && avg <= 120 && jit <= 18) {
    calls = isAr
      ? {
          tone: "emerald",
          badge: "نقاء عالٍ جداً",
          desc: "ثبات ممتاز لمكالمات الصوت والاجتماعات المرئية المباشرة دون تقطيع صوتي.",
        }
      : {
          tone: "emerald",
          badge: "Crystal Clear",
          desc: "Ideal packet pacing for Zoom, Teams, Discord, and VoIP calls.",
        };
  } else if (loss <= 3.0 && jit <= 30) {
    calls = isAr
      ? {
          tone: "amber",
          badge: "مقبول مع تذبذب طفيف",
          desc: "يعمل بصورة عامة مع احتمالية ظهور تقطعات لحظية قصيرة عند ضغط الشبكة.",
        }
      : {
          tone: "amber",
          badge: "Moderate",
          desc: "Usable for calls, though brief audio jitter may occur under load.",
        };
  } else {
    calls = isAr
      ? {
          tone: "red",
          badge: "تقطيع صوتي محتمل",
          desc: "ارتفاع الفقد أو التذبذب يؤدي إلى تأخر أو تقطع ملحوظ في الصوت والصورة.",
        }
      : {
          tone: "red",
          badge: "Audio Drop Risk",
          desc: "High packet loss or jitter will degrade real-time audio and video streams.",
        };
  }

  if (loss <= 1.5) {
    streaming = isAr
      ? {
          tone: "emerald",
          badge: "مثالي للبث 4K",
          desc: "نقل حزم نقي ومستقر يدعم البث فائق الدقة والتخزين السحابي بسلاسة تامة.",
        }
      : {
          tone: "emerald",
          badge: "Optimal 4K Ready",
          desc: "Clean packet delivery ensures smooth buffering and rapid TCP throughput.",
        };
  } else if (loss <= 4.0) {
    streaming = isAr
      ? {
          tone: "amber",
          badge: "جيد مع إعادة إرسال",
          desc: "يعمل البث بصورة جيدة، لكن فقد الحزم يقلل من أقصى سرعة فعلية لتحميل الملفات الكبيرة.",
        }
      : {
          tone: "amber",
          badge: "Fair (TCP Retries)",
          desc: "Streaming works via buffering, but packet drops throttle peak download speed.",
        };
  } else {
    streaming = isAr
      ? {
          tone: "red",
          badge: "بطء وتوقف متكرر",
          desc: "فقد الحزم المرتفع يجبر التطبيقات على إعادة طلب البيانات ويخفض دقة العرض تلقائياً.",
        }
      : {
          tone: "red",
          badge: "Buffering Likely",
          desc: "Significant packet loss forces heavy TCP retransmissions and quality drops.",
        };
  }

  return { gaming, calls, streaming };
}

export function ExportToolbarCapsule({
  lang,
  hopsCount,
  copyFeedback,
  exportFeedback,
  onCopySummary,
  onExportReport,
  onOpenStudio,
}) {
  const isAr = lang === "ar";
  const hasData = hopsCount > 0;

  const labels = isAr
    ? {
        copy: "نسخ التقرير",
        copied: "تم النسخ",
        pdf: "تقرير PDF",
        saved: "تم الحفظ",
        guide: "شرح البيانات والتقارير",
        needTraceTip: "ابدأ فحص المسار أولاً لاستخراج وتصدير القراءات الحية",
        copyTip: "نسخ التقرير التشخيصي المفصل مع شرح المؤشرات إلى الحافظة",
        pdfTip: "تصدير التقرير الرسمي المنسق للطباعة والحفظ بصيغة PDF",
        jsonTip: "تصدير كافة البيانات المستخرجة والمنحنيات بصيغة JSON",
        csvTip: "تصدير جدول القراءات وشرح المصطلحات لبرنامج Excel بصيغة CSV",
        guideTip: "فتح نافذة التحليل التفصيلي وشرح جميع البيانات المستخرجة",
      }
    : {
        copy: "Copy Summary",
        copied: "Copied",
        pdf: "PDF Report",
        saved: "Saved",
        guide: "Data & Report Guide",
        needTraceTip: "Start a trace first to export live extracted telemetry",
        copyTip: "Copy full executive diagnostic summary & metric guide to clipboard",
        pdfTip: "Export official printable A4/Letter HTML/PDF diagnostic report",
        jsonTip: "Export structured telemetry, 60s history & field glossary as JSON",
        csvTip: "Export Excel-ready UTF-8 CSV table with hop interpretations",
        guideTip: "Open interactive breakdown & complete guide to all extracted data",
      };

  const exportItems = [
    {
      fmt: "html",
      label: labels.pdf,
      tip: hasData ? labels.pdfTip : labels.needTraceTip,
      accent: true,
      icon: (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="13" y2="17" />
        </svg>
      ),
    },
    {
      fmt: "json",
      label: "JSON",
      tip: hasData ? labels.jsonTip : labels.needTraceTip,
      mono: true,
      icon: (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1" />
          <path d="M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1" />
        </svg>
      ),
    },
    {
      fmt: "csv",
      label: "CSV",
      tip: hasData ? labels.csvTip : labels.needTraceTip,
      mono: true,
      icon: (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      ),
    },
  ];

  return (
    <div className="masar-well flex flex-wrap items-center bg-slate-950 border border-slate-700/80 rounded-xl p-1 gap-1 shadow-sm">
      {/* 1. Copy Summary Button */}
      <button
        type="button"
        onClick={onCopySummary}
        disabled={!hasData}
        title={hasData ? labels.copyTip : labels.needTraceTip}
        className={`group masar-cta-sheen masar-action-btn px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 border ${
          !hasData
            ? "text-slate-400 opacity-60 border-transparent cursor-not-allowed"
            : copyFeedback
            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm"
            : "bg-slate-900/90 text-slate-200 border-slate-800/90 hover:bg-sky-500/15 hover:text-sky-300 hover:border-sky-500/35"
        }`}
      >
        <span className="inline-flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-115 group-hover:rotate-12">
          {copyFeedback ? (
            <svg className="w-3.5 h-3.5 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 shrink-0 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </span>
        <span>{copyFeedback ? labels.copied : labels.copy}</span>
      </button>

      <span className="h-4 w-px bg-slate-800 mx-0.5" />

      {/* 2. File Export Buttons: PDF Report, JSON, CSV */}
      {exportItems.map((item) => {
        const isSaved = exportFeedback === item.fmt.toUpperCase();
        return (
          <button
            key={item.fmt}
            type="button"
            disabled={!hasData}
            title={item.tip}
            onClick={() => onExportReport(item.fmt)}
            className={`group masar-cta-sheen masar-action-btn px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 border ${
              item.mono ? "font-mono" : ""
            } ${
              !hasData
                ? "text-slate-400 opacity-60 border-transparent cursor-not-allowed"
                : isSaved
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm"
                : item.accent
                ? "bg-sky-950/60 text-sky-300 border-sky-500/30 hover:bg-sky-500/20 hover:border-sky-500/50"
                : "bg-slate-900/80 text-slate-200 border-slate-800/80 hover:bg-slate-800 hover:text-sky-300 hover:border-sky-500/35"
            }`}
          >
            <span className="inline-flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-115 group-hover:-translate-y-0.5">
              {isSaved ? (
                <svg className="w-3.5 h-3.5 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                item.icon
              )}
            </span>
            <span>{isSaved ? labels.saved : item.label}</span>
          </button>
        );
      })}

      <span className="h-4 w-px bg-slate-800 mx-0.5" />

      {/* 3. Always-Accessible Interactive Data & Report Guide Studio Button */}
      <button
        type="button"
        onClick={onOpenStudio}
        title={labels.guideTip}
        className="group masar-cta-sheen masar-action-btn px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 shadow-sm"
      >
        <span className="h-4 w-4 rounded-md bg-emerald-500/20 text-emerald-300 flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-[360deg] group-hover:scale-110">
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" strokeLinecap="round" />
            <path d="M12 8h.01" strokeLinecap="round" />
          </svg>
        </span>
        <span>{labels.guide}</span>
        {hasData && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        )}
      </button>
    </div>
  );
}

const EXPORT_FORMAT_ICONS = {
  copy: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  html: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  ),
  json: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1" />
      <path d="M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1" />
    </svg>
  ),
  csv: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  ),
};

const STUDIO_TAB_ICONS = {
  all: (
    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  live: (
    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12h4l3-7 4 14 3-7h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  exports: (
    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  dictionary: (
    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  preview: (
    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
};

export { formatArabicCount, formatEnglishCount, EXPORT_FORMAT_ICONS, STUDIO_TAB_ICONS };
