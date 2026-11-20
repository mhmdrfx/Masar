import React, { Suspense, useState, useEffect, useRef, useId } from "react";
import {
  ExportToolbarCapsule,
  buildBrowserCSVReport,
  buildBrowserDetailedReport,
  buildBrowserHTMLReport,
} from "./ReportStudio.jsx";
import {
  UpdateNotifier,
  UpdateSettingsPanel,
  useAppVersion,
} from "./UpdateManager.jsx";
import StatusLottie from "./motion/StatusLottie.jsx";
import {
  TabStage,
  AnimatedModal,
  GoDataLoader,
  MorphLabel,
} from "./motion/MotionPrimitives.jsx";

const ReportStudioModal = React.lazy(() => import("./ReportStudioModal.jsx"));
const MtrTimelineCanvas = React.lazy(() => import("./components/MtrTimelineCanvas.jsx"));
const TlsInspectorCard = React.lazy(() => import("./components/TlsInspectorCard.jsx"));

const PRESETS = [
  { labelEn: "Google DNS", labelAr: "خادم جوجل", value: "8.8.8.8" },
  { labelEn: "Cloudflare", labelAr: "كلاودفلير", value: "1.1.1.1" },
  { labelEn: "Quad9", labelAr: "كواد 9", value: "9.9.9.9" },
];

const I18N = {
  en: {
    dir: "ltr",
    appSubtitle: "Visual MTR & Smart Network Diagnostics",
    tracingLive: "Live Polling",
    tabMtr: "Visual MTR",
    tabDns: "DNS Lookup",
    tabPorts: "Port Scanner",
    tabSpeed: "Speed Benchmark",
    quickTargets: "Quick Targets",
    targetPlaceholder: "Enter IP or Hostname (e.g. 8.8.8.8)",
    startTrace: "Start Trace",
    stopTrace: "Stop",
    copySummary: "Copy Summary",
    copiedSummary: "Copied",
    exportPdf: "PDF Report",
    errorTitle: "Network Socket / Trace Error",
    dismiss: "Dismiss",
    healthScoreTitle: "Connection Health Score",
    hop1Label: "Hop 1: Router",
    ispLabel: "Hops 2–3: ISP",
    totalHopsLabel: "Hops",
    targetLabel: "Target",
    updatedLabel: "Updated",
    badgeHealthy: "HEALTHY PATH",
    badgeWarning: "DEGRADED",
    badgeCritical: "ACTION REQUIRED",
    badgeIdle: "STANDBY",
    topologyTitle: "Network Path Architecture & Geo-IP Topology",
    topologySub: "End-to-end packet flow across local gateway, ISP backbone, and destination",
    stageDevice: "This Device",
    stageDeviceSub: "Raw ICMPv4 Socket",
    stageRouter: "Local Gateway (Hop 1)",
    stageIsp: "ISP & Transit Backbone",
    stageTarget: "Target Destination",
    awaitingProbes: "Awaiting probes",
    reachableHops: "Responding Nodes",
    silentHops: "ICMP Filtered",
    tableTitle: "Real-Time Hop Telemetry (MTR)",
    tableSub: "Per-Hop Packet Loss, Geo-IP/ASN, Latency & 60s Live Sparklines",
    legendHealthy: "Healthy (0% – 2%)",
    legendWarn: "Warning (2% – 5%)",
    legendCrit: "Critical (> 5%)",
    colHop: "Hop",
    colHost: "IP / Hostname",
    colGeo: "Geo-IP / ASN",
    colLoss: "Loss %",
    colSentRecv: "Sent / Recv",
    colLast: "Last",
    colAvg: "Avg",
    colJitter: "Jitter",
    colTrend: "Trend (60s)",
    emptyTitle: "No Active MTR Trace Running",
    emptyDesc: "Select a preset or enter an IP/hostname above and click Start Trace to begin 1-second ICMP path telemetry.",
    timedOut: "Request Timed Out — ICMP Silent",
    roleRouter: "Local Router",
    roleIsp: "ISP Gateway",
    roleTarget: "Target",
    transitHop: "Transit Hop",
    dnsTitle: "DNS Record & Reverse PTR Inspector",
    dnsDesc: "Concurrently resolves A, AAAA, CNAME, MX, NS, TXT, and Reverse PTR records with query latency telemetry.",
    dnsPlaceholder: "Domain or IP (e.g. google.com)",
    dnsBtn: "Lookup DNS",
    dnsResolving: "Resolving...",
    dnsQueryTime: "Query Time",
    dnsRecordsFound: "Records Found",
    dnsColType: "Record Type",
    dnsColValue: "Resolved Value",
    portTitle: "Concurrent TCP Port Scanner",
    portDesc: "Scans standard infrastructure & service ports (SSH, DNS, HTTP, HTTPS, SMB, RDP, MySQL, PostgreSQL, Redis) and measures TCP handshake RTT.",
    portPlaceholder: "Host or IP (e.g. 8.8.8.8)",
    portBtn: "Scan Ports",
    portScanning: "Scanning...",
    portOpenCount: "Open Ports",
    portDuration: "Scan Duration",
    stateOpen: "OPEN",
    stateFiltered: "FILTERED",
    stateClosed: "CLOSED",
    speedTitle: "Speedtest • Bandwidth & Edge Latency",
    speedDesc: "Ookla-standard calibrated test (Idle/Loaded Ping, Adaptive HTTP/1.1 TCP Streams, 20-Slice Trimmed Mean).",
    speedStartBtn: "Start Test",
    speedStopBtn: "Stop Test",
    speedGoBtn: "GO",
    speedTesting: "Testing...",
    speedTestAgain: "Test Again",
    speedCopyResults: "Copy Results",
    speedCopied: "Copied!",
    speedExportPdf: "PDF Report",
    speedExportingPdf: "Exporting...",
    speedDown: "Download",
    speedUp: "Upload",
    speedPing: "Ping",
    speedLoadedPing: "Loaded Ping",
    speedDownPing: "Download Ping",
    speedUpPing: "Upload Ping",
    speedIdlePing: "Idle Ping",
    speedLoss: "Packet Loss",
    speedConnMode: "Connections",
    speedModeMulti: "Multi",
    speedModeSingle: "Single",
    speedModeMultiHint: "Parallel TCP streams (Max Line Capacity)",
    speedModeSingleHint: "1 TCP stream (Single-Connection Speed)",
    speedStreamsUnit: "Streams",
    speedStreamSingleUnit: "Stream",
    speedNetworkCard: "Your Network (ISP)",
    speedServerCard: "Test Server",
    speedBufferbloat: "Bufferbloat",
    speedLatencyLow: "Low",
    speedLatencyMed: "Moderate",
    speedLatencyHigh: "Elevated",
    speedDurationHint: "Calibrated 20-slice Ookla trimmed mean test for rock-steady, reproducible throughput scoring",
    speedJitter: "Jitter",
    speedPeak: "Peak",
    speedBest: "Best",
    speedTotalData: "Data Used",
    speedPhasePing: "Finding Server & Idle Ping...",
    speedPhaseDown: "Testing Download",
    speedPhaseUp: "Testing Upload",
    speedPhaseComplete: "Speed Test Complete",
    speedPhaseDuplex: "Multi-Stream Testing...",
    speedPhaseIdle: "Select Multi or Single connections and click GO",
    speedEdgesTitle: "Global Anycast Edge Latency Matrix",
    speedAvg: "Avg",
    speedScorecardTitle: "Speed Test Results",
    speedGradeTitle: "Connection Quality",
    speedGradeExcellent: "Ultra Fast Connection (Ideal for Competitive Gaming, 4K Streaming & Low-Latency VoIP)",
    speedGradeGood: "Fast & Stable Connection (Great for Remote Work, HD Streaming & Video Calls)",
    speedGradeFair: "Moderate Connection (Suitable for Web Browsing & Standard Streaming)",
    speedGradePoor: "Limited Connection (Suitable for basic browsing; heavy media or gaming may lag)",
    speedServerHint: "Cloudflare Anycast & Multi-CDN Edge Network",
    speedProgress: "Progress",
    zoomIn: "Zoom In (Ctrl +)",
    zoomOut: "Zoom Out (Ctrl -)",
    zoomReset: "Reset Zoom (100%)",
    zoomLabel: "UI Zoom",
    menuCompact: "Compact",
    menuExpanded: "Full",
    menuToggleTitle: "Toggle Menu Layout (Compact / Full)",
    settingsBtn: "Settings & Guide",
    settingsTitle: "Masar Settings, Theme & Comprehensive Guide",
    settingsSub: "Application identity, appearance mode, and detailed documentation for all diagnostic modules",
    closeBtn: "Close",
    sec1Title: "1. Application Identity & Credits",
    craftedPhrase: "Crafted with Perfection",
    identityDesc:
      "Visual MTR & Smart Network Diagnostics — Real-Time ICMPv4 Route Telemetry, Geo-IP Topology, DNS Inspector, TCP Port Scanner & Live Multi-Stream Bandwidth Benchmark.",
    rightsText: "All Rights Reserved to Developer",
    sec2Title: "2. Appearance Mode (Carbon Dark / Daylight Light)",
    sec2Desc: "Switch the application interface between Carbon Slate Dark Mode and Soft Daylight Alabaster Mode:",
    darkThemeTitle: "Carbon Dark Mode",
    darkThemeDesc: "Solid layered slate surfaces with crisp borders & zero distraction",
    lightThemeTitle: "Soft Daylight Mode",
    lightThemeDesc: "Anti-glare pearl-stone daylight palette — comfortable & eye-friendly",
    activeThemeBadge: "ACTIVE",
    sec3Title: "3. Comprehensive Guide to All Program Sections",
    sec3Desc: "Detailed explanation of every tool, indicator, and metric inside Masar v1.0:",
    endToEndRtt: "End-to-End RTT",
    endToEndLoss: "Target Loss",
    routeJitter: "Path Jitter",
    streamRxTag: "4x RX Streams",
    streamTxTag: "3x TX Streams",
    cadenceLive: "LIVE 0.5s",
    cadenceIdle: "STANDBY",
    gaugeUnit: "SCORE",
  },
  ar: {
    dir: "rtl",
    appSubtitle: "الفحص البصري للمسار وتشخيص الشبكة الذكي",
    tracingLive: "فحص مباشر",
    tabMtr: "فحص المسار البصري",
    tabDns: "فحص النطاقات",
    tabPorts: "فاحص المنافذ",
    tabSpeed: "قياس السرعة المباشر",
    quickTargets: "أهداف سريعة",
    targetPlaceholder: "أدخل عنوان IP أو اسم النطاق (مثل 8.8.8.8)",
    startTrace: "بدء الفحص",
    stopTrace: "إيقاف",
    copySummary: "نسخ التقرير",
    copiedSummary: "تم النسخ",
    exportPdf: "تقرير PDF",
    errorTitle: "تنبيه محرك الشبكة",
    dismiss: "إغلاق",
    healthScoreTitle: "مؤشر جودة الاتصال",
    hop1Label: "القفزة 1: الراوتر",
    ispLabel: "القفزتان 2–3: المزود",
    totalHopsLabel: "القفزات",
    targetLabel: "الهدف",
    updatedLabel: "آخر تحديث",
    badgeHealthy: "مسار سليم",
    badgeWarning: "تذبذب في المسار",
    badgeCritical: "يوجد خلل",
    badgeIdle: "جاهز للفحص",
    topologyTitle: "خريطة المسار الجغرافي وبنية الاتصال",
    topologySub: "تتبع رحلة الحزم من جهازك مروراً بالراوتر وبوابة مزود الخدمة حتى الوجهة النهائية",
    stageDevice: "جهازك الحالي",
    stageDeviceSub: "مقبس فحص مباشر",
    stageRouter: "الراوتر المحلي (القفزة 1)",
    stageIsp: "بوابة المزود والربط الدولي",
    stageTarget: "الوجهة النهائية",
    awaitingProbes: "بانتظار الاستجابة",
    reachableHops: "عقد مستجيبة",
    silentHops: "عقد صامتة",
    tableTitle: "جدول تحليل القفزات اللحظي",
    tableSub: "نسبة الفقد، الموقع الجغرافي ومزود الخدمة، زمن الاستجابة، والمنحنى الزمني لآخر 60 ثانية",
    legendHealthy: "سليم (0% – 2%)",
    legendWarn: "تحذير (2% – 5%)",
    legendCrit: "خلل حرج (أكثر من 5%)",
    colHop: "القفزة",
    colHost: "العنوان الرقمي / المضيف",
    colGeo: "الموقع / الشبكة",
    colLoss: "الفقد %",
    colSentRecv: "مرسل / مستلم",
    colLast: "الحالي",
    colAvg: "المتوسط",
    colJitter: "التذبذب",
    colTrend: "منحنى (60ث)",
    emptyTitle: "لا يوجد فحص مسار نشط حالياً",
    emptyDesc: "اختر أحد الأهداف السريعة أو أدخل عنوان IP أو نطاقاً في الأعلى ثم اضغط على «بدء الفحص» لتحليل المسار كل ثانية.",
    timedOut: "راوتر صامت — يتجاهل فحص ICMP",
    roleRouter: "الراوتر المحلي",
    roleIsp: "بوابة المزود",
    roleTarget: "الهدف النهائي",
    transitHop: "عقدة عبور",
    dnsTitle: "فاحص سجلات النطاقات والفحص العكسي",
    dnsDesc: "استعلام متوازٍ وسريع عن سجلات النطاقات (A وAAAA وCNAME وMX وNS وTXT) والفحص العكسي (PTR) مع قياس زمن الاستجابة.",
    dnsPlaceholder: "أدخل اسم النطاق أو العنوان (مثل google.com)",
    dnsBtn: "فحص السجلات",
    dnsResolving: "جارٍ الفحص...",
    dnsQueryTime: "زمن الاستعلام",
    dnsRecordsFound: "السجلات المكتشفة",
    dnsColType: "نوع السجل",
    dnsColValue: "القيمة المسجلة",
    portTitle: "فاحص المنافذ المتوازي",
    portDesc: "فحص متوازٍ لمنافذ الخدمات القياسية (SSH وDNS وHTTP وHTTPS وSMB وRDP وقواعد البيانات) مع قياس زمن مصافحة الاتصال.",
    portPlaceholder: "أدخل المضيف أو العنوان (مثل 8.8.8.8)",
    portBtn: "بدء فحص المنافذ",
    portScanning: "جارٍ الفحص...",
    portOpenCount: "المنافذ المفتوحة",
    portDuration: "مدة الفحص",
    stateOpen: "مفتوح",
    stateFiltered: "محجوب",
    stateClosed: "مغلق",
    speedTitle: "قياس السرعة الاحترافي • Speedtest",
    speedDesc: "فحص تكيّفي مستقر بمعايير Ookla Speedtest (الاستجابة تحت الضغط، قنوات TCP مستقلة، ومتوسط 20 شريحة مشذّب).",
    speedStartBtn: "بدء الفحص",
    speedStopBtn: "إيقاف الفحص",
    speedGoBtn: "ابدأ",
    speedTesting: "جارٍ الفحص...",
    speedTestAgain: "إعادة الفحص",
    speedCopyResults: "نسخ النتيجة",
    speedCopied: "تم النسخ!",
    speedExportPdf: "تقرير PDF للنتيجة",
    speedExportingPdf: "جارٍ تصدير التقرير...",
    speedDown: "التحميل",
    speedUp: "الرفع",
    speedPing: "الاستجابة",
    speedLoadedPing: "تحت الضغط",
    speedDownPing: "استجابة التحميل",
    speedUpPing: "استجابة الرفع",
    speedIdlePing: "استجابة الخمول",
    speedLoss: "فقد الحزم",
    speedConnMode: "الاتصالات",
    speedModeMulti: "متعدد القنوات",
    speedModeSingle: "قناة واحدة",
    speedModeMultiHint: "قنوات متوازية لقياس السعة القصوى للخط",
    speedModeSingleHint: "جلسة TCP واحدة لقياس سرعة التنزيل الفردي",
    speedStreamsUnit: "قنوات",
    speedStreamSingleUnit: "قناة",
    speedNetworkCard: "شبكتك (المزود)",
    speedServerCard: "خادم الفحص",
    speedBufferbloat: "تأثر الضغط",
    speedLatencyLow: "ممتاز",
    speedLatencyMed: "متوسط",
    speedLatencyHigh: "مرتفع",
    speedDurationHint: "فحص معاير وفق منهجية 20 شريحة زمنية واستبعاد الأطراف الشاذة للحصول على قراءة ثابتة ودقيقة",
    speedJitter: "التذبذب",
    speedPeak: "الذروة",
    speedBest: "الأفضل",
    speedTotalData: "البيانات",
    speedPhasePing: "تحديد الخادم وقياس الاستجابة...",
    speedPhaseDown: "قياس سرعة التحميل",
    speedPhaseUp: "قياس سرعة الرفع",
    speedPhaseComplete: "اكتملت نتائج الفحص",
    speedPhaseDuplex: "فحص متزامن...",
    speedPhaseIdle: "اختر نمط الاتصال ثم اضغط «ابدأ» لقياس السرعة الفعلي",
    speedEdgesTitle: "استجابة الخوادم السحابية العالمية (Anycast Edge)",
    speedAvg: "المتوسط",
    speedScorecardTitle: "نتيجة فحص السرعة",
    speedGradeTitle: "تقييم جودة الاتصال",
    speedGradeExcellent: "اتصال فائق السرعة (مثالي للألعاب التنافسية والبث بدقة 4K والمكالمات الفائقة)",
    speedGradeGood: "اتصال سريع ومستقر (ممتاز للعمل عن بعد والمكالمات المرئية والتصفح السلس)",
    speedGradeFair: "اتصال معتدل (مناسب للتصفح اليومي ومشاهدة الفيديو العادي)",
    speedGradePoor: "اتصال محدود (مناسب للمهام الأساسية فقط وقد يتأثر عند ضغط الاستخدام)",
    speedServerHint: "شبكة خوادم Cloudflare Anycast السحابية العالمية",
    speedProgress: "التقدم",
    zoomIn: "تكبير الواجهة (Ctrl +)",
    zoomOut: "تصغير الواجهة (Ctrl -)",
    zoomReset: "إعادة ضبط الحجم (100%)",
    zoomLabel: "مقياس الواجهة",
    menuCompact: "مدمج",
    menuExpanded: "كامل",
    menuToggleTitle: "تبديل شكل القوائم (مدمج / كامل)",
    settingsBtn: "الإعدادات والدليل",
    settingsTitle: "إعدادات مسار والدليل الشامل",
    settingsSub: "هوية البرنامج وحقوق التطوير، تخصيص المظهر، والشرح المفصل لجميع الأقسام",
    closeBtn: "إغلاق",
    sec1Title: "أولاً: هوية البرنامج وحقوق التطوير",
    craftedPhrase: "صُنع بكل إتقان",
    identityDesc:
      "الفحص البصري للمسار وتشخيص الشبكة الذكي — تتبع لحظي لمسار الحزم، خريطة الموقع الجغرافي، فاحص سجلات النطاقات، فاحص المنافذ المتوازي، والقياس المباشر لسرعة الاتصال.",
    rightsText: "جميع الحقوق محفوظة للمطور",
    sec2Title: "ثانياً: وضع المظهر (الداكن / النهاري المريح)",
    sec2Desc: "اختر المظهر المناسب لك بين الوضع الداكن الاحترافي والوضع النهاري الهادئ المريح للعين:",
    darkThemeTitle: "الوضع الداكن (Carbon Slate)",
    darkThemeDesc: "طبقات داكنة صلبة عالية الوضوح والتباين بدون أي تشتيت بصري",
    lightThemeTitle: "الوضع النهاري المريح (Soft Daylight)",
    lightThemeDesc: "تدرج لؤلؤي حجري هادئ يمنع وهج اللون الأبيض ويحمي العين",
    activeThemeBadge: "مُفعّل حالياً",
    sec3Title: "ثالثاً: الشرح المفصل لجميع أقسام البرنامج",
    sec3Desc: "دليل شامل يشرح وظيفة وطريقة قراءة كل أداة وكل مؤشر داخل برنامج مسار (الإصدار 1.0):",
    endToEndRtt: "استجابة الوجهة",
    endToEndLoss: "فقد الوجهة",
    routeJitter: "تذبذب المسار",
    streamRxTag: "4 قنوات تحميل",
    streamTxTag: "3 قنوات رفع",
    cadenceLive: "مباشر 0.5ث",
    cadenceIdle: "جاهز",
    gaugeUnit: "الجودة",
  },
};

function localizeHealth(health, hops, lang) {
  if (!health) {
    return { status: "", detail: "" };
  }
  if (lang !== "ar") {
    return { status: health.status, detail: health.detail };
  }

  const st = health.status || "";
  const culprit = hops.find((h) => h.hop === health.culpritHop);
  const finalHop = hops.length > 0 ? hops[hops.length - 1] : null;

  if (st.includes("Ready to Diagnose")) {
    return {
      status: "جاهز لتشخيص مسار الشبكة",
      detail:
        "اختر هدفاً سريعاً (8.8.8.8 أو 1.1.1.1) أو أدخل أي عنوان IP أو اسم نطاق ثم اضغط على «بدء الفحص».",
    };
  }
  if (st.includes("Initializing") || st.includes("Measuring")) {
    return {
      status: "جارٍ اكتشاف وتحليل مسار الشبكة...",
      detail:
        "يتم إرسال نبضات فحص متتالية عبر القفزات لقياس جودة الراوتر المحلي وبوابة مزود الخدمة والوجهة النهائية.",
    };
  }
  if (st.includes("Local Network")) {
    return {
      status: "تم رصد خلل في الشبكة المحلية أو الراوتر (القفزة 1)",
      detail: culprit
        ? `القفزة الأولى (${culprit.ip || "الراوتر المحلي"}) تسجل فقد حزم بنسبة ${culprit.lossPercent.toFixed(1)}% ومتوسط زمن استجابة قدره ${culprit.avgMs.toFixed(1)} مللي ثانية؛ تحقق من إشارة الواي فاي أو كابل الشبكة أو الراوتر.`
        : "تم رصد فقد حزم أو ارتفاع في زمن الاستجابة عند الراوتر المحلي؛ تحقق من إشارة الواي فاي أو كابل الشبكة.",
    };
  }
  if (st.includes("ISP / Backbone")) {
    return {
      status: "تم رصد مشكلة من جهة مزود خدمة الإنترنت",
      detail: culprit
        ? `الراوتر المحلي (القفزة 1) سليم تماماً، لكن القفزة رقم ${culprit.hop} (${culprit.ip || "بوابة المزود"}) تسجل فقد حزم بنسبة ${culprit.lossPercent.toFixed(1)}% ومتوسط استجابة ${culprit.avgMs.toFixed(1)} مللي ثانية؛ يمكنك تصدير التقرير الرسمي وإرساله للدعم الفني.`
        : "الراوتر المحلي سليم، لكن تم رصد فقد حزم أو تأخر عند بوابة مزود الخدمة.",
    };
  }
  if (st.includes("Downstream Transit")) {
    return {
      status: "تذبذب في مسار الربط الدولي أو الخادم الهدف",
      detail: culprit
        ? `الشبكة المحلية وبوابة مزود الخدمة مستقرتان، لكن القفزة رقم ${culprit.hop} (${culprit.ip || "عقدة عبور"}) تسجل فقد حزم بنسبة ${culprit.lossPercent.toFixed(1)}% ومتوسط استجابة ${culprit.avgMs.toFixed(1)} مللي ثانية.`
        : "الشبكة المحلية وبوابة مزود الخدمة مستقرتان، لكن يوجد تذبذب في مسار العبور الدولي.",
    };
  }
  if (st.includes("Connection is Healthy")) {
    return {
      status: "الاتصال سليم — أداء المسار مثالي ومستقر",
      detail:
        finalHop && finalHop.received > 0
          ? `متوسط زمن الاستجابة إلى الوجهة (${finalHop.ip}) هو ${finalHop.avgMs.toFixed(1)} مللي ثانية مع تذبذب منخفض قدره ${finalHop.jitterMs.toFixed(1)} مللي ثانية ونسبة فقد ${finalHop.lossPercent.toFixed(1)}% فقط.`
          : "لا يوجد فقد مؤثر في الحزم عبر الراوتر المحلي أو بوابة مزود الخدمة.",
    };
  }

  return { status: health.status, detail: health.detail };
}

function localizeErrorMessage(rawErr, lang) {
  if (!rawErr) return "";
  const msg = String(rawErr).trim();
  if (!msg) return "";
  const lower = msg.toLowerCase();
  const isAr = lang === "ar";

  if (lower.includes("valid target ipv4") || lower.includes("valid ipv4 address or hostname")) {
    return isAr
      ? "يرجى إدخال عنوان IPv4 صحيح أو اسم نطاق صالح للفحص."
      : "Please enter a valid IPv4 address or hostname.";
  }
  if (lower.includes("valid domain name or ip")) {
    return isAr
      ? "يرجى إدخال اسم نطاق صالح أو عنوان IP صحيح."
      : "Please enter a valid domain name or IP address.";
  }
  if (lower.includes("valid host or ipv4")) {
    return isAr
      ? "يرجى إدخال اسم مضيف صالح أو عنوان IPv4 صحيح."
      : "Please enter a valid host or IPv4 address.";
  }
  if (lower.includes("failed to resolve host") || lower.includes("no such host")) {
    return isAr
      ? "تعذّر تحويل اسم النطاق إلى عنوان رقمي — يرجى التحقق من صحة كتابة النطاق أو من اتصال الإنترنت."
      : "Could not resolve the specified hostname — please check the domain spelling and your internet connection.";
  }
  if (lower.includes("no ipv4 address found")) {
    return isAr
      ? "لم يتم العثور على عنوان IPv4 مرتبط بهذا النطاق."
      : "No IPv4 address was found for the specified hostname.";
  }
  if (lower.includes("is ipv6")) {
    return isAr
      ? "العنوان المدخل من نوع IPv6 — يتطلب محرك مسار عنوان IPv4 أو نطاقاً يدعم IPv4."
      : "The entered address is IPv6 — Masar requires an IPv4 address or dual-stack hostname.";
  }
  if (
    lower.includes("elevated privileges") ||
    lower.includes("access is denied") ||
    lower.includes("permission denied")
  ) {
    return isAr
      ? "يتطلب الفحص المباشر لحزم الشبكة تشغيل برنامج مسار بصلاحية المسؤول (التشغيل كمسؤول) في نظام ويندوز."
      : "Raw ICMPv4 socket access requires Administrator privileges on Windows. Please right-click Masar and choose 'Run as administrator'.";
  }
  if (lower.includes("no trace telemetry available")) {
    return isAr
      ? "لا توجد بيانات فحص مسار حالياً — اضغط على «بدء الفحص» أولاً لاستخراج القراءات."
      : "No trace telemetry is available yet — click 'Start Trace' first to collect path metrics.";
  }
  if (lower.includes("failed to write report")) {
    return isAr
      ? "تعذّر حفظ ملف التقرير في المجلد المحدد — يرجى التحقق من صلاحيات الكتابة."
      : "Could not save the report file to the selected location — please check folder write permissions.";
  }
  if (lower.includes("unable to reach speed benchmark servers")) {
    return isAr
      ? "تعذّر الوصول إلى خوادم قياس السرعة — تأكد من اتصال الإنترنت أو إعدادات البروكسي والجدار الناري."
      : "Unable to reach speed benchmark servers — check your internet connection, proxy, or firewall.";
  }
  if (lower.includes("blocked unsafe redirect") || lower.includes("captive portal")) {
    return isAr
      ? "تم حظر إعادة توجيه غير آمنة أو بوابة تسجيل دخول شبكة (Captive Portal) أثناء الاتصال بخادم قياس السرعة."
      : "Blocked unsafe redirect or captive portal while connecting to the benchmark server.";
  }
  if (lower.includes("unable to download benchmark stream")) {
    return isAr
      ? "تعذّر تحميل حزم الفحص من خادم التوزيع (قد يكون محجوباً عبر الجدار الناري أو البروكسي)."
      : "Unable to download benchmark stream from CDN (blocked by proxy, captive portal, or firewall).";
  }

  return msg;
}

function localizeEdgeProvider(provider, lang) {
  if (lang !== "ar") return provider;
  const p = String(provider || "");
  if (p.includes("Cloudflare")) return "سحابة كلاودفلير العالمية";
  if (p.includes("Google")) return "سحابة جوجل العامة";
  if (p.includes("Quad9")) return "سحابة كواد 9 الأمنية";
  if (p.includes("OpenDNS") || p.includes("Cisco")) return "سحابة أوبن دي إن إس (سيسكو)";
  return p;
}

const INITIAL_HEALTH = {
  score: 100,
  severity: "idle",
  status: "Ready to Diagnose Network Path",
  detail:
    "Select a target preset (8.8.8.8 or 1.1.1.1) or enter any hostname/IPv4 address and click Start Trace.",
  culpritHop: 0,
};

const INITIAL_SPEED = {
  seq: 0,
  running: false,
  completed: false,
  progress: 0,
  phase: "idle",
  error: "",
  connectionMode: "multi",
  activeStreams: 0,
  downloadMbps: 0,
  peakDownloadMbps: 0,
  finalDownloadMbps: 0,
  uploadMbps: 0,
  peakUploadMbps: 0,
  finalUploadMbps: 0,
  pingMs: 0,
  bestPingMs: 0,
  maxPingMs: 0,
  loadedPingMs: 0,
  downloadLatencyMs: 0,
  uploadLatencyMs: 0,
  jitterMs: 0,
  packetLoss: 0,
  totalMB: 0,
  clientIp: "",
  clientIsp: "",
  clientLocation: "",
  serverName: "Cloudflare Anycast CDN",
  serverLocation: "Global Edge Network",
  downloadHistory: [],
  uploadHistory: [],
  pingHistory: [],
  edgePings: [
    { provider: "Cloudflare Anycast Edge", endpoint: "1.1.1.1:443", latencyMs: 0, avgMs: 0, bestMs: 0, history: [], status: "idle" },
    { provider: "Google Public Edge", endpoint: "8.8.8.8:443", latencyMs: 0, avgMs: 0, bestMs: 0, history: [], status: "idle" },
    { provider: "Quad9 Security Edge", endpoint: "9.9.9.9:443", latencyMs: 0, avgMs: 0, bestMs: 0, history: [], status: "idle" },
    { provider: "OpenDNS / Cisco Edge", endpoint: "208.67.222.222:443", latencyMs: 0, avgMs: 0, bestMs: 0, history: [], status: "idle" },
  ],
  updatedAt: "--:--:--",
};

const hasWailsBackend = () =>
  typeof window !== "undefined" &&
  window.go &&
  window.go.main &&
  window.go.main.App;

const hasWailsRuntime = () =>
  typeof window !== "undefined" &&
  window.runtime &&
  typeof window.runtime.EventsOn === "function";

function MasarLogo({ size = 24, className = "" }) {
  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const gradId = `waveGrad-${safeId}`;
  const shadowId = `waveShadow-${safeId}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <filter
          id={shadowId}
          x="-10%"
          y="-10%"
          width="120%"
          height="130%"
          filterUnits="userSpaceOnUse"
        >
          <feDropShadow
            dx="0"
            dy="5"
            stdDeviation="5"
            floodColor="#0284c7"
            floodOpacity="0.28"
          />
        </filter>
      </defs>
      <rect
        x="1.5"
        y="1.5"
        width="97"
        height="97"
        rx="24.5"
        fill="#ffffff"
        stroke="#e2e8f0"
        strokeWidth="1.5"
      />
      <path
        d="M18 72C18 42 25 24 35 24C45 24 47 52 50 52C53 52 55 24 65 24C75 24 82 42 82 72C74 72 69 58 65 40C61 52 57 69 50 69C43 69 39 52 35 40C31 58 26 72 18 72Z"
        fill={`url(#${gradId})`}
        filter={`url(#${shadowId})`}
      />
    </svg>
  );
}

// Soft, velvety two-note ambient marimba/Rhodes interval (C4/G4 -> E4/B4) via native Windows audio + Web Audio fallback
function playMasarStartupChime(preferWebAudioOnly = false) {
  try {
    if (
      !preferWebAudioOnly &&
      hasWailsBackend() &&
      typeof window.go.main.App.PlayStartupChime === "function"
    ) {
      window.go.main.App.PlayStartupChime();
      return;
    }
  } catch {
    // fallback to Web Audio API below
  }

  try {
    const AudioCtx =
      typeof window !== "undefined" &&
      (window.AudioContext || window.webkitAudioContext);
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime + 0.02;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.13, now);

    // Deep warm low-pass filter (950 Hz) for a soft, wooden marimba/Rhodes feel without any harsh highs
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(950, now);
    filter.Q.setValueAtTime(0.5, now);

    filter.connect(master);
    master.connect(ctx.destination);

    const notes = [
      { freq: 130.81, delay: 0.0, dur: 1.15, gain: 0.14 },  // C3 warm sub
      { freq: 261.63, delay: 0.0, dur: 1.15, gain: 0.34 },  // C4 root
      { freq: 392.00, delay: 0.0, dur: 1.10, gain: 0.22 },  // G4 fifth
      { freq: 329.63, delay: 0.16, dur: 1.15, gain: 0.28 }, // E4 gentle third
      { freq: 493.88, delay: 0.16, dur: 1.15, gain: 0.18 }, // B4 warm major 7th
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(n.freq, now + n.delay);

      noteGain.gain.setValueAtTime(0.0001, now + n.delay);
      noteGain.gain.linearRampToValueAtTime(n.gain, now + n.delay + 0.038);
      noteGain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + n.delay + n.dur
      );

      osc.connect(noteGain);
      noteGain.connect(filter);
      osc.start(now + n.delay);
      osc.stop(now + n.delay + n.dur + 0.04);
    });

    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // ignore
      }
    }, 1800);
  } catch {
    // ignore audio context restrictions
  }
}

function MasarStartupSplash({
  lang = "ar",
  isLight = false,
  versionDisplay = "v1.0.4",
  progress = 0,
  exiting = false,
  soundMuted = false,
  onToggleSound,
  onSkip,
}) {
  const isAr = lang === "ar";
  const stages = isAr
    ? [
        {
          code: "STAGE 01 // ICMPv4 CORE",
          text: "تهيئة محرك الفحص البصري للمسار (ICMPv4 Engine)...",
        },
        {
          code: "STAGE 02 // GEO-IP & ASN",
          text: "تحميل خرائط المواقع الجغرافية ومزودي الخدمة (Geo-IP)...",
        },
        {
          code: "STAGE 03 // DNS & TCP ENGINE",
          text: "تجهيز فاحص النطاقات والمنافذ المتوازي عالي السرعة...",
        },
        {
          code: "STAGE 04 // ANYCAST EDGE",
          text: "معايرة قنوات قياس السرعة وخوادم الحافة السحابية...",
        },
      ]
    : [
        {
          code: "STAGE 01 // ICMPv4 CORE",
          text: "Initializing Visual MTR & Raw ICMPv4 Telemetry Engine...",
        },
        {
          code: "STAGE 02 // GEO-IP & ASN",
          text: "Loading Geo-IP Topology & ASN Network Intelligence...",
        },
        {
          code: "STAGE 03 // DNS & TCP ENGINE",
          text: "Arming Concurrent DNS Inspector & TCP Port Scanner...",
        },
        {
          code: "STAGE 04 // ANYCAST EDGE",
          text: "Calibrating Multi-Stream Speedtest & Anycast Edge Nodes...",
        },
      ];

  const stageIdx =
    progress >= 82 ? 3 : progress >= 55 ? 2 : progress >= 26 ? 1 : 0;

  const nodes = [
    {
      id: "mtr",
      title: isAr ? "المسار MTR" : "Visual MTR",
      sub: "ICMPv4",
      threshold: 14,
    },
    {
      id: "dns",
      title: isAr ? "النطاقات DNS" : "DNS Probe",
      sub: "7-Record",
      threshold: 42,
    },
    {
      id: "ports",
      title: isAr ? "المنافذ TCP" : "Port Scan",
      sub: "18-Port",
      threshold: 68,
    },
    {
      id: "speed",
      title: isAr ? "السرعة CDN" : "Speedtest",
      sub: "Anycast",
      threshold: 88,
    },
  ];

  // Progress ring circumference for 148px orbital SVG (r = 66)
  const ringRadius = 66;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset =
    ringCircumference * (1 - Math.max(4, Math.min(100, progress)) / 100);

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      onClick={onSkip}
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 select-none overflow-hidden ${
        exiting ? "masar-splash-screen-out" : ""
      }`}
      style={{
        background: isLight
          ? "radial-gradient(circle at 50% 28%, #d4e2f0 0%, #dde6f0 42%, #dce3ec 100%)"
          : "radial-gradient(circle at 50% 28%, #132038 0%, #0e1628 45%, #0b0f19 100%)",
        opacity: exiting ? 0 : 1,
        transform: exiting ? "scale(1.03) translate3d(0, -8px, 0)" : "scale(1) translate3d(0, 0, 0)",
        transition:
          "opacity 320ms cubic-bezier(0.22, 1, 0.36, 1), transform 340ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* Invisible top drag region so the frameless window remains draggable during splash */}
      <div
        className="wails-drag absolute top-0 inset-x-0 h-10 z-20"
        style={{ WebkitAppRegion: "drag", "--wails-draggable": "drag" }}
      />
      {/* Subtle Static Architectural Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: isLight
            ? "linear-gradient(to right, rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.06) 1px, transparent 1px)"
            : "linear-gradient(to right, rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.06) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* Ambient Cyan-Emerald Dual Aura */}
      <div
        className="masar-splash-halo pointer-events-none absolute w-[420px] h-[420px] rounded-full blur-3xl"
        style={{
          background: isLight
            ? "radial-gradient(circle, rgba(2,132,199,0.14) 0%, rgba(5,150,105,0.10) 52%, transparent 74%)"
            : "radial-gradient(circle, rgba(14,165,233,0.18) 0%, rgba(16,185,129,0.12) 52%, transparent 74%)",
        }}
      />

      {/* Center Executive Telemetry Boot Console */}
      <div className="masar-splash-card-in relative z-10 w-full max-w-lg flex flex-col items-center text-center">
        {/* 1) Orbital Radar & 3D Glass Logo Emblem */}
        <div className="relative w-40 h-40 flex items-center justify-center mb-4">
          {/* Outer Expanding Sonar Ring */}
          <span
            className="masar-sonar-ring absolute w-32 h-32 rounded-full border"
            style={{
              borderColor: isLight
                ? "rgba(2, 132, 199, 0.28)"
                : "rgba(56, 189, 248, 0.32)",
            }}
          />

          {/* Counter-Rotating SVG Orbital Telemetry Rings + Live Circular Progress */}
          <svg
            className="absolute inset-0 w-full h-full overflow-visible"
            viewBox="0 0 160 160"
          >
            <defs>
              <linearGradient
                id="splashOrbitGrad"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>

            {/* Outer Segmented Orbit (Clockwise) */}
            <g className="masar-orbit-cw" style={{ transformOrigin: "80px 80px" }}>
              <circle
                cx="80"
                cy="80"
                r="75"
                fill="none"
                stroke={
                  isLight
                    ? "rgba(2, 132, 199, 0.22)"
                    : "rgba(56, 189, 248, 0.24)"
                }
                strokeWidth="1.25"
                strokeDasharray="10 14 28 14"
              />
              <circle cx="80" cy="5" r="2.6" fill="#38bdf8" />
              <circle cx="80" cy="155" r="2.2" fill="#10b981" />
            </g>

            {/* Inner Segmented Orbit (Counter-Clockwise) */}
            <g
              className="masar-orbit-ccw"
              style={{ transformOrigin: "80px 80px" }}
            >
              <circle
                cx="80"
                cy="80"
                r="58"
                fill="none"
                stroke={
                  isLight
                    ? "rgba(16, 185, 129, 0.25)"
                    : "rgba(52, 211, 153, 0.24)"
                }
                strokeWidth="1.2"
                strokeDasharray="6 10"
              />
            </g>

            {/* Circular Progress Ring Track */}
            <circle
              cx="80"
              cy="80"
              r={ringRadius}
              fill="none"
              stroke={
                isLight ? "rgba(203, 213, 225, 0.55)" : "rgba(30, 41, 59, 0.7)"
              }
              strokeWidth="2.5"
            />
            {/* Circular Progress Active Arc */}
            <circle
              cx="80"
              cy="80"
              r={ringRadius}
              fill="none"
              stroke="url(#splashOrbitGrad)"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringOffset}
              transform="rotate(-90 80 80)"
              style={{ transition: "stroke-dashoffset 120ms ease-out" }}
            />
          </svg>

          {/* Clean Frameless Logo Emblem (No Dark Pedestal Border) */}
          <div
            className="masar-studio-float relative flex items-center justify-center rounded-[22px]"
            style={{
              filter: isLight
                ? "drop-shadow(0 18px 34px rgba(2, 132, 199, 0.22))"
                : "drop-shadow(0 20px 40px rgba(14, 165, 233, 0.36))",
            }}
          >
            <MasarLogo size={84} />
          </div>
        </div>

        {/* 2) Project Name Bilingual Title + Version & Sound Controls */}
        <div className="masar-splash-stagger-1 flex flex-col items-center">
          <div className="flex items-center justify-center gap-2.5 flex-wrap mb-1.5">
            <h1
              className="text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-2.5"
              style={{ color: isLight ? "#0f172a" : "#f8fafc" }}
            >
              <span
                className="tracking-wider bg-gradient-to-r from-sky-400 via-blue-500 to-emerald-400 bg-clip-text text-transparent"
                dir="ltr"
              >
                MASAR
              </span>
            </h1>
            <span
              dir="ltr"
              className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border"
              style={{
                backgroundColor: isLight
                  ? "rgba(2, 132, 199, 0.10)"
                  : "rgba(14, 165, 233, 0.15)",
                color: isLight ? "#0369a1" : "#38bdf8",
                borderColor: isLight
                  ? "rgba(2, 132, 199, 0.28)"
                  : "rgba(56, 189, 248, 0.34)",
              }}
            >
              {versionDisplay}
            </span>
          </div>

          <p
            className="text-xs sm:text-[13px] font-medium max-w-md leading-relaxed mb-5"
            style={{ color: isLight ? "#475569" : "#94a3b8" }}
          >
            {isAr
              ? "منصة الفحص البصري للمسار وتشخيص الشبكة الذكي في الوقت الفعلي"
              : "Visual MTR, Route Telemetry & Smart Network Diagnostics Suite"}
          </p>
        </div>

        {/* 3) Executive Telemetry & Live Topology Boot Card */}
        <div
          className="masar-splash-stagger-2 w-full rounded-2xl border p-4 shadow-2xl"
          style={{
            backgroundColor: isLight ? "#f2f5f9" : "#131b2e",
            borderColor: isLight
              ? "rgba(15, 23, 42, 0.14)"
              : "rgba(148, 163, 184, 0.22)",
            boxShadow: isLight
              ? "0 20px 45px -18px rgba(15, 23, 42, 0.12)"
              : "0 24px 55px -16px rgba(2, 6, 23, 0.75)",
          }}
        >
          {/* Top Header: Stage Code + Equalizer Waveform + Numeric Percentage */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* Live 5-Bar Audio/Signal Equalizer */}
              <div
                className="flex items-end gap-[2.5px] h-3.5 px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/25 shrink-0"
                aria-hidden="true"
              >
                {[0, 150, 300, 120, 240].map((delayMs, i) => (
                  <span
                    key={i}
                    className="masar-eq-bar w-[2.5px] h-2.5 rounded-full"
                    style={{
                      animationDelay: `${delayMs}ms`,
                      background:
                        i % 2 === 0 ? "#38bdf8" : "#10b981",
                    }}
                  />
                ))}
              </div>
              <span
                dir="ltr"
                className="text-[10px] font-mono font-bold tracking-wider uppercase truncate"
                style={{ color: isLight ? "#0284c7" : "#38bdf8" }}
              >
                {stages[stageIdx].code}
              </span>
            </div>

            <span
              dir="ltr"
              className="font-mono font-black text-sm tabular-nums shrink-0"
              style={{ color: isLight ? "#0f172a" : "#f8fafc" }}
            >
              {Math.round(progress)}%
            </span>
          </div>

          {/* Active Stage Description */}
          <div
            className="text-xs font-semibold text-start truncate mb-2.5"
            style={{ color: isLight ? "#1e293b" : "#e2e8f0" }}
          >
            {stages[stageIdx].text}
          </div>

          {/* Gradient Progress Bar with Shimmer */}
          <div
            className="w-full h-2 rounded-full overflow-hidden relative"
            style={{
              backgroundColor: isLight ? "#e2e8f0" : "rgba(30, 41, 59, 0.95)",
            }}
          >
            <div
              className="h-full rounded-full relative overflow-hidden transition-all duration-100 ease-out"
              style={{
                width: `${Math.max(6, Math.min(100, progress))}%`,
                background:
                  "linear-gradient(90deg, #06b6d4 0%, #3b82f6 52%, #10b981 100%)",
              }}
            >
              <div
                className="masar-splash-bar-shimmer absolute inset-y-0 w-1/2"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
                }}
              />
            </div>
          </div>

          {/* 4-Node Network Topology Pipeline (Clean Opaque Cards without Bleeding Line) */}
          <div className="mt-3.5 pt-3 border-t border-slate-500/15">
            <div className="grid grid-cols-4 gap-2 text-[10px]">
              {nodes.map((node, idx) => {
                const ready = progress >= node.threshold;
                const active =
                  !ready &&
                  (idx === 0 || progress >= nodes[idx - 1].threshold);
                return (
                  <div
                    key={node.id}
                    className="rounded-xl border px-2 py-2 flex flex-col items-center justify-center gap-0.5 transition-all duration-200"
                    style={{
                      backgroundColor: ready
                        ? isLight
                          ? "#ecfdf5"
                          : "#092622"
                        : active
                        ? isLight
                          ? "#f0f9ff"
                          : "#0c1e36"
                        : isLight
                        ? "#f8fafc"
                        : "#0d1527",
                      borderColor: ready
                        ? isLight
                          ? "rgba(16, 185, 129, 0.45)"
                          : "rgba(16, 185, 129, 0.42)"
                        : active
                        ? isLight
                          ? "rgba(14, 165, 233, 0.45)"
                          : "rgba(56, 189, 248, 0.40)"
                        : isLight
                        ? "#e2e8f0"
                        : "rgba(51, 65, 85, 0.55)",
                      color: ready
                        ? isLight
                          ? "#047857"
                          : "#34d399"
                        : active
                        ? isLight
                          ? "#0284c7"
                          : "#38bdf8"
                        : "#64748b",
                    }}
                  >
                    <div className="flex items-center gap-1.5 font-bold truncate max-w-full">
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                          active ? "animate-pulse" : ""
                        }`}
                        style={{
                          backgroundColor: ready
                            ? "#10b981"
                            : active
                            ? "#38bdf8"
                            : "#64748b",
                        }}
                      />
                      <span className="truncate">{node.title}</span>
                    </div>
                    <span
                      dir="ltr"
                      className="text-[9px] opacity-75 tracking-tight"
                    >
                      {node.sub}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4) Bottom Footer Strip: Calm Sound Chime Toggle + Crafted Credit */}
        <div className="masar-splash-stagger-3 mt-4 flex items-center justify-between w-full px-1 text-[11px]">
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleSound) onToggleSound();
            }}
            role="switch"
            aria-checked={!soundMuted}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                if (onToggleSound) onToggleSound();
              }
            }}
            className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all duration-200 hover:scale-105"
            style={{
              backgroundColor: isLight
                ? "rgba(255, 255, 255, 0.75)"
                : "rgba(15, 23, 42, 0.65)",
              borderColor: isLight
                ? "rgba(203, 213, 225, 0.85)"
                : "rgba(51, 65, 85, 0.65)",
              color: soundMuted
                ? "#94a3b8"
                : isLight
                ? "#0284c7"
                : "#38bdf8",
            }}
          >
            {soundMuted ? (
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M23 9l-6 6M17 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span className="font-semibold">
              {soundMuted
                ? isAr
                  ? "نغمة البدء: صامت"
                  : "Startup Chime: Muted"
                : isAr
                ? "نغمة البدء الهادئة"
                : "Calm Startup Chime"}
            </span>
          </div>

          <span
            className="font-medium opacity-75"
            style={{ color: isLight ? "#64748b" : "#64748b" }}
          >
            {isAr ? "انقر في أي مكان للتخطي السريع" : "Click anywhere to skip"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* Miniature Visual Preview Screenshot of Masar UI (Dark Mode vs White Mode) */
function ThemePreviewMiniUI({ mode = "dark", versionDisplay = "v1.0.4" }) {
  const isDark = mode === "dark";
  return (
    <div
      dir="ltr"
      style={{
        background: isDark ? "#0b0f19" : "#dce3ec",
        borderColor: isDark ? "rgba(148,163,184,0.22)" : "rgba(15,23,42,0.16)",
        color: isDark ? "#f8fafc" : "#0f172a",
      }}
      className="w-full rounded-xl overflow-hidden border shadow-md select-none"
    >
      {/* Mini Titlebar */}
      <div
        style={{
          backgroundColor: isDark ? "#0e1422" : "#e6ecf3",
          borderBottom: isDark
            ? "1px solid rgba(148,163,184,0.16)"
            : "1px solid rgba(15,23,42,0.10)",
        }}
        className="h-6 px-2.5 flex items-center justify-between"
      >
        <div className="flex items-center gap-1.5">
          <MasarLogo size={13} />
          <span
            style={{ color: isDark ? "#f1f5f9" : "#0f172a" }}
            className="text-[9px] font-bold tracking-wide"
          >
            MASAR
          </span>
          <span
            style={{
              backgroundColor: isDark ? "rgba(14,165,233,0.16)" : "rgba(2,132,199,0.12)",
              color: isDark ? "#38bdf8" : "#0369a1",
              borderColor: isDark ? "rgba(56,189,248,0.35)" : "rgba(2,132,199,0.35)",
            }}
            className="text-[8px] px-1 rounded font-mono border"
          >
            {versionDisplay}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400/60" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400/60" />
          <span className="w-1.5 h-1.5 rounded-full bg-red-400/80" />
        </div>
      </div>

      {/* Mini Body */}
      <div className="p-2.5 space-y-2">
        {/* Mini Control Card */}
        <div
          style={{
            backgroundColor: isDark ? "#131b2e" : "#f2f5f9",
            borderColor: isDark ? "rgba(148,163,184,0.20)" : "rgba(15,23,42,0.14)",
          }}
          className="rounded-lg p-1.5 border flex items-center justify-between gap-1 shadow-sm"
        >
          <div className="flex items-center gap-1">
            <span
              style={{
                backgroundColor: isDark ? "rgba(14,165,233,0.20)" : "rgba(2,132,199,0.14)",
                color: isDark ? "#7dd3fc" : "#0369a1",
                borderColor: isDark ? "rgba(56,189,248,0.45)" : "rgba(2,132,199,0.38)",
              }}
              className="px-1.5 py-0.5 rounded text-[8px] font-bold border"
            >
              Visual MTR
            </span>
            <span
              style={{ color: isDark ? "#a3b3c9" : "#334155" }}
              className="px-1 py-0.5 text-[8px]"
            >
              DNS
            </span>
            <span
              style={{ color: isDark ? "#a3b3c9" : "#334155" }}
              className="px-1 py-0.5 text-[8px]"
            >
              Ports
            </span>
          </div>
          <span
            style={{
              backgroundColor: isDark ? "#0ea5e9" : "#0284c7",
              color: isDark ? "#090d18" : "#ffffff",
            }}
            className="px-2 py-0.5 rounded text-[8px] font-bold"
          >
            ▶ Start
          </span>
        </div>

        {/* Mini Health Card */}
        <div
          style={{
            background: isDark
              ? "linear-gradient(90deg, rgba(16,185,129,0.14) 0%, #131b2e 60%, #131b2e 100%)"
              : "linear-gradient(90deg, #e6f7f0 0%, #f2f5f9 60%, #f2f5f9 100%)",
            borderColor: isDark ? "rgba(16,185,129,0.40)" : "rgba(5,150,105,0.38)",
          }}
          className="rounded-lg p-2 border flex items-center justify-between shadow-sm"
        >
          <div className="space-y-0.5">
            <span
              style={{
                backgroundColor: isDark ? "rgba(16,185,129,0.18)" : "rgba(5,150,105,0.14)",
                color: isDark ? "#6ee7b7" : "#047857",
              }}
              className="inline-block text-[7px] font-bold px-1.5 py-0.2 rounded-full"
            >
              HEALTHY PATH
            </span>
            <div
              style={{ color: isDark ? "#f8fafc" : "#0f172a" }}
              className="text-[9px] font-bold"
            >
              Optimal Path • 8.8.8.8
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="24" height="24" viewBox="0 0 32 32">
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke={isDark ? "#1e293b" : "#d5dfeb"}
                strokeWidth="3"
              />
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="68 90"
                transform="rotate(-90 16 16)"
              />
            </svg>
            <div
              style={{ color: isDark ? "#34d399" : "#047857" }}
              className="text-xs font-extrabold font-mono"
            >
              98%
            </div>
          </div>
        </div>

        {/* Mini Telemetry Table */}
        <div
          style={{
            backgroundColor: isDark ? "#131b2e" : "#f2f5f9",
            borderColor: isDark ? "rgba(148,163,184,0.20)" : "rgba(15,23,42,0.14)",
          }}
          className="rounded-lg border overflow-hidden shadow-sm"
        >
          <div
            style={{
              backgroundColor: isDark ? "#0d1322" : "#e5ebf3",
              color: isDark ? "#a3b3c9" : "#334155",
              borderColor: isDark ? "rgba(148,163,184,0.16)" : "rgba(15,23,42,0.12)",
            }}
            className="px-2 py-1 text-[7px] font-mono uppercase flex justify-between border-b"
          >
            <span>#1 192.168.1.1</span>
            <span style={{ color: isDark ? "#34d399" : "#047857" }}>
              0.0% • 1.8ms
            </span>
          </div>
          <div
            style={{ color: isDark ? "#e2e8f0" : "#1e293b" }}
            className="px-2 py-1 text-[7px] font-mono uppercase flex justify-between"
          >
            <span>#5 8.8.8.8 (dns.google)</span>
            <span style={{ color: isDark ? "#38bdf8" : "#0369a1" }}>
              0.0% • 18.4ms
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Calm, Static Architectural Card Top Accent (Zero Moving Dots, Orbs, Waves or Laser Distractions) */
function SectionAmbientBackground({ variant = "mtr" }) {
  const palette = {
    mtr: "linear-gradient(90deg, transparent 5%, rgba(56, 189, 248, 0.32) 35%, rgba(16, 185, 129, 0.28) 65%, transparent 95%)",
    dns: "linear-gradient(90deg, transparent 5%, rgba(56, 189, 248, 0.32) 35%, rgba(99, 102, 241, 0.28) 65%, transparent 95%)",
    ports: "linear-gradient(90deg, transparent 5%, rgba(16, 185, 129, 0.32) 35%, rgba(20, 184, 166, 0.28) 65%, transparent 95%)",
    speed: "linear-gradient(90deg, transparent 5%, rgba(56, 189, 248, 0.35) 35%, rgba(16, 185, 129, 0.30) 65%, transparent 95%)",
  };
  const topLine = palette[variant] || palette.mtr;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl z-0"
    >
      {/* Static subtle top-edge specular hairline only — no moving dots, orbs, or waves */}
      <div
        style={{ background: topLine }}
        className="absolute top-0 inset-x-0 h-[1px] opacity-80"
      />
    </div>
  );
}

function TabIcon({ id, active }) {
  const cls = `w-3.5 h-3.5 ${active ? "text-sky-400" : "text-slate-400"}`;
  if (id === "mtr") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === "dns") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "ports") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const LatencySparkline = React.memo(function LatencySparkline({
  history = [],
  lossPercent = 0,
  width = 104,
  height = 24,
  colorOverride = "",
  zeroBaseline = false,
}) {
  if (!history || history.length === 0) {
    return <span className="text-xs text-slate-600">—</span>;
  }

  const samples = history.slice(-30);
  const minVal = zeroBaseline ? 0 : Math.min(...samples);
  const maxVal = zeroBaseline
    ? Math.max(...samples, 5) * 1.12
    : Math.max(...samples, minVal + 2);
  const range = Math.max(1, maxVal - minVal);

  const pts = samples.map((val, idx) => {
    const x =
      samples.length === 1
        ? width / 2
        : (idx / (samples.length - 1)) * (width - 6) + 3;
    const y = height - 4 - ((val - minVal) / range) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const strokeColor =
    colorOverride ||
    (lossPercent > 5.0
      ? "#ef4444"
      : lossPercent > 2.0
      ? "#fbbf24"
      : "#10b981");

  const fillColor =
    colorOverride === "#38bdf8"
      ? "rgba(56,189,248,0.16)"
      : colorOverride === "#0284c7"
      ? "rgba(2,132,199,0.16)"
      : colorOverride === "#059669"
      ? "rgba(5,150,105,0.15)"
      : lossPercent > 5.0
      ? "rgba(239,68,68,0.16)"
      : lossPercent > 2.0
      ? "rgba(251,191,36,0.16)"
      : "rgba(16,185,129,0.15)";

  const areaPoints = `3,${height - 2} ${pts.join(" ")} ${
    samples.length === 1 ? width / 2 : width - 3
  },${height - 2}`;

  const lastPt = pts[pts.length - 1].split(",");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block overflow-visible"
    >
      <polygon points={areaPoints} fill={fillColor} />
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts.join(" ")}
      />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="2.2" fill={strokeColor} />
    </svg>
  );
});

const HealthRadialGauge = React.memo(function HealthRadialGauge({
  score = 100,
  severity = "idle",
  unitLabel = "SCORE",
  isLight = false,
}) {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  const arcLength = 165.8; // 250 deg of r=38 (C = 238.76)
  const dashOffset = arcLength * (1 - clamped / 100);

  const strokeColor =
    severity === "critical"
      ? "#ef4444"
      : severity === "warning"
      ? "#f59e0b"
      : severity === "healthy"
      ? "#10b981"
      : "#38bdf8";

  const trackColor = isLight ? "#e2e8f0" : "#1e293b";
  const ringColor = isLight ? "rgba(148,163,184,0.28)" : "rgba(51,65,85,0.45)";

  return (
    <div className="relative w-[92px] h-[92px] shrink-0 flex items-center justify-center select-none">
      <svg width="92" height="92" viewBox="0 0 100 100" className="overflow-visible">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={ringColor}
          strokeWidth="1"
          strokeDasharray="2 4"
        />
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke={trackColor}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} 300`}
          transform="rotate(145 50 50)"
        />
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke={strokeColor}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} 300`}
          strokeDashoffset={dashOffset}
          transform="rotate(145 50 50)"
          className="masar-gauge-arc"
          style={{
            filter: isLight ? "none" : `drop-shadow(0 0 6px ${strokeColor}55)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
        <span
          dir="ltr"
          style={{ color: strokeColor }}
          className="text-xl font-extrabold font-mono leading-none tabular-nums"
        >
          {clamped}%
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">
          {unitLabel}
        </span>
      </div>
    </div>
  );
});

function ThroughputArcMeter({
  value = 0,
  peak = 100,
  color = "#38bdf8",
  active = false,
  isLight = false,
}) {
  const scaleMax = Math.max(100, (Number(peak) || 0) * 1.15);
  const pct = Math.max(0, Math.min(100, ((Number(value) || 0) / scaleMax) * 100));
  const arcLength = 104.7; // 250 deg of r=24 (C = 150.8)
  const dashOffset = arcLength * (1 - pct / 100);
  const trackColor = isLight ? "#e2e8f0" : "#1e293b";

  return (
    <div className="relative w-14 h-14 shrink-0 flex items-center justify-center select-none">
      <svg width="56" height="56" viewBox="0 0 64 64" className="overflow-visible">
        <circle
          cx="32"
          cy="32"
          r="24"
          fill="none"
          stroke={trackColor}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} 200`}
          transform="rotate(145 32 32)"
        />
        <circle
          cx="32"
          cy="32"
          r="24"
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} 200`}
          strokeDashoffset={dashOffset}
          transform="rotate(145 32 32)"
          className="masar-gauge-arc"
          style={{
            filter:
              active && !isLight ? `drop-shadow(0 0 5px ${color}66)` : "none",
          }}
        />
      </svg>
      <span
        dir="ltr"
        style={{ color }}
        className="absolute text-[10px] font-mono font-extrabold tabular-nums"
      >
        {Math.round(pct)}%
      </span>
    </div>
  );
}

const SPEED_ANCHORS_1G = [
  { v: 0, p: 0, label: "0" },
  { v: 5, p: 12, label: "5" },
  { v: 10, p: 24, label: "10" },
  { v: 25, p: 38, label: "25" },
  { v: 50, p: 52, label: "50" },
  { v: 100, p: 65, label: "100" },
  { v: 250, p: 77, label: "250" },
  { v: 500, p: 87, label: "500" },
  { v: 750, p: 94, label: "750" },
  { v: 1000, p: 100, label: "1000" },
];

const SPEED_ANCHORS_2G = [
  { v: 0, p: 0, label: "0" },
  { v: 10, p: 14, label: "10" },
  { v: 25, p: 27, label: "25" },
  { v: 50, p: 40, label: "50" },
  { v: 100, p: 53, label: "100" },
  { v: 250, p: 66, label: "250" },
  { v: 500, p: 77, label: "500" },
  { v: 1000, p: 87, label: "1G" },
  { v: 1500, p: 94, label: "1.5G" },
  { v: 2000, p: 100, label: "2G" },
];

const PING_ANCHORS = [
  { v: 0, p: 0, label: "0" },
  { v: 10, p: 20, label: "10" },
  { v: 25, p: 42, label: "25" },
  { v: 50, p: 64, label: "50" },
  { v: 100, p: 84, label: "100" },
  { v: 150, p: 100, label: "150" },
];

function mapSpeedGaugePct(val, anchors) {
  if (!Number.isFinite(val) || val <= 0) return 0;
  const last = anchors[anchors.length - 1];
  if (val >= last.v) return 100;
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1];
    const b = anchors[i];
    if (val <= b.v) {
      const ratio = (val - a.v) / (b.v - a.v || 1);
      return a.p + ratio * (b.p - a.p);
    }
  }
  return 100;
}

function SpeedtestBigGauge({
  phase = "ping",
  downloadMbps = 0,
  uploadMbps = 0,
  pingMs = 0,
  peakDownload = 0,
  peakUpload = 0,
  activeStreams = 1,
  connectionMode = "multi",
  history = [],
  isLight = false,
  lang = "en",
}) {
  const isDown = phase === "download";
  const isUp = phase === "upload";
  const isPing = phase === "ping";

  const targetVal = isDown ? downloadMbps : isUp ? uploadMbps : pingMs;
  const maxObserved = isDown
    ? Math.max(peakDownload || 0, downloadMbps || 0)
    : Math.max(peakUpload || 0, uploadMbps || 0);
  const anchors = isPing
    ? PING_ANCHORS
    : maxObserved > 980
    ? SPEED_ANCHORS_2G
    : SPEED_ANCHORS_1G;

  const color = isDown
    ? isLight
      ? "#0284c7"
      : "#38bdf8"
    : isUp
    ? isLight
      ? "#059669"
      : "#10b981"
    : isLight
    ? "#d97706"
    : "#f59e0b";
  const trackColor = isLight ? "#e2e8f0" : "#1e293b";
  const tickColor = isLight ? "#94a3b8" : "#475569";
  const labelColor = isLight ? "#475569" : "#94a3b8";

  const cx = 180;
  const cy = 158;
  const radius = 128;
  const circumference = 2 * Math.PI * radius; // 804.25
  const arcLength = circumference * (240 / 360); // 536.17

  const initialPct = mapSpeedGaugePct(targetVal, anchors);
  const initialDashOffset = arcLength * (1 - initialPct / 100);
  const initialRot = -120 + (initialPct / 100) * 240;

  const gradId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const arcRef = useRef(null);
  const needleRef = useRef(null);
  const numRef = useRef(null);
  const displayValRef = useRef(targetVal);
  const targetValRef = useRef(targetVal);
  const anchorsRef = useRef(anchors);
  const prevPhaseRef = useRef(phase);

  targetValRef.current = targetVal;
  anchorsRef.current = anchors;

  useEffect(() => {
    if (prevPhaseRef.current !== phase) {
      prevPhaseRef.current = phase;
      displayValRef.current = 0;
    }
  }, [phase]);

  useEffect(() => {
    const applyGaugeDom = (val) => {
      const pct = mapSpeedGaugePct(val, anchorsRef.current);
      if (arcRef.current) {
        arcRef.current.setAttribute(
          "stroke-dashoffset",
          String(arcLength * (1 - pct / 100))
        );
      }
      if (needleRef.current) {
        const rot = -120 + (pct / 100) * 240;
        needleRef.current.setAttribute(
          "transform",
          `rotate(${rot.toFixed(2)} ${cx} ${cy})`
        );
      }
      if (numRef.current) {
        numRef.current.textContent = Math.max(0, val || 0).toFixed(1);
      }
    };

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) {
      displayValRef.current = targetValRef.current;
      applyGaugeDom(displayValRef.current);
      return undefined;
    }

    if (Math.abs(targetValRef.current - displayValRef.current) < 0.01) {
      displayValRef.current = targetValRef.current;
      applyGaugeDom(displayValRef.current);
      return undefined;
    }

    let rafId = 0;
    let lastTs = performance.now();

    const step = (ts) => {
      const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000));
      lastTs = ts;
      const cur = displayValRef.current;
      const tgt = targetValRef.current;
      const alpha = 1 - Math.exp(-dt * 7.5);
      const settled = Math.abs(tgt - cur) < 0.03;
      const next = settled ? tgt : cur + (tgt - cur) * alpha;
      displayValRef.current = next;
      applyGaugeDom(next);
      if (!settled) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [targetVal, phase, arcLength]);

  const phaseBadge = isDown
    ? lang === "ar"
      ? `التحميل • ${activeStreams || 1} ${connectionMode === "single" ? "قناة" : "قنوات"}`
      : `DOWNLOAD • ${activeStreams || 1} ${activeStreams === 1 ? "Stream" : "Streams"}`
    : isUp
    ? lang === "ar"
      ? `الرفع • ${activeStreams || 1} ${connectionMode === "single" ? "قناة" : "قنوات"}`
      : `UPLOAD • ${activeStreams || 1} ${activeStreams === 1 ? "Stream" : "Streams"}`
    : lang === "ar"
    ? "فحص الاستجابة"
    : "IDLE PING";

  return (
    <div
      className="relative w-72 sm:w-80 md:w-[356px] flex flex-col items-center justify-center select-none"
      dir="ltr"
    >
      <svg
        width="100%"
        viewBox="0 0 360 288"
        className="overflow-visible w-full h-auto"
      >
        <defs>
          <linearGradient id={`speedGrad-${gradId}`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={isDown ? "#0ea5e9" : isUp ? "#059669" : "#d97706"} />
            <stop offset="100%" stopColor={isDown ? "#38bdf8" : isUp ? "#34d399" : "#fbbf24"} />
          </linearGradient>
        </defs>

        {/* Background Arc Track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference + 50}`}
          transform={`rotate(150 ${cx} ${cy})`}
        />

        {/* Illuminated 60fps Sweeping Value Arc */}
        <circle
          ref={arcRef}
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={`url(#speedGrad-${gradId})`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference + 50}`}
          strokeDashoffset={initialDashOffset}
          transform={`rotate(150 ${cx} ${cy})`}
          className="masar-gauge-arc"
          style={{
            filter: !isLight ? `drop-shadow(0 0 12px ${color}77)` : "none",
          }}
        />

        {/* Fixed Perimeter Tick Marks & Speedtest Scale Labels */}
        {anchors.map((a) => {
          const deg = 150 + (a.p / 100) * 240;
          const rad = (deg * Math.PI) / 180;
          const x1 = cx + Math.cos(rad) * 116;
          const y1 = cy + Math.sin(rad) * 116;
          const x2 = cx + Math.cos(rad) * 109;
          const y2 = cy + Math.sin(rad) * 109;
          const lx = cx + Math.cos(rad) * 95;
          const ly = cy + Math.sin(rad) * 95;
          return (
            <g key={a.label}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={tickColor}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <text
                x={lx}
                y={ly + 3.5}
                textAnchor="middle"
                fill={labelColor}
                fontSize="10"
                fontWeight="700"
                fontFamily="monospace"
              >
                {a.label}
              </text>
            </g>
          );
        })}

        {/* Rotating Gauge Pointer Needle */}
        <g
          ref={needleRef}
          transform={`rotate(${initialRot.toFixed(2)} ${cx} ${cy})`}
          opacity={isPing && pingMs <= 0 ? 0.35 : 0.92}
        >
          <polygon
            points={`${cx - 2.6},${cy - 8} ${cx + 2.6},${cy - 8} ${cx + 0.8},${cy - 109} ${cx - 0.8},${cy - 109}`}
            fill={color}
          />
          <circle
            cx={cx}
            cy={cy}
            r="4.5"
            fill={isLight ? "#ffffff" : "#0f172a"}
            stroke={color}
            strokeWidth="2.5"
          />
        </g>

        {/* Central Tabular Digital Telemetry (Positioned Cleanly Below Pivot Hub) */}
        <g textAnchor="middle">
          <text
            ref={numRef}
            x={cx}
            y={cy + 56}
            fill={color}
            fontSize="38"
            fontWeight="900"
            fontFamily="monospace"
            className="tabular-nums"
          >
            {(targetVal || 0).toFixed(1)}
          </text>
          <text
            x={cx}
            y={cy + 74}
            fill={labelColor}
            fontSize="11"
            fontWeight="700"
            letterSpacing="2"
          >
            {isPing ? "MS (PING)" : "MBPS"}
          </text>
        </g>
      </svg>

      {/* Bottom Crescent: Phase Badge + Live Stability Curve */}
      <div className="-mt-4 flex flex-col items-center gap-2">
        <span
          className={`text-xs font-extrabold px-3.5 py-1 rounded-full shadow-sm ${
            lang === "ar" ? "font-arabic" : "tracking-wide"
          }`}
          style={{
            backgroundColor: isLight ? `${color}1a` : `${color}24`,
            color,
            border: `1px solid ${color}55`,
            boxShadow: isLight ? "none" : `0 0 16px -4px ${color}50`,
          }}
        >
          {phaseBadge}
        </span>
        <div className="h-7 flex items-center justify-center">
          {!isPing && history && history.length >= 2 ? (
            <LatencySparkline
              history={history}
              width={168}
              height={26}
              colorOverride={color}
              zeroBaseline
            />
          ) : (
            <div className="w-[168px] h-[26px] flex items-center justify-center">
              <span className="text-[11px] font-medium text-slate-300 masar-text-glow-sky">
                {isPing
                  ? lang === "ar"
                    ? "جاري معايرة زمن المسار..."
                    : "Calibrating Route RTT..."
                  : lang === "ar"
                  ? "جاري مزامنة القنوات..."
                  : "Synchronizing Streams..."}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ThemeRadioIndicator({ active }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex items-center justify-center shrink-0 rounded-full transition-all duration-200"
      style={{
        width: 18,
        height: 18,
        border: `2px solid ${active ? "#0ea5e9" : "#94a3b8"}`,
        backgroundColor: active ? "#0ea5e9" : "transparent",
        boxShadow: active ? "0 0 0 4px rgba(14, 165, 233, 0.22)" : "none",
      }}
    >
      {active && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6.3l2.3 2.3 4.7-4.9"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

// Browser simulation helper for Ookla-calibrated Speedtest staged benchmark
function buildSimulatedSpeedSnapshot(prev, tick, mode = "multi") {
  const isSingle = mode === "single";
  const downTarget = isSingle ? 418.4 : 652.4;
  const upTarget = isSingle ? 214.2 : 318.6;
  let phase = "ping";
  let completed = false;
  let progress = 2;
  let downVal = 0;
  let upVal = 0;
  let activeStreams = isSingle ? 1 : 4;
  let loadedPing = prev?.loadedPingMs || 0;
  let downLatency = prev?.downloadLatencyMs || 0;
  let upLatency = prev?.uploadLatencyMs || 0;
  let finalDown = prev?.finalDownloadMbps || 0;
  let finalUp = prev?.finalUploadMbps || 0;

  if (tick <= 8) {
    phase = "ping";
    progress = Math.min(12, 2 + tick);
    activeStreams = isSingle ? 1 : 4;
  } else if (tick <= 42) {
    phase = "download";
    const step = tick - 8;
    progress = 12 + Math.round((step / 34) * 44);
    activeStreams = isSingle ? 1 : step <= 4 ? 4 : 12;
    const rampFactor = 1 - Math.exp(-step / 4.2);
    const wave = Math.sin(tick * 0.25) * (isSingle ? 4.5 : 6.2);
    downVal = +(rampFactor * downTarget + wave * rampFactor).toFixed(1);
    finalDown = downVal;
    downLatency = +(13.8 + Math.sin(tick * 0.35) * 0.7).toFixed(1);
    loadedPing = downLatency;
  } else if (tick <= 68) {
    phase = "upload";
    const step = tick - 42;
    progress = 56 + Math.round((step / 26) * 42);
    activeStreams = isSingle ? 1 : step <= 4 ? 3 : 8;
    downVal = finalDown || downTarget;
    const rampFactor = 1 - Math.exp(-step / 3.8);
    const wave = Math.cos(tick * 0.28) * (isSingle ? 2.8 : 4.2);
    upVal = +(rampFactor * upTarget + wave * rampFactor).toFixed(1);
    finalUp = upVal;
    upLatency = +(16.4 + Math.cos(tick * 0.32) * 0.9).toFixed(1);
    loadedPing = upLatency;
  } else {
    phase = "complete";
    completed = true;
    progress = 100;
    activeStreams = isSingle ? 1 : 12;
    downVal = isSingle ? 430.5 : 668.4;
    upVal = isSingle ? 221.0 : 326.8;
    finalDown = downVal;
    finalUp = upVal;
    downLatency = prev?.downloadLatencyMs || 14.1;
    upLatency = prev?.uploadLatencyMs || 16.4;
    loadedPing = upLatency;
  }

  const pingVal = +(11.2 + (tick % 3 === 0 ? 0.2 : -0.1)).toFixed(1);
  const jitterVal = 0.6;

  const defaultDown = [
    260.4, 345.1, 430.6, 515.2, 575.4, 610.8, 635.2, 646.4, 650.8, 655.2,
    653.5, 651.4, 652.8, 655.1, 654.4, 652.4,
  ];
  const defaultUp = [
    125.2, 188.4, 235.1, 270.5, 295.2, 308.4, 315.1, 319.4, 318.2, 317.4,
    320.5, 318.6,
  ];
  const defaultPing = [
    12.0, 11.4, 11.2, 11.5, 11.1, 11.3, 11.2, 11.4, 11.0, 11.2,
  ];

  const downHist =
    phase === "download" && downVal > 0
      ? [...(prev?.downloadHistory || []), downVal].slice(-36)
      : prev?.downloadHistory?.length > 0
      ? prev.downloadHistory
      : completed
      ? defaultDown
      : [];
  const upHist =
    phase === "upload" && upVal > 0
      ? [...(prev?.uploadHistory || []), upVal].slice(-36)
      : prev?.uploadHistory?.length > 0
      ? prev.uploadHistory
      : completed
      ? defaultUp
      : [];
  const pingHist = prev?.pingHistory?.length > 0 ? [...prev.pingHistory, pingVal].slice(-40) : defaultPing;

  const baseEdges = [
    { provider: "Cloudflare Anycast Edge", endpoint: "1.1.1.1:443", base: 11.2, hist: [11.8, 12.1, 11.4, 11.9, 11.2, 11.5, 11.1, 11.4, 11.2] },
    { provider: "Google Public Edge", endpoint: "8.8.8.8:443", base: 16.8, hist: [17.5, 16.9, 17.2, 16.8, 17.1, 16.7, 16.9, 16.8] },
    { provider: "Quad9 Security Edge", endpoint: "9.9.9.9:443", base: 21.4, hist: [22.4, 21.8, 22.1, 21.4, 21.9, 21.3, 21.6, 21.4] },
    { provider: "OpenDNS / Cisco Edge", endpoint: "208.67.222.222:443", base: 24.1, hist: [25.2, 24.6, 24.9, 24.1, 24.5, 23.9, 24.3, 24.1] },
  ];

  const edgePings = baseEdges.map((be) => {
    const hist = be.hist;
    const sum = hist.reduce((a, b) => a + b, 0);
    return {
      provider: be.provider,
      endpoint: be.endpoint,
      latencyMs: be.base,
      avgMs: Number((sum / hist.length).toFixed(1)),
      bestMs: Number(Math.min(...hist).toFixed(1)),
      history: hist,
      status: "online",
    };
  });

  return {
    running: !completed,
    completed,
    progress,
    phase,
    connectionMode: mode,
    activeStreams,
    downloadMbps: downVal,
    peakDownloadMbps: isSingle ? 430.5 : 668.4,
    finalDownloadMbps: finalDown || (completed ? downTarget : 0),
    uploadMbps: upVal,
    peakUploadMbps: isSingle ? 221.0 : 326.8,
    finalUploadMbps: finalUp || (completed ? upTarget : 0),
    pingMs: pingVal,
    bestPingMs: 9.8,
    maxPingMs: 12.4,
    latencyP50Ms: pingVal,
    latencyP95Ms: +(pingVal * 1.15).toFixed(1),
    latencyP99Ms: +(pingVal * 1.24).toFixed(1),
    loadedPingMs: loadedPing || 14.8,
    downloadLatencyMs: downLatency || (phase === "upload" || completed ? 14.1 : 0),
    downloadLatencyP95: downLatency ? +(downLatency * 1.18).toFixed(1) : (phase === "upload" || completed ? 16.6 : 0),
    uploadLatencyMs: upLatency || (completed ? 16.4 : 0),
    uploadLatencyP95: upLatency ? +(upLatency * 1.18).toFixed(1) : (completed ? 19.3 : 0),
    bufferbloatGrade: downLatency || upLatency || completed ? "A+" : "",
    jitterMs: jitterVal,
    packetLoss: 0.0,
    totalMB: +(15.2 + tick * 4.8).toFixed(1),
    clientIp: "198.51.100.42",
    clientIsp: "Saudi Telecom (STC Fiber)",
    clientLocation: "Riyadh, SA",
    serverName: "Cloudflare Anycast (RUH)",
    serverLocation: "POP RUH • Anycast Edge",
    downloadHistory: downHist,
    uploadHistory: upHist,
    pingHistory: pingHist,
    edgePings,
    updatedAt: new Date().toTimeString().slice(0, 8),
  };
}

function escapeHtml(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildBrowserSpeedReport(snap, lang = "ar", customVersion = "1.0.4") {
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const down = snap?.finalDownloadMbps || snap?.downloadMbps || 0;
  const up = snap?.finalUploadMbps || snap?.uploadMbps || 0;
  const ping = snap?.pingMs || 0;
  const downPing = snap?.downloadLatencyMs || snap?.loadedPingMs || ping;
  const upPing = snap?.uploadLatencyMs || snap?.loadedPingMs || ping;
  const jitter = snap?.jitterMs || 0;
  const loss = snap?.packetLoss || 0;
  const totalMB = snap?.totalMB || 0;
  const isSingle = snap?.connectionMode === "single";
  const modeLabel = escapeHtml(
    isAr
      ? isSingle ? "قناة واحدة (Single)" : "متعدد القنوات التكيّفي (Multi)"
      : isSingle ? "Single Connection" : "Multi-Connection (Adaptive)"
  );
  const serverLabel = escapeHtml(snap?.serverName || "Cloudflare Anycast CDN");
  const ispLabel = escapeHtml(snap?.clientIsp || (isAr ? "شبكة المزود المحلي" : "Detected ISP Network"));
  let grade = "C";
  let gradeColor = "#e11d48";
  let gradeBg = "#ffe4e6";
  if (down >= 100 && up >= 25 && ping > 0 && ping <= 40 && loss < 1) {
    grade = "A+";
    gradeColor = "#059669";
    gradeBg = "#d1fae5";
  } else if (down >= 35 && up >= 8 && ping > 0 && ping <= 85 && loss < 2) {
    grade = "A";
    gradeColor = "#0284c7";
    gradeBg = "#e0f2fe";
  } else if (down >= 12 && loss < 5) {
    grade = "B";
    gradeColor = "#f59e0b";
    gradeBg = "#fef3c7";
  }
  const gradeText = escapeHtml(
    isAr
      ? grade === "A+"
        ? "ممتاز فائق — أداء ألياف بصرية مثالي للألعاب التنافسية وبث 4K/8K المتزامن"
        : grade === "A"
        ? "جيد جداً — اتصال سريع ومستقر يلبي كافة متطلبات العمل المنزلي"
        : grade === "B"
        ? "جيد — كافٍ للتصفح والعمل المكتبي"
        : "محدود — مناسب للمهام الأساسية فقط وقد يتأثر عند ضغط الاستخدام"
      : grade === "A+"
      ? "Excellent — Fiber-grade performance for competitive gaming and 4K/8K streaming"
      : grade === "A"
      ? "Very Good — Reliable high-speed connection for home and office"
      : grade === "B"
      ? "Fair — Suitable for browsing and HD media"
      : "Limited — Suitable for basic browsing; heavy media or gaming may experience congestion"
  );

  const safeVersion = escapeHtml(customVersion);
  const nowFormatted = escapeHtml(new Date().toLocaleString(isAr ? "ar-SA" : "en-US"));
  const docTitle = escapeHtml(
    isAr ? "مسار — التقرير الرسمي لفحص سرعة الاتصال" : "Masar — Official Speed Benchmark Report"
  );
  const printBtnText = escapeHtml(
    isAr ? "حفظ كملف PDF / طباعة التقرير" : "Save as PDF / Print"
  );

  const edges = snap?.edgePings || [];
  let edgeRows = "";
  for (const ep of edges) {
    const isOnline = String(ep.status || "").toLowerCase() === "online";
    const statusBg = isOnline ? "#dcfce7" : "#fee2e2";
    const statusFg = isOnline ? "#15803d" : "#b91c1c";
    const statusLabel = escapeHtml(String(ep.status || "offline").toUpperCase());
    edgeRows += `
      <tr>
        <td style="font-weight:700">${escapeHtml(ep.provider || "Edge")}</td>
        <td dir="ltr" style="font-family:monospace;color:#64748b">${escapeHtml(ep.endpoint || "—")}</td>
        <td dir="ltr" style="font-weight:700;color:#0284c7">${ep.avgMs ? ep.avgMs.toFixed(1) + " ms" : "—"}</td>
        <td dir="ltr" style="color:#7c3aed">${ep.bestMs ? ep.bestMs.toFixed(1) + " ms" : "—"}</td>
        <td><span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;background:${statusBg};color:${statusFg}">${statusLabel}</span></td>
      </tr>
    `;
  }

  return `<!DOCTYPE html>
<html lang="${isAr ? "ar" : "en"}" dir="${dir}">
<head>
<meta charset="utf-8">
<title>${docTitle}</title>
<style>
  @page { size: A4 portrait; margin: 12mm 14mm 14mm 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ${isAr ? '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif' : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'};
    background: #f8fafc;
    color: #0f172a;
    line-height: 1.5;
    padding: 24px;
    text-align: ${isAr ? "right" : "left"};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .report-container { max-width: 860px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px -2px rgba(0,0,0,0.05); }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0284c7; padding-bottom: 20px; margin-bottom: 24px; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand-title { font-size: 20px; font-weight: 800; color: #0f172a; }
  .brand-sub { font-size: 11px; color: #64748b; font-weight: 600; }
  .print-btn { background: #0284c7; color: white; border: none; border-radius: 8px; padding: 8px 18px; font-size: 12px; font-weight: 700; cursor: pointer; }
  .hero-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
  .hero-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; text-align: center; }
  .hero-title { font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; }
  .hero-val { font-size: 34px; font-weight: 900; font-family: monospace; line-height: 1.1; }
  .hero-unit { font-size: 12px; font-weight: 600; color: #64748b; margin-top: 4px; }
  .verdict-box { background: ${gradeBg}; border: 1px solid ${gradeColor}; border-radius: 12px; padding: 16px 20px; display: flex; align-items: center; gap: 18px; margin-bottom: 24px; }
  .verdict-badge { width: 56px; height: 56px; border-radius: 12px; background: ${gradeColor}; color: white; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900; flex-shrink: 0; }
  .sec-heading { font-size: 14px; font-weight: 800; color: #1e293b; margin: 24px 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
  .kpi-table, .edge-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
  .edge-table th, .kpi-table th { background: #f1f5f9; padding: 8px 12px; font-weight: 700; border: 1px solid #e2e8f0; text-align: ${isAr ? "right" : "left"}; }
  .edge-table td, .kpi-table td { padding: 9px 12px; border: 1px solid #e2e8f0; }
  .method-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 12px; color: #166534; line-height: 1.6; }
  .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center; }
  @media print {
    body { padding: 0; background: white; }
    .report-container { border: none; box-shadow: none; padding: 0; }
    .print-btn { display: none !important; }
  }
</style>
</head>
<body>
<div class="report-container">
  <div class="header">
    <div class="brand">
      <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="border-radius:12px;box-shadow:0 2px 8px rgba(15,23,42,0.06);flex-shrink:0">
        <defs>
          <linearGradient id="msg_browser" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#06b6d4"/>
            <stop offset="50%" stop-color="#3b82f6"/>
            <stop offset="100%" stop-color="#10b981"/>
          </linearGradient>
          <filter id="msg_browser_shadow" x="-10%" y="-10%" width="120%" height="130%" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#0284c7" flood-opacity="0.28"/>
          </filter>
        </defs>
        <rect x="1.5" y="1.5" width="97" height="97" rx="24.5" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
        <path d="M18 72C18 42 25 24 35 24C45 24 47 52 50 52C53 52 55 24 65 24C75 24 82 42 82 72C74 72 69 58 65 40C61 52 57 69 50 69C43 69 39 52 35 40C31 58 26 72 18 72Z" fill="url(#msg_browser)" filter="url(#msg_browser_shadow)"/>
      </svg>
      <div>
        <div class="brand-title">MASAR</div>
        <div class="brand-sub">${isAr ? "تقرير فحص سرعة الاتصال المعتمد" : "Certified Speed Benchmark Report"} • v${safeVersion}</div>
      </div>
    </div>
    <button class="print-btn" onclick="window.print()">${printBtnText}</button>
  </div>

  <div class="verdict-box">
    <div class="verdict-badge">${grade}</div>
    <div>
      <div style="font-size:15px;font-weight:800;color:#0f172a">${isAr ? "مستوى جودة وسعة الاتصال" : "Connection Quality Grade"} (${grade})</div>
      <div style="font-size:12px;color:#334155;margin-top:2px">${gradeText}</div>
    </div>
  </div>

  <div class="sec-heading">${isAr ? "أولاً: السرعات المستدامة المعتمدة" : "1. Certified Sustained Throughput"}</div>
  <div class="hero-grid">
    <div class="hero-card" style="border-top: 4px solid #0284c7">
      <div class="hero-title" style="color:#0284c7">${isAr ? "التحميل المستدام" : "Sustained Download"}</div>
      <div class="hero-val" style="color:#0284c7">${down.toFixed(1)}</div>
      <div class="hero-unit">Mbps • ↓ ${downPing.toFixed(1)} ms</div>
    </div>
    <div class="hero-card" style="border-top: 4px solid #10b981">
      <div class="hero-title" style="color:#10b981">${isAr ? "الرفع المستدام" : "Sustained Upload"}</div>
      <div class="hero-val" style="color:#10b981">${up.toFixed(1)}</div>
      <div class="hero-unit">Mbps • ↑ ${upPing.toFixed(1)} ms</div>
    </div>
    <div class="hero-card" style="border-top: 4px solid #f59e0b">
      <div class="hero-title" style="color:#f59e0b">${isAr ? "الاستجابة (Idle)" : "Idle Ping"}</div>
      <div class="hero-val" style="color:#f59e0b">${ping.toFixed(1)}</div>
      <div class="hero-unit">ms • Jitter ${jitter.toFixed(1)} ms</div>
    </div>
  </div>

  <div class="sec-heading">${isAr ? "ثانياً: مؤشرات الاستجابة وجودة الخط تحت الضغط" : "2. Idle & Loaded Latency Breakdown"}</div>
  <table class="kpi-table">
    <tr>
      <th>${isAr ? "الاستجابة أثناء التحميل (Download Ping)" : "Download Latency"}</th>
      <td dir="ltr" style="font-weight:700;color:#0284c7">${downPing.toFixed(1)} ms</td>
      <th>${isAr ? "الاستجابة أثناء الرفع (Upload Ping)" : "Upload Latency"}</th>
      <td dir="ltr" style="font-weight:700;color:#10b981">${upPing.toFixed(1)} ms</td>
    </tr>
    <tr>
      <th>${isAr ? "تذبذب الاستجابة / الفقد" : "Jitter / Loss"}</th>
      <td dir="ltr" style="font-weight:700;color:#7c3aed">${jitter.toFixed(1)} ms (Loss ${loss.toFixed(1)}%)</td>
      <th>${isAr ? "حجم البيانات المستخدمة" : "Data Transferred"}</th>
      <td dir="ltr" style="font-weight:700">${totalMB.toFixed(1)} MB</td>
    </tr>
    <tr>
      <th>${isAr ? "ذروة التحميل (أعلى سرعة)" : "Peak Download"}</th>
      <td dir="ltr" style="font-weight:700;color:#0284c7">${(snap?.peakDownloadMbps || down).toFixed(1)} Mbps</td>
      <th>${isAr ? "ذروة الرفع (أعلى سرعة)" : "Peak Upload"}</th>
      <td dir="ltr" style="font-weight:700;color:#10b981">${(snap?.peakUploadMbps || up).toFixed(1)} Mbps</td>
    </tr>
    <tr>
      <th>${isAr ? "نمط الاتصال" : "Connection Mode"}</th>
      <td style="font-weight:700">${modeLabel}</td>
      <th>${isAr ? "المزود وخادم الفحص" : "ISP & Test Server"}</th>
      <td style="font-weight:600">${ispLabel} → ${serverLabel}</td>
    </tr>
  </table>

  ${edges.length > 0 ? `
  <div class="sec-heading">${isAr ? "ثالثاً: مصفوفة استجابة خوادم Anycast CDN" : "3. Anycast CDN Latency Matrix"}</div>
  <table class="edge-table">
    <thead>
      <tr>
        <th>${isAr ? "المزود" : "Provider"}</th>
        <th>${isAr ? "نقطة الاتصال" : "Endpoint"}</th>
        <th>${isAr ? "متوسط الاستجابة" : "Avg Latency"}</th>
        <th>${isAr ? "أفضل استجابة" : "Best RTT"}</th>
        <th>${isAr ? "الحالة" : "Status"}</th>
      </tr>
    </thead>
    <tbody>${edgeRows}</tbody>
  </table>` : ""}

  <div class="sec-heading">${isAr ? "رابعاً: منهجية الفحص والدقة" : "4. Methodology & Ookla Compliance"}</div>
  <div class="method-box">
    <strong>${isAr ? "معايير Ookla Speedtest القياسية" : "Ookla Speedtest Standard"}:</strong>
    ${isAr
      ? "تم تنفيذ الفحص عبر قنوات HTTP/1.1 TCP مستقلة ومعايرة أولية لسرعة الخط، ثم تقسيم القياس إلى 20 شريحة زمنية واستبعاد أبطأ 30% وأسرع 10% وحساب المتوسط الوسطي (60%) لضمان أقصى ثبات واستقرار."
      : "Measured over independent calibrated HTTP/1.1 TCP streams with initial ramp-up discard and a 20-slice Ookla trimmed mean (dropping slowest 30% and fastest 10% slices)."}
  </div>

  <div class="footer">
    ${isAr ? `تم استخراج التقرير بواسطة مسار (الإصدار ${safeVersion}) — صُنع بكل إتقان • ${nowFormatted}` : `Generated by Masar Visual Diagnostics (v${safeVersion}) • ${nowFormatted}`}
  </div>
</div>
</body>
</html>`;
}

// Browser simulation helper for MTR
function buildSimulatedSnapshot(target, tick, scenario, mode = "icmp") {
  const baseHops = [
    {
      hop: 1,
      ip: "192.168.1.1",
      hostname: "home-gateway.local",
      location: "Local LAN / Gateway",
      asn: "Private RFC1918",
      baseRtt: scenario === "wifi_loss" ? 42.0 : 2.1,
      lossRate: scenario === "wifi_loss" ? 8.5 : 0.0,
      jitter: scenario === "wifi_loss" ? 18.4 : 0.4,
    },
    {
      hop: 2,
      ip: "10.24.0.1",
      hostname: "bng-core-01.isp.net",
      location: "SA • Riyadh",
      asn: "AS39891 STC Gateway",
      baseRtt: scenario === "isp_loss" ? 95.0 : 9.4,
      lossRate: scenario === "isp_loss" ? 6.8 : 0.0,
      jitter: scenario === "isp_loss" ? 22.1 : 1.1,
    },
    {
      hop: 3,
      ip: "172.16.12.45",
      hostname: "pe-backbone-04.isp.net",
      location: "SA • Jeddah IXP",
      asn: "AS39891 Backbone",
      baseRtt: 14.2,
      lossRate: 0.0,
      jitter: 1.3,
    },
    {
      hop: 4,
      ip: "72.14.215.85",
      hostname: "peer-ix.google.com",
      location: "AE • Dubai Peering",
      asn: "AS15169 Google Edge",
      baseRtt: 19.8,
      lossRate: 0.0,
      jitter: 1.5,
    },
    {
      hop: 5,
      ip: target || "8.8.8.8",
      hostname:
        target === "8.8.8.8"
          ? "dns.google"
          : target === "1.1.1.1"
          ? "one.one.one.one"
          : "target.endpoint.net",
      location: "Global Anycast",
      asn: target === "1.1.1.1" ? "AS13335 Cloudflare" : "AS15169 Google LLC",
      baseRtt: 24.6,
      lossRate:
        scenario === "wifi_loss" ? 7.2 : scenario === "isp_loss" ? 5.9 : 0.0,
      jitter: 1.4,
      reachedDest: true,
    },
  ];

  const hops = baseHops.map((h) => {
    const sent = Math.max(12, tick);
    const lost = Math.round((sent * h.lossRate) / 100);
    const received = Math.max(0, sent - lost);
    const lossPercent = sent > 0 ? ((sent - received) / sent) * 100 : 0;
    const history = Array.from({ length: Math.min(20, Math.max(12, tick)) }, (_, idx) =>
      Number(
        Math.max(
          0.5,
          h.baseRtt + Math.sin(idx + h.hop) * h.jitter * 0.7
        ).toFixed(1)
      )
    );
    const lastMs = history[history.length - 1] || h.baseRtt;
    return {
      hop: h.hop,
      ip: h.ip,
      hostname: h.hostname,
      location: h.location,
      asn: h.asn,
      sent,
      received,
      lossPercent: Number(lossPercent.toFixed(1)),
      lastMs: Number(lastMs.toFixed(1)),
      avgMs: Number(h.baseRtt.toFixed(1)),
      bestMs: Number(Math.max(0.4, h.baseRtt - h.jitter).toFixed(1)),
      worstMs: Number((h.baseRtt + h.jitter * 1.8).toFixed(1)),
      jitterMs: Number(h.jitter.toFixed(1)),
      history,
      reachedDest: Boolean(h.reachedDest),
    };
  });

  const health = {
    score: 98,
    severity: "healthy",
    status: "Connection is Healthy — Optimal Path Performance",
    detail: `End-to-end latency to ${target || "8.8.8.8"} is 24.6 ms (jitter 1.4 ms, loss 0.0%).`,
    culpritHop: 0,
  };

  const protoLabel =
    mode === "tcp" ? "TCP-MTR :443" : mode === "udp" ? "UDP-MTR" : "ICMPv4";

  return {
    target: target || "8.8.8.8",
    resolvedIp: target || "8.8.8.8",
    protocol: protoLabel,
    ipVersion: 4,
    mosScore: 4.41,
    mosGrade: "HD",
    updatedAt: new Date().toTimeString().slice(0, 8),
    hops,
    health,
    running: true,
  };
}

const getUrlQueryParam = (key) => {
  if (typeof window === "undefined") return null;
  try {
    return new URLSearchParams(window.location.search).get(key);
  } catch {
    return null;
  }
};

export default function App() {
  const [lang, setLang] = useState(() => {
    const q = getUrlQueryParam("lang");
    if (q === "ar" || q === "en") return q;
    try {
      return localStorage.getItem("masar_lang") || "ar";
    } catch {
      return "ar";
    }
  });
  const [uiTheme, setUiTheme] = useState(() => {
    const q = getUrlQueryParam("theme");
    if (q === "light" || q === "dark") return q;
    try {
      const saved = localStorage.getItem("masar_theme");
      return saved === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  const [settingsOpen, setSettingsOpen] = useState(() => getUrlQueryParam("settings") === "1");
  const [reportModalOpen, setReportModalOpen] = useState(() => getUrlQueryParam("report") === "1");
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const q = getUrlQueryParam("tab");
    return q && ["mtr", "dns", "ports", "speed"].includes(q) ? q : "mtr";
  });
  const [stageState, setStageState] = useState(() => ({
    key: activeTab,
    phase: "enter",
  }));
  const [target, setTarget] = useState(() => getUrlQueryParam("target") || "8.8.8.8");
  const [isRunning, setIsRunning] = useState(() => getUrlQueryParam("trace") === "1");
  const [isMaximized, setIsMaximized] = useState(false);
  const [uiScale, setUiScale] = useState(() => {
    try {
      const saved = parseFloat(localStorage.getItem("masar_ui_scale"));
      return saved >= 0.8 && saved <= 1.6 ? saved : 1.0;
    } catch {
      return 1.0;
    }
  });
  const [menuCompact, setMenuCompact] = useState(() => {
    try {
      return localStorage.getItem("masar_menu_compact") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      document.documentElement.style.setProperty("--masar-zoom", String(uiScale));
      document.body.style.zoom = String(uiScale);
      localStorage.setItem("masar_ui_scale", String(uiScale));
    } catch {
      // ignore
    }
  }, [uiScale]);

  useEffect(() => {
    try {
      localStorage.setItem("masar_menu_compact", String(menuCompact));
    } catch {
      // ignore
    }
  }, [menuCompact]);

  const handleZoomIn = () => {
    setUiScale((prev) => Math.min(1.5, Math.round((prev + 0.1) * 10) / 10));
  };

  const handleZoomOut = () => {
    setUiScale((prev) => Math.max(0.8, Math.round((prev - 0.1) * 10) / 10));
  };

  const handleZoomReset = () => {
    setUiScale(1.0);
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        handleZoomReset();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const [snapshot, setSnapshot] = useState(() => {
    if (getUrlQueryParam("trace") === "1" || getUrlQueryParam("report") === "1") {
      return buildSimulatedSnapshot(getUrlQueryParam("target") || "8.8.8.8", 15, "healthy");
    }
    return {
      target: "8.8.8.8",
      resolvedIp: "8.8.8.8",
      updatedAt: "--:--:--",
      hops: [],
      health: INITIAL_HEALTH,
    };
  });
  const [errorBanner, setErrorBanner] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [exportFeedback, setExportFeedback] = useState("");
  const [reportNotice, setReportNotice] = useState("");
  const reportNoticeTimerRef = useRef(null);
  const [simScenario] = useState("healthy");
  const simTimerRef = useRef(null);
  const simTickRef = useRef(15);

  // Multi-Tools & Phase 2/3 Engine State
  const [mtrMode, setMtrMode] = useState("icmp");
  const [mtrTimeline, setMtrTimeline] = useState([]);
  const prevRouteSigRef = useRef("");

  const [dnsTarget, setDnsTarget] = useState("google.com");
  const [dnsResolver, setDnsResolver] = useState("system");
  const [dnsUseDoH, setDnsUseDoH] = useState(false);
  const [dnsLoading, setDnsLoading] = useState(false);
  const [dnsReport, setDnsReport] = useState(null);

  const [portHost, setPortHost] = useState("8.8.8.8");
  const [portSpec, setPortSpec] = useState("common");
  const [portLoading, setPortLoading] = useState(false);
  const [portReport, setPortReport] = useState(null);

  const [tlsPort, setTlsPort] = useState(443);
  const [tlsLoading, setTlsLoading] = useState(false);
  const [tlsReport, setTlsReport] = useState(null);

  useEffect(() => {
    const hopsList = snapshot?.hops || [];
    if (!snapshot?.updatedAt || snapshot.updatedAt === "--:--:--" || hopsList.length === 0) {
      return;
    }
    let refHop = null;
    for (let i = hopsList.length - 1; i >= 0; i--) {
      if (hopsList[i].received > 0) {
        refHop = hopsList[i];
        break;
      }
    }
    if (!refHop) return;
    const routeSig = hopsList.map((h) => `${h.hop}:${h.ip || "*"}:${h.routeChanges || 0}`).join("|");
    const routeShift = Boolean(prevRouteSigRef.current && prevRouteSigRef.current !== routeSig && snapshot.running);
    prevRouteSigRef.current = routeSig;

    setMtrTimeline((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].ts === snapshot.updatedAt && !routeShift) {
        return prev;
      }
      const nextPt = {
        ts: snapshot.updatedAt,
        avgMs: Number(refHop.avgMs || 0),
        worstMs: Number(refHop.worstMs || refHop.lastMs || refHop.avgMs || 0),
        lossPercent: Number(refHop.lossPercent || 0),
        mosScore: Number(snapshot.mosScore || refHop.mos || 0),
        routeShift,
      };
      const merged = [...prev, nextPt];
      return merged.length > 300 ? merged.slice(merged.length - 300) : merged;
    });
  }, [snapshot]);

  // Continuous Live Speed Benchmark State
  const [speedMode, setSpeedMode] = useState(() => {
    const qm = getUrlQueryParam("mode");
    if (qm === "single" || qm === "multi") return qm;
    try {
      return localStorage.getItem("masar_speed_mode") === "single" ? "single" : "multi";
    } catch {
      return "multi";
    }
  });
  const [speedMeta, setSpeedMeta] = useState(null);
  const [speedRunning, setSpeedRunning] = useState(() => {
    const sp = getUrlQueryParam("speed");
    return sp === "1" || sp === "download";
  });
  const [speedSnap, setSpeedSnap] = useState(() => {
    const sp = getUrlQueryParam("speed");
    const initMode = getUrlQueryParam("mode") === "single" ? "single" : "multi";
    if (sp === "complete") {
      return buildSimulatedSpeedSnapshot(INITIAL_SPEED, 70, initMode);
    }
    if (sp === "download") {
      return buildSimulatedSpeedSnapshot(INITIAL_SPEED, 28, initMode);
    }
    if (sp === "1") {
      return buildSimulatedSpeedSnapshot(INITIAL_SPEED, 8, initMode);
    }
    return INITIAL_SPEED;
  });
  const [speedCopied, setSpeedCopied] = useState(false);
  const [speedExporting, setSpeedExporting] = useState(false);
  const [speedPdfSaved, setSpeedPdfSaved] = useState(false);
  const speedSimTimerRef = useRef(null);
  const speedSimTickRef = useRef(8);
  const speedRunningRef = useRef(speedRunning);
  const lastSpeedSeqRef = useRef(0);
  const lastSpeedEventAtRef = useRef(0);
  const speedToggleBusyRef = useRef(false);
  const isRunningRef = useRef(isRunning);
  const lastMtrEventAtRef = useRef(0);
  const initialMtrSyncedRef = useRef(false);

  useEffect(() => {
    speedRunningRef.current = speedRunning;
  }, [speedRunning]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    try {
      localStorage.setItem("masar_speed_mode", speedMode);
    } catch {
      // ignore
    }
  }, [speedMode]);

  useEffect(() => {
    if (activeTab !== "speed" || speedMeta || !hasWailsBackend() || !window.go.main.App.GetSpeedMeta) {
      return undefined;
    }
    let cancelled = false;
    window.go.main.App.GetSpeedMeta()
      .then((m) => {
        if (!cancelled && m && (m.clientIsp || m.serverName)) {
          setSpeedMeta(m);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeTab, speedMeta]);

  const appVersion = useAppVersion();
  const versionDisplay = appVersion ? `v${appVersion}` : "v1.0.4";

  const [soundMuted, setSoundMuted] = useState(() => {
    try {
      return localStorage.getItem("masar_sound_muted") === "1";
    } catch {
      return false;
    }
  });
  const soundMutedRef = useRef(soundMuted);
  useEffect(() => {
    soundMutedRef.current = soundMuted;
  }, [soundMuted]);
  const chimePlayedRef = useRef(false);

  const [splashVisible, setSplashVisible] = useState(() => {
    const sp = getUrlQueryParam("splash");
    if (sp === "0" || getUrlQueryParam("nosplash") === "1") return false;
    return true;
  });
  const [splashExiting, setSplashExiting] = useState(false);
  const [splashProgress, setSplashProgress] = useState(() =>
    getUrlQueryParam("splash") === "1" ? 78 : 6
  );
  const [bootRevealPhase, setBootRevealPhase] = useState(() => {
    const sp = getUrlQueryParam("splash");
    if (sp === "0" || getUrlQueryParam("nosplash") === "1") return "ready";
    return "holding";
  });
  const bootRevealStartedRef = useRef(
    getUrlQueryParam("splash") === "0" || getUrlQueryParam("nosplash") === "1"
  );

  useEffect(() => {
    if (splashVisible && !splashExiting) {
      return undefined;
    }
    if (bootRevealStartedRef.current) {
      return undefined;
    }
    bootRevealStartedRef.current = true;
    setBootRevealPhase("entering");
    const timer = setTimeout(() => {
      setBootRevealPhase("ready");
    }, 950);
    return () => clearTimeout(timer);
  }, [splashVisible, splashExiting]);

  const handleToggleStartupSound = () => {
    setSoundMuted((prev) => {
      const next = !prev;
      soundMutedRef.current = next;
      try {
        localStorage.setItem("masar_sound_muted", next ? "1" : "0");
      } catch {
        // ignore
      }
      if (!next) {
        playMasarStartupChime(false);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!splashVisible) return undefined;
    if (!chimePlayedRef.current) {
      chimePlayedRef.current = true;
      if (!soundMutedRef.current) {
        playMasarStartupChime(false);
      }
    }
    if (getUrlQueryParam("splash") === "1") {
      setSplashProgress(78);
      return undefined;
    }
    const startTs = performance.now();
    const durationMs = 1950;
    let rafId = 0;
    let exitTimer = null;

    const tick = (now) => {
      const elapsed = now - startTs;
      const ratio = Math.min(1, Math.max(0, elapsed / durationMs));
      const eased = 1 - Math.pow(1 - ratio, 2.5);
      setSplashProgress(Math.min(100, Math.round(6 + eased * 94)));
      if (ratio < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setSplashExiting(true);
        exitTimer = setTimeout(() => {
          setSplashVisible(false);
        }, 420);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, [splashVisible]);

  const t = I18N[lang] || I18N.en;

  const selectLanguage = (nextLang) => {
    setLang(nextLang);
    try {
      localStorage.setItem("masar_lang", nextLang);
    } catch {
      // ignore storage error
    }
    setTimeout(() => setLangMenuOpen(false), 180);
  };

  const selectTheme = (nextTheme) => {
    setUiTheme(nextTheme);
    try {
      localStorage.setItem("masar_theme", nextTheme);
    } catch {
      // ignore storage error
    }
  };

  useEffect(() => {
    const isLight = uiTheme === "light";
    if (typeof document !== "undefined") {
      const rootEl = document.documentElement;
      const bodyEl = document.body;
      rootEl.classList.toggle("theme-light", isLight);
      rootEl.classList.remove("theme-emerald", "theme-glass");
      rootEl.classList.toggle("dark", !isLight);
      rootEl.style.colorScheme = isLight ? "light" : "dark";
      if (bodyEl) {
        bodyEl.classList.toggle("theme-light", isLight);
        bodyEl.classList.remove("theme-emerald", "theme-glass");
      }
    }
    const applyNativeWindowTheme = () => {
      if (!hasWailsRuntime()) return;
      if (isLight) {
        window.runtime.WindowSetLightTheme?.();
        window.runtime.WindowSetBackgroundColour?.(234, 240, 246, 255);
      } else {
        window.runtime.WindowSetDarkTheme?.();
        window.runtime.WindowSetBackgroundColour?.(11, 15, 25, 255);
      }
    };
    applyNativeWindowTheme();
    const timer = setTimeout(applyNativeWindowTheme, 120);
    return () => clearTimeout(timer);
  }, [uiTheme]);

  useEffect(() => {
    if (!hasWailsRuntime()) return;

    const offUpdate = window.runtime.EventsOn("mtr:update", (snap) => {
      if (snap) {
        lastMtrEventAtRef.current = Date.now();
        initialMtrSyncedRef.current = true;
        setSnapshot(snap);
        if (typeof snap.running === "boolean") {
          setIsRunning(snap.running);
        }
      }
    });

    const offStatus = window.runtime.EventsOn("mtr:status", (st) => {
      if (st && typeof st.running === "boolean") {
        lastMtrEventAtRef.current = Date.now();
        setIsRunning(st.running);
      }
    });

    const offError = window.runtime.EventsOn("mtr:error", (errMsg) => {
      if (errMsg) {
        setErrorBanner(String(errMsg));
        setIsRunning(false);
      }
    });

    const offSpeedUpdate = window.runtime.EventsOn("speed:update", (snap) => {
      if (!snap) return;
      const incomingSeq = typeof snap.seq === "number" ? snap.seq : 0;
      if (incomingSeq > 0 && incomingSeq < lastSpeedSeqRef.current) {
        return;
      }
      if (incomingSeq > 0) {
        lastSpeedSeqRef.current = incomingSeq;
      }
      lastSpeedEventAtRef.current = Date.now();
      setSpeedSnap(snap);
      if (snap.error) {
        setErrorBanner(String(snap.error));
        setSpeedRunning(false);
        return;
      }
      if (typeof snap.running === "boolean") {
        setSpeedRunning(snap.running && !snap.completed);
      }
    });

    const offSpeedStatus = window.runtime.EventsOn("speed:status", (st) => {
      if (st && typeof st.running === "boolean") {
        lastSpeedEventAtRef.current = Date.now();
        setSpeedRunning(st.running);
      }
    });

    const syncInterval = setInterval(async () => {
      if (!hasWailsBackend()) return;
      try {
        const mtrRecentlyStreamed =
          isRunningRef.current && Date.now() - lastMtrEventAtRef.current < 1500;
        const shouldPollMtr =
          (!initialMtrSyncedRef.current || isRunningRef.current) && !mtrRecentlyStreamed;
        if (shouldPollMtr && window.go.main.App.GetLastSnapshot) {
          const snap = await window.go.main.App.GetLastSnapshot();
          initialMtrSyncedRef.current = true;
          if (snap) {
            if (typeof snap.running === "boolean") {
              setIsRunning((prevRun) => (prevRun === snap.running ? prevRun : snap.running));
            }
            if (snap.hops && snap.hops.length > 0) {
              setSnapshot((prev) => {
                if (
                  prev.updatedAt === snap.updatedAt &&
                  prev.running === snap.running &&
                  prev.target === snap.target &&
                  (prev.hops?.length || 0) === snap.hops.length
                ) {
                  return prev;
                }
                return snap;
              });
            }
          }
        }
        const recentlyStreamed =
          speedRunningRef.current && Date.now() - lastSpeedEventAtRef.current < 1500;
        if (speedRunningRef.current && !recentlyStreamed && window.go.main.App.GetLastSpeedSnapshot) {
          const sp = await window.go.main.App.GetLastSpeedSnapshot();
          if (sp && typeof sp.running === "boolean") {
            const pollSeq = typeof sp.seq === "number" ? sp.seq : 0;
            if (pollSeq > 0 && pollSeq < lastSpeedSeqRef.current) {
              return;
            }
            if (pollSeq > lastSpeedSeqRef.current) {
              lastSpeedSeqRef.current = pollSeq;
            }
            setSpeedRunning((prevRun) => (prevRun === sp.running ? prevRun : sp.running));
            if (sp.error) {
              setErrorBanner(String(sp.error));
            }
            if (sp.running || sp.completed || sp.error || sp.totalMB > 0) {
              setSpeedSnap((prev) => {
                if (
                  prev.seq === sp.seq &&
                  prev.running === sp.running &&
                  prev.completed === sp.completed &&
                  prev.phase === sp.phase &&
                  prev.error === sp.error &&
                  prev.progress === sp.progress &&
                  prev.downloadMbps === sp.downloadMbps &&
                  prev.uploadMbps === sp.uploadMbps &&
                  prev.pingMs === sp.pingMs &&
                  prev.updatedAt === sp.updatedAt
                ) {
                  return prev;
                }
                return sp;
              });
            }
          }
        }
      } catch {
        // ignore transient RPC errors
      }
    }, 800);

    return () => {
      clearInterval(syncInterval);
      if (typeof offUpdate === "function") offUpdate();
      if (typeof offStatus === "function") offStatus();
      if (typeof offError === "function") offError();
      if (typeof offSpeedUpdate === "function") offSpeedUpdate();
      if (typeof offSpeedStatus === "function") offSpeedStatus();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
      if (speedSimTimerRef.current) clearInterval(speedSimTimerRef.current);
      if (reportNoticeTimerRef.current) clearTimeout(reportNoticeTimerRef.current);
    };
  }, []);

  const handleMinimize = () => {
    if (window.runtime?.WindowMinimise) {
      window.runtime.WindowMinimise();
    }
  };

  const handleToggleMaximize = async () => {
    if (window.runtime?.WindowToggleMaximise) {
      window.runtime.WindowToggleMaximise();
      if (window.runtime?.WindowIsMaximised) {
        try {
          const max = await window.runtime.WindowIsMaximised();
          setIsMaximized(Boolean(max));
          return;
        } catch {
          // fallback toggle
        }
      }
    }
    setIsMaximized((prev) => !prev);
  };

  const handleClose = () => {
    if (window.runtime?.Quit) {
      window.runtime.Quit();
    } else if (typeof window !== "undefined") {
      window.close();
    }
  };

  const handleStartStop = async () => {
    setErrorBanner("");
    if (isRunning) {
      await stopTrace();
    } else {
      await startTrace(target);
    }
  };

  const startTrace = async (targetHost, modeOverride = "") => {
    const clean = (targetHost || "").trim();
    if (!clean) {
      setErrorBanner("Please enter a valid target IPv4 address or hostname.");
      return;
    }
    const activeMode = modeOverride || mtrMode;
    setMtrTimeline([]);
    prevRouteSigRef.current = "";

    if (hasWailsBackend()) {
      try {
        setIsRunning(true);
        if (window.go.main.App.StartTraceWithMode) {
          await window.go.main.App.StartTraceWithMode(clean, activeMode);
        } else {
          await window.go.main.App.StartTrace(clean);
        }
      } catch (err) {
        setIsRunning(false);
        setErrorBanner(typeof err === "string" ? err : err?.message || String(err));
      }
    } else {
      startBrowserSimulation(clean, simScenario, activeMode);
    }
  };

  const stopTrace = async () => {
    if (hasWailsBackend()) {
      try {
        await window.go.main.App.StopTrace();
      } catch (err) {
        console.error(err);
      }
      setIsRunning(false);
    } else {
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
      setIsRunning(false);
    }
  };

  const startBrowserSimulation = (cleanTarget, scenario, activeMode = "icmp") => {
    if (simTimerRef.current) clearInterval(simTimerRef.current);
    simTickRef.current = 0;
    setIsRunning(true);

    const runSimStep = () => {
      simTickRef.current += 1;
      const tick = simTickRef.current;
      const simulated = buildSimulatedSnapshot(cleanTarget, tick, scenario, activeMode);
      setSnapshot(simulated);
    };

    runSimStep();
    simTimerRef.current = setInterval(runSimStep, 1000);
  };

  const showReportConfirmation = (msg) => {
    setReportNotice(msg);
    if (reportNoticeTimerRef.current) {
      clearTimeout(reportNoticeTimerRef.current);
    }
    reportNoticeTimerRef.current = setTimeout(() => {
      setReportNotice("");
    }, 6500);
  };

  const handleCopySummary = async () => {
    setErrorBanner("");
    try {
      let reportText = "";
      if (hasWailsBackend()) {
        if (window.go.main.App.CopySupportSummaryWithLang) {
          reportText = await window.go.main.App.CopySupportSummaryWithLang(lang);
        } else {
          reportText = await window.go.main.App.CopySupportSummary();
        }
      } else {
        const locH = localizeHealth(snapshot?.health, snapshot?.hops || [], lang);
        reportText = buildBrowserDetailedReport(snapshot, lang, locH, appVersion);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(reportText);
        }
      }
      if (reportText) {
        setCopyFeedback(t.copiedSummary);
        setTimeout(() => setCopyFeedback(""), 2600);
        showReportConfirmation(
          lang === "ar"
            ? "تم نسخ التقرير التشخيصي الشامل (مع تحليل المقاطع وشرح جميع البيانات المستخرجة) إلى الحافظة — جاهز للصق فوراً."
            : "Detailed diagnostic report (including segment breakdown & metric reference guide) copied to clipboard."
        );
      }
    } catch (err) {
      setErrorBanner(typeof err === "string" ? err : err?.message || String(err));
    }
  };

  const handleExportReport = async (format) => {
    setErrorBanner("");
    try {
      if (hasWailsBackend() && window.go.main.App.ExportReport) {
        const savedPath = window.go.main.App.ExportReportWithLang
          ? await window.go.main.App.ExportReportWithLang(format, lang)
          : await window.go.main.App.ExportReport(`${format}:${lang}`);
        if (savedPath) {
          const fmtUpper = format.toUpperCase();
          setExportFeedback(fmtUpper);
          setTimeout(() => setExportFeedback(""), 2800);
          if (format === "html") {
            showReportConfirmation(
              lang === "ar" ? (
                <>
                  تم حفظ التقرير الرسمي القابل للطباعة بصيغة PDF في المسار:{" "}
                  <bdi dir="ltr" className="font-mono px-1">
                    {savedPath}
                  </bdi>{" "}
                  — افتح الملف واضغط على «حفظ كملف PDF / طباعة التقرير».
                </>
              ) : (
                <>
                  Official printable PDF/HTML report saved to:{" "}
                  <span className="font-mono">{savedPath}</span> — Open it and click "Save as PDF / Print".
                </>
              )
            );
          } else {
            showReportConfirmation(
              lang === "ar" ? (
                <>
                  تم تصدير ملف البيانات المفصل (<bdi dir="ltr" className="font-mono">{fmtUpper}</bdi>) مع قاموس شرح المؤشرات في:{" "}
                  <bdi dir="ltr" className="font-mono px-1">
                    {savedPath}
                  </bdi>
                </>
              ) : (
                <>
                  Detailed {fmtUpper} report with metric dictionary saved to:{" "}
                  <span className="font-mono">{savedPath}</span>
                </>
              )
            );
          }
        }
      } else {
        const locH = localizeHealth(snapshot?.health, snapshot?.hops || [], lang);
        const blobData =
          format === "json"
            ? JSON.stringify(snapshot, null, 2)
            : format === "html"
            ? buildBrowserHTMLReport(snapshot, lang, locH, appVersion)
            : format === "csv"
            ? buildBrowserCSVReport(snapshot)
            : buildBrowserDetailedReport(snapshot, lang, locH, appVersion);
        const mimeType =
          format === "html"
            ? "text/html;charset=utf-8"
            : format === "json"
            ? "application/json;charset=utf-8"
            : format === "csv"
            ? "text/csv;charset=utf-8"
            : "text/plain;charset=utf-8";
        const blob = new Blob([blobData], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `masar-report-${snapshot.target}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        setExportFeedback(format.toUpperCase());
        setTimeout(() => setExportFeedback(""), 2800);
        showReportConfirmation(
          lang === "ar"
            ? `تم تنزيل ملف التقرير (${format.toUpperCase()}) بنجاح.`
            : `Report file (${format.toUpperCase()}) downloaded successfully.`
        );
      }
    } catch (err) {
      setErrorBanner(typeof err === "string" ? err : err?.message || String(err));
    }
  };

  const handlePresetSelect = (presetVal) => {
    setTarget(presetVal);
    if (isRunning) {
      startTrace(presetVal);
    }
  };

  const handleRunDNS = async (e) => {
    if (e) e.preventDefault();
    setDnsLoading(true);
    setErrorBanner("");
    try {
      if (hasWailsBackend() && window.go.main.App.RunDNSLookupWithOptions) {
        const res = await window.go.main.App.RunDNSLookupWithOptions(
          dnsTarget,
          dnsResolver,
          dnsUseDoH
        );
        setDnsReport(res);
      } else if (hasWailsBackend() && window.go.main.App.RunDNSLookup) {
        const res = await window.go.main.App.RunDNSLookup(dnsTarget);
        setDnsReport(res);
      } else {
        setDnsReport({
          target: dnsTarget,
          resolver: dnsUseDoH ? `${dnsResolver === "system" ? "1.1.1.1" : dnsResolver} (DoH)` : dnsResolver,
          useDoH: dnsUseDoH,
          dnssecValidated: dnsUseDoH || dnsResolver !== "system",
          queryTimeMs: 14.2,
          checkedAt: new Date().toTimeString().slice(0, 8),
          records: [
            { type: "A", value: "142.250.185.46", ttl: 300, latencyMs: 11.4, dnssec: dnsUseDoH },
            { type: "AAAA", value: "2a00:1450:4001:810::200e", ttl: 300, latencyMs: 12.1, dnssec: dnsUseDoH },
            { type: "MX", value: "10 smtp.google.com", ttl: 600, latencyMs: 13.8 },
            { type: "NS", value: "ns1.google.com", ttl: 3600, latencyMs: 9.6 },
            { type: "SOA", value: "ns1.google.com dns-admin.google.com (serial 20261115, refresh 900s)", ttl: 60, latencyMs: 14.0 },
            { type: "CAA", value: '0 issue "pki.goog"', ttl: 3600, latencyMs: 14.2 },
          ],
        });
      }
    } catch (err) {
      setErrorBanner(typeof err === "string" ? err : err?.message || String(err));
    } finally {
      setDnsLoading(false);
    }
  };

  const handleRunPortScan = async (e) => {
    if (e) e.preventDefault();
    setPortLoading(true);
    setErrorBanner("");
    try {
      if (hasWailsBackend() && window.go.main.App.RunPortScanSpec) {
        const res = await window.go.main.App.RunPortScanSpec(portHost, portSpec);
        setPortReport(res);
      } else if (hasWailsBackend() && window.go.main.App.RunPortScan) {
        const res = await window.go.main.App.RunPortScan(portHost, []);
        setPortReport(res);
      } else {
        setPortReport({
          host: portHost,
          resolvedIp: portHost,
          openCount: 2,
          totalPorts: 6,
          durationMs: 312.5,
          results: [
            { port: 22, service: "SSH", state: "filtered", latencyMs: 0 },
            { port: 53, service: "DNS", state: "open", latencyMs: 18.4 },
            { port: 80, service: "HTTP", state: "closed", latencyMs: 0 },
            { port: 443, service: "HTTPS", state: "open", latencyMs: 19.1 },
            { port: 3306, service: "MySQL", state: "closed", latencyMs: 0 },
            { port: 3389, service: "RDP", state: "closed", latencyMs: 0 },
          ],
        });
      }
    } catch (err) {
      setErrorBanner(typeof err === "string" ? err : err?.message || String(err));
    } finally {
      setPortLoading(false);
    }
  };

  const handleInspectTls = async (e) => {
    if (e) e.preventDefault();
    setTlsLoading(true);
    setErrorBanner("");
    try {
      if (hasWailsBackend() && window.go.main.App.RunTLSInspect) {
        const res = await window.go.main.App.RunTLSInspect(portHost, tlsPort);
        setTlsReport(res);
      } else {
        setTlsReport({
          host: portHost,
          port: tlsPort,
          protocolVersion: "TLS 1.3",
          cipherSuite: "TLS_AES_128_GCM_SHA256",
          handshakeMs: 24.8,
          subject: portHost,
          issuer: "WE1 (Google Trust Services)",
          sans: [portHost, `*.${portHost}`],
          notBefore: "2026-09-01",
          notAfter: "2027-03-01",
          daysRemaining: 106,
          verified: true,
          checkedAt: new Date().toTimeString().slice(0, 8),
        });
      }
    } catch (err) {
      setErrorBanner(typeof err === "string" ? err : err?.message || String(err));
    } finally {
      setTlsLoading(false);
    }
  };

  // Staged Speedtest Benchmark Runner (Start / Stop)
  const handleToggleSpeedBenchmark = async (overrideMode) => {
    if (speedToggleBusyRef.current) return;
    speedToggleBusyRef.current = true;
    try {
      const activeMode =
        overrideMode === "single" || overrideMode === "multi" ? overrideMode : speedMode;
      setErrorBanner("");
      if (speedRunning) {
        if (hasWailsBackend() && window.go.main.App.StopSpeedBenchmark) {
          await window.go.main.App.StopSpeedBenchmark();
        }
        if (speedSimTimerRef.current) {
          clearInterval(speedSimTimerRef.current);
          speedSimTimerRef.current = null;
        }
        setSpeedRunning(false);
      } else {
        setSpeedSnap({
          ...INITIAL_SPEED,
          ...(speedMeta || {}),
          running: true,
          completed: false,
          error: "",
          progress: 1,
          phase: "ping",
          connectionMode: activeMode,
          activeStreams: activeMode === "single" ? 1 : 4,
        });

        if (
          hasWailsBackend() &&
          (window.go.main.App.StartSpeedBenchmarkWithMode ||
            window.go.main.App.StartSpeedBenchmark)
        ) {
          try {
            lastSpeedEventAtRef.current = Date.now();
            setSpeedRunning(true);
            if (window.go.main.App.StartSpeedBenchmarkWithMode) {
              await window.go.main.App.StartSpeedBenchmarkWithMode(activeMode);
            } else {
              await window.go.main.App.StartSpeedBenchmark();
            }
          } catch (err) {
            setSpeedRunning(false);
            setErrorBanner(typeof err === "string" ? err : err?.message || String(err));
          }
        } else {
          speedSimTickRef.current = 0;
          setSpeedRunning(true);
          if (speedSimTimerRef.current) {
            clearInterval(speedSimTimerRef.current);
          }
          speedSimTimerRef.current = setInterval(() => {
            speedSimTickRef.current += 1;
            const tk = speedSimTickRef.current;
            setSpeedSnap((prev) => {
              const nextSnap = buildSimulatedSpeedSnapshot(prev, tk, activeMode);
              if (nextSnap.completed) {
                if (speedSimTimerRef.current) {
                  clearInterval(speedSimTimerRef.current);
                  speedSimTimerRef.current = null;
                }
                setSpeedRunning(false);
              }
              return nextSnap;
            });
          }, 420);
        }
      }
    } finally {
      speedToggleBusyRef.current = false;
    }
  };

  const handleCopySpeedResults = () => {
    const down = speedSnap.finalDownloadMbps || speedSnap.downloadMbps || 0;
    const up = speedSnap.finalUploadMbps || speedSnap.uploadMbps || 0;
    const ping = speedSnap.pingMs || 0;
    const downPing = speedSnap.downloadLatencyMs || speedSnap.loadedPingMs || ping;
    const upPing = speedSnap.uploadLatencyMs || speedSnap.loadedPingMs || ping;
    const jitter = speedSnap.jitterMs || 0;
    const loss = speedSnap.packetLoss || 0;
    const modeStr = (speedSnap.connectionMode || speedMode) === "single"
      ? (lang === "ar" ? "قناة واحدة (Single)" : "Single Connection")
      : (lang === "ar" ? "متعدد القنوات (Multi)" : "Multi-Connection");
    const grade =
      down >= 100 && up >= 25 && ping > 0 && ping <= 40 && loss < 1
        ? "A+"
        : down >= 35 && up >= 8 && ping > 0 && ping <= 85 && loss < 2
        ? "A"
        : down >= 12 && loss < 5
        ? "B"
        : "C";
    const peakDown = speedSnap.peakDownloadMbps || down;
    const peakUp = speedSnap.peakUploadMbps || up;
    const text =
      lang === "ar"
        ? `🚀 نتيجة فحص سرعة مسار (${versionDisplay} — ${modeStr}):\n• سرعة التحميل (المستدامة): ${down.toFixed(1)} Mbps (الذروة: ${peakDown.toFixed(1)} Mbps)\n• سرعة الرفع (المستدامة): ${up.toFixed(1)} Mbps (الذروة: ${peakUp.toFixed(1)} Mbps)\n• الاستجابة: الخمول ${ping.toFixed(1)} ms | أثناء التحميل ${downPing.toFixed(1)} ms | أثناء الرفع ${upPing.toFixed(1)} ms\n• التذبذب: ${jitter.toFixed(1)} ms | فقد الحزم: ${loss.toFixed(1)}%\n• الخادم: ${speedSnap.serverName || "Cloudflare Anycast"} | التقييم: ${grade}`
        : `🚀 Masar Speedtest Results (${versionDisplay} — ${modeStr}):\n• Download (Sustained): ${down.toFixed(1)} Mbps (Peak: ${peakDown.toFixed(1)} Mbps)\n• Upload (Sustained): ${up.toFixed(1)} Mbps (Peak: ${peakUp.toFixed(1)} Mbps)\n• Latency: Idle ${ping.toFixed(1)} ms | Download ${downPing.toFixed(1)} ms | Upload ${upPing.toFixed(1)} ms\n• Jitter: ${jitter.toFixed(1)} ms | Loss: ${loss.toFixed(1)}%\n• Server: ${speedSnap.serverName || "Cloudflare Anycast"} | Grade: ${grade}`;

    try {
      if (hasWailsRuntime() && window.runtime.ClipboardSetText) {
        window.runtime.ClipboardSetText(text);
      } else if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      }
    } catch {
      // ignore
    }
    setSpeedCopied(true);
    setTimeout(() => setSpeedCopied(false), 2400);
  };

  const handleExportSpeedPdf = async () => {
    setSpeedExporting(true);
    try {
      if (hasWailsBackend() && window.go?.main?.App?.ExportSpeedReport) {
        const savedPath = await window.go.main.App.ExportSpeedReport(lang);
        if (savedPath) {
          setSpeedPdfSaved(true);
          setTimeout(() => setSpeedPdfSaved(false), 3800);
          showReportConfirmation(
            lang === "ar" ? (
              <>
                تم حفظ تقرير فحص السرعة بنجاح! مسار حفظ الملف:{" "}
                <bdi dir="ltr" className="font-mono font-bold text-white px-1">
                  {savedPath}
                </bdi>{" "}
                — افتح الملف واضغط على «حفظ كملف PDF / طباعة التقرير».
              </>
            ) : (
              <>
                Speed benchmark report saved successfully! File saved to:{" "}
                <span className="font-mono font-bold text-white">{savedPath}</span> — Open it to print or save as PDF.
              </>
            )
          );
        }
      } else {
        const htmlContent = buildBrowserSpeedReport(speedSnap, lang, versionDisplay.replace(/^v/, ""));
        const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, "_blank");
        if (win) {
          win.focus();
        } else {
          const a = document.createElement("a");
          a.href = url;
          a.download = `masar-speed-report-${new Date().toISOString().slice(0, 10)}.html`;
          a.click();
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        setSpeedPdfSaved(true);
        setTimeout(() => setSpeedPdfSaved(false), 3800);
        showReportConfirmation(
          lang === "ar"
            ? "تم حفظ وتوليد تقرير فحص السرعة الرسمي — يمكنك حفظه كملف PDF عبر أمر الطباعة مباشرة."
            : "Official speed report generated — use Print to save as PDF."
        );
      }
    } catch (err) {
      setErrorBanner(typeof err === "string" ? err : err?.message || String(err));
    } finally {
      setSpeedExporting(false);
    }
  };

  const health = snapshot?.health || INITIAL_HEALTH;
  const hops = snapshot?.hops || [];
  const localizedHealth = localizeHealth(health, hops, lang);
  const localizedErrorBanner = localizeErrorMessage(errorBanner, lang);

  const hop1 = hops.find((h) => h.hop === 1) || null;
  const transitHops = hops.filter((h) => h.hop > 1 && !h.reachedDest);
  const respondingTransit = transitHops.filter((h) => h.received > 0);
  const silentTransitCount = transitHops.length - respondingTransit.length;
  const primaryIspHop = respondingTransit[0] || transitHops[0] || null;
  const destHop =
    hops.find((h) => h.reachedDest) ||
    (hops.length > 1 ? hops[hops.length - 1] : null);

  const getHealthTheme = (severity) => {
    const isLight = uiTheme === "light";
    switch (severity) {
      case "healthy":
        return {
          border: isLight ? "border-emerald-300" : "border-emerald-500/40",
          bg: isLight
            ? "from-emerald-50 via-white to-white"
            : "from-emerald-950/50 via-slate-900/90 to-slate-900/90",
          badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
          bar: "bg-emerald-500",
          scoreText: "text-emerald-400",
          label: t.badgeHealthy,
        };
      case "warning":
        return {
          border: isLight ? "border-amber-300" : "border-amber-500/50",
          bg: isLight
            ? "from-amber-50 via-white to-white"
            : "from-amber-950/50 via-slate-900/90 to-slate-900/90",
          badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
          bar: "bg-amber-400",
          scoreText: "text-amber-400",
          label: t.badgeWarning,
        };
      case "critical":
        return {
          border: isLight ? "border-red-300" : "border-red-500/60",
          bg: isLight
            ? "from-red-50 via-white to-white"
            : "from-red-950/55 via-slate-900/90 to-slate-900/90",
          badge: "bg-red-500/20 text-red-300 border-red-500/40",
          bar: "bg-red-500",
          scoreText: "text-red-400",
          label: t.badgeCritical,
        };
      default:
        return {
          border: "border-slate-800",
          bg: isLight
            ? "from-white via-white to-slate-50"
            : "from-slate-900 via-slate-900 to-slate-950",
          badge: "bg-slate-800 text-slate-300 border-slate-700",
          bar: "bg-sky-500",
          scoreText: "text-sky-400",
          label: t.badgeIdle,
        };
    }
  };

  const theme = getHealthTheme(health.severity);

  const getLossColorClass = (lossPct, sent, received) => {
    if (!sent || sent === 0 || (received === 0 && lossPct === 0)) {
      return "text-slate-500";
    }
    if (lossPct > 5.0) return "text-red-500 font-bold";
    if (lossPct > 2.0) return "text-amber-400 font-semibold";
    return "text-emerald-400 font-medium";
  };

  const getRowHighlightClass = (hop) => {
    if (hop.lossPercent > 5.0) {
      return "bg-red-950/20 hover:bg-red-950/35";
    }
    if (hop.lossPercent > 2.0) {
      return "bg-amber-950/15 hover:bg-amber-950/25";
    }
    return "hover:bg-slate-800/50";
  };

  const guideSections =
    lang === "ar"
      ? [
          {
            badge: "القسم الأول",
            title: "الفحص البصري للمسار وخريطة الموقع الجغرافي",
            summary:
              "الأداة الرئيسية في البرنامج؛ تجمع بين فحص الاستجابة وتتبع المسار في وقت واحد كل ثانية لاكتشاف مكان التقطيع أو ارتفاع زمن الاستجابة بدقة.",
            points: [
              "مؤشر جودة الاتصال (من 0% إلى 100%): يقيّم كفاءة خطك تلقائياً ويخبرك باللغة الواضحة هل الاتصال سليم أم يوجد خلل من الشبكة المنزلية والراوتر (القفزة 1) أو من مزود الخدمة (القفزتين 2 و3) أو من الخادم البعيد.",
              "خريطة المسار المعماري (4 مراحل): تعرض مسار الحزم بصرياً عبر أربع محطات: جهازك الحالي، ثم الراوتر المحلي، ثم بوابة المزود والربط الدولي، وصولاً إلى الوجهة النهائية.",
              "جدول القفزات اللحظي: يعرض لكل راوتر في الطريق رقم القفزة، والعنوان الرقمي واسم المضيف، والموقع الجغرافي ومزود الخدمة، ونسبة الفقد، وعدد الحزم المرسلة والمستلمة، وزمن الاستجابة الحالي والمتوسط، والتذبذب الزمني، ومنحنى الاستقرار لآخر 60 ثانية.",
              "الراوترات الصامتة: إذا كان أحد راوترات العبور يحجب رسائل الفحص أمنياً بينما يستجيب الخادم النهائي دون فقد، يضع البرنامج علامة (—) ولا يحتسبه كعطل وهمي.",
            ],
          },
          {
            badge: "القسم الثاني",
            title: "فاحص سجلات النطاقات والفحص العكسي",
            summary:
              "أداة لفحص خوادم أسماء النطاقات وتحليل جميع السجلات المرتبطة بأي موقع أو عنوان رقمي في أجزاء من الثانية.",
            points: [
              "فحص متوازٍ للسجلات: يستعلم في اللحظة نفسها عن سجلات A (عنوان IPv4)، وAAAA (عنوان IPv6)، وCNAME (الاسم البديل)، وMX (خوادم البريد)، وNS (خوادم النطاق)، وTXT (سجلات التحقق والحماية).",
              "الفحص العكسي: عند إدخال عنوان رقمي مثل (8.8.8.8) يقوم البرنامج بجلب الاسم العكسي المسجل لهذا العنوان في سجلات PTR.",
              "زمن الاستعلام: يقيس سرعة استجابة خادم النطاقات الحالي على شبكتك بالمللي ثانية.",
            ],
          },
          {
            badge: "القسم الثالث",
            title: "فاحص المنافذ المتوازي",
            summary:
              "يفحص المنافذ الأساسية لأي خادم أو جهاز على الشبكة لمعرفة الخدمات النشطة أو المحجوبة وسرعة استجابتها.",
            points: [
              "المنافذ المفحوصة: يفحص بشكل متوازٍ منافذ الخدمات القياسية مثل SSH (22)، وDNS (53)، وHTTP (80)، وHTTPS (443)، وSMB (445)، وMySQL (3306)، وRDP (3389)، وPostgreSQL (5432)، وRedis (6379).",
              "حالة المنفذ وزمن الاتصال: يوضح لكل منفذ ما إذا كان مفتوحاً باللون الأخضر أو مغلقاً، ويحسب زمن مصافحة الاتصال بالمللي ثانية.",
            ],
          },
          {
            badge: "القسم الرابع",
            title: "قياس السرعة الاحترافي بمعايير Speedtest",
            summary:
              "محرك قياس سرعة واستجابة بمعايير Ookla القياسية: معايرة أولية لسرعة الخط، قنوات TCP مستقلة، ومتوسط مشذّب من 20 شريحة زمنية.",
            points: [
              "نمط متعدد القنوات أو قناة واحدة (Multi / Single): تكيّف تلقائي بين 4 إلى 12 قناة تحميل (و3 إلى 8 للرفع) عبر HTTP/1.1 المستقلة، مع إمكانية اختيار جلسة TCP مفردة.",
              "منهجية 20 شريحة واستبعاد الإحماء: استبعاد مرحلة بدء اتصال TCP ثم شطب أبطأ 30% وأسرع 10% من الشرائح لاستخراج سرعة ثابتة ودقيقة، مع قياس الاستجابة في الخمول وتحت ضغط التحميل والرفع.",
            ],
          },
          {
            badge: "القسم الخامس",
            title: "تصدير التقارير الاحترافية وشرح البيانات",
            summary:
              "أدوات توثيق حالة الشبكة لمشاركتها مع الدعم الفني لشركة الاتصالات أو فريق تقنية المعلومات.",
            points: [
              "نسخ التقرير النصي: ينسخ تقريراً تشخيصياً شاملاً ومنسقاً بضغطة واحدة للصقه في تذاكر الدعم الفني أو المحادثات.",
              "التقرير الرسمي القابل للطباعة (PDF / HTML): ينشئ وثيقة رسمية تحمل شعار مسار وملخص التشخيص وجدول القفزات وشرح المؤشرات جاهزة للحفظ بصيغة PDF.",
              "تصدير JSON وCSV: لحفظ البيانات المهيكلة أو فتحها مباشرة في برنامج Microsoft Excel بدعم كامل للغة العربية.",
            ],
          },
        ]
      : [
          {
            badge: "Section 1",
            title: "Visual MTR & Geo-IP Route Topology",
            summary:
              "Combines real-time Ping and Traceroute every second over raw ICMPv4 sockets to pinpoint packet loss and latency bottlenecks.",
            points: [
              "Connection Health Score (0% – 100%): Automatically evaluates Hop 1 (Local Router/Wi-Fi), Hops 2-3 (ISP Gateway), and the target server to deliver a plain-language verdict.",
              "4-Stage Route Architecture: Visualizes packet flow from This Device → Local Gateway (Hop 1) → ISP & Transit Backbone → Target Destination.",
              "Real-Time Telemetry Table: Displays Hop #, IP/Hostname, Geo-IP Location & ASN, Loss %, Sent/Recv counts, Last/Avg RTT (ms), Jitter (ms), and a live 60-second sparkline.",
              "Smart ICMP Silent Filtering: Intermediate routers that drop ICMP Time Exceeded packets while downstream hops reply cleanly are marked as silent (—) rather than false 100% packet loss.",
            ],
          },
          {
            badge: "Section 2",
            title: "DNS Record & Reverse PTR Inspector",
            summary:
              "Concurrently resolves domain records and reverse IP lookups while measuring DNS resolver latency.",
            points: [
              "Concurrent Record Resolution: Queries A, AAAA, CNAME, MX, NS, and TXT records simultaneously.",
              "Reverse PTR Lookup: Resolves PTR hostnames when given an IPv4/IPv6 address.",
              "Query Time Telemetry: Measures exact DNS response time in milliseconds (ms).",
            ],
          },
          {
            badge: "Section 3",
            title: "Concurrent TCP Port Scanner",
            summary:
              "Tests standard infrastructure and service ports in parallel to verify reachability and firewall rules.",
            points: [
              "Standard Ports Scanned: Probes ports 22 (SSH), 53 (DNS), 80 (HTTP), 443 (HTTPS), 445 (SMB), 3306 (MySQL), 3389 (RDP), 5432 (PostgreSQL), 6379 (Redis), and 8080 (HTTP-Alt).",
              "Handshake Latency: Reports OPEN/CLOSED status and exact TCP three-way handshake RTT in milliseconds.",
            ],
          },
          {
            badge: "Section 4",
            title: "Speedtest-Calibrated Bandwidth & Edge Benchmark",
            summary:
              "Follows Ookla Speedtest standards: adaptive HTTP/1.1 TCP calibration, idle vs. loaded latency tracking, and 20-slice trimmed mean scoring.",
            points: [
              "Multi & Single Connection Modes: Scales dynamically across independent HTTP/1.1 TCP streams (up to 12 download / 8 upload) or tests single-stream performance with warmup buffer exclusion and slowest-30% / fastest-10% slice trimming.",
              "Loaded Ping & Global Edge Matrix: Separately tracks Idle Ping, Download Latency, Upload Latency (Bufferbloat), and continuous Anycast latencies across Cloudflare, Google, Quad9, and OpenDNS.",
            ],
          },
          {
            badge: "Section 5",
            title: "Diagnostic Reports & Export (Copy / PDF / JSON / CSV)",
            summary:
              "One-click reporting tools designed for ISP support tickets and network engineering documentation.",
            points: [
              "Copy Summary: Copies a formatted ASCII report directly to your clipboard.",
              "PDF / HTML Report: Generates a printable branded diagnostic report with health verdict and hop table.",
              "JSON & CSV Exports: Exports structured telemetry for Excel or monitoring pipelines.",
            ],
          },
        ];

  return (
    <div
      dir={t.dir}
      lang={lang}
      style={{ height: "calc(100vh / var(--masar-zoom, 1))" }}
      className={`bg-[#0b0f19] text-slate-100 flex flex-col overflow-hidden select-none transition-colors duration-300 ${
        uiTheme === "light" ? "theme-light" : ""
      } ${
        bootRevealPhase === "holding"
          ? "masar-workspace-holding"
          : bootRevealPhase === "entering"
          ? "masar-workspace-entering"
          : ""
      }`}
    >
      {splashVisible && (
        <MasarStartupSplash
          lang={lang}
          isLight={uiTheme === "light"}
          versionDisplay={versionDisplay}
          progress={splashProgress}
          exiting={splashExiting}
          soundMuted={soundMuted}
          onToggleSound={handleToggleStartupSound}
          onSkip={() => {
            if (!splashExiting) {
              setSplashProgress(100);
              setSplashExiting(true);
              setTimeout(() => setSplashVisible(false), 320);
            }
          }}
        />
      )}

      {/* Sleek Custom Frameless Titlebar (hidden while startup splash is active) */}
      <div
        dir="ltr"
        className={`masar-boot-titlebar wails-drag h-10 w-full shrink-0 flex items-center justify-between pl-3.5 pr-1.5 select-none z-50 ${
          splashVisible && !splashExiting ? "pointer-events-none" : ""
        } ${
          uiTheme === "light"
            ? "bg-[#f6f9fc] border-b border-slate-900/[0.09]"
            : "bg-[#0e1422] border-b border-slate-700/50"
        }`}
        style={{ WebkitAppRegion: "drag", "--wails-draggable": "drag" }}
        onDoubleClick={handleToggleMaximize}
      >
        {/* Left: Branding + Window Title */}
        <div className="flex items-center gap-2.5 pointer-events-none">
          <MasarLogo size={20} className="shrink-0 drop-shadow-sm" />
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-slate-100 tracking-wide leading-normal flex items-center">
              <span dir="ltr">MASAR</span>
            </span>
            <span className="text-[11px] font-semibold leading-none text-sky-200 bg-sky-500/15 border border-sky-400/35 px-2 py-1 rounded-full font-mono">
              {versionDisplay}
            </span>
          </div>
          <span className="hidden sm:inline-block h-3.5 w-px bg-slate-700/70 mx-0.5" />
          <span
            dir={t.dir}
            className="hidden sm:inline-block font-sans text-xs font-medium text-slate-200 leading-normal masar-text-glow-sky"
          >
            {t.appSubtitle}
          </span>
          {(isRunning || speedRunning) && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold leading-none text-emerald-200 bg-emerald-500/15 border border-emerald-500/35 px-2.5 py-1 rounded-full ml-1">
              <StatusLottie variant="loading" size={13} />
              {t.tracingLive}
            </span>
          )}
        </div>

        {/* Right: Window Controls */}
        <div
          className="wails-no-drag flex items-center gap-1"
          style={{ WebkitAppRegion: "no-drag", "--wails-draggable": "no-drag" }}
        >
          <button
            type="button"
            onClick={handleMinimize}
            className="h-7 w-9 flex items-center justify-center rounded-md hover:bg-slate-800/80 text-slate-400 hover:text-slate-100 transition"
            title={lang === "ar" ? "تصغير" : "Minimize"}
          >
            <svg width="10" height="2" viewBox="0 0 10 2" fill="currentColor">
              <rect width="10" height="1.5" rx="0.75" />
            </svg>
          </button>

          <button
            type="button"
            onClick={handleToggleMaximize}
            className="h-7 w-9 flex items-center justify-center rounded-md hover:bg-slate-800/80 text-slate-400 hover:text-slate-100 transition"
            title={
              isMaximized
                ? lang === "ar"
                  ? "استعادة الحجم"
                  : "Restore"
                : lang === "ar"
                ? "تكبير"
                : "Maximize"
            }
          >
            {isMaximized ? (
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              >
                <rect x="2" y="0.5" width="7.5" height="7.5" rx="1" />
                <path d="M0.5 2.5V9.5H7.5" />
              </svg>
            ) : (
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              >
                <rect x="0.5" y="0.5" width="9" height="9" rx="1" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="h-7 w-9 flex items-center justify-center rounded-md hover:bg-red-500/90 text-slate-400 hover:text-white transition"
            title={lang === "ar" ? "إغلاق" : "Close"}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            >
              <path d="M1 1L9 9M9 1L1 9" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div
        id="masar-scroll-root"
        className="masar-scroll-viewport relative flex-1 min-h-0 flex flex-col"
      >
      {/* Top Section: Same rounded-2xl border and max-w-7xl alignment edges as the cards below */}
      <header className="masar-boot-header max-w-7xl w-full mx-auto px-6 pt-5">
        <div className="relative overflow-hidden bg-slate-900/60 border border-slate-800/90 rounded-2xl p-4 shadow-lg flex flex-col gap-3">
          <SectionAmbientBackground variant={activeTab} />
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            {/* Harmonized Vector Tool Navigation Bar */}
            <div className="flex items-center gap-2">
              <nav className="masar-well flex items-center bg-slate-950 border border-slate-800/90 rounded-xl p-1 gap-1">
                {[
                  { id: "mtr", label: t.tabMtr, short: "MTR" },
                  { id: "dns", label: t.tabDns, short: "DNS" },
                  { id: "ports", label: t.tabPorts, short: lang === "ar" ? "المنافذ" : "Ports" },
                  { id: "speed", label: t.tabSpeed, short: lang === "ar" ? "السرعة" : "Speed" },
                ].map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setErrorBanner("");
                        setActiveTab(tab.id);
                      }}
                      className={`masar-nav-btn masar-icon-btn px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                        active
                          ? "bg-sky-500/20 text-sky-200 border border-sky-400/50 shadow-md shadow-sky-500/15"
                          : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] border border-transparent"
                      }`}
                      title={tab.label}
                    >
                      <span className="masar-icon-target">
                        <TabIcon id={tab.id} active={active} />
                      </span>
                      <MorphLabel
                        compact={menuCompact}
                        compactText={tab.short}
                        fullText={tab.label}
                        className="tracking-wide"
                      />
                      {active && (
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-sm shadow-sky-400 animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </nav>

              <button
                type="button"
                onClick={() => setMenuCompact((prev) => !prev)}
                className={`masar-well masar-nav-btn masar-icon-btn h-9 px-2.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-semibold transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  menuCompact
                    ? "bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm shadow-sky-500/15"
                    : "bg-slate-950 border-slate-800/90 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
                title={t.menuToggleTitle}
              >
                <span className="masar-icon-target">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path
                      d="M10.5 4v16"
                      className="transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{ transform: menuCompact ? "translateX(-3px)" : "translateX(0px)" }}
                    />
                    <path
                      d="M16.5 9.5L13.5 12l3 2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{
                        transformOrigin: "15px 12px",
                        transform: menuCompact ? "rotate(180deg) translateX(1px)" : "rotate(0deg)",
                      }}
                    />
                  </svg>
                </span>
                <span className="text-[11px] hidden md:inline-flex items-center">
                  <MorphLabel
                    compact={menuCompact}
                    compactText={t.menuCompact}
                    fullText={t.menuExpanded}
                  />
                </span>
              </button>
            </div>

            {/* Quick Targets & Target Controls (Shown in sync with Visual MTR Stage) */}
            {stageState.key === "mtr" && (
              <div
                className={`flex flex-wrap items-center gap-2 ${
                  stageState.phase === "exit" && activeTab !== "mtr"
                    ? "masar-page-exit"
                    : "masar-page-enter"
                }`}
              >
                <div className="masar-well flex items-center bg-slate-950 border border-slate-800/90 rounded-xl p-1 gap-1">
                  {PRESETS.map((preset) => {
                    const active = target.trim() === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => handlePresetSelect(preset.value)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                          active
                            ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent"
                        }`}
                      >
                        {lang === "ar" ? preset.labelAr : preset.labelEn}{" "}
                        <span className="font-mono text-[11px] opacity-75">
                          ({preset.value})
                        </span>
                      </button>
                    );
                  })}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    startTrace(target, mtrMode);
                  }}
                  className="flex flex-wrap items-center gap-2 shrink-0"
                >
                  <div
                    role="group"
                    aria-label={lang === "ar" ? "بروتوكول الفحص" : "Probe Protocol"}
                    className="masar-well inline-flex items-center p-0.5 rounded-xl bg-slate-950 border border-slate-700/80"
                    dir="ltr"
                  >
                    {[
                      { id: "icmp", label: "ICMP" },
                      { id: "tcp", label: "TCP" },
                      { id: "udp", label: "UDP" },
                    ].map((pm) => {
                      const active = mtrMode === pm.id;
                      return (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => {
                            setMtrMode(pm.id);
                            if (isRunning && target.trim()) {
                              startTrace(target, pm.id);
                            }
                          }}
                          title={
                            pm.id === "icmp"
                              ? lang === "ar"
                                ? "ICMP Echo القياسي (تتبع كل القفزات)"
                                : "Standard ICMP Echo Traceroute"
                              : pm.id === "tcp"
                                ? lang === "ar"
                                  ? "TCP-MTR (يدعم host:port مثل 1.1.1.1:443)"
                                  : "TCP-MTR Probe (supports host:port e.g. 1.1.1.1:443)"
                                : lang === "ar"
                                  ? "UDP-MTR (المنافذ 33434+)"
                                  : "UDP-MTR Probes (ports 33434+)"
                          }
                          className={`px-2 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                            active
                              ? "bg-sky-600 text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {pm.label}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    dir="ltr"
                    type="text"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder={t.targetPlaceholder}
                    className="masar-well w-48 sm:w-56 bg-slate-950 border border-slate-700/80 focus:border-sky-500 focus:outline-none rounded-xl px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 font-mono"
                  />

                  <button
                    type="button"
                    onClick={handleStartStop}
                    className={`group masar-cta-sheen masar-action-btn shrink-0 whitespace-nowrap active:scale-95 px-3.5 py-1.5 rounded-xl text-xs font-bold tracking-tight transition-all duration-300 flex items-center gap-2 border ${
                      isRunning
                        ? "bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_6px_16px_-4px_rgba(239,68,68,0.28)]"
                        : "bg-gradient-to-r from-sky-500 via-sky-400 to-cyan-400 hover:from-sky-400 hover:via-cyan-400 hover:to-emerald-400 text-slate-950 border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_6px_16px_-4px_rgba(14,165,233,0.38)]"
                    }`}
                  >
                    {isRunning ? (
                      <>
                        <span className="h-4 w-4 shrink-0 rounded-md bg-red-500/25 text-red-300 flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-90 group-hover:scale-110">
                          <span className="w-2 h-2 rounded-sm bg-red-400" />
                        </span>
                        <span>{t.stopTrace}</span>
                      </>
                    ) : (
                      <>
                        <span className="h-4 w-4 shrink-0 rounded-md bg-slate-950/15 text-slate-950 flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-[360deg] group-hover:scale-110">
                          <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 12 12">
                            <path d="M2.5 1.5L10.5 6L2.5 10.5V1.5Z" />
                          </svg>
                        </span>
                        <span>{t.startTrace}</span>
                      </>
                    )}
                  </button>
                </form>

                <ExportToolbarCapsule
                  lang={lang}
                  hopsCount={hops.length}
                  copyFeedback={copyFeedback}
                  exportFeedback={exportFeedback}
                  onCopySummary={handleCopySummary}
                  onExportReport={handleExportReport}
                  onOpenStudio={() => setReportModalOpen(true)}
                />
              </div>
            )}
          </div>
        </div>
      </header>

      {localizedErrorBanner && (
        <div className="masar-page-enter max-w-7xl w-full mx-auto px-6 pt-4">
          <div className="rounded-xl bg-red-950/60 border border-red-500/50 px-4 py-3 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <StatusLottie variant="error" size={26} className="mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-red-200">
                  {t.errorTitle}
                </h3>
                <p className="text-xs text-red-300/90 mt-0.5 leading-relaxed">
                  {localizedErrorBanner}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setErrorBanner("")}
              className="text-xs text-red-300 hover:text-white px-2.5 py-0.5 rounded bg-red-900/40 shrink-0 font-semibold"
            >
              {t.dismiss}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col">
      <TabStage
        activeKey={activeTab}
        onStageChange={(key, phase) => setStageState({ key, phase })}
        renderTab={(renderedTab) => (
          <>
            {renderedTab === "mtr" && (
        <main
          key="tab-mtr"
          className="flex-1 max-w-7xl w-full mx-auto px-6 py-5 pb-16 flex flex-col gap-5"
        >
          {reportNotice && (
            <div className="masar-page-enter rounded-xl bg-emerald-950/40 border border-emerald-500/40 px-4 py-3 flex items-center justify-between gap-4 shadow-md">
              <div className="flex items-center gap-3 min-w-0">
                <StatusLottie variant="success" size={24} />
                <p className="text-xs text-emerald-200 font-semibold leading-relaxed break-all">
                  {reportNotice}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportNotice("")}
                className="text-xs text-emerald-300 hover:text-white px-2.5 py-0.5 rounded-lg bg-emerald-950/50 border border-emerald-500/30 shrink-0 font-semibold"
              >
                {t.dismiss}
              </button>
            </div>
          )}

          <section
            className={`masar-stagger-1 relative overflow-hidden rounded-2xl border ${theme.border} bg-gradient-to-r ${theme.bg} p-5 shadow-xl`}
          >
            <SectionAmbientBackground variant="mtr" />
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${theme.badge}`}
                  >
                    {theme.label}
                  </span>
                  {snapshot.protocol && (
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-sky-300" dir="ltr">
                      {snapshot.protocol}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    {t.targetLabel}:{" "}
                    <bdi dir="ltr" className="font-mono text-slate-300">
                      {snapshot.target || target}
                      {snapshot.resolvedIp &&
                      snapshot.resolvedIp !== snapshot.target
                        ? ` (${snapshot.resolvedIp})`
                        : ""}
                    </bdi>
                  </span>
                  {snapshot.updatedAt && snapshot.updatedAt !== "--:--:--" && (
                    <span className="text-xs text-slate-500">
                      • {t.updatedLabel}:{" "}
                      <bdi dir="ltr" className="font-mono">
                        {snapshot.updatedAt}
                      </bdi>
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                    {localizedHealth.status}
                  </h2>

                  <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
                    {localizedHealth.detail}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <div className="masar-well px-3 py-1.5 rounded-xl border border-slate-800/80 flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {t.endToEndRtt}:
                    </span>
                    <span className="text-xs font-mono font-bold text-sky-400" dir="ltr">
                      {destHop && destHop.received > 0
                        ? `${destHop.avgMs.toFixed(1)} ms`
                        : "—"}
                    </span>
                  </div>

                  <div className="masar-well px-3 py-1.5 rounded-xl border border-slate-800/80 flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {t.routeJitter}:
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400" dir="ltr">
                      {destHop && destHop.received > 1
                        ? `${destHop.jitterMs.toFixed(1)} ms`
                        : "—"}
                    </span>
                  </div>

                  <div className="masar-well px-3 py-1.5 rounded-xl border border-slate-800/80 flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {t.endToEndLoss}:
                    </span>
                    <span
                      className={`text-xs font-mono font-bold ${
                        destHop && destHop.lossPercent > 2
                          ? "text-red-400"
                          : "text-slate-200"
                      }`}
                      dir="ltr"
                    >
                      {destHop && destHop.sent > 0
                        ? `${destHop.lossPercent.toFixed(1)}%`
                        : "—"}
                    </span>
                  </div>
                  {snapshot?.mosScore > 0 && (
                    <div
                      className="masar-well px-3 py-1.5 rounded-xl border border-slate-800/80 flex items-center gap-2"
                      title={
                        lang === "ar"
                          ? "تقدير جودة المكالمات الصوتية وفق معيار ITU-T G.107 E-Model (من 1.0 إلى 4.5)"
                          : "ITU-T G.107 E-Model Voice/Real-Time Quality Score (1.0 - 4.5)"
                      }
                    >
                      <span className="text-[11px] text-slate-400 font-medium">
                        {lang === "ar" ? "جودة MOS:" : "VoIP MOS:"}
                      </span>
                      <span
                        className={`text-xs font-mono font-bold tabular-nums ${
                          snapshot.mosScore >= 4.2
                            ? "text-emerald-400"
                            : snapshot.mosScore >= 3.7
                              ? "text-sky-400"
                              : snapshot.mosScore >= 3.1
                                ? "text-amber-400"
                                : "text-red-400"
                        }`}
                        dir="ltr"
                      >
                        {snapshot.mosScore.toFixed(2)}
                        {snapshot.mosGrade ? ` (${snapshot.mosGrade})` : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:w-[348px] masar-well bg-slate-950/75 border border-slate-800/90 rounded-2xl p-4 flex items-center gap-4 shrink-0">
                <HealthRadialGauge
                  score={health.score}
                  severity={health.severity}
                  unitLabel={t.gaugeUnit}
                  isLight={uiTheme === "light"}
                />

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold truncate">
                    {t.healthScoreTitle}
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-slate-300 truncate">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            !hop1 || hop1.received === 0
                              ? "bg-slate-500"
                              : hop1.lossPercent > 5
                              ? "bg-red-500"
                              : hop1.lossPercent > 2
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                          }`}
                        />
                        <span className="truncate">{t.hop1Label}</span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 shrink-0" dir="ltr">
                        {hop1 && hop1.received > 0
                          ? `${hop1.avgMs.toFixed(1)}ms`
                          : "—"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-slate-300 truncate">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            !primaryIspHop || primaryIspHop.received === 0
                              ? "bg-slate-500"
                              : primaryIspHop.lossPercent > 5
                              ? "bg-red-500"
                              : primaryIspHop.lossPercent > 2
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                          }`}
                        />
                        <span className="truncate">{t.ispLabel}</span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 shrink-0" dir="ltr">
                        {primaryIspHop && primaryIspHop.received > 0
                          ? `${primaryIspHop.avgMs.toFixed(1)}ms`
                          : "—"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/70">
                      <span className="text-[11px] text-slate-400">
                        {t.totalHopsLabel}
                      </span>
                      <span className="font-mono text-xs font-bold text-sky-400" dir="ltr">
                        {hops.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {hops.length > 0 && (
            <section className="masar-stagger-2 relative overflow-hidden bg-slate-900/60 border border-slate-800/90 rounded-2xl p-4 shadow-lg space-y-3">
              <SectionAmbientBackground variant="mtr" />
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-sky-400 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="6" cy="6" r="3" />
                    <circle cx="18" cy="18" r="3" />
                    <path d="M8.5 8.5l7 7M15 6h3v3M6 15v3h3" strokeLinecap="round" />
                  </svg>
                  <span className="text-xs font-bold text-slate-200">
                    {t.topologyTitle}
                  </span>
                  <span className="hidden sm:inline text-xs text-slate-500">
                    — {t.topologySub}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1" dir="ltr">
                  {hops.map((h) => {
                    const isTimeout = !h.ip;
                    const isBad = h.lossPercent > 5.0;
                    const isWarn = h.lossPercent > 2.0;
                    return (
                      <span
                        key={h.hop}
                        title={
                          lang === "ar"
                            ? isTimeout
                              ? `القفزة #${h.hop}: ${t.timedOut}`
                              : `القفزة #${h.hop}: ${h.ip} (${h.avgMs.toFixed(1)} مللي ثانية)`
                            : isTimeout
                            ? `Hop #${h.hop}: ${t.timedOut}`
                            : `Hop #${h.hop}: ${h.ip} (${h.avgMs.toFixed(1)} ms)`
                        }
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono border transition ${
                          isTimeout
                            ? "bg-slate-950/80 border-slate-800 text-slate-500"
                            : isBad
                            ? "bg-red-950/50 border-red-500/40 text-red-300 font-bold"
                            : isWarn
                            ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
                            : h.reachedDest
                            ? "bg-sky-500/20 border-sky-500/40 text-sky-300 font-bold"
                            : "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                        }`}
                      >
                        #{h.hop} {isTimeout ? "•" : `${Math.round(h.avgMs)}ms`}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="masar-lift-card masar-well bg-slate-950/80 border border-slate-800/90 rounded-xl p-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
                      <span className="font-mono text-[10px] text-sky-400">01</span>
                      <span>{t.stageDevice}</span>
                    </div>
                    <div className="text-xs font-bold text-slate-200">
                      Masar ICMPv4
                    </div>
                    <div className="text-[11px] text-sky-400">
                      {t.stageDeviceSub}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8M12 17v4" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                <div
                  className={`masar-lift-card masar-well rounded-xl p-3 border flex items-center justify-between ${
                    hop1 && hop1.lossPercent > 5
                      ? "bg-red-950/25 border-red-500/40"
                      : "bg-slate-950/80 border-slate-800/90"
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
                      <span className="font-mono text-[10px] text-emerald-400">02</span>
                      <span className="truncate">{t.stageRouter}</span>
                    </div>
                    {hop1?.ip ? (
                      <div className="text-xs font-mono font-bold text-slate-100 truncate text-start" dir="ltr">
                        {hop1.ip}
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-slate-300 truncate">
                        {t.awaitingProbes}
                      </div>
                    )}
                    <div className="text-[11px] text-emerald-400 truncate">
                      {hop1 && hop1.received > 0 ? (
                        lang === "ar" ? (
                          <>
                            <bdi dir="ltr" className="font-mono">
                              {hop1.avgMs.toFixed(1)} ms
                            </bdi>{" "}
                            • فقد{" "}
                            <bdi dir="ltr" className="font-mono">
                              {hop1.lossPercent.toFixed(1)}%
                            </bdi>
                          </>
                        ) : (
                          <span className="font-mono" dir="ltr">
                            {`${hop1.avgMs.toFixed(1)} ms • ${hop1.lossPercent.toFixed(1)}% loss`}
                          </span>
                        )
                      ) : (
                        t.timedOut
                      )}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-center text-slate-300 shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="14" width="20" height="6" rx="2" />
                      <path d="M6 17h.01M10 17h.01M12 10V4M8 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                <div className="masar-lift-card masar-well bg-slate-950/80 border border-slate-800/90 rounded-xl p-3 flex items-center justify-between">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
                      <span className="font-mono text-[10px] text-amber-400">03</span>
                      <span className="truncate">{t.stageIsp}</span>
                    </div>
                    {primaryIspHop?.ip ? (
                      <div className="text-xs font-mono font-bold text-slate-100 truncate text-start" dir="ltr">
                        {primaryIspHop.ip}
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-slate-200 truncate">
                        {`${respondingTransit.length} ${t.reachableHops}`}
                      </div>
                    )}
                    <div className="text-[11px] text-slate-400 truncate">
                      {primaryIspHop?.location || primaryIspHop?.asn ? (
                        <bdi dir="ltr" className="font-mono">
                          {primaryIspHop.location || primaryIspHop.asn}
                        </bdi>
                      ) : (
                        `${respondingTransit.length} ${t.reachableHops} • ${silentTransitCount} ${t.silentHops}`
                      )}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-center text-slate-300 shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M3.6 9h16.8M3.6 15h16.8" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                <div className="masar-lift-card bg-sky-950/20 border border-sky-500/35 rounded-xl p-3 flex items-center justify-between">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-sky-300 font-semibold">
                      <span className="font-mono text-[10px] text-sky-400">04</span>
                      <span className="truncate">{t.stageTarget}</span>
                    </div>
                    <div className="text-xs font-mono font-bold text-white truncate text-start" dir="ltr">
                      {destHop?.ip || snapshot.resolvedIp || target}
                    </div>
                    <div className="text-[11px] text-sky-300/90 truncate">
                      {destHop && destHop.received > 0 ? (
                        <>
                          <bdi dir="ltr" className="font-mono">
                            {destHop.avgMs.toFixed(1)} ms
                          </bdi>{" "}
                          •{" "}
                          {destHop.location ? (
                            <bdi dir="ltr" className="font-mono">
                              {destHop.location}
                            </bdi>
                          ) : lang === "ar" ? (
                            "شبكة عالمية"
                          ) : (
                            "Anycast"
                          )}
                        </>
                      ) : (
                        <bdi dir="ltr" className="font-mono">
                          {snapshot.target}
                        </bdi>
                      )}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-300 shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="9" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="masar-stagger-3 relative flex-1 bg-slate-900/60 border border-slate-800/90 rounded-2xl overflow-hidden flex flex-col shadow-xl">
            <SectionAmbientBackground variant="mtr" />
            <div className="relative z-10 px-5 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-900/90">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-200">
                  {t.tableTitle}
                </h3>
                <span className="text-xs text-slate-500">— {t.tableSub}</span>
              </div>

              <div className="flex flex-wrap items-center gap-3.5 text-xs">
                <span className="inline-flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  {t.legendHealthy}
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  {t.legendWarn}
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {t.legendCrit}
                </span>

                <button
                  type="button"
                  onClick={() => setReportModalOpen(true)}
                  className="group masar-cta-sheen masar-action-btn active:scale-95 px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/35 text-[11px] font-bold transition flex items-center gap-1.5"
                >
                  <span className="h-4 w-4 rounded-md bg-sky-500/20 text-sky-300 flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-[360deg] group-hover:scale-110">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span>
                    {lang === "ar" ? "شرح الأعمدة والبيانات" : "Explain Metrics"}
                  </span>
                </button>
              </div>
            </div>

            <div className="relative z-10 overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse" dir="ltr">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-950/60">
                    <th className="py-3 px-4 w-14">{t.colHop}</th>
                    <th className="py-3 px-4">{t.colHost}</th>
                    <th className="py-3 px-4">{t.colGeo}</th>
                    <th className="py-3 px-4 text-right">{t.colLoss}</th>
                    <th className="py-3 px-4 text-right">{t.colSentRecv}</th>
                    <th className="py-3 px-4 text-right">{t.colLast}</th>
                    <th className="py-3 px-4 text-right">{t.colAvg}</th>
                    <th className="py-3 px-4 text-right">{t.colJitter}</th>
                    <th className="py-3 px-4 text-center">{t.colTrend}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm font-mono">
                  {hops.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-12 px-6 text-center text-slate-500 font-sans"
                      >
                        <div className="max-w-3xl mx-auto space-y-6">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-start" dir={t.dir}>
                            {[
                              {
                                step: "01",
                                title: t.stageDevice,
                                sub: t.stageDeviceSub,
                                subLtr: false,
                                accent: "text-sky-400 border-sky-500/30 bg-sky-500/10",
                              },
                              {
                                step: "02",
                                title: t.stageRouter,
                                sub:
                                  lang === "ar"
                                    ? "الشبكة المحلية • 192.168.1.x"
                                    : "192.168.1.x • LAN/Wi-Fi",
                                subLtr: lang !== "ar",
                                accent: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
                              },
                              {
                                step: "03",
                                title: t.stageIsp,
                                sub:
                                  lang === "ar"
                                    ? "مقسم المزود والربط الدولي"
                                    : "ASN • IXP Peering",
                                subLtr: lang !== "ar",
                                accent: "text-amber-400 border-amber-500/30 bg-amber-500/10",
                              },
                              {
                                step: "04",
                                title: t.stageTarget,
                                sub:
                                  lang === "ar"
                                    ? `الخادم الهدف (${target})`
                                    : `${target} • Anycast Edge`,
                                subLtr: lang !== "ar",
                                accent: "text-sky-300 border-sky-400/40 bg-sky-500/15",
                              },
                            ].map((node, i) => (
                              <div
                                key={i}
                                className="masar-lift-card masar-well bg-slate-950/75 border border-slate-800/90 rounded-xl p-3 space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                      lang === "ar" ? "" : "font-mono"
                                    } ${node.accent}`}
                                  >
                                    {lang === "ar"
                                      ? `المرحلة ${node.step}`
                                      : `HOP ${node.step}`}
                                  </span>
                                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400/60 animate-pulse" />
                                </div>
                                <div className="text-xs font-bold text-slate-200 truncate">
                                  {node.title}
                                </div>
                                <div
                                  className={`text-[11px] text-slate-500 truncate ${
                                    node.subLtr ? "font-mono" : ""
                                  }`}
                                  dir={node.subLtr ? "ltr" : t.dir}
                                >
                                  {node.sub}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-sm font-bold text-slate-200">
                              {t.emptyTitle}
                            </p>
                            <p className="text-xs text-slate-400 max-w-lg mx-auto">
                              {t.emptyDesc}
                            </p>
                          </div>

                          {/* Quick-Start Interactive Target Pills */}
                          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                            {PRESETS.map((preset) => (
                              <button
                                key={preset.value}
                                type="button"
                                onClick={() => {
                                  setTarget(preset.value);
                                  startTrace(preset.value);
                                }}
                                className="masar-lift-card masar-well px-3.5 py-2 rounded-xl bg-slate-950/90 hover:bg-sky-500/15 border border-slate-800 hover:border-sky-500/40 text-xs font-semibold text-slate-200 hover:text-sky-300 flex items-center gap-2"
                              >
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span>
                                  {lang === "ar" ? preset.labelAr : preset.labelEn}
                                </span>
                                <span className="font-mono text-[11px] text-sky-400">
                                  {preset.value}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const maxPathRtt = Math.max(
                        25,
                        ...hops.map((x) => (x.received > 0 ? x.avgMs : 0))
                      );
                      return hops.map((hop) => {
                        const timedOut = !hop.ip;
                        const isCulprit =
                          health.culpritHop > 0 &&
                          health.culpritHop === hop.hop;
                        const rttBarPct =
                          hop.received > 0
                            ? Math.max(
                                8,
                                Math.min(100, (hop.avgMs / maxPathRtt) * 100)
                              )
                            : 0;

                        return (
                          <tr
                            key={hop.hop}
                            className={`masar-telemetry-row transition-colors ${getRowHighlightClass(
                              hop
                            )}`}
                          >
                            <td className="py-2.5 px-4 font-bold text-slate-300">
                              <div className="flex items-center gap-1.5">
                                <span>{hop.hop}</span>
                                {isCulprit && (
                                  <span
                                    title={
                                      lang === "ar"
                                        ? "مصدر الخلل الرئيسي المرصود تلقائياً"
                                        : "Primary bottleneck identified by Smart Health Evaluator"
                                    }
                                    className="text-xs text-red-400"
                                  >
                                    ▲
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-2.5 px-4">
                              {timedOut ? (
                                <span className="text-slate-500 italic text-xs font-sans">
                                  * * * (<bdi>{t.timedOut}</bdi>)
                                </span>
                              ) : (
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 flex-wrap">
                                  <span className="text-slate-100 font-semibold">
                                    {hop.ip}
                                  </span>
                                  {Array.isArray(hop.altIps) && hop.altIps.length > 0 && (
                                    <span
                                      title={`${
                                        lang === "ar"
                                          ? "مسارات ECMP بديلة"
                                          : "ECMP Alternate Responders"
                                      }: ${hop.altIps.join(", ")}`}
                                      className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/35 text-[10px] font-bold shrink-0 cursor-help"
                                    >
                                      +{hop.altIps.length} ECMP
                                    </span>
                                  )}
                                  {hop.hostname && (
                                    <span className="text-xs text-slate-400 truncate max-w-[210px]">
                                      ({hop.hostname})
                                    </span>
                                  )}
                                  {hop.hop === 1 && (
                                    <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                      <bdi>{t.roleRouter}</bdi>
                                    </span>
                                  )}
                                  {(hop.hop === 2 || hop.hop === 3) && (
                                    <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/70">
                                      <bdi>{t.roleIsp}</bdi>
                                    </span>
                                  )}
                                  {hop.reachedDest && (
                                    <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                      <bdi>{t.roleTarget}</bdi>
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-4 font-sans text-xs">
                              {timedOut ? (
                                <span className="text-slate-600">—</span>
                              ) : (
                                <div className="flex flex-col">
                                  <span className="text-slate-200 font-medium">
                                    <bdi>{hop.location || t.transitHop}</bdi>
                                  </span>
                                  {hop.asn && (
                                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">
                                      {hop.asn}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            <td
                              className={`py-2.5 px-4 text-right ${getLossColorClass(
                                hop.lossPercent,
                                hop.sent,
                                hop.received
                              )}`}
                            >
                              {hop.received === 0 && hop.lossPercent === 0
                                ? "—"
                                : `${hop.lossPercent.toFixed(1)}%`}
                            </td>

                            <td className="py-2.5 px-4 text-right text-slate-300">
                              {hop.sent} / {hop.received}
                            </td>

                            <td className="py-2.5 px-4 text-right text-slate-200">
                              {hop.received > 0 ? `${hop.lastMs.toFixed(1)}` : "—"}
                            </td>

                            <td className="py-2.5 px-4 text-right text-slate-200">
                              {hop.received > 0 ? (
                                <div className="inline-flex flex-col items-end gap-1">
                                  <span>{hop.avgMs.toFixed(1)}</span>
                                  <span className="w-12 h-1 rounded-full bg-slate-800 overflow-hidden">
                                    <span
                                      className={`block h-full rounded-full ${
                                        hop.avgMs > 120
                                          ? "bg-red-500"
                                          : hop.avgMs > 60
                                          ? "bg-amber-400"
                                          : "bg-sky-400"
                                      }`}
                                      style={{ width: `${rttBarPct}%` }}
                                    />
                                  </span>
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>

                            <td
                              className={`py-2.5 px-4 text-right ${
                                hop.jitterMs > 15
                                  ? "text-amber-400 font-semibold"
                                  : "text-slate-300"
                              }`}
                            >
                              {hop.received > 1
                                ? `${hop.jitterMs.toFixed(1)}`
                                : "0.0"}
                            </td>

                            <td className="py-2 px-4 text-center">
                              <LatencySparkline
                                history={hop.history}
                                lossPercent={hop.lossPercent}
                              />
                            </td>
                          </tr>
                        );
                      });
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <Suspense fallback={null}>
            <MtrTimelineCanvas
              points={mtrTimeline}
              uiTheme={uiTheme}
              lang={lang}
              onClear={() => setMtrTimeline([])}
            />
          </Suspense>
        </main>
      )}

      {/* TAB 2: DNS LOOKUP */}
      {renderedTab === "dns" && (
        <main
          key="tab-dns"
          className="flex-1 max-w-7xl w-full mx-auto px-6 py-5 pb-16 flex flex-col gap-5"
        >
          <div className="masar-stagger-1 relative overflow-hidden bg-slate-900/60 border border-slate-800/90 rounded-2xl p-6 space-y-4 shadow-xl">
            <SectionAmbientBackground variant="dns" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">{t.dnsTitle}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{t.dnsDesc}</p>
              </div>
              <form onSubmit={handleRunDNS} className="flex flex-wrap items-center gap-2 shrink-0">
                <select
                  aria-label={lang === "ar" ? "خادم DNS" : "DNS Resolver"}
                  value={dnsResolver}
                  onChange={(e) => {
                    const nextResolver = e.target.value;
                    setDnsResolver(nextResolver);
                    if (nextResolver === "system" && dnsUseDoH) {
                      setDnsUseDoH(false);
                    }
                  }}
                  dir={lang === "ar" && dnsResolver === "system" ? "rtl" : "ltr"}
                  className={`masar-well bg-slate-950 border border-slate-700 focus:border-sky-500 focus:outline-none rounded-xl px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer ${
                    lang === "ar" && dnsResolver === "system" ? "font-sans" : "font-mono"
                  }`}
                >
                  <option value="system" dir={t.dir}>
                    {lang === "ar" ? "النظام (System)" : "System"}
                  </option>
                  <option value="1.1.1.1" dir="ltr">1.1.1.1 (Cloudflare)</option>
                  <option value="8.8.8.8" dir="ltr">8.8.8.8 (Google)</option>
                  <option value="9.9.9.9" dir="ltr">9.9.9.9 (Quad9)</option>
                </select>
                <button
                  type="button"
                  disabled={dnsResolver === "system"}
                  onClick={() => setDnsUseDoH((prev) => !prev)}
                  title={
                    dnsResolver === "system"
                      ? lang === "ar"
                        ? "اختر 1.1.1.1 أو 8.8.8.8 أو 9.9.9.9 لتفعيل استعلام DoH المشفر"
                        : "Select 1.1.1.1, 8.8.8.8, or 9.9.9.9 to enable encrypted DoH (RFC 8484)"
                      : lang === "ar"
                        ? "تفعيل استعلام DNS المشفر عبر HTTPS (RFC 8484 + EDNS0 DNSSEC)"
                        : "Use encrypted DNS-over-HTTPS (RFC 8484 Wire Format + EDNS0 DO=1)"
                  }
                  dir="ltr"
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-all ${
                    dnsResolver === "system"
                      ? "bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed"
                      : dnsUseDoH
                        ? "bg-indigo-600/25 border-indigo-500/60 text-indigo-300 shadow-sm cursor-pointer"
                        : "bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200 cursor-pointer"
                  }`}
                >
                  DoH
                </button>
                <input
                  dir="ltr"
                  type="text"
                  value={dnsTarget}
                  onChange={(e) => setDnsTarget(e.target.value)}
                  placeholder={t.dnsPlaceholder}
                  className="masar-well w-56 sm:w-64 bg-slate-950 border border-slate-700 focus:border-sky-500 focus:outline-none rounded-xl px-3 py-1.5 text-sm font-mono"
                />
                <button
                  type="submit"
                  disabled={dnsLoading}
                  className={`group masar-cta-sheen masar-action-btn shrink-0 whitespace-nowrap active:scale-95 px-3.5 py-1.5 rounded-xl text-xs font-bold tracking-tight transition-all duration-300 flex items-center gap-2 border ${
                    dnsLoading
                      ? "bg-sky-500/20 text-sky-200 border-sky-400/50 cursor-wait ring-2 ring-sky-500/25"
                      : "bg-gradient-to-r from-sky-500 via-sky-400 to-cyan-400 hover:from-sky-400 hover:via-cyan-400 hover:to-emerald-400 text-slate-950 border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_6px_16px_-4px_rgba(14,165,233,0.38)]"
                  }`}
                >
                  <span
                    className={`h-4 w-4 shrink-0 rounded-md flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      dnsLoading
                        ? "bg-sky-400/20 text-sky-300"
                        : "bg-slate-950/15 text-slate-950 group-hover:rotate-180 group-hover:scale-110"
                    }`}
                  >
                    <svg
                      className={`w-3 h-3 ${dnsLoading ? "animate-spin" : ""}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.3"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path
                        d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span>{dnsLoading ? t.dnsResolving : t.dnsBtn}</span>
                </button>
              </form>
            </div>

            {dnsLoading && (
              <div className="relative z-10 py-3">
                <GoDataLoader
                  label={t.dnsResolving}
                  sublabel={dnsTarget}
                />
              </div>
            )}

            {dnsReport ? (
              <div className="relative z-10 space-y-3 pt-2">
                <div className="masar-well flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 bg-slate-950/70 px-4 py-2.5 rounded-xl border border-slate-800">
                  <span>
                    {t.targetLabel}:{" "}
                    <bdi dir="ltr" className="font-mono text-slate-200 font-semibold">
                      {dnsReport.target}
                    </bdi>
                  </span>
                  {dnsReport.resolver && (
                    <span className="inline-flex items-center gap-1.5">
                      <span>{lang === "ar" ? "المُحلّل:" : "Resolver:"}</span>
                      <bdi
                        dir="ltr"
                        className={`font-mono px-1.5 py-0.5 rounded border text-[11px] font-semibold ${
                          dnsReport.useDoH
                            ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/35"
                            : "bg-slate-900 text-slate-200 border-slate-700"
                        }`}
                      >
                        {dnsReport.resolver}
                        {dnsReport.useDoH ? " · DoH" : ""}
                      </bdi>
                    </span>
                  )}
                  {dnsReport.dnssecValidated && (
                    <span
                      dir="ltr"
                      title={
                        lang === "ar"
                          ? "تم التحقق من التوقيع الرقمي DNSSEC (AD=1)"
                          : "DNSSEC Authentic Data (AD=1) flag verified by resolver"
                      }
                      className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/35"
                    >
                      ✓ DNSSEC AD
                    </span>
                  )}
                  <span className="text-sky-400 font-semibold">
                    {t.dnsQueryTime}:{" "}
                    <bdi dir="ltr" className="font-mono">
                      {dnsReport.queryTimeMs} ms
                    </bdi>
                  </span>
                  <span>
                    {t.dnsRecordsFound}:{" "}
                    <bdi dir="ltr" className="font-mono text-slate-200 font-semibold">
                      {dnsReport.records?.length || 0}
                    </bdi>
                  </span>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-800">
                  <table className="w-full text-left border-collapse text-sm font-mono" dir="ltr">
                    <thead>
                      <tr className="bg-slate-950 text-[11px] uppercase text-slate-400 border-b border-slate-800">
                        <th className="py-2.5 px-4 w-32">{t.dnsColType}</th>
                        <th className="py-2.5 px-4">{t.dnsColValue}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(dnsReport.records || []).map((rec, i) => (
                        <tr key={i} className="masar-telemetry-row hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 text-xs font-bold">
                              {rec.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-200 break-all">
                            <div className="flex items-center justify-between gap-2">
                              <span className="break-all">{rec.value}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {rec.dnssec && (
                                  <span
                                    className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                                    dir="ltr"
                                    title="DNSSEC AD verified"
                                  >
                                    AD
                                  </span>
                                )}
                                {rec.ttl > 0 && (
                                  <span
                                    className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/80 text-amber-300"
                                    dir="ltr"
                                    title="Time To Live (seconds)"
                                  >
                                    TTL {rec.ttl}s
                                  </span>
                                )}
                                {rec.latencyMs > 0 && (
                                  <span
                                    className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/80 text-sky-300"
                                    dir="ltr"
                                  >
                                    {rec.latencyMs.toFixed(1)} ms
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="relative z-10 pt-3 space-y-4">
                <div className="flex flex-wrap items-center gap-2" dir="ltr">
                  {["google.com", "cloudflare.com", "1.1.1.1", "quad9.net"].map(
                    (dom) => (
                      <button
                        key={dom}
                        type="button"
                        onClick={() => {
                          setDnsTarget(dom);
                        }}
                        className={`masar-lift-card masar-well px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold ${
                          dnsTarget === dom
                            ? "bg-sky-500/20 border-sky-500/40 text-sky-300"
                            : "bg-slate-950/75 border-slate-800 text-slate-300 hover:border-sky-500/35"
                        }`}
                      >
                        {dom}
                      </button>
                    )
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5" dir={t.dir}>
                  {[
                    {
                      type: "A",
                      desc: lang === "ar" ? "عنوان مضيف IPv4" : "IPv4 Host Address",
                    },
                    {
                      type: "AAAA",
                      desc: lang === "ar" ? "عنوان مضيف IPv6" : "IPv6 Host Address",
                    },
                    {
                      type: "CNAME",
                      desc: lang === "ar" ? "الاسم البديل للنطاق" : "Canonical Alias",
                    },
                    {
                      type: "MX",
                      desc: lang === "ar" ? "خوادم البريد الإلكتروني" : "Mail Exchange",
                    },
                    {
                      type: "NS",
                      desc: lang === "ar" ? "خوادم النطاق المعتمدة" : "Authoritative NS",
                    },
                    {
                      type: "TXT / PTR / SOA",
                      desc:
                        lang === "ar"
                          ? "سجلات SPF و CAA والفحص العكسي والسلطة"
                          : "SPF, CAA, SOA, DNSSEC & rDNS",
                    },
                  ].map((item) => (
                    <div
                      key={item.type}
                      className="masar-lift-card masar-well bg-slate-950/75 border border-slate-800/90 rounded-xl p-3 space-y-1"
                    >
                      <span
                        dir="ltr"
                        className="inline-block px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[11px] font-mono font-bold"
                      >
                        {item.type}
                      </span>
                      <div className="text-[11px] text-slate-400">
                        {item.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {renderedTab === "ports" && (
        <main
          key="tab-ports"
          className="flex-1 max-w-7xl w-full mx-auto px-6 py-5 pb-16 flex flex-col gap-5"
        >
          <div className="masar-stagger-1 relative overflow-hidden bg-slate-900/60 border border-slate-800/90 rounded-2xl p-6 space-y-4 shadow-xl">
            <SectionAmbientBackground variant="ports" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">{t.portTitle}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{t.portDesc}</p>
              </div>
              <form
                onSubmit={handleRunPortScan}
                className="flex flex-wrap items-center gap-2 shrink-0"
              >
                <div
                  role="group"
                  aria-label={lang === "ar" ? "حزم المنافذ الجاهزة" : "Port Scan Presets"}
                  className="masar-well inline-flex items-center p-0.5 rounded-xl bg-slate-950 border border-slate-700/80"
                  dir="ltr"
                >
                  {["common", "web", "database", "remote"].map((preset) => {
                    const active = (portSpec || "common").trim().toLowerCase() === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setPortSpec(preset)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                          active
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
                <input
                  dir="ltr"
                  type="text"
                  value={portSpec}
                  onChange={(e) => setPortSpec(e.target.value)}
                  placeholder="common | 22,80,8000-8010"
                  title={
                    lang === "ar"
                      ? "نطاق أو قائمة المنافذ (حد أقصى 256 منفذًا: common أو web أو database أو 22,80,8000-8010)"
                      : "Custom port list or range (max 256 ports: common, web, database, remote, or 22,80,8000-8010)"
                  }
                  className="masar-well w-40 sm:w-44 bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:outline-none rounded-xl px-2.5 py-1.5 text-xs font-mono text-emerald-300"
                />
                <input
                  dir="ltr"
                  type="text"
                  value={portHost}
                  onChange={(e) => setPortHost(e.target.value)}
                  placeholder={t.portPlaceholder}
                  className="masar-well w-52 sm:w-60 bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:outline-none rounded-xl px-3 py-1.5 text-sm font-mono"
                />
                <button
                  type="submit"
                  disabled={portLoading}
                  className={`group masar-cta-sheen masar-action-btn shrink-0 whitespace-nowrap active:scale-95 px-3.5 py-1.5 rounded-xl text-xs font-bold tracking-tight transition-all duration-300 flex items-center gap-2 border ${
                    portLoading
                      ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/50 cursor-wait ring-2 ring-emerald-500/25"
                      : "bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 text-slate-950 border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_6px_16px_-4px_rgba(16,185,129,0.38)]"
                  }`}
                >
                  <span
                    className={`h-4 w-4 shrink-0 rounded-md flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      portLoading
                        ? "bg-emerald-400/20 text-emerald-300"
                        : "bg-slate-950/15 text-slate-950 group-hover:rotate-180 group-hover:scale-110"
                    }`}
                  >
                    <svg
                      className={`w-3 h-3 ${portLoading ? "animate-spin" : ""}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.3"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span>{portLoading ? t.portScanning : t.portBtn}</span>
                </button>
              </form>
            </div>

            {portLoading && (
              <div className="relative z-10 py-3">
                <GoDataLoader
                  label={t.portScanning}
                  sublabel={portHost}
                />
              </div>
            )}

            {portReport ? (
              <div className="relative z-10 space-y-3 pt-2">
                <div className="masar-well flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 bg-slate-950/70 px-4 py-2.5 rounded-xl border border-slate-800">
                  <bdi dir="ltr" className="font-mono text-slate-200 font-semibold">
                    {portReport.host} ({portReport.resolvedIp})
                  </bdi>
                  <span className="text-emerald-400 font-bold">
                    {t.portOpenCount}:{" "}
                    <bdi dir="ltr" className="font-mono">
                      {portReport.openCount} / {portReport.totalPorts}
                    </bdi>
                  </span>
                  <span>
                    {t.portDuration}:{" "}
                    <bdi dir="ltr" className="font-mono text-slate-200 font-semibold">
                      {portReport.durationMs} ms
                    </bdi>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5" dir="ltr">
                  {(portReport.results || []).map((r) => {
                    const isOpen = r.state === "open";
                    const isFiltered = r.state === "filtered";
                    return (
                      <div
                        key={r.port}
                        className={`masar-lift-card p-3 rounded-xl border text-xs flex items-center justify-between ${
                          isOpen
                            ? "bg-emerald-950/35 border-emerald-500/50 text-emerald-200"
                            : isFiltered
                            ? "bg-amber-950/30 border-amber-500/45 text-amber-200"
                            : "masar-well bg-slate-950/60 border-slate-800/80 text-slate-300"
                        }`}
                      >
                        <div className="font-mono">
                          <div className="font-bold text-sm">:{r.port}</div>
                          <div className="text-[11px] opacity-85">
                            {r.service}
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            dir={t.dir}
                            className={`font-sans px-2 py-0.5 rounded text-[10px] font-bold ${
                              lang === "ar" ? "" : "uppercase tracking-wide"
                            } ${
                              isOpen
                                ? "bg-emerald-500/20 text-emerald-300"
                                : isFiltered
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {isOpen
                              ? t.stateOpen
                              : isFiltered
                              ? t.stateFiltered
                              : t.stateClosed}
                          </span>
                          {isOpen && (
                            <div className="text-[11px] font-mono text-emerald-400 mt-1">
                              {r.latencyMs.toFixed(1)} ms
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="relative z-10 pt-3 space-y-4">
                <div className="flex flex-wrap items-center gap-2" dir="ltr">
                  {["8.8.8.8", "1.1.1.1", "google.com", "cloudflare.com"].map(
                    (hst) => (
                      <button
                        key={hst}
                        type="button"
                        onClick={() => setPortHost(hst)}
                        className={`masar-lift-card masar-well px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold ${
                          portHost === hst
                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                            : "bg-slate-950/75 border-slate-800 text-slate-300 hover:border-emerald-500/35"
                        }`}
                      >
                        {hst}
                      </button>
                    )
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5" dir="ltr">
                  {[
                    { port: 22, svc: "SSH" },
                    { port: 53, svc: "DNS" },
                    { port: 80, svc: "HTTP" },
                    { port: 443, svc: "HTTPS" },
                    { port: 445, svc: "SMB" },
                    { port: 3306, svc: "MySQL" },
                    { port: 3389, svc: "RDP" },
                    { port: 5432, svc: "PostgreSQL" },
                    { port: 6379, svc: "Redis" },
                    { port: 8080, svc: "HTTP-Alt" },
                  ].map((item) => (
                    <div
                      key={item.port}
                      className="masar-lift-card masar-well bg-slate-950/75 border border-slate-800/90 rounded-xl p-2.5 flex items-center justify-between font-mono text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-200">:{item.port}</div>
                        <div className="text-[10px] text-slate-500">{item.svc}</div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[9px] font-bold">
                        TCP
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Suspense fallback={null}>
            <TlsInspectorCard
              host={portHost}
              tlsPort={tlsPort}
              onChangeTlsPort={setTlsPort}
              tlsLoading={tlsLoading}
              tlsReport={tlsReport}
              onInspectTls={handleInspectTls}
              lang={lang}
            />
          </Suspense>
        </main>
      )}

      {renderedTab === "speed" && (
        <main
          key="tab-speed"
          className="flex-1 max-w-7xl w-full mx-auto px-6 py-5 pb-16 flex flex-col gap-5"
        >
          {reportNotice && (
            <div className="masar-page-enter rounded-xl bg-emerald-950/60 border border-emerald-500/50 px-4 py-3 flex items-center justify-between gap-4 shadow-lg shadow-emerald-500/10">
              <div className="flex items-center gap-3 min-w-0">
                <StatusLottie variant="success" size={24} />
                <p className="text-xs text-emerald-200 font-semibold leading-relaxed break-all">
                  {reportNotice}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportNotice("")}
                className="text-xs text-emerald-300 hover:text-white px-2.5 py-0.5 rounded-lg bg-emerald-950/50 border border-emerald-500/30 shrink-0 font-semibold transition"
              >
                {t.dismiss}
              </button>
            </div>
          )}

          <div className="masar-stagger-1 relative overflow-hidden bg-slate-900/60 border border-slate-800/90 rounded-2xl p-6 space-y-5 shadow-xl">
            <SectionAmbientBackground variant="speed" />
            {/* Header + Single Clean Action Toolbar */}
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-lg font-bold text-white">
                    {t.speedTitle}
                  </h2>
                  {speedRunning ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                      {speedSnap.phase === "download"
                        ? t.speedPhaseDown
                        : speedSnap.phase === "upload"
                        ? t.speedPhaseUp
                        : t.speedPhasePing}
                    </span>
                  ) : speedSnap.completed ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {t.speedPhaseComplete}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      {(speedMode === "single" ? t.speedModeSingle : t.speedModeMulti)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">{t.speedDesc}</p>
              </div>

              {/* Action Toolbar (Single Source of Truth — Never Duplicated Below) */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {speedSnap.completed && !speedRunning && (
                  <>
                    <button
                      type="button"
                      onClick={handleExportSpeedPdf}
                      disabled={speedExporting}
                      className={`group masar-cta-sheen masar-action-btn shrink-0 whitespace-nowrap active:scale-95 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all duration-300 border ${
                        speedPdfSaved
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/35"
                      }`}
                      title={t.speedExportPdf}
                    >
                      <span
                        className={`h-4 w-4 shrink-0 rounded-md flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                          speedPdfSaved
                            ? "bg-emerald-500/25 text-emerald-300"
                            : "bg-rose-500/20 text-rose-300 group-hover:scale-110 group-hover:-translate-y-0.5"
                        }`}
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          {speedPdfSaved ? (
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
                          ) : (
                            <>
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M16 13H8m8 4H8m2-8H8" strokeLinecap="round" strokeLinejoin="round"/>
                            </>
                          )}
                        </svg>
                      </span>
                      <span>
                        {speedPdfSaved
                          ? (lang === "ar" ? "تم الحفظ بنجاح! ✓" : "Saved Successfully! ✓")
                          : speedExporting
                          ? t.speedExportingPdf
                          : t.speedExportPdf}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopySpeedResults}
                      className="group masar-cta-sheen masar-action-btn shrink-0 whitespace-nowrap active:scale-95 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 transition-all duration-300"
                      title={t.speedCopyResults}
                    >
                      <span className="h-4 w-4 shrink-0 rounded-md bg-sky-500/15 text-sky-400 flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110 group-hover:rotate-12">
                        <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <rect x="9" y="9" width="13" height="13" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span>{speedCopied ? t.speedCopied : t.speedCopyResults}</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => handleToggleSpeedBenchmark()}
                  className={`group masar-cta-sheen masar-action-btn shrink-0 whitespace-nowrap active:scale-95 px-3.5 py-1.5 rounded-xl font-bold text-xs tracking-tight transition-all duration-300 flex items-center gap-2 border ${
                    speedRunning
                      ? "bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_6px_16px_-4px_rgba(239,68,68,0.28)]"
                      : "bg-gradient-to-r from-sky-500 via-sky-400 to-cyan-400 hover:from-sky-400 hover:via-cyan-400 hover:to-emerald-400 text-slate-950 border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_6px_16px_-4px_rgba(14,165,233,0.38)]"
                  }`}
                >
                  {speedRunning ? (
                    <>
                      <span className="h-4 w-4 shrink-0 rounded-md bg-red-500/25 text-red-300 flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-90 group-hover:scale-110">
                        <span className="w-2 h-2 rounded-sm bg-red-400" />
                      </span>
                      <span>{t.speedStopBtn}</span>
                    </>
                  ) : speedSnap.completed ? (
                    <>
                      <span className="h-4 w-4 shrink-0 rounded-md bg-slate-950/15 text-slate-950 flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-180 group-hover:scale-110">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                          <path d="M21 12a9 9 0 0 0-15.5-6.36L3 8" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M3 12a9 9 0 0 0 15.5 6.36L21 16" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M16 16h5v5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span>{t.speedTestAgain}</span>
                    </>
                  ) : (
                    <>
                      <span className="h-4 w-4 shrink-0 rounded-md bg-slate-950/15 text-slate-950 flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-[360deg] group-hover:scale-110">
                        <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 12 12">
                          <path d="M2.5 1.5L10.5 6L2.5 10.5V1.5Z" />
                        </svg>
                      </span>
                      <span>{t.speedStartBtn}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* PINNED TOP 3-COLUMN LIVE SCOREBOARD STRIP (Fixed Geometry Across Idle / Running / Complete) */}
            {(() => {
              const showFinal = speedSnap.completed && !speedRunning;
              const downDisplay = showFinal
                ? (speedSnap.finalDownloadMbps || speedSnap.downloadMbps)
                : speedSnap.downloadMbps;
              const upDisplay = showFinal
                ? (speedSnap.finalUploadMbps || speedSnap.uploadMbps)
                : speedSnap.uploadMbps;
              const isDownActive = speedRunning && speedSnap.phase === "download";
              const isUpActive = speedRunning && speedSnap.phase === "upload";
              const isPingActive = speedRunning && speedSnap.phase === "ping";
              const downLoadedPing = speedSnap.downloadLatencyMs || speedSnap.loadedPingMs || 0;
              const upLoadedPing = speedSnap.uploadLatencyMs || 0;

              return (
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Pinned Column 1: Download */}
                  <div
                    className={`masar-well rounded-xl px-4 py-3 border transition-colors duration-200 ${
                      isDownActive
                        ? "border-sky-400/70 bg-sky-500/[0.06] shadow-md shadow-sky-500/10"
                        : showFinal
                        ? "border-sky-500/40 bg-slate-950/75"
                        : "border-slate-800/90 bg-slate-950/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-sky-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span>{t.speedDown}</span>
                      </span>
                      <span className="text-[11px] text-slate-300 tabular-nums">
                        {t.speedDownPing}:{" "}
                        <bdi dir="ltr" className="font-mono font-semibold text-slate-100">
                          {downLoadedPing > 0 ? `${downLoadedPing.toFixed(0)} ms` : "—"}
                        </bdi>
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-baseline justify-between gap-2">
                      <div
                        className={`text-2xl sm:text-3xl font-extrabold font-mono text-sky-400 tabular-nums tracking-tight ${
                          isDownActive ? "masar-text-glow-sky" : ""
                        }`}
                        dir="ltr"
                      >
                        {downDisplay > 0 ? downDisplay.toFixed(1) : "—"}
                        <span className="text-xs font-medium text-slate-300 ml-1.5">Mbps</span>
                      </div>
                      <span className="text-[11px] text-slate-300 tabular-nums min-h-[16px]">
                        {speedSnap.peakDownloadMbps > 0 ? (
                          <>
                            {t.speedPeak}{" "}
                            <bdi dir="ltr" className="font-mono font-semibold text-slate-100">
                              {speedSnap.peakDownloadMbps.toFixed(1)}
                            </bdi>
                          </>
                        ) : "\u00A0"}
                      </span>
                    </div>
                  </div>

                  {/* Pinned Column 2: Upload */}
                  <div
                    className={`masar-well rounded-xl px-4 py-3 border transition-colors duration-200 ${
                      isUpActive
                        ? "border-emerald-400/70 bg-emerald-500/[0.06] shadow-md shadow-emerald-500/10"
                        : showFinal
                        ? "border-emerald-500/40 bg-slate-950/75"
                        : "border-slate-800/90 bg-slate-950/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M12 20V8m0 0l-4 4m4-4l4 4M4 4h16" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span>{t.speedUp}</span>
                      </span>
                      <span className="text-[11px] text-slate-300 tabular-nums">
                        {t.speedUpPing}:{" "}
                        <bdi dir="ltr" className="font-mono font-semibold text-slate-100">
                          {upLoadedPing > 0 ? `${upLoadedPing.toFixed(0)} ms` : "—"}
                        </bdi>
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-baseline justify-between gap-2">
                      <div
                        className={`text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400 tabular-nums tracking-tight ${
                          isUpActive ? "masar-text-glow-emerald" : ""
                        }`}
                        dir="ltr"
                      >
                        {upDisplay > 0 ? upDisplay.toFixed(1) : "—"}
                        <span className="text-xs font-medium text-slate-300 ml-1.5">Mbps</span>
                      </div>
                      <span className="text-[11px] text-slate-300 tabular-nums min-h-[16px]">
                        {speedSnap.peakUploadMbps > 0 ? (
                          <>
                            {t.speedPeak}{" "}
                            <bdi dir="ltr" className="font-mono font-semibold text-slate-100">
                              {speedSnap.peakUploadMbps.toFixed(1)}
                            </bdi>
                          </>
                        ) : "\u00A0"}
                      </span>
                    </div>
                  </div>

                  {/* Pinned Column 3: Idle Ping + Jitter + Packet Loss */}
                  <div
                    className={`masar-well rounded-xl px-4 py-3 border transition-colors duration-200 ${
                      isPingActive
                        ? "border-amber-400/70 bg-amber-500/[0.06] shadow-md shadow-amber-500/10"
                        : showFinal
                        ? "border-amber-500/40 bg-slate-950/75"
                        : "border-slate-800/90 bg-slate-950/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span>{t.speedIdlePing || t.speedPing}</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 tabular-nums" dir="ltr">
                        {speedSnap.bestPingMs > 0 ? `MIN ${speedSnap.bestPingMs.toFixed(1)}ms` : ""}
                      </span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 gap-2 items-baseline">
                      <div>
                        <div className="text-xl sm:text-2xl font-extrabold font-mono text-amber-400 tabular-nums" dir="ltr">
                          {speedSnap.pingMs > 0 ? speedSnap.pingMs.toFixed(1) : "—"}
                          <span className="text-[10px] font-normal text-slate-400 ml-0.5">ms</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{t.speedPing}</div>
                      </div>
                      <div>
                        <div className="text-xl sm:text-2xl font-extrabold font-mono text-purple-400 tabular-nums" dir="ltr">
                          {speedSnap.jitterMs > 0 ? speedSnap.jitterMs.toFixed(1) : "—"}
                          <span className="text-[10px] font-normal text-slate-400 ml-0.5">ms</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{t.speedJitter}</div>
                      </div>
                      <div>
                        <div className="text-xl sm:text-2xl font-extrabold font-mono text-rose-400 tabular-nums" dir="ltr">
                          {(speedSnap.completed || speedSnap.pingMs > 0) ? (speedSnap.packetLoss ?? 0).toFixed(1) : "—"}
                          <span className="text-[10px] font-normal text-slate-400 ml-0.5">%</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{t.speedLoss}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* SPEEDTEST FIXED-HEIGHT CENTER ARENA */}
            <div className="relative z-10 min-h-[420px] flex flex-col justify-center">
              {/* STATE 1: IDLE LAUNCHPAD (Speedtest.net GO Button + Multi/Single Toggle) */}
              {!speedRunning && !speedSnap.completed && (
                <div className="flex flex-col items-center justify-center py-6 px-4 gap-5 text-center">
                  <div className="relative group cursor-pointer" onClick={() => handleToggleSpeedBenchmark()}>
                    <div className="masar-go-pulse absolute -inset-3 rounded-full bg-gradient-to-r from-sky-500/20 to-emerald-500/20 blur-xl opacity-70 group-hover:opacity-100 transition duration-500" />
                    <button
                      type="button"
                      style={{
                        background:
                          uiTheme === "light"
                            ? "radial-gradient(circle at 35% 30%, #f8fafc 0%, #eaeff6 65%, #dde5f0 100%)"
                            : "radial-gradient(circle at 35% 30%, #1b2845 0%, #131b2e 65%, #0d1322 100%)",
                      }}
                      className={`relative w-44 h-44 sm:w-48 sm:h-48 rounded-full border-2 ${
                        uiTheme === "light"
                          ? "border-sky-600/45 group-hover:border-sky-600 shadow-[0_14px_32px_-8px_rgba(2,132,199,0.22),inset_0_2px_4px_rgba(255,255,255,0.9)]"
                          : "border-sky-400/50 group-hover:border-sky-300 shadow-[0_18px_40px_-8px_rgba(2,6,23,0.75),inset_0_1px_1px_rgba(255,255,255,0.1)]"
                      } flex flex-col items-center justify-center gap-1 transition-all duration-300 group-hover:scale-105 active:scale-95`}
                    >
                      <span
                        className={`text-4xl sm:text-5xl bg-gradient-to-r ${
                          uiTheme === "light"
                            ? "from-sky-700 via-sky-600 to-emerald-600"
                            : "from-sky-400 via-teal-300 to-emerald-400"
                        } bg-clip-text text-transparent px-2 py-2 -my-2 inline-block ${
                          lang === "ar"
                            ? "font-bold leading-[1.45]"
                            : "font-black tracking-wider leading-tight"
                        }`}
                      >
                        {lang === "ar" ? "ابدأ" : "GO"}
                      </span>
                      <span className={`font-semibold text-slate-300 ${lang === "ar" ? "text-xs font-arabic mt-0.5" : "text-[11px] uppercase tracking-widest mt-0.5"}`}>
                        {lang === "ar" ? "فحص السرعة" : "SPEED TEST"}
                      </span>
                    </button>
                  </div>

                  {/* Multi / Single Connection Mode Selector */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-950/80 border border-slate-800/90">
                      <span className="text-[11px] font-semibold text-slate-400 px-2.5">{t.speedConnMode}</span>
                      <button
                        type="button"
                        onClick={() => setSpeedMode("multi")}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                          speedMode === "multi"
                            ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm"
                            : "text-slate-400 hover:text-slate-200 border border-transparent"
                        }`}
                      >
                        {t.speedModeMulti}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpeedMode("single")}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                          speedMode === "single"
                            ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm"
                            : "text-slate-400 hover:text-slate-200 border border-transparent"
                        }`}
                      >
                        {t.speedModeSingle}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 max-w-md">
                      {speedMode === "single" ? t.speedModeSingleHint : t.speedModeMultiHint}
                    </p>
                  </div>
                </div>
              )}

              {/* STATE 2: ACTIVE STAGED TESTING WITH 60FPS FIXED-SCALE GAUGE */}
              {speedRunning && (
                <div className="flex flex-col items-center justify-center py-2 px-4 gap-4 text-center">
                  <SpeedtestBigGauge
                    phase={speedSnap.phase}
                    downloadMbps={speedSnap.downloadMbps}
                    uploadMbps={speedSnap.uploadMbps}
                    pingMs={speedSnap.pingMs}
                    peakDownload={speedSnap.peakDownloadMbps}
                    peakUpload={speedSnap.peakUploadMbps}
                    activeStreams={speedSnap.activeStreams}
                    connectionMode={speedSnap.connectionMode || speedMode}
                    history={speedSnap.phase === "upload" ? speedSnap.uploadHistory : speedSnap.downloadHistory}
                    isLight={uiTheme === "light"}
                    lang={lang}
                  />

                  {/* Compact Progress & Telemetry Strip */}
                  <div className="w-full max-w-lg space-y-1.5" dir={t.dir}>
                    <div className="flex items-center justify-between text-xs text-slate-200">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-slate-100 masar-text-glow-sky">
                          {t.speedProgress}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 border border-sky-400/35 text-sky-200 shadow-[0_0_12px_-3px_rgba(56,189,248,0.4)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                          {(speedSnap.connectionMode || speedMode) === "single" ? (
                            <span>{lang === "ar" ? "قناة واحدة" : `1 ${t.speedStreamSingleUnit}`}</span>
                          ) : (
                            <>
                              <bdi dir="ltr" className="font-mono font-extrabold text-white">
                                {speedSnap.activeStreams || 4}
                              </bdi>
                              <span>{t.speedStreamsUnit}</span>
                            </>
                          )}
                        </span>
                      </span>
                      <span className="flex items-center gap-3 font-mono" dir="ltr">
                        <span className="text-slate-300 font-medium">
                          {(speedSnap.totalMB || 0).toFixed(1)} MB
                        </span>
                        <span className="text-sky-300 font-extrabold tabular-nums masar-text-glow-sky">
                          {speedSnap.progress || 0}%
                        </span>
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden p-0.5 border border-slate-700/50">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          speedSnap.phase === "upload"
                            ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300"
                            : speedSnap.phase === "ping"
                            ? "bg-gradient-to-r from-amber-500 to-amber-300"
                            : "bg-gradient-to-r from-sky-500 via-cyan-400 to-teal-300"
                        }`}
                        style={{ width: `${Math.max(4, Math.min(100, speedSnap.progress || 0))}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STATE 3: COMPLETED RESULTS ANALYTICS INSIDE FIXED-HEIGHT ARENA */}
              {speedSnap.completed && !speedRunning && (() => {
                const finalDown = speedSnap.finalDownloadMbps || speedSnap.downloadMbps || 0;
                const finalUp = speedSnap.finalUploadMbps || speedSnap.uploadMbps || 0;
                const idlePing = speedSnap.pingMs || 0;
                const downLoadPing = speedSnap.downloadLatencyMs || speedSnap.loadedPingMs || idlePing;
                const upLoadPing = speedSnap.uploadLatencyMs || speedSnap.loadedPingMs || idlePing;
                const bloatDelta = Math.max(0, Math.max(downLoadPing, upLoadPing) - idlePing);
                const backendGrade = (speedSnap.bufferbloatGrade || "").toUpperCase();
                const bloatBadge = backendGrade
                  ? {
                      label: `${lang === "ar" ? "تقدير Bufferbloat:" : "Grade"} ${backendGrade}`,
                      cls:
                        backendGrade === "A+" || backendGrade === "A"
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/35"
                          : backendGrade === "B"
                            ? "bg-sky-500/15 text-sky-300 border-sky-500/35"
                            : backendGrade === "C"
                              ? "bg-amber-500/15 text-amber-300 border-amber-500/35"
                              : "bg-rose-500/15 text-rose-300 border-rose-500/35",
                    }
                  : bloatDelta <= 25
                    ? { label: t.speedLatencyLow, cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35" }
                    : bloatDelta <= 75
                    ? { label: t.speedLatencyMed, cls: "bg-amber-500/15 text-amber-300 border-amber-500/35" }
                    : { label: t.speedLatencyHigh, cls: "bg-rose-500/15 text-rose-300 border-rose-500/35" };
                const loss = speedSnap.packetLoss || 0;
                const grade =
                  speedSnap.qualityGrade ||
                  (finalDown >= 100 && finalUp >= 25 && idlePing > 0 && idlePing <= 40 && loss < 1
                    ? "A+"
                    : finalDown >= 35 && finalUp >= 8 && idlePing > 0 && idlePing <= 85 && loss < 2
                    ? "A"
                    : finalDown >= 12 && loss < 5
                    ? "B"
                    : "C");
                const gradeText =
                  grade === "A+"
                    ? t.speedGradeExcellent
                    : grade === "A"
                    ? t.speedGradeGood
                    : grade === "B"
                    ? t.speedGradeFair
                    : t.speedGradePoor;
                const gradeBadgeColor =
                  grade === "A+"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : grade === "A"
                    ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                    : grade === "B"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-rose-500/20 text-rose-300 border-rose-500/40";

                return (
                  <div className="masar-score-reveal space-y-4">
                    {/* 2-Card Analytical Breakdown */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Card A: Throughput Stability Curves */}
                      <div className="masar-well bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 space-y-3.5">
                        <div className="flex items-center justify-between border-b border-slate-800/70 pb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                            {t.speedDown} &amp; {t.speedUp}
                          </span>
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                            {(speedSnap.connectionMode || speedMode) === "single" ? t.speedModeSingle : t.speedModeMulti}
                          </span>
                        </div>

                        {/* Download Stability Row */}
                        <div className="flex items-center justify-between gap-3 bg-slate-900/60 border border-sky-500/25 rounded-xl px-3 py-2.5">
                          <div className="min-w-[110px]">
                            <div className="text-[11px] font-bold text-sky-400">{t.speedDown}</div>
                            <div className="text-lg font-extrabold font-mono text-white tabular-nums masar-text-glow-sky" dir="ltr">
                              {finalDown.toFixed(1)} <span className="text-[10px] font-normal text-slate-300">Mbps</span>
                            </div>
                            <div className="text-[11px] text-slate-300 tabular-nums">
                              {t.speedPeak}:{" "}
                              <bdi dir="ltr" className="font-mono font-semibold text-slate-100">
                                {(speedSnap.peakDownloadMbps || finalDown).toFixed(1)}
                              </bdi>
                            </div>
                          </div>
                          <div className="flex-1 flex justify-end overflow-hidden">
                            <LatencySparkline
                              history={speedSnap.downloadHistory}
                              width={220}
                              height={38}
                              colorOverride={uiTheme === "light" ? "#0284c7" : "#38bdf8"}
                              zeroBaseline
                            />
                          </div>
                        </div>

                        {/* Upload Stability Row */}
                        <div className="flex items-center justify-between gap-3 bg-slate-900/60 border border-emerald-500/25 rounded-xl px-3 py-2.5">
                          <div className="min-w-[110px]">
                            <div className="text-[11px] font-bold text-emerald-400">{t.speedUp}</div>
                            <div className="text-lg font-extrabold font-mono text-white tabular-nums masar-text-glow-emerald" dir="ltr">
                              {finalUp.toFixed(1)} <span className="text-[10px] font-normal text-slate-300">Mbps</span>
                            </div>
                            <div className="text-[11px] text-slate-300 tabular-nums">
                              {t.speedPeak}:{" "}
                              <bdi dir="ltr" className="font-mono font-semibold text-slate-100">
                                {(speedSnap.peakUploadMbps || finalUp).toFixed(1)}
                              </bdi>
                            </div>
                          </div>
                          <div className="flex-1 flex justify-end overflow-hidden">
                            <LatencySparkline
                              history={speedSnap.uploadHistory}
                              width={220}
                              height={38}
                              colorOverride={uiTheme === "light" ? "#059669" : "#10b981"}
                              zeroBaseline
                            />
                          </div>
                        </div>
                      </div>

                      {/* Card B: Loaded Latency & Bufferbloat Profile */}
                      <div className="masar-well bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between gap-3">
                        <div className="flex items-center justify-between border-b border-slate-800/70 pb-2 gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                            {t.speedBufferbloat}
                          </span>
                          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${bloatBadge.cls}`} dir={t.dir}>
                            {bloatBadge.label}
                          </span>
                        </div>

                        {/* Idle / Download / Upload Ping Breakdown */}
                        <div className="grid grid-cols-3 gap-2.5">
                          <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-2.5 text-center">
                            <div className="text-[11px] font-medium text-slate-300 truncate">{t.speedIdlePing}</div>
                            <div className="text-lg font-extrabold font-mono text-amber-400 mt-0.5 tabular-nums" dir="ltr">
                              {idlePing.toFixed(1)}<span className="text-[11px] font-normal text-slate-300 ml-0.5">ms</span>
                            </div>
                            <div className="text-[11px] font-mono font-medium text-slate-300 mt-0.5 tabular-nums" dir="ltr">
                              {speedSnap.latencyP50Ms > 0
                                ? `p50 ${speedSnap.latencyP50Ms.toFixed(0)} · p95 ${(speedSnap.latencyP95Ms || speedSnap.latencyP50Ms).toFixed(0)} · p99 ${(speedSnap.latencyP99Ms || speedSnap.latencyP95Ms || speedSnap.latencyP50Ms).toFixed(0)}`
                                : speedSnap.bestPingMs > 0
                                  ? `${speedSnap.bestPingMs.toFixed(0)}–${(speedSnap.maxPingMs || speedSnap.bestPingMs).toFixed(0)}ms`
                                  : "—"}
                            </div>
                          </div>
                          <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-2.5 text-center">
                            <div className="text-[11px] font-medium text-slate-300 truncate">{t.speedDownPing}</div>
                            <div className="text-lg font-extrabold font-mono text-sky-400 mt-0.5 tabular-nums" dir="ltr">
                              {downLoadPing.toFixed(1)}<span className="text-[11px] font-normal text-slate-300 ml-0.5">ms</span>
                            </div>
                            <div className="text-[11px] font-mono font-medium text-slate-300 mt-0.5 tabular-nums" dir="ltr">
                              {downLoadPing > idlePing ? `+${(downLoadPing - idlePing).toFixed(0)}ms` : "0ms"}
                              {speedSnap.downloadLatencyP95 > 0 ? ` · p95 ${speedSnap.downloadLatencyP95.toFixed(0)}ms` : ""}
                            </div>
                          </div>
                          <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-2.5 text-center">
                            <div className="text-[11px] font-medium text-slate-300 truncate">{t.speedUpPing}</div>
                            <div className="text-lg font-extrabold font-mono text-emerald-400 mt-0.5 tabular-nums" dir="ltr">
                              {upLoadPing.toFixed(1)}<span className="text-[11px] font-normal text-slate-300 ml-0.5">ms</span>
                            </div>
                            <div className="text-[11px] font-mono font-medium text-slate-300 mt-0.5 tabular-nums" dir="ltr">
                              {upLoadPing > idlePing ? `+${(upLoadPing - idlePing).toFixed(0)}ms` : "0ms"}
                              {speedSnap.uploadLatencyP95 > 0 ? ` · p95 ${speedSnap.uploadLatencyP95.toFixed(0)}ms` : ""}
                            </div>
                          </div>
                        </div>

                        {/* Secondary Telemetry Strip */}
                        <div className="pt-2 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
                          <span>{t.speedTotalData}: <bdi dir="ltr" className="font-mono font-bold text-slate-100">{(speedSnap.totalMB || 0).toFixed(1)} MB</bdi></span>
                          <span>{t.speedJitter}: <bdi dir="ltr" className="font-mono font-bold text-purple-300">{(speedSnap.jitterMs || 0).toFixed(1)} ms</bdi></span>
                          <span>{t.speedLoss}: <bdi dir="ltr" className="font-mono font-bold text-rose-300">{(speedSnap.packetLoss ?? 0).toFixed(1)}%</bdi></span>
                          <span className="font-mono text-slate-400" dir="ltr">{speedSnap.updatedAt}</span>
                        </div>
                      </div>
                    </div>

                    {/* Compact Verdict Banner + Quick Mode Switcher */}
                    <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className={`w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-lg border shrink-0 ${gradeBadgeColor}`}>
                          {grade}
                        </span>
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">{t.speedGradeTitle}</div>
                          <div className="text-xs text-slate-300">{gradeText}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <span className="text-[11px] font-semibold text-slate-400">{t.speedConnMode}</span>
                        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              setSpeedMode("multi");
                              if ((speedSnap.connectionMode || speedMode) !== "multi") {
                                handleToggleSpeedBenchmark("multi");
                              }
                            }}
                            title={lang === "ar" ? "فحص متعدد القنوات" : "Run Multi-Connection Test"}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                              (speedSnap.connectionMode || speedMode) === "multi"
                                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                                : "text-slate-400 hover:text-slate-200 border border-transparent"
                            }`}
                          >
                            {t.speedModeMulti}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSpeedMode("single");
                              if ((speedSnap.connectionMode || speedMode) !== "single") {
                                handleToggleSpeedBenchmark("single");
                              }
                            }}
                            title={lang === "ar" ? "فحص بقناة واحدة" : "Run Single-Connection Test"}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                              (speedSnap.connectionMode || speedMode) === "single"
                                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                                : "text-slate-400 hover:text-slate-200 border border-transparent"
                            }`}
                          >
                            {t.speedModeSingle}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* PINNED CONNECTION & TEST SERVER STRIP (Constant Across Idle / Running / Complete) */}
            <div className="relative z-10 masar-well rounded-xl bg-slate-950/70 border border-slate-800/85 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400 shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 000 18M12 3a14 14 0 010 18" strokeLinecap="round" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.speedNetworkCard}</div>
                  <div className="font-semibold text-slate-200 truncate">
                    {speedSnap.clientIsp || speedMeta?.clientIsp || (lang === "ar" ? "جاري التعرف على المزود..." : "Detecting ISP...")}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 truncate text-start">
                    <bdi dir="ltr">
                      {speedSnap.clientIp || speedMeta?.clientIp || "—"}
                      {(speedSnap.clientLocation || speedMeta?.clientLocation)
                        ? ` • ${speedSnap.clientLocation || speedMeta?.clientLocation}`
                        : ""}
                    </bdi>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 min-w-0 sm:border-s sm:border-slate-800/80 sm:ps-4">
                <span className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="6" rx="1.5" />
                    <rect x="3" y="14" width="18" height="6" rx="1.5" />
                    <circle cx="7" cy="7" r="1" fill="currentColor" />
                    <circle cx="7" cy="17" r="1" fill="currentColor" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.speedServerCard}</span>
                    <span className="text-[11px] font-semibold text-emerald-300">
                      {(speedSnap.connectionMode || speedMode) === "single" ? t.speedModeSingle : t.speedModeMulti}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-200 truncate">
                    {speedSnap.serverName || speedMeta?.serverName || "Cloudflare Anycast Edge"}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {speedSnap.serverLocation || speedMeta?.serverLocation || t.speedServerHint}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Global Anycast Edge Latency Matrix */}
            <div className="relative z-10 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {t.speedEdgesTitle}
                </h3>
                {!speedRunning && speedSnap.downloadMbps === 0 && (
                  <span className="text-xs text-slate-500">
                    {t.speedPhaseIdle}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3" dir={t.dir}>
                {(() => {
                  const edges = speedSnap.edgePings || [];
                  const maxEdgeRtt = Math.max(
                    35,
                    ...edges.map((e) => (e.status === "online" ? e.latencyMs : 0))
                  );
                  return edges.map((ep, idx) => {
                    const barPct =
                      ep.status === "online"
                        ? Math.max(
                            10,
                            Math.min(100, (ep.latencyMs / maxEdgeRtt) * 100)
                          )
                        : 0;
                    return (
                      <div
                        key={idx}
                        className="masar-lift-card masar-well bg-slate-950/80 border border-slate-800/90 rounded-xl px-4 py-3 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-200 truncate">
                            {localizeEdgeProvider(ep.provider, lang)}
                          </div>
                          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                            <bdi dir="ltr" className="font-mono">
                              {ep.endpoint}
                            </bdi>
                            {ep.bestMs > 0 && (
                              <span className="text-slate-400">
                                • {t.speedBest}:{" "}
                                <bdi dir="ltr" className="font-mono">
                                  {ep.bestMs.toFixed(1)} ms
                                </bdi>{" "}
                                • {t.speedAvg}:{" "}
                                <bdi dir="ltr" className="font-mono">
                                  {ep.avgMs.toFixed(1)} ms
                                </bdi>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0" dir="ltr">
                          <LatencySparkline
                            history={ep.history}
                            width={96}
                            height={24}
                          />
                          <div className="text-right font-mono w-20">
                            {ep.status === "online" ? (
                              <div className="inline-flex flex-col items-end gap-1 w-full">
                                <span className="text-emerald-400 font-bold text-sm">
                                  {ep.latencyMs.toFixed(1)} ms
                                </span>
                                <span className="w-16 h-1 rounded-full bg-slate-800 overflow-hidden">
                                  <span
                                    className="block h-full rounded-full bg-emerald-400 transition-all duration-300"
                                    style={{ width: `${barPct}%` }}
                                  />
                                </span>
                              </div>
                            ) : ep.status === "timeout" ? (
                              <span className="text-red-400 text-xs font-sans">
                                <bdi>{lang === "ar" ? "انتهت المهلة" : "Timeout"}</bdi>
                              </span>
                            ) : (
                              <span className="text-slate-600 text-xs">—</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </main>
      )}
          </>
        )}
      />
      </div>
      </div>

      {/* Bottom-Right Corner Dock: Vertical Stack of Zoom, Language & Settings Capsules */}
      <div
        dir="ltr"
        className="fixed bottom-3 right-6 z-40 flex flex-col items-end gap-2"
      >
        {/* 1. Animated Morphing Zoom Capsule */}
        <div
          className={`h-8 min-w-[32px] flex flex-row-reverse items-center bg-slate-900/95 border border-slate-800/90 hover:border-sky-500/40 rounded-xl overflow-hidden shadow-lg transition-all duration-300 ease-out ${
            zoomMenuOpen ? "px-1" : "p-0"
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setZoomMenuOpen((prev) => !prev);
              setLangMenuOpen(false);
            }}
            className={`masar-icon-btn shrink-0 flex items-center justify-center transition-all duration-300 ${
              zoomMenuOpen
                ? "h-6 w-6 rounded-lg bg-sky-500/20 text-sky-300"
                : uiScale !== 1
                  ? "h-full w-8 text-sky-400 hover:text-sky-300 hover:bg-slate-800"
                  : "h-full w-8 text-slate-400 hover:text-sky-400 hover:bg-slate-800"
            }`}
            title={`${lang === "ar" ? "تكبير وتصغير الواجهة" : "UI Zoom"} (${Math.round(uiScale * 100)}%)`}
          >
            <svg
              className={`masar-icon-target w-4 h-4 ${
                zoomMenuOpen ? "scale-110 text-sky-400" : ""
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
              <path d="M11 8v6M8 11h6" />
            </svg>
          </button>

          {/* Expanding Animated Zoom Controls (- 100% +) */}
          <div
            className={`flex items-center overflow-hidden transition-all duration-300 ease-out ${
              zoomMenuOpen
                ? "max-w-[148px] opacity-100 pl-1 pr-1 gap-0.5"
                : "max-w-0 opacity-0 pl-0 gap-0 pointer-events-none"
            }`}
          >
            <button
              type="button"
              onClick={handleZoomOut}
              className="h-6 w-6 rounded-md flex items-center justify-center text-slate-300 hover:bg-slate-800 hover:text-white transition-all duration-200"
              title={t.zoomOut}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 5H8" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleZoomReset}
              className="h-6 min-w-[40px] px-1.5 rounded-md flex items-center justify-center text-xs font-mono tabular-nums font-bold leading-none text-slate-100 hover:bg-slate-800 hover:text-sky-300 masar-text-glow-sky transition-all duration-200"
              title={t.zoomReset}
            >
              {Math.round(uiScale * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="h-6 w-6 rounded-md flex items-center justify-center text-slate-300 hover:bg-slate-800 hover:text-white transition-all duration-200"
              title={t.zoomIn}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 2V8M2 5H8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* 2. Animated Morphing Language Capsule */}
        <div
          className={`h-8 min-w-[32px] flex flex-row-reverse items-center bg-slate-900/95 border border-slate-800/90 hover:border-sky-500/40 rounded-xl overflow-hidden shadow-lg transition-all duration-300 ease-out ${
            langMenuOpen ? "px-1" : "p-0"
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setLangMenuOpen((prev) => !prev);
              setZoomMenuOpen(false);
            }}
            className={`masar-icon-btn shrink-0 flex items-center justify-center transition-all duration-300 ${
              langMenuOpen
                ? "h-6 w-6 rounded-lg bg-sky-500/20 text-sky-300"
                : "h-full w-8 text-slate-400 hover:text-sky-400 hover:bg-slate-800"
            }`}
            title={lang === "ar" ? "تغيير اللغة" : "Switch Language"}
          >
            <svg
              className={`masar-icon-target w-4 h-4 ${
                langMenuOpen ? "rotate-180 scale-110 text-sky-400" : ""
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </button>

          {/* Expanding Animated Language Options */}
          <div
            className={`flex items-center overflow-hidden transition-all duration-300 ease-out ${
              langMenuOpen
                ? "max-w-[148px] opacity-100 pl-1 pr-1 gap-1"
                : "max-w-0 opacity-0 pl-0 gap-0 pointer-events-none"
            }`}
          >
            <button
              type="button"
              onClick={() => selectLanguage("ar")}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all duration-200 ${
                lang === "ar"
                  ? "bg-sky-500 text-slate-950 shadow-sm scale-100"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white scale-95"
              }`}
            >
              العربية
            </button>
            <button
              type="button"
              onClick={() => selectLanguage("en")}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all duration-200 ${
                lang === "en"
                  ? "bg-sky-500 text-slate-950 shadow-sm scale-100"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white scale-95"
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* 3. Settings & Guide Icon Button */}
        <button
          type="button"
          onClick={() => {
            setZoomMenuOpen(false);
            setLangMenuOpen(false);
            setSettingsOpen(true);
          }}
          className="masar-icon-btn group w-8 h-8 rounded-xl bg-slate-900/95 hover:bg-slate-800 border border-slate-800/90 hover:border-sky-500/40 shadow-lg flex items-center justify-center text-slate-400 hover:text-sky-400 transition-all duration-300"
          title={t.settingsBtn}
        >
          <svg
            className="masar-icon-target w-4 h-4 group-hover:rotate-90 transition-transform duration-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* SETTINGS, CREDITS, THEME SWITCHER & COMPREHENSIVE GUIDE MODAL */}
      <AnimatedModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        backdropClassName={`fixed inset-x-0 bottom-0 top-10 z-40 flex items-center justify-center p-3 sm:p-6 ${
          uiTheme === "light"
            ? "bg-slate-300/45 backdrop-blur-xl"
            : "bg-black/70 backdrop-blur-xl"
        }`}
        panelClassName="relative bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-full flex flex-col shadow-2xl overflow-hidden"
      >
            <SectionAmbientBackground variant="mtr" />
            {/* Modal Header */}
            <div className="relative z-10 shrink-0 px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-3">
                <MasarLogo size={34} className="shrink-0 drop-shadow-sm" />
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-white">
                    {t.settingsTitle}
                  </h2>
                  <p className="text-xs text-slate-400">{t.settingsSub}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-slate-700 text-xs font-bold transition"
              >
                ✕ {t.closeBtn}
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="relative z-10 flex-1 min-h-0 p-6 overflow-y-auto overscroll-contain space-y-7">
              {/* 1. CREDITS & APP IDENTITY (@mhmdrfx + Crafted Phrase + App Logo) */}
              <section className="space-y-3">
                <h3 className="text-sm font-extrabold text-sky-400 uppercase tracking-wider">
                  {t.sec1Title}
                </h3>

                <div
                  className={`rounded-2xl border p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-lg bg-gradient-to-br ${
                    uiTheme === "light"
                      ? "from-sky-50 via-white to-emerald-50 border-sky-300"
                      : "from-sky-950/40 via-slate-950/90 to-emerald-950/30 border-sky-500/35"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-start">
                    <MasarLogo
                      size={82}
                      className={`shrink-0 ${
                        uiTheme === "light"
                          ? "drop-shadow-[0_10px_20px_rgba(14,165,233,0.16)]"
                          : "drop-shadow-[0_12px_24px_rgba(2,6,23,0.65)]"
                      }`}
                    />

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <span className="text-xl font-extrabold text-white tracking-wide" dir="ltr">
                          MASAR
                        </span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/40">
                          {versionDisplay}
                        </span>
                      </div>

                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs font-bold">
                        <span>✦</span>
                        <span>{t.craftedPhrase}</span>
                        <span>✦</span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed max-w-md">
                        {t.identityDesc}
                      </p>
                    </div>
                  </div>

                  {/* Developer Rights Badge (@mhmdrfx) */}
                  <div className="bg-slate-950/90 border border-sky-500/40 rounded-2xl px-6 py-4 text-center space-y-2 shrink-0 shadow-xl">
                    <div className="text-[11px] text-slate-400 font-semibold">
                      {t.rightsText}
                    </div>
                    <div
                      dir="ltr"
                      style={{
                        fontFamily:
                          "'Segoe UI Variable Display', 'Trebuchet MS', 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
                        letterSpacing: "0.06em",
                      }}
                      className="inline-flex items-center justify-center gap-0.5 text-lg font-extrabold bg-sky-950/60 border border-sky-500/40 px-4 py-1.5 rounded-xl shadow-inner select-all"
                    >
                      <span className="text-sky-400 font-bold">@</span>
                      <span className="text-white tracking-wider">mhmdrfx</span>
                    </div>
                    <div className="text-[11px] text-emerald-400 font-bold">
                      {t.craftedPhrase} ♥
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. THEME SWITCHER (DARK MODE VS WHITE MODE WITH VISUAL PREVIEWS) */}
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-extrabold text-sky-400 uppercase tracking-wider">
                    {t.sec2Title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{t.sec2Desc}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => selectTheme("dark")}
                    className={`masar-lift-card text-start rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                      uiTheme === "dark"
                        ? "border-sky-500/80 ring-1 ring-sky-500/40 bg-sky-950/20 shadow-lg shadow-sky-500/10"
                        : "border-slate-800/80 bg-slate-950/60 hover:border-slate-700"
                    }`}
                  >
                    <div className="w-full space-y-1">
                      <div className="w-full flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <ThemeRadioIndicator active={uiTheme === "dark"} />
                          <span className="text-sm font-bold text-white truncate">
                            {t.darkThemeTitle}
                          </span>
                        </div>
                        {uiTheme === "dark" && (
                          <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500 text-slate-950">
                            ✓ {t.activeThemeBadge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 w-full">
                        {t.darkThemeDesc}
                      </p>
                    </div>

                    <ThemePreviewMiniUI mode="dark" versionDisplay={versionDisplay} />
                  </button>

                  <button
                    type="button"
                    onClick={() => selectTheme("light")}
                    className={`masar-lift-card text-start rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                      uiTheme === "light"
                        ? "border-sky-600/80 ring-1 ring-sky-600/30 bg-sky-50 shadow-lg shadow-sky-600/10"
                        : "border-slate-800/80 bg-slate-950/60 hover:border-slate-700"
                    }`}
                  >
                    <div className="w-full space-y-1">
                      <div className="w-full flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <ThemeRadioIndicator active={uiTheme === "light"} />
                          <span className="text-sm font-bold text-white truncate">
                            {t.lightThemeTitle}
                          </span>
                        </div>
                        {uiTheme === "light" && (
                          <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500 text-slate-950">
                            ✓ {t.activeThemeBadge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 w-full">
                        {t.lightThemeDesc}
                      </p>
                    </div>

                    <ThemePreviewMiniUI mode="light" versionDisplay={versionDisplay} />
                  </button>
                </div>
              </section>

              {/* WINDOW RESIZE, UI ZOOM & MENU PREFERENCES */}
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-extrabold text-sky-400 uppercase tracking-wider">
                    {lang === "ar" ? "حجم النوافذ والقوائم وتخصيص الواجهة" : "Window Scale & Menu Customization"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {lang === "ar"
                      ? "تحكم في مقياس تكبير/تصغير واجهة البرنامج ونمط عرض القوائم لتناسب شاشتك بدقة:"
                      : "Adjust interface zoom scale and menu layouts to match your display resolution:"}
                  </p>
                </div>

                <div className="masar-lift-card masar-well rounded-2xl bg-slate-950/80 border border-slate-800/90 p-5 space-y-4 shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold text-slate-200">
                        {lang === "ar" ? "مقياس تكبير وتصغير الواجهة (UI Zoom)" : "Interface Zoom Scale"}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {lang === "ar"
                          ? "تكبير وتصغير عناصر البرنامج والنصوص بالكامل (أو اختصارات: Ctrl + و Ctrl - و Ctrl 0)"
                          : "Scale entire application UI and text (Keyboard shortcuts: Ctrl + and Ctrl -)"}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[0.85, 0.9, 1.0, 1.1, 1.25, 1.5].map((scale) => {
                        const active = Math.abs(uiScale - scale) < 0.02;
                        return (
                          <button
                            key={scale}
                            type="button"
                            onClick={() => setUiScale(scale)}
                            className={`px-3 py-1 rounded-xl text-xs font-mono font-semibold transition ${
                              active
                                ? "bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20"
                                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
                            }`}
                          >
                            {Math.round(scale * 100)}%
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold text-slate-200">
                        {lang === "ar" ? "نمط شريط القوائم والتنقل" : "Navigation Bar Layout Mode"}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {lang === "ar"
                          ? "التبديل بين العرض المدمج لتوفير المساحة أو العرض الكامل مع الأيقونات والأسماء"
                          : "Switch between compact mode to save screen space or full detailed menu layout"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMenuCompact(false)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                          !menuCompact
                            ? "bg-sky-500 text-slate-950 font-bold shadow-sm"
                            : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
                        }`}
                      >
                        <span>{lang === "ar" ? "العرض الكامل" : "Expanded Menu"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMenuCompact(true)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                          menuCompact
                            ? "bg-sky-500 text-slate-950 font-bold shadow-sm"
                            : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
                        }`}
                      >
                        <span>{lang === "ar" ? "العرض المدمج" : "Compact Menu"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. IN-APP UPDATES & WINGET CHANNEL */}
              <UpdateSettingsPanel lang={lang} />

              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-extrabold text-sky-400 uppercase tracking-wider">
                    {t.sec3Title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{t.sec3Desc}</p>
                </div>

                <div className="space-y-3">
                  {guideSections.map((sec, idx) => (
                    <div
                      key={idx}
                      className="masar-lift-card masar-well rounded-2xl bg-slate-950/80 border border-slate-800/90 p-4 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/30">
                          {sec.badge}
                        </span>
                        <h4 className="text-sm font-bold text-white">
                          {sec.title}
                        </h4>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {sec.summary}
                      </p>

                      <ul className="space-y-1.5 pt-1">
                        {sec.points.map((pt, pIdx) => (
                          <li
                            key={pIdx}
                            className="text-xs text-slate-400 leading-relaxed flex items-start gap-2"
                          >
                            <span className="text-sky-400 font-bold mt-0.5">
                              •
                            </span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            </div>
      </AnimatedModal>

      {/* EXTRACTED DATA BREAKDOWN, REPORT STUDIO & 12-METRIC REFERENCE MODAL */}
      <Suspense fallback={null}>
        <ReportStudioModal
          open={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          lang={lang}
          uiTheme={uiTheme}
          snapshot={snapshot}
          localizedHealth={localizedHealth}
          copyFeedback={copyFeedback}
          exportFeedback={exportFeedback}
          reportNotice={reportNotice}
          onCopySummary={handleCopySummary}
          onExportReport={handleExportReport}
          onStartTraceNow={() => startTrace(target, mtrMode)}
          SectionAmbientBackground={SectionAmbientBackground}
          appVersion={appVersion}
        />
      </Suspense>

      {/* FLOATING UPDATE NOTIFIER */}
      <UpdateNotifier lang={lang} />
    </div>
  );
}
