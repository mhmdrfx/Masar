import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatedModal } from "./motion/MotionPrimitives.jsx";
import StatusLottie from "./motion/StatusLottie.jsx";
import {
  buildBrowserDetailedReport,
  evaluateReadinessFront,
  formatArabicCount,
  formatEnglishCount,
  EXPORT_FORMAT_ICONS,
  STUDIO_TAB_ICONS,
} from "./ReportStudio.jsx";

export default function ReportStudioModal(props) {
  const { open, onClose, uiTheme } = props;

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatedModal
      open={open}
      onClose={onClose}
      backdropClassName={`fixed inset-x-0 bottom-0 top-10 z-40 flex items-center justify-center p-3 sm:p-6 ${
        uiTheme === "light"
          ? "bg-slate-300/45 backdrop-blur-md"
          : "bg-black/75 backdrop-blur-sm"
      }`}
      panelClassName="relative bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full max-h-full flex flex-col shadow-2xl overflow-hidden"
    >
      <ReportStudioContent {...props} />
    </AnimatedModal>
  );
}

function ReportStudioContent({
  onClose,
  lang,
  uiTheme,
  snapshot,
  localizedHealth,
  copyFeedback,
  exportFeedback,
  reportNotice,
  onCopySummary,
  onExportReport,
  onStartTraceNow,
  SectionAmbientBackground,
  appVersion = "",
}) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [renderedFilter, setRenderedFilter] = useState("all");
  const [filterPhase, setFilterPhase] = useState("enter");
  const tabTimerRef = useRef(null);
  const bodyRef = useRef(null);
  const tabsBarRef = useRef(null);
  const tabBtnRefs = useRef({});
  const [pillStyle, setPillStyle] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    ready: false,
  });

  useEffect(() => {
    if (activeFilter === renderedFilter) {
      if (tabTimerRef.current) {
        clearTimeout(tabTimerRef.current);
        tabTimerRef.current = null;
      }
      setFilterPhase("enter");
      return;
    }

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) {
      setRenderedFilter(activeFilter);
      setFilterPhase("enter");
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
      return;
    }

    setFilterPhase("exit");
    if (tabTimerRef.current) clearTimeout(tabTimerRef.current);
    tabTimerRef.current = setTimeout(() => {
      tabTimerRef.current = null;
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
      setRenderedFilter(activeFilter);
      setFilterPhase("enter");
    }, 105);

    return () => {
      if (tabTimerRef.current) {
        clearTimeout(tabTimerRef.current);
        tabTimerRef.current = null;
      }
    };
  }, [activeFilter, renderedFilter]);

  const isAr = lang === "ar";
  const hops = snapshot?.hops || [];
  const hasData = hops.length > 0;
  const health = snapshot?.health || { score: 100, severity: "idle" };

  const hop1 = hops.find((h) => h.hop === 1) || null;
  const transitHops = hops.filter((h) => h.hop > 1 && !h.reachedDest);
  const respondingTransit = transitHops.filter((h) => h.received > 0);
  const silentCount = hops.filter(
    (h) => !h.ip || (h.received === 0 && h.lossPercent === 0)
  ).length;
  const respondingCount = hops.length - silentCount;
  const ispHop = respondingTransit[0] || transitHops[0] || null;
  const destHop =
    hops.find((h) => h.reachedDest) || (hops.length > 0 ? hops[hops.length - 1] : null);

  const readiness = evaluateReadinessFront(destHop, isAr);
  const previewText = hasData
    ? buildBrowserDetailedReport(snapshot, lang, localizedHealth, appVersion)
    : "";

  const toneBadgeClass = (tone) => {
    switch (tone) {
      case "emerald":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/35";
      case "sky":
        return "bg-sky-500/15 text-sky-300 border-sky-500/35";
      case "amber":
        return "bg-amber-500/15 text-amber-300 border-amber-500/35";
      case "red":
        return "bg-red-500/20 text-red-300 border-red-500/40";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const hopsCountAr = formatArabicCount(
    hops.length,
    "قفزة واحدة",
    "قفزتان",
    "قفزات",
    "قفزة"
  );
  const hopsCountEn = formatEnglishCount(hops.length, "Hop", "Hops");

  const metricCards = isAr
    ? [
        {
          num: "01",
          code: "Hop # / TTL",
          title: "رقم القفزة وترتيب المحطة",
          liveVal: hasData ? hopsCountAr : "من 1 إلى 30 قفزة",
          liveIsLtr: false,
          desc: "يرسل برنامج مسار نبضات فحص بتدرج زمن حياة يبدأ من 1 وحتى 30 ليكشف كل راوتر تعبره بياناتك بالترتيب. القفزة الأولى هي دائماً راوترك المنزلي أو المكتبي، والقفزتان الثانية والثالثة تمثلان مقسم وبوابة شركة الاتصالات، تليها عقد الربط الدولي حتى الوصول إلى الخادم الهدف.",
          good: "مسار مباشر ومختصر (من 5 إلى 14 قفزة)",
          warn: "مسار طويل نسبياً (من 15 إلى 22 قفزة)",
          crit: "توجيه غير مباشر (أكثر من 25 قفزة)",
        },
        {
          num: "02",
          code: "IP & Hostname",
          title: "عنوان الراوتر والاسم العكسي للمضيف",
          liveVal: destHop?.ip
            ? `${destHop.ip}${destHop.hostname ? ` (${destHop.hostname})` : ""}`
            : "8.8.8.8 (dns.google)",
          liveIsLtr: true,
          desc: "العنوان الرقمي الفريد لكل راوتر على المسار متبوعاً باسمه المسجل في سجلات الفحص العكسي للنطاقات. قراءة هذا الاسم تكشف للمختصين اسم المدينة، ونوع مقسم المزود، وهوية الخادم النهائي.",
          good: "عنوان رقمي واضح مع سجل عكسي معرف",
          warn: "عنوان رقمي بدون اسم عكسي مسجل",
          crit: "تغير متكرر وغير مستقر في عنوان العقدة",
        },
        {
          num: "03",
          code: "Geo-IP & ASN",
          title: "الموقع الجغرافي ورقم النظام المستقل",
          liveVal: destHop?.asn || destHop?.location || "AS15169 • Global",
          liveIsLtr: true,
          desc: "يستخرج البرنامج الدولة والمدينة التي يتواجد فيها الراوتر إلى جانب رقم النظام المستقل للشبكة المالكة له (مثل شبكات جوجل أو كلاودفلير أو مشغلي الاتصالات المحليين) لتتبع مسار خروج البيانات دولياً.",
          good: "ربط إقليمي مباشر بمسار جغرافي قصير",
          warn: "عبور عبر قارة بعيدة قبل الوصول للهدف",
          crit: "اختناق عند نقطة تبادل دولية مزدحمة",
        },
        {
          num: "04",
          code: "Loss %",
          title: "نسبة فقد الحزم المئوية",
          liveVal:
            destHop && destHop.sent > 0
              ? `${destHop.lossPercent.toFixed(1)}%`
              : "0.0%",
          liveIsLtr: true,
          desc: "أهم رقم لتشخيص التقطيع على الإطلاق؛ يحسب نسبة النبضات التي لم تعد من إجمالي المرسل. العبرة دائماً باستمرار الفقد حتى الوجهة النهائية؛ فإذا بدأ الفقد عند القفزة الأولى فالمشكلة من الشبكة المنزلية، وإذا بدأ من القفزة الثانية واستمر للنهاية فالمشكلة من خط المزود.",
          good: "من 0% إلى 2% مسار نقي ومثالي",
          warn: "من 2% إلى 5% فقد متوسط يسبب تذبذباً",
          crit: "أكثر من 5% خلل يسبب تقطيعاً واضحاً",
        },
        {
          num: "05",
          code: "Sent / Recv",
          title: "عدد الحزم المرسلة والمستلمة",
          liveVal:
            destHop && destHop.sent > 0
              ? `${destHop.sent} / ${destHop.received}`
              : "1 / 1",
          liveIsLtr: true,
          desc: "عداد النبضات التي أرسلها البرنامج (بمعدل نبضة كل ثانية لكل قفزة) مقابل الردود المستلمة فعلياً. عند تقديم بلاغ فني لشركة الاتصالات، يُنصح بترك الفحص يعمل لمدة 30 إلى 60 ثانية على الأقل لتكوين عينة إحصائية موثوقة.",
          good: "تطابق تام بين المرسل والمستلم",
          warn: "نقص طفيف متقطع في الردود المستلمة",
          crit: "اتساع مستمر في الفارق بين المرسل والمستلم",
        },
        {
          num: "06",
          code: "Last RTT (ms)",
          title: "زمن الاستجابة اللحظي الحالي",
          liveVal:
            destHop && destHop.received > 0
              ? `${destHop.lastMs.toFixed(1)} ms`
              : "— ms",
          liveIsLtr: true,
          desc: "زمن رحلة آخر حزمة خرجت من جهازك إلى القفزة وعادت إليك مقيساً بالمللي ثانية (جزء من ألف من الثانية). يعكس حالة الخط في هذه الثانية تحديداً ويكشف الارتفاعات المفاجئة فور حدوثها.",
          good: "أقل من 35 مللي ثانية محلياً وإقليمياً",
          warn: "من 35 إلى 110 مللي ثانية للربط الدولي",
          crit: "أعلى من 150 مللي ثانية تأخر ملحوظ",
        },
        {
          num: "07",
          code: "Avg RTT (ms)",
          title: "المتوسط الحسابي لزمن الاستجابة",
          liveVal:
            destHop && destHop.received > 0
              ? `${destHop.avgMs.toFixed(1)} ms`
              : "— ms",
          liveIsLtr: true,
          desc: "مجموع أزمنة جميع الردود المستلمة مقسوماً على عددها منذ بداية جلسة الفحص. يُعد الرقم الأكثر دقة للحكم على سرعة استجابة الخادم الحقيقية بعيداً عن أي قفزة عابرة لثانية واحدة.",
          good: "أقل من 45 مللي ثانية للألعاب التنافسية",
          warn: "من 45 إلى 100 مللي ثانية مستقر للتصفح",
          crit: "أعلى من 150 مللي ثانية مسار بعيد أو مزدحم",
        },
        {
          num: "08",
          code: "Best / Worst",
          title: "أفضل وأسوأ زمن استجابة مسجل",
          liveVal:
            destHop && destHop.received > 0
              ? `${destHop.bestMs.toFixed(1)} / ${destHop.worstMs.toFixed(1)} ms`
              : "— / — ms",
          liveIsLtr: true,
          desc: "يمثل «الأفضل» الحد الفيزيائي الأدنى لانتقال الإشارة في الألياف نحو الخادم، بينما يكشف «الأسوأ» أقصى اختناق حدث أثناء الفحص. اتساع الفارق الكبير بينهما يدل على ازدحام طوابير البيانات عند سحب سرعات عالية بالمنزل.",
          good: "فارق ضيق بين القراءتين (أقل من 15 مللي ثانية)",
          warn: "فارق متوسط (من 15 إلى 45 مللي ثانية)",
          crit: "قفزات حادة تتجاوز 80 مللي ثانية فوق الأفضل",
        },
        {
          num: "09",
          code: "Jitter (ms)",
          title: "تباين الاستجابة الزمني (التذبذب)",
          liveVal:
            destHop && destHop.received > 0
              ? `${destHop.jitterMs.toFixed(1)} ms`
              : "— ms",
          liveIsLtr: true,
          desc: "يقيس مقدار التفاوت وعدم الانتظام بين كل قراءة استجابة والقراءة التي تليها مباشرة. حتى لو كان متوسط الاستجابة منخفضاً، فإن ارتفاع هذا التباين يسبب ارتداد الحركة في الألعاب وتقطع الصوت في المكالمات.",
          good: "من 0 إلى 8 مللي ثانية ثبات فائق",
          warn: "من 8 إلى 20 مللي ثانية تذبذب متوسط",
          crit: "أعلى من 20 مللي ثانية عدم استقرار واضح",
        },
        {
          num: "10",
          code: "Trend (60s)",
          title: "المنحنى البياني الحي لآخر 60 ثانية",
          liveVal:
            destHop?.history?.length > 0
              ? formatArabicCount(
                  destHop.history.length,
                  "عينة زمنية واحدة",
                  "عينتان زمنيتان",
                  "عينات زمنية",
                  "عينة زمنية"
                )
              : "حتى 60 عينة حية",
          liveIsLtr: false,
          desc: "رسم موجي لحظي يوثق آخر 60 قراءة زمنية لكل قفزة على حدة، ويُدرج أيضاً كرسم متجه داخل التقرير الرسمي للطباعة. الخط الأفقي الهادئ يعني اتصالاً صخرياً، أما التموجات الحادة فتعني تداخل إشارة لاسلكية أو ضغط تحميل بالخلفية.",
          good: "خط انسيابي شبه أفقي باللون الأخضر",
          warn: "تموجات متوسطة باللون الأصفر",
          crit: "قمم حادة متكررة باللون الأحمر",
        },
        {
          num: "11",
          code: "ICMP Silent",
          title: "الراوترات الصامتة وتجاهل رسائل الفحص",
          liveVal: hasData
            ? formatArabicCount(
                silentCount,
                "عقدة صامتة واحدة",
                "عقدتان صامتتان",
                "عقد صامتة",
                "عقدة صامتة"
              )
            : "فلترة طبيعية غير مؤثرة",
          liveIsLtr: false,
          desc: "معلومة جوهرية في هندسة الشبكات: راوترات العبور الدولية تنقل ملايين الحزم في الثانية، لذلك تبرمجها شركات الاتصالات لتجاهل رسائل الفحص لحماية معالجاتها بينما تمرر بياناتك بسرعة كاملة؛ لذا لا تُحتسب كعطل طالما كانت الوجهة النهائية سليمة.",
          good: "عقدة صامتة بالمنتصف مع فقد 0% بالوجهة",
          warn: "صمت في القفزة الأولى بسبب جدار الحماية",
          crit: "انقطاع كامل في استجابة الوجهة النهائية",
        },
        {
          num: "12",
          code: "Health Score",
          title: "مؤشر الجودة الذكي وعزل مصدر المشكلة",
          liveVal: `${health.score}%`,
          liveIsLtr: true,
          desc: "يقارن محرك التحليل الذكي في مسار أداء القفزة الأولى (الراوتر المنزلي) مع بوابة المزود ومع الوجهة النهائية في اللحظة نفسها، ليمنحك درجة تقييم مئوية ويحدد بدقة مصدر الخلل دون الحاجة إلى خبرة شبكات متقدمة.",
          good: "من 85% إلى 100% اتصال صحي ومثالي",
          warn: "من 60% إلى 84% تذبذب أو ارتفاع استجابة",
          crit: "أقل من 60% خلل يتطلب المعالجة",
        },
      ]
    : [
        {
          num: "01",
          code: "Hop # / TTL",
          title: "Hop Sequence & Time-To-Live Step",
          liveVal: hasData ? `${hopsCountEn} Discovered` : "TTL 1 → 30",
          liveIsLtr: true,
          desc: "Masar dispatches ICMPv4 probes with incrementing Time-To-Live (TTL 1..30) to map every router along your path in exact order. Hop #1 is always your local LAN/Wi-Fi router, Hops #2–#3 are your ISP access/aggregation gateways, followed by IXP peering nodes up to the destination.",
          good: "Direct route (5–14 hops)",
          warn: "Extended path (15–22 hops)",
          crit: "Suboptimal / routing loop (>25 hops)",
        },
        {
          num: "02",
          code: "IP & Hostname",
          title: "Router IPv4 Address & Reverse DNS",
          liveVal: destHop?.ip
            ? `${destHop.ip}${destHop.hostname ? ` (${destHop.hostname})` : ""}`
            : "8.8.8.8 (dns.google)",
          liveIsLtr: true,
          desc: "Displays each hop's numeric IPv4 address alongside its asynchronously resolved PTR hostname. Carrier hostnames often encode city airport codes, router roles (bng, core, peer), and link speeds.",
          good: "Resolved IP + descriptive PTR record",
          warn: "Public IP without PTR record",
          crit: "Frequent route flapping between IPs",
        },
        {
          num: "03",
          code: "Geo-IP & ASN",
          title: "Geographic Location & Autonomous System",
          liveVal: destHop?.asn || destHop?.location || "AS15169 • Global",
          liveIsLtr: true,
          desc: "Identifies the physical country/city and Autonomous System Number (e.g., AS15169 Google, AS13335 Cloudflare, or regional telecom ASNs) operating each router so you can verify regional vs. intercontinental routing.",
          good: "Direct regional IXP peering",
          warn: "Detour through distant continent",
          crit: "Congested international transit link",
        },
        {
          num: "04",
          code: "Loss %",
          title: "Packet Loss Percentage",
          liveVal:
            destHop && destHop.sent > 0
              ? `${destHop.lossPercent.toFixed(1)}% at Target`
              : "0.0%",
          liveIsLtr: true,
          desc: "The primary indicator of connection drops: ((Sent - Recv) / Sent) × 100. True packet loss is confirmed when loss begins at a specific hop AND persists through the final destination. Loss starting at Hop 1 points to Wi-Fi/LAN; loss starting at Hop 2+ points to your ISP.",
          good: "0% – 2% Clean & Healthy",
          warn: "2% – 5% Moderate Degradation",
          crit: "> 5% Critical Packet Drops",
        },
        {
          num: "05",
          code: "Sent / Recv",
          title: "Transmitted vs. Received Probes",
          liveVal:
            destHop && destHop.sent > 0
              ? `${destHop.sent} Sent / ${destHop.received} Recv`
              : "1 Probe / sec",
          liveIsLtr: true,
          desc: "Counts total 1-second ICMP Echo probes sent to each hop vs. valid replies received. Running a trace for at least 30–60 samples provides statistically solid evidence when escalating tickets to your ISP.",
          good: "1:1 parity (e.g., 60 / 60)",
          warn: "Occasional missed echo replies",
          crit: "Sustained drop gap between Sent & Recv",
        },
        {
          num: "06",
          code: "Last RTT (ms)",
          title: "Latest Round-Trip Latency",
          liveVal:
            destHop && destHop.received > 0
              ? `${destHop.lastMs.toFixed(1)} ms`
              : "— ms",
          liveIsLtr: true,
          desc: "Exact Round-Trip Time in milliseconds for the most recent packet to reach that hop and return. Useful for spotting real-time spikes the instant network load changes.",
          good: "< 35 ms (Optimal local/regional)",
          warn: "35 – 110 ms (Normal international)",
          crit: "> 150 ms (High latency route)",
        },
        {
          num: "07",
          code: "Avg RTT (ms)",
          title: "Cumulative Average Latency",
          liveVal:
            destHop && destHop.received > 0
              ? `${destHop.avgMs.toFixed(1)} ms`
              : "— ms",
          liveIsLtr: true,
          desc: "Mean Round-Trip Time across all received probes during the active session. Smooths out single-second anomalies to represent true baseline route responsiveness.",
          good: "< 45 ms for Competitive Gaming",
          warn: "45 – 100 ms Solid General/VoIP",
          crit: "> 150 ms Long-Haul / Congested",
        },
        {
          num: "08",
          code: "Best / Worst",
          title: "Minimum Floor & Peak Latency Spike",
          liveVal:
            destHop && destHop.received > 0
              ? `${destHop.bestMs.toFixed(1)} / ${destHop.worstMs.toFixed(1)} ms`
              : "Min / Max ms",
          liveIsLtr: true,
          desc: "Best RTT reflects the physical fiber propagation floor, whereas Worst RTT captures the highest congestion spike. A narrow spread proves queue stability; a wide gap diagnoses Bufferbloat under heavy downloads or uploads.",
          good: "Tight spread (< 15 ms gap)",
          warn: "Moderate spikes (15 – 45 ms gap)",
          crit: "Severe bufferbloat (> 80 ms spikes)",
        },
        {
          num: "09",
          code: "Jitter (ms)",
          title: "Inter-Packet Latency Variance",
          liveVal:
            destHop && destHop.received > 0
              ? `${destHop.jitterMs.toFixed(1)} ms`
              : "— ms",
          liveIsLtr: true,
          desc: "Measures the average fluctuation between consecutive ping samples. Low jitter is just as critical as low ping—high jitter causes rubber-banding in games and choppy VoIP audio even when average latency looks fine.",
          good: "0 – 8 ms Rock-Solid Pacing",
          warn: "8 – 20 ms Mild Fluctuation",
          crit: "> 20 ms Unstable Real-Time Timing",
        },
        {
          num: "10",
          code: "Trend (60s)",
          title: "Live 60-Second Rolling Sparkline",
          liveVal:
            destHop?.history?.length > 0
              ? formatEnglishCount(destHop.history.length, "Live Sample", "Live Samples")
              : "60s Waveform",
          liveIsLtr: true,
          desc: "Plots the rolling 60-second RTT waveform per hop (also embedded as vector SVG charts inside exported PDF/HTML reports). Flat waveforms confirm clean links; sawtooth bursts reveal Wi-Fi contention or queue saturation.",
          good: "Flat emerald baseline",
          warn: "Amber periodic waves",
          crit: "Sharp recurring red spikes",
        },
        {
          num: "11",
          code: "ICMP Silent",
          title: "Control-Plane ICMP Rate-Limiting",
          liveVal: hasData
            ? formatEnglishCount(silentCount, "Silent Transit Hop", "Silent Transit Hops")
            : "Harmless Filter",
          liveIsLtr: true,
          desc: "Crucial diagnostic rule: Core backbone routers prioritize forwarding gigabits of user traffic in hardware ASICs and intentionally deprioritize or drop ICMP TTL-expired packets on their CPU. If an intermediate hop is silent (—) while your final destination shows 0% loss, there is zero fault.",
          good: "Silent transit + 0% target loss = 100% Healthy",
          warn: "Hop 1 silent (local firewall ICMP block)",
          crit: "Final destination itself timing out",
        },
        {
          num: "12",
          code: "Health Score",
          title: "Automated Correlation & Bottleneck Score",
          liveVal: `${health.score}%`,
          liveIsLtr: true,
          desc: "Masar's diagnostic engine simultaneously correlates Hop 1 (Home Wi-Fi/LAN), Hops 2–3 (ISP Gateway), and End-to-End Target metrics to isolate the true culprit and compute an executive 0–100% reliability score.",
          good: "85% – 100% Optimal Path",
          warn: "60% – 84% Degraded Latency/Jitter",
          crit: "< 60% Actionable Network Fault",
        },
      ];

  const exportFormatCards = isAr
    ? [
        {
          id: "copy",
          badge: "نسخ فوري للحافظة",
          title: "نسخ التقرير النصي الشامل",
          sub: "مخصص لتذاكر الدعم الفني والمحادثات الفورية",
          desc: "ينسخ بضغطة واحدة تقريراً نصياً منسقاً يتضمن: الملخص التنفيذي، تحليل المقاطع (الراوتر، المزود، الوجهة)، تقييم الألعاب والمكالمات، سجل القفزات، ودليل شرح المؤشرات.",
          actionLabel: copyFeedback ? "✓ تم النسخ إلى الحافظة" : "نسخ التقرير الآن",
          onClick: onCopySummary,
          activeFeedback: Boolean(copyFeedback),
        },
        {
          id: "html",
          badge: "تقرير رسمي للطباعة",
          title: "التقرير الرسمي المعتمد (PDF / HTML)",
          sub: "وثيقة رسمية بشعار مسار جاهزة للحفظ بصيغة PDF",
          desc: "ينشئ وثيقة احترافية عالية الدقة تتضمن 6 بطاقات مؤشرات رئيسية، تقييم جاهزية التطبيقات، جدول القفزات مع رسوم المنحنيات البيانية، و10 بطاقات مرجعية تشرح كافة القراءات.",
          actionLabel:
            exportFeedback === "HTML" ? "✓ تم حفظ التقرير" : "تصدير التقرير الرسمي (PDF)",
          onClick: () => onExportReport("html"),
          activeFeedback: exportFeedback === "HTML",
          primary: true,
        },
        {
          id: "json",
          badge: "بيانات مهيكلة",
          title: "ملف البيانات الكامل (JSON)",
          sub: "للمهندسين وأنظمة المراقبة والتحليل البرمجي",
          desc: "يحتوي على بيانات التقرير التعريفية، التشخيص التنفيذي، مصفوفة القفزات شاملة سجل آخر 60 ثانية والتفسير الآلي لكل قفزة، مع قاموس مرجعي مدمج لكافة الحقول.",
          actionLabel: exportFeedback === "JSON" ? "✓ تم حفظ ملف JSON" : "تصدير ملف JSON",
          onClick: () => onExportReport("json"),
          activeFeedback: exportFeedback === "JSON",
        },
        {
          id: "csv",
          badge: "متوافق مع Excel",
          title: "جدول البيانات التفصيلي (CSV)",
          sub: "يدعم اللغة العربية بالكامل في برنامج Microsoft Excel",
          desc: "مُرمّز بصيغة UTF-8 BOM ليفتح في برنامج Excel مباشرة بجدول مرتب يشمل ملخص الفحص، قراءات كل قفزة وتقييمها الفني، وجدول شرح المصطلحات في الأسفل.",
          actionLabel: exportFeedback === "CSV" ? "✓ تم حفظ جدول CSV" : "تصدير جدول CSV",
          onClick: () => onExportReport("csv"),
          activeFeedback: exportFeedback === "CSV",
        },
      ]
    : [
        {
          id: "copy",
          badge: "Clipboard Ready",
          title: "Copy Executive Text Summary",
          sub: "Designed for ISP support tickets, email & chat",
          desc: "Copies a structured plain-text diagnostic report including Executive Summary, Segment Isolation (Hop 1 / ISP / Target), Application Readiness, Hop Table, and Metric Guide.",
          actionLabel: copyFeedback ? "✓ Copied to Clipboard" : "Copy Summary Now",
          onClick: onCopySummary,
          activeFeedback: Boolean(copyFeedback),
        },
        {
          id: "html",
          badge: "Official Printable",
          title: "Official PDF / HTML Report",
          sub: "Branded A4/Letter report with Print-to-PDF button",
          desc: "Generates a self-contained executive document with Masar branding, 6 KPI cards, Gaming/VoIP/4K readiness ratings, inline 60s SVG sparklines, hop verdicts, and a 10-card metric glossary.",
          actionLabel:
            exportFeedback === "HTML" ? "✓ Report Saved" : "Export PDF / HTML Report",
          onClick: () => onExportReport("html"),
          activeFeedback: exportFeedback === "HTML",
          primary: true,
        },
        {
          id: "json",
          badge: "Machine Readable",
          title: "Structured JSON Telemetry",
          sub: "For network engineers, scripts & NOC pipelines",
          desc: "Exports report metadata, executive diagnostic object, annotated hop array with full 60-second RTT history arrays, and an embedded field reference dictionary.",
          actionLabel: exportFeedback === "JSON" ? "✓ JSON Saved" : "Export JSON File",
          onClick: () => onExportReport("json"),
          activeFeedback: exportFeedback === "JSON",
        },
        {
          id: "csv",
          badge: "Excel Ready",
          title: "Annotated CSV Spreadsheet",
          sub: "UTF-8 BOM encoded for Microsoft Excel & Sheets",
          desc: "Exports executive header rows, complete hop-by-hop columns with automated technical interpretations, plus a built-in metric reference guide at the bottom.",
          actionLabel: exportFeedback === "CSV" ? "✓ CSV Saved" : "Export CSV Table",
          onClick: () => onExportReport("csv"),
          activeFeedback: exportFeedback === "CSV",
        },
      ];

  const filterTabs = isAr
    ? [
        { id: "all", label: "الدليل الشامل الكامل" },
        { id: "live", label: "تحليل بياناتك الحالية" },
        { id: "exports", label: "صيغ التصدير الاحترافية" },
        { id: "dictionary", label: "شرح جميع المؤشرات (12)" },
        { id: "preview", label: "معاينة التقرير النصي" },
      ]
    : [
        { id: "all", label: "Complete Studio" },
        { id: "live", label: "Live Data Breakdown" },
        { id: "exports", label: "Export Formats" },
        { id: "dictionary", label: "All Extracted Metrics (12)" },
        { id: "preview", label: "Live Report Preview" },
      ];

  const measureTabPill = () => {
    const btn = tabBtnRefs.current?.[activeFilter];
    if (!btn) return;
    setPillStyle({
      x: btn.offsetLeft,
      y: btn.offsetTop,
      width: btn.offsetWidth,
      height: btn.offsetHeight,
      ready: true,
    });
  };

  useLayoutEffect(() => {
    measureTabPill();
    const bar = tabsBarRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measureTabPill());
    ro.observe(bar);
    return () => ro.disconnect();
  }, [activeFilter, lang, hasData]);

  const showLive = renderedFilter === "all" || renderedFilter === "live";
  const showExports = renderedFilter === "all" || renderedFilter === "exports";
  const showDict = renderedFilter === "all" || renderedFilter === "dictionary";
  const showPreview = renderedFilter === "all" || renderedFilter === "preview";

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      lang={isAr ? "ar" : "en"}
      className="relative flex flex-col flex-1 min-h-0 overflow-hidden"
    >
      {SectionAmbientBackground && <SectionAmbientBackground variant="mtr" />}

      {/* Modal Top Header */}
      <div className="relative z-10 shrink-0 px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/85">
        <div className="flex items-center gap-3">
          <div className="masar-studio-float masar-icon-interactive relative w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-500/35 flex items-center justify-center text-sky-400 shrink-0 shadow-md shadow-sky-500/10">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M8 13h8M8 17h5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-white">
              {isAr
                ? "مركز التقارير الاحترافية وشرح جميع البيانات المستخرجة"
                : "Diagnostic Report Studio & Complete Extracted Data Guide"}
            </h2>
            <p className="text-xs text-slate-400">
              {isAr
                ? "قراءة تفصيلية لنتائج فحصك الحالية، تصدير التقارير الرسمية، وشرح دقيق لكل رقم وعمود ومؤشر"
                : "Live interpretation of your trace telemetry, executive report exports, and in-depth guide to every metric"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="masar-icon-btn px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-slate-700 text-xs font-bold transition inline-flex items-center gap-1.5"
        >
          <span className="masar-icon-target">✕</span>
          <span>{isAr ? "إغلاق" : "Close"}</span>
        </button>
      </div>

      {/* Sub-Navigation Filter Bar with Sliding Indicator */}
      <div className="relative z-10 shrink-0 px-6 py-2.5 border-b border-slate-800/80 bg-slate-950/60 flex flex-wrap items-center justify-between gap-2">
        <div ref={tabsBarRef} className="relative flex flex-wrap items-center gap-1.5">
          {pillStyle.ready && (
            <span
              aria-hidden="true"
              className="masar-tab-pill-indicator bg-sky-500/20 border border-sky-500/45 shadow-sm shadow-sky-500/15"
              style={{
                width: `${pillStyle.width}px`,
                height: `${pillStyle.height}px`,
                transform: `translate3d(${pillStyle.x}px, ${pillStyle.y}px, 0)`,
              }}
            />
          )}
          {filterTabs.map((tab) => {
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabBtnRefs.current[tab.id] = el;
                }}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`masar-icon-btn relative z-10 px-3 py-1 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 border border-transparent ${
                  active
                    ? "text-sky-300"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                }`}
              >
                <span className="masar-icon-target">{STUDIO_TAB_ICONS[tab.id]}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className={`masar-sonar-ring absolute inline-flex h-full w-full rounded-full ${
                hasData ? "bg-emerald-400" : "bg-sky-400"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                hasData ? "bg-emerald-400" : "bg-sky-400/80"
              }`}
            />
          </span>
          {hasData ? (
            isAr ? (
              <>
                <span>الهدف النشط:</span>
                <bdi dir="ltr" className="font-mono text-sky-400">
                  {snapshot.target}
                </bdi>
                <span>•</span>
                <span>{hopsCountAr}</span>
              </>
            ) : (
              <>
                <span>Active Target:</span>
                <span className="font-mono text-sky-400">{snapshot.target}</span>
                <span>•</span>
                <span>{hopsCountEn}</span>
              </>
            )
          ) : isAr ? (
            "الوضع الحالي: جاهز للفحص"
          ) : (
            "Status: Standby"
          )}
        </span>
      </div>

      {/* Scrollable Studio Body */}
      <div
        ref={bodyRef}
        className="relative z-10 flex-1 min-h-0 p-6 overflow-y-auto overscroll-contain"
      >
        <div
          key={renderedFilter}
          className={`space-y-8 ${
            filterPhase === "exit"
              ? "masar-studio-content-exit"
              : "masar-studio-content-enter"
          }`}
        >
          {/* Confirmation Notice Inside Modal if User Just Exported/Copied */}
          {reportNotice && (
            <div className="masar-studio-card rounded-xl bg-emerald-950/40 border border-emerald-500/40 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-emerald-300 font-semibold">
                <StatusLottie variant="success" size={22} />
                <span>{reportNotice}</span>
              </div>
            </div>
          )}

          {showLive && (
            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-sky-400">
                  {isAr
                    ? "أولاً: القراءة التفصيلية لبيانات اتصالك المستخرجة حالياً"
                    : "1. Live Breakdown of Your Currently Extracted Telemetry"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isAr
                    ? "تحليل تلقائي يترجم أرقام الفحص الحالية إلى خلاصة عملية واضحة لكل مرحلة من مراحل اتصالك:"
                    : "Automated segment-by-segment translation of your current ICMPv4 numbers into actionable diagnostics:"}
                </p>
              </div>

              {!hasData ? (
                <div
                  className="masar-studio-card masar-lift-card masar-well relative overflow-hidden rounded-2xl border border-slate-800 p-5 flex flex-col sm:flex-row items-center justify-between gap-4"
                  style={{ animationDelay: "30ms" }}
                >
                  <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-start">
                    <div className="relative w-11 h-11 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                      <span className="masar-sonar-ring absolute inset-0 rounded-2xl border border-sky-400/50 pointer-events-none" />
                      <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12h4l3-7 4 14 3-7h4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-white">
                        {isAr
                          ? "لم يبدأ استخراج القراءات الحية بعد"
                          : "No Live Trace Telemetry Extracted Yet"}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                        {isAr
                          ? "اضغط على زر «بدء الفحص الآن» ليقوم مسار بإرسال نبضات الفحص واستخراج قراءات الراوتر المنزلي وبوابة شركة الاتصالات والوجهة النهائية وتفسيرها هنا مباشرة."
                          : "Click Start Live Trace Now so Masar can probe your local router, ISP gateway, and destination server and analyze your live numbers right here."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onStartTraceNow}
                    className="group masar-cta-sheen masar-action-btn shrink-0 whitespace-nowrap active:scale-95 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-sky-400 to-cyan-400 hover:from-sky-400 hover:via-cyan-400 hover:to-emerald-400 text-slate-950 border border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_6px_16px_-4px_rgba(14,165,233,0.38)] text-xs font-bold tracking-tight transition-all duration-300 inline-flex items-center gap-2"
                  >
                    <span className="h-4 w-4 shrink-0 rounded-md bg-slate-950/15 text-slate-950 flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-[360deg] group-hover:scale-110">
                      <svg className="w-2.5 h-2.5 fill-current shrink-0" viewBox="0 0 12 12">
                        <path d="M2.5 1.5L10.5 6L2.5 10.5V1.5Z" />
                      </svg>
                    </span>
                    <span>{isAr ? "بدء الفحص الآن" : "Start Live Trace Now"}</span>
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div
                      className="masar-studio-card masar-lift-card masar-well rounded-2xl border border-slate-800/90 p-4 space-y-2"
                      style={{ animationDelay: "30ms" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-400">
                          <span dir="ltr" className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-sky-500/15 border border-sky-500/30">
                            01
                          </span>
                          <span>{isAr ? "الراوتر المحلي" : "Local Router"}</span>
                        </span>
                        <span
                          dir="ltr"
                          className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${toneBadgeClass(
                            evaluateSingleHopFront(hop1, isAr).tone
                          )}`}
                        >
                          {hop1 && hop1.received > 0
                            ? `${hop1.lossPercent.toFixed(1)}%`
                            : isAr
                            ? "صامت"
                            : "Silent"}
                        </span>
                      </div>
                      <div dir="ltr" className="text-sm font-extrabold font-mono text-white truncate text-start">
                        {hop1?.ip || "—"}
                      </div>
                      <div className="text-xs text-slate-300 font-medium">
                        {hop1 && hop1.received > 0 ? (
                          isAr ? (
                            <>
                              المتوسط{" "}
                              <bdi dir="ltr" className="font-mono">
                                {hop1.avgMs.toFixed(1)} ms
                              </bdi>{" "}
                              • التذبذب{" "}
                              <bdi dir="ltr" className="font-mono">
                                {hop1.jitterMs.toFixed(1)} ms
                              </bdi>
                            </>
                          ) : (
                            <span className="font-mono">
                              Avg {hop1.avgMs.toFixed(1)} ms • Jitter {hop1.jitterMs.toFixed(1)} ms
                            </span>
                          )
                        ) : isAr ? (
                          "تجاهل رسائل الفحص محلياً"
                        ) : (
                          "ICMP Filtered"
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {hop1 && hop1.received > 0
                          ? hop1.lossPercent > 2 || hop1.avgMs > 15
                            ? isAr
                              ? "يوجد تأخر أو فقد بين جهازك والراوتر؛ افحص إشارة الواي فاي أو كابل الشبكة."
                              : "Elevated local Wi-Fi/LAN latency or packet loss detected at your router."
                            : isAr
                            ? "اتصالك الداخلي بالراوتر المنزلي سريع ومستقر تماماً."
                            : "Your local Wi-Fi / Ethernet link to the router is clean and fast."
                          : isAr
                          ? "الراوتر لا يرد على الفحص المباشر لكنه يمرر البيانات طبيعياً."
                          : "Router blocks direct ping replies while forwarding traffic normally."}
                      </p>
                    </div>

                    {/* Card 2: ISP Gateway */}
                    <div
                      className="masar-studio-card masar-lift-card masar-well rounded-2xl border border-slate-800/90 p-4 space-y-2"
                      style={{ animationDelay: "75ms" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-400">
                          <span dir="ltr" className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-sky-500/15 border border-sky-500/30">
                            02
                          </span>
                          <span>{isAr ? "بوابة المزود" : "ISP Gateway"}</span>
                        </span>
                        <span
                          dir="ltr"
                          className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${toneBadgeClass(
                            evaluateSingleHopFront(ispHop, isAr).tone
                          )}`}
                        >
                          {ispHop && ispHop.received > 0
                            ? `#${ispHop.hop} • ${ispHop.lossPercent.toFixed(1)}%`
                            : isAr
                            ? "عبور"
                            : "Transit"}
                        </span>
                      </div>
                      <div dir="ltr" className="text-sm font-extrabold font-mono text-white truncate text-start">
                        {ispHop?.ip || "—"}
                      </div>
                      <div className="text-xs text-slate-300 font-medium">
                        {ispHop && ispHop.received > 0 ? (
                          isAr ? (
                            <>
                              المتوسط{" "}
                              <bdi dir="ltr" className="font-mono">
                                {ispHop.avgMs.toFixed(1)} ms
                              </bdi>{" "}
                              • التذبذب{" "}
                              <bdi dir="ltr" className="font-mono">
                                {ispHop.jitterMs.toFixed(1)} ms
                              </bdi>
                            </>
                          ) : (
                            <span className="font-mono">
                              Avg {ispHop.avgMs.toFixed(1)} ms • Jitter {ispHop.jitterMs.toFixed(1)} ms
                            </span>
                          )
                        ) : (
                          "—"
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {ispHop && ispHop.received > 0
                          ? ispHop.lossPercent > 2
                            ? isAr
                              ? "تم رصد فقد حزم عند مقسم شركة الاتصالات؛ التقرير جاهز لإرساله للدعم الفني."
                              : "Packet loss observed at ISP aggregation gateway; export report for support."
                            : isAr
                            ? "بوابة مزود الخدمة تعمل بكفاءة واستقرار دون اختناق."
                            : "ISP access and aggregation gateway shows clean packet delivery."
                          : isAr
                          ? "عقد المزود تمرر الاتصال مباشرة نحو المسار الدولي."
                          : "ISP hops forward packets cleanly toward backbone peering."}
                      </p>
                    </div>

                    {/* Card 3: Target End-to-End */}
                    <div
                      className="masar-studio-card masar-lift-card masar-well rounded-2xl border border-slate-800/90 p-4 space-y-2"
                      style={{ animationDelay: "120ms" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                          <span dir="ltr" className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/30">
                            03
                          </span>
                          <span>{isAr ? "الوجهة النهائية" : "Final Target"}</span>
                        </span>
                        <span
                          dir="ltr"
                          className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${toneBadgeClass(
                            evaluateSingleHopFront(destHop, isAr).tone
                          )}`}
                        >
                          {destHop && destHop.received > 0
                            ? `${destHop.lossPercent.toFixed(1)}%`
                            : "—"}
                        </span>
                      </div>
                      <div dir="ltr" className="text-sm font-extrabold font-mono text-white truncate text-start">
                        {destHop?.ip || snapshot.target}
                      </div>
                      <div className="text-xs text-slate-300 font-medium">
                        {destHop && destHop.received > 0 ? (
                          isAr ? (
                            <>
                              المتوسط{" "}
                              <bdi dir="ltr" className="font-mono">
                                {destHop.avgMs.toFixed(1)} ms
                              </bdi>{" "}
                              (
                              <bdi dir="ltr" className="font-mono">
                                {destHop.bestMs.toFixed(1)}–{destHop.worstMs.toFixed(1)} ms
                              </bdi>
                              )
                            </>
                          ) : (
                            <span className="font-mono">
                              Avg {destHop.avgMs.toFixed(1)} ms ({destHop.bestMs.toFixed(1)}–{destHop.worstMs.toFixed(1)} ms)
                            </span>
                          )
                        ) : (
                          "—"
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {destHop && destHop.received > 0
                          ? isAr
                            ? `تم استلام ${destHop.received} من أصل ${destHop.sent} حزمة بتذبذب زمني قدره ${destHop.jitterMs.toFixed(1)} مللي ثانية.`
                            : `Received ${destHop.received} of ${destHop.sent} probes with ${destHop.jitterMs.toFixed(1)} ms jitter.`
                          : isAr
                          ? "بانتظار وصول ردود الوجهة النهائية."
                          : "Awaiting echo replies from final destination."}
                      </p>
                    </div>

                    {/* Card 4: Overall Route Structure */}
                    <div
                      className="masar-studio-card masar-lift-card masar-well rounded-2xl border border-slate-800/90 p-4 space-y-2"
                      style={{ animationDelay: "165ms" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-400">
                          <span dir="ltr" className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-sky-500/15 border border-sky-500/30">
                            04
                          </span>
                          <span>{isAr ? "بنية المسار والجودة" : "Path & Health"}</span>
                        </span>
                        <span
                          dir="ltr"
                          className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/35"
                        >
                          {health.score}%
                        </span>
                      </div>
                      <div className="text-sm font-extrabold text-white">
                        {isAr ? hopsCountAr : `${hopsCountEn} Total`}
                      </div>
                      <div className="text-xs text-slate-300">
                        {isAr
                          ? `المستجيبة: ${respondingCount} • الصامتة: ${silentCount}`
                          : `${respondingCount} Responding • ${silentCount} ICMP Silent`}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {localizedHealth?.status || ""}
                      </p>
                    </div>
                  </div>

                  {/* 3 Real-World Application Suitability Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      {
                        title: isAr
                          ? "الألعاب الإلكترونية التنافسية"
                          : "Competitive Gaming",
                        data: readiness.gaming,
                      },
                      {
                        title: isAr
                          ? "المكالمات الصوتية والاجتماعات المرئية"
                          : "VoIP & Video Conferencing",
                        data: readiness.calls,
                      },
                      {
                        title: isAr
                          ? "البث فائق الدقة (4K) والسحابة"
                          : "4K Streaming & Cloud",
                        data: readiness.streaming,
                      },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className="masar-studio-card masar-lift-card masar-well rounded-2xl border border-slate-800/90 p-4 space-y-1.5"
                        style={{ animationDelay: `${180 + idx * 45}ms` }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white">
                            {item.title}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${toneBadgeClass(
                              item.data.tone
                            )}`}
                          >
                            {item.data.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {item.data.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {showExports && (
            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-sky-400">
                  {isAr
                    ? "ثانياً: صيغ التصدير الاحترافية ومحتوى كل ملف"
                    : "2. Professional Export Formats & What Each Report Contains"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isAr
                    ? "جميع التقارير المُصدّرة تُكتب تلقائياً بلغة البرنامج الحالية وتتضمن شرحاً مدمجاً للبيانات المستخرجة:"
                    : "Every exported report automatically matches your selected UI language and embeds a complete metric reference guide:"}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {exportFormatCards.map((card, idx) => (
                  <div
                    key={card.id}
                    className={`masar-studio-card masar-lift-card masar-well masar-icon-btn relative overflow-hidden rounded-2xl border p-4 flex flex-col justify-between gap-3 ${
                      card.primary
                        ? "border-sky-500/40 bg-sky-950/20"
                        : "border-slate-800/90"
                    }`}
                    style={{ animationDelay: `${70 + idx * 50}ms` }}
                  >
                    {card.primary && (
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-sky-400/70 to-transparent opacity-80" />
                    )}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`masar-icon-target w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 ${
                              card.primary
                                ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                                : "bg-slate-900 text-sky-400 border-slate-800"
                            }`}
                          >
                            {EXPORT_FORMAT_ICONS[card.id]}
                          </span>
                          <span className="text-sm font-extrabold text-white truncate">
                            {card.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30 shrink-0">
                          {card.badge}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-emerald-400">
                        {card.sub}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {card.desc}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={!hasData}
                      onClick={card.onClick}
                      className={`group masar-cta-sheen masar-action-btn w-full py-2 px-3 rounded-xl text-xs font-extrabold tracking-tight transition-all duration-300 border flex items-center justify-center gap-2 ${
                        !hasData
                          ? "bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed opacity-65"
                          : card.activeFeedback
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : card.primary
                          ? "bg-gradient-to-r from-sky-500 via-sky-400 to-cyan-400 hover:from-sky-400 hover:via-cyan-400 hover:to-emerald-400 text-slate-950 border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_8px_20px_-4px_rgba(14,165,233,0.4)]"
                          : "bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-sky-300 border-slate-700"
                      }`}
                    >
                      {hasData && (
                        <span
                          className={`h-5 w-5 rounded-lg flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                            card.primary && !card.activeFeedback
                              ? "bg-slate-950/15 text-slate-950 group-hover:scale-110 group-hover:-translate-y-0.5"
                              : "bg-sky-500/15 text-sky-400 group-hover:scale-110 group-hover:-translate-y-0.5"
                          }`}
                        >
                          {EXPORT_FORMAT_ICONS[card.id]}
                        </span>
                      )}
                      <span>
                        {!hasData
                          ? isAr
                            ? "ابدأ الفحص أولاً لتفعيل التصدير"
                            : "Start a Trace First to Enable Export"
                          : card.actionLabel}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {showDict && (
            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-sky-400">
                  {isAr
                    ? "ثالثاً: الدليل التفصيلي الشامل لجميع البيانات والمؤشرات المستخرجة (12 مؤشراً)"
                    : "3. Complete Detailed Dictionary of All Extracted Metrics (12 Metrics)"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isAr
                    ? "مرجع متكامل يشرح معنى كل عمود ورقم يستخرجه مسار، وكيفية قراءته، والنطاقات الطبيعية والتحذيرية لكل مؤشر:"
                    : "In-depth explanation of every column and indicator extracted by Masar, alongside exact healthy, warning, and critical thresholds:"}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {metricCards.map((m, idx) => (
                  <div
                    key={m.num}
                    className="masar-studio-card masar-lift-card masar-well masar-icon-btn rounded-2xl border border-slate-800/90 p-4 flex flex-col justify-between gap-3"
                    style={{ animationDelay: `${Math.min(idx, 11) * 32}ms` }}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            dir="ltr"
                            className="masar-icon-target text-[11px] font-mono font-extrabold px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30"
                          >
                            {m.num}
                          </span>
                          <h4 className="text-sm font-bold text-white">
                            {m.title}
                          </h4>
                        </div>
                        <span
                          dir="ltr"
                          className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                        >
                          {m.code}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-slate-400 font-semibold">
                          {isAr ? "القيمة المستخرجة:" : "Extracted Value:"}
                        </span>
                        <span
                          dir={m.liveIsLtr ? "ltr" : "rtl"}
                          className={`font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded ${
                            m.liveIsLtr ? "font-mono" : ""
                          }`}
                        >
                          {m.liveVal}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {m.desc}
                      </p>
                    </div>

                    {/* Threshold Reference Strip */}
                    <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10.5px]">
                      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-2 py-1 text-emerald-300 font-medium">
                        <span className="font-bold block">
                          {isAr ? "● الطبيعي السليم" : "● Healthy"}
                        </span>
                        <span>{m.good}</span>
                      </div>
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 px-2 py-1 text-amber-300 font-medium">
                        <span className="font-bold block">
                          {isAr ? "● نطاق التحذير" : "● Warning"}
                        </span>
                        <span>{m.warn}</span>
                      </div>
                      <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-2 py-1 text-red-300 font-medium">
                        <span className="font-bold block">
                          {isAr ? "● نطاق الخلل" : "● Critical"}
                        </span>
                        <span>{m.crit}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {showPreview && (
            <section
              className="masar-studio-card space-y-3"
              style={{ animationDelay: "60ms" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-sky-400">
                    {isAr
                      ? "رابعاً: معاينة حية للتقرير النصي المستخرج"
                      : "4. Live Preview of Extracted Support Report"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isAr
                      ? "هذا نموذج حي لما يتم نسخه عند الضغط على «نسخ التقرير» لإرساله مباشرة إلى الدعم الفني:"
                      : "Exact live preview of the formatted diagnostic summary copied to your clipboard:"}
                  </p>
                </div>

                {hasData && (
                  <button
                    type="button"
                    onClick={onCopySummary}
                    className="group masar-cta-sheen masar-action-btn px-3.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/35 text-xs font-bold transition-all duration-300 inline-flex items-center gap-2"
                  >
                    <span className="h-4 w-4 rounded-md bg-sky-500/20 text-sky-300 flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110 group-hover:rotate-12">
                      {EXPORT_FORMAT_ICONS.copy}
                    </span>
                    <span>
                      {copyFeedback
                        ? isAr
                          ? "✓ تم النسخ إلى الحافظة"
                          : "✓ Copied"
                        : isAr
                        ? "نسخ هذا التقرير الآن"
                        : "Copy This Report"}
                    </span>
                  </button>
                )}
              </div>

              {hasData ? (
                <pre
                  dir={isAr ? "rtl" : "ltr"}
                  className={`masar-well rounded-2xl border border-slate-800 p-4 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-72 select-text whitespace-pre-wrap ${
                    uiTheme === "light" ? "text-slate-800" : "text-slate-300"
                  }`}
                >
                  {previewText}
                </pre>
              ) : (
                <div className="masar-well rounded-2xl border border-slate-800 p-4 text-xs text-slate-400 text-center">
                  {isAr
                    ? "ستظهر المعاينة الكاملة للتقرير المستخرج هنا فور بدء فحص المسار."
                    : "The live formatted diagnostic report preview will appear here once a trace starts."}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

