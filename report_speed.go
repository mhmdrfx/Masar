package main

import (
	"fmt"
	"html"
	"strings"
	"time"

	"masar/internal/nettools"
)

// BuildSpeedHTMLReport generates a print-ready, standalone HTML report for Speed Benchmark results.
func BuildSpeedHTMLReport(snap nettools.SpeedSnapshot, lang string) string {
	isAr := strings.HasPrefix(strings.ToLower(strings.TrimSpace(lang)), "ar")
	dir := "ltr"
	htmlLang := "en"
	textAlign := "left"
	bodyFont := `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`
	if isAr {
		dir = "rtl"
		htmlLang = "ar"
		textAlign = "right"
		bodyFont = `"IBM Plex Sans Arabic", "Segoe UI", Tahoma, Arial, sans-serif`
	}

	down := snap.FinalDownloadMbps
	if down == 0 {
		down = snap.DownloadMbps
	}
	up := snap.FinalUploadMbps
	if up == 0 {
		up = snap.UploadMbps
	}
	ping := snap.PingMs
	downPing := snap.DownloadLatencyMs
	if downPing == 0 {
		downPing = snap.LoadedPingMs
	}
	if downPing == 0 {
		downPing = ping
	}
	upPing := snap.UploadLatencyMs
	if upPing == 0 {
		upPing = snap.LoadedPingMs
	}
	if upPing == 0 {
		upPing = ping
	}
	jitter := snap.JitterMs
	isSingleMode := strings.EqualFold(strings.TrimSpace(snap.ConnectionMode), "single")
	modeLabel := "Multi-Connection (Adaptive)"
	if isSingleMode {
		modeLabel = "Single Connection (1 Stream)"
	}
	if isAr {
		if isSingleMode {
			modeLabel = "قناة واحدة (Single Stream)"
		} else {
			modeLabel = "متعدد القنوات التكيّفي (Multi-Connection)"
		}
	}
	serverLabel := snap.ServerName
	if serverLabel == "" {
		serverLabel = "Cloudflare Anycast CDN"
	}
	ispLabel := snap.ClientISP
	if ispLabel == "" {
		if isAr {
			ispLabel = "المزود التلقائي للاتصال"
		} else {
			ispLabel = "Detected ISP Network"
		}
	}

	grade := "C"
	gradeColor := "#e11d48"
	gradeBg := "#ffe4e6"
	gradeText := "محدود — مناسب للمهام الأساسية فقط وقد يتأثر عند ضغط الاستخدام"
	if !isAr {
		gradeText = "Limited — Suitable for basic browsing; heavy media or gaming may experience congestion"
	}
	if down >= 100 && up >= 25 && ping > 0 && ping <= 40 && snap.PacketLoss < 1 {
		grade = "A+"
		gradeColor = "#059669"
		gradeBg = "#d1fae5"
		if isAr {
			gradeText = "ممتاز فائق — أداء ألياف بصرية مثالي للألعاب التنافسية وبث 4K/8K المتزامن"
		} else {
			gradeText = "Excellent — Fiber-grade performance, ideal for competitive gaming and 4K/8K streaming"
		}
	} else if down >= 35 && up >= 8 && ping > 0 && ping <= 85 && snap.PacketLoss < 2 {
		grade = "A"
		gradeColor = "#0284c7"
		gradeBg = "#e0f2fe"
		if isAr {
			gradeText = "جيد جداً — اتصال سريع ومستقر يلبي كافة متطلبات العمل المنزلي والمكالمات عالية الدقة"
		} else {
			gradeText = "Very Good — Fast, reliable line meeting all home-office and HD video requirements"
		}
	} else if down >= 12 && snap.PacketLoss < 5 {
		grade = "B"
		gradeColor = "#f59e0b"
		gradeBg = "#fef3c7"
		if isAr {
			gradeText = "جيد — كافٍ للتصفح والعمل المكتبي والبث بجودة Full HD"
		} else {
			gradeText = "Fair — Suitable for browsing, remote office work, and 1080p streaming"
		}
	}

	nowFormatted := time.Now().Format("2006-01-02 15:04:05 MST")
	appVer := currentAppVersion
	if appVer == "" {
		appVer = "1.0.4"
	}

	var (
		docTitle, printBtnText, sec1Title, sec2Title, sec3Title, sec4Title string
		lblDown, lblUp, lblIdlePing, lblDownPing, lblUpPing, lblJitter     string
		lblDataUsed, lblLoss, lblMode, lblServerIsp                        string
		thEdge, thEndpoint, thLatency, thJitter, thStatus                  string
		methodologyTitle, methodologyDesc, footerCredits                   string
	)

	if isAr {
		docTitle = "مسار — التقرير الرسمي الشامل لفحص سرعة الاتصال والأداء الشبكي"
		printBtnText = "حفظ كملف PDF / طباعة التقرير"
		sec1Title = "أولاً: الملخص التنفيذي وسرعات الاتصال المعتمدة"
		sec2Title = "ثانياً: مؤشرات زمن الاستجابة وجودة الخط تحت الضغط (Loaded Latency)"
		sec3Title = "ثالثاً: مصفوفة زمن الاستجابة نحو خوادم الحوسبة السحابية (Anycast Edges)"
		sec4Title = "رابعاً: معايير ومنهجية الفحص المطبقة (مطابقة لمعايير Ookla Speedtest)"
		lblDown = "سرعة التحميل المستدامة"
		lblUp = "سرعة الرفع المستدامة"
		lblIdlePing = "زمن الاستجابة (Idle Ping)"
		lblDownPing = "الاستجابة أثناء التحميل (Download Ping)"
		lblUpPing = "الاستجابة أثناء الرفع (Upload Ping)"
		lblJitter = "تذبذب الاستجابة (Jitter)"
		lblDataUsed = "حجم البيانات المستخدمة"
		lblLoss = "فقد الحزم (Loss)"
		lblMode = "نمط الاتصال المستخدم"
		lblServerIsp = "مزود الخدمة وخادم الفحص"
		thEdge = "شبكة الخوادم الحافة"
		thEndpoint = "نقطة الاتصال"
		thLatency = "متوسط الاستجابة"
		thJitter = "أفضل استجابة"
		thStatus = "الحالة التشغيلية"
		methodologyTitle = "قياس تكيّفي متعدد القنوات وفق معايير Speedtest القياسية"
		methodologyDesc = "طُبّق الفحص وفق منهجية Ookla القياسية: اختبار أولي لتحديد سعة الخط وتهيئة القنوات (HTTP/1.1 TCP المستقلة)، ثم تقسيم مرحلة الاستقرار إلى 20 شريحة زمنية لكل من التحميل والرفع بعد استبعاد فترة الإحماء (TCP Slow-Start)، واستبعاد أبطأ 30% من الشرائح وأسرع 10% وحساب متوسط الشريحة الوسطى (60%) لضمان نتيجة ثابتة ومستقرة تماماً."
		footerCredits = fmt.Sprintf("تم استخراج هذا التقرير الرسمي عبر برنامج مسار (الإصدار %s) — تطوير @mhmdrfx • صُنع بكل إتقان", appVer)
	} else {
		docTitle = "Masar — Official Speed Benchmark & Network Capacity Report"
		printBtnText = "Save as PDF / Print Official Report"
		sec1Title = "1. Executive Summary & Certified Line Speeds"
		sec2Title = "2. Idle & Loaded Latency Breakdown (Bufferbloat)"
		sec3Title = "3. Anycast Cloud Edge Latency Matrix"
		sec4Title = "4. Benchmark Methodology & Ookla Standards"
		lblDown = "Sustained Download"
		lblUp = "Sustained Upload"
		lblIdlePing = "Idle Ping"
		lblDownPing = "Download Latency"
		lblUpPing = "Upload Latency"
		lblJitter = "Ping Jitter"
		lblDataUsed = "Total Data Transferred"
		lblLoss = "Packet Loss"
		lblMode = "Connection Mode"
		lblServerIsp = "ISP & Test Server"
		thEdge = "Edge Provider"
		thEndpoint = "Endpoint"
		thLatency = "Avg Latency"
		thJitter = "Best RTT"
		thStatus = "Operational Status"
		methodologyTitle = "Adaptive HTTP/1.1 TCP Calibration with 20-Slice Trimmed Mean"
		methodologyDesc = "This benchmark follows Ookla Speedtest standards: pre-test bandwidth calibration across independent HTTP/1.1 TCP streams, warm-up slow-start discard, and 20 equal steady-state time slices per direction where the slowest 30% and fastest 10% of slices are trimmed to compute the sustained middle-60% score."
		footerCredits = fmt.Sprintf("Generated by Masar Visual Network Diagnostics (%s) — @mhmdrfx", appVer)
	}

	emptyEdgeMsg := "Direct edge test completed successfully"
	perfRatingTitle := "Connection Performance Rating"
	peakDownTitle := "Peak Download (Max Speed)"
	peakUpTitle := "Peak Upload (Max Speed)"
	if isAr {
		emptyEdgeMsg = "تم إجراء الفحص مباشرة مع خوادم الحافة الدولية بنجاح"
		perfRatingTitle = "تقييم جودة وسعة الاتصال"
		peakDownTitle = "ذروة التحميل (أعلى سرعة)"
		peakUpTitle = "ذروة الرفع (أعلى سرعة)"
	}

	var edgeRows strings.Builder
	for _, ep := range snap.EdgePings {
		statusBg := "#dcfce7"
		statusFg := "#15803d"
		if !strings.EqualFold(ep.Status, "online") {
			statusBg = "#fee2e2"
			statusFg = "#b91c1c"
		}
		edgeRows.WriteString(fmt.Sprintf(`
			<tr>
				<td style="font-weight:700">%s</td>
				<td dir="ltr" style="font-family:monospace;color:#64748b">%s</td>
				<td dir="ltr" style="font-weight:700;color:#0284c7">%s</td>
				<td dir="ltr" style="color:#7c3aed">%s</td>
				<td><span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;background:%s;color:%s">%s</span></td>
			</tr>
		`,
			html.EscapeString(ep.Provider),
			html.EscapeString(ep.Endpoint),
			fmt.Sprintf("%.1f ms", ep.AvgMs),
			fmt.Sprintf("%.1f ms", ep.BestMs),
			statusBg,
			statusFg,
			html.EscapeString(strings.ToUpper(ep.Status)),
		))
	}
	if len(snap.EdgePings) == 0 {
		edgeRows.WriteString(fmt.Sprintf(`<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:12px">%s</td></tr>`,
			emptyEdgeMsg))
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="%s" dir="%s">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>%s</title>
<style>
  @page { size: A4 portrait; margin: 12mm 14mm 14mm 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: %s;
    background: #f8fafc;
    color: #0f172a;
    line-height: 1.5;
    padding: 24px;
    text-align: %s;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .report-container { max-width: 900px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px -2px rgba(0,0,0,0.05); }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0284c7; padding-bottom: 20px; margin-bottom: 24px; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .logo-box { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #0284c7, #10b981); display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 20px; }
  .brand-title { font-size: 20px; font-weight: 800; color: #0f172a; }
  .brand-sub { font-size: 11px; color: #64748b; font-weight: 600; }
  .print-btn { background: #0284c7; color: white; border: none; border-radius: 8px; padding: 8px 18px; font-size: 12px; font-weight: 700; cursor: pointer; transition: 0.2s; }
  .print-btn:hover { background: #0369a1; }
  .hero-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
  .hero-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; text-align: center; }
  .hero-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .hero-val { font-size: 34px; font-weight: 900; font-family: monospace; line-height: 1.1; }
  .hero-unit { font-size: 12px; font-weight: 600; color: #64748b; margin-top: 4px; }
  .verdict-box { background: %s; border: 1px solid %s; border-radius: 12px; padding: 16px 20px; display: flex; align-items: center; gap: 18px; margin-bottom: 24px; }
  .verdict-badge { width: 56px; height: 56px; border-radius: 12px; background: %s; color: white; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900; shrink: 0; }
  .sec-heading { font-size: 14px; font-weight: 800; color: #1e293b; margin: 24px 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
  .kpi-table, .edge-table { width: 100%%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
  .edge-table th, .kpi-table th { background: #f1f5f9; padding: 8px 12px; font-weight: 700; border: 1px solid #e2e8f0; text-align: inherit; }
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
          <linearGradient id="msg" x1="0%%" y1="0%%" x2="100%%" y2="100%%">
            <stop offset="0%%" stop-color="#06b6d4"/><stop offset="50%%" stop-color="#3b82f6"/><stop offset="100%%" stop-color="#10b981"/>
          </linearGradient>
          <filter id="msgShadow" x="-10%%" y="-10%%" width="120%%" height="130%%" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#0284c7" flood-opacity="0.28"/>
          </filter>
        </defs>
        <rect x="1.5" y="1.5" width="97" height="97" rx="24.5" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
        <path d="M18 72C18 42 25 24 35 24C45 24 47 52 50 52C53 52 55 24 65 24C75 24 82 42 82 72C74 72 69 58 65 40C61 52 57 69 50 69C43 69 39 52 35 40C31 58 26 72 18 72Z" fill="url(#msg)" filter="url(#msgShadow)"/>
      </svg>
      <div>
        <div class="brand-title">MASAR • مسار</div>
        <div class="brand-sub">%s • %s</div>
      </div>
    </div>
    <button class="print-btn" onclick="window.print()">%s</button>
  </div>

  <div class="verdict-box">
    <div class="verdict-badge">%s</div>
    <div>
      <div style="font-size:15px;font-weight:800;color:#0f172a">%s (%s)</div>
      <div style="font-size:12px;color:#334155;margin-top:2px">%s</div>
    </div>
  </div>

  <div class="sec-heading">%s</div>
  <div class="hero-grid">
    <div class="hero-card" style="border-top: 4px solid #0284c7">
      <div class="hero-title" style="color:#0284c7">%s</div>
      <div class="hero-val" style="color:#0284c7">%.1f</div>
      <div class="hero-unit">Mbps • ↓ %.1f ms</div>
    </div>
    <div class="hero-card" style="border-top: 4px solid #10b981">
      <div class="hero-title" style="color:#10b981">%s</div>
      <div class="hero-val" style="color:#10b981">%.1f</div>
      <div class="hero-unit">Mbps • ↑ %.1f ms</div>
    </div>
    <div class="hero-card" style="border-top: 4px solid #f59e0b">
      <div class="hero-title" style="color:#f59e0b">%s</div>
      <div class="hero-val" style="color:#f59e0b">%.1f</div>
      <div class="hero-unit">ms (Idle) • Jitter %.1f ms</div>
    </div>
  </div>

  <div class="sec-heading">%s</div>
  <table class="kpi-table">
    <tr>
      <th>%s</th>
      <td dir="ltr" style="font-weight:700;color:#0284c7">%.1f ms</td>
      <th>%s</th>
      <td dir="ltr" style="font-weight:700;color:#10b981">%.1f ms</td>
    </tr>
    <tr>
      <th>%s</th>
      <td dir="ltr" style="font-weight:700;color:#7c3aed">%.1f ms (Loss %.1f%%)</td>
      <th>%s</th>
      <td dir="ltr" style="font-weight:700">%.1f MB</td>
    </tr>
    <tr>
      <th>%s</th>
      <td dir="ltr" style="font-weight:700;color:#0284c7">%.1f Mbps</td>
      <th>%s</th>
      <td dir="ltr" style="font-weight:700;color:#10b981">%.1f Mbps</td>
    </tr>
    <tr>
      <th>%s</th>
      <td style="font-weight:700">%s</td>
      <th>%s</th>
      <td style="font-weight:600">%s → %s</td>
    </tr>
    <tr>
      <th>%s</th>
      <td dir="ltr" style="font-weight:700;color:#0284c7">%s</td>
      <th>%s</th>
      <td dir="ltr" style="font-weight:600">%s</td>
    </tr>
  </table>

  <div class="sec-heading">%s</div>
  <table class="edge-table">
    <thead>
      <tr>
        <th>%s</th>
        <th>%s</th>
        <th>%s</th>
        <th>%s</th>
        <th>%s</th>
      </tr>
    </thead>
    <tbody>
      %s
    </tbody>
  </table>

  <div class="sec-heading">%s</div>
  <div class="method-box">
    <strong>%s:</strong> %s
  </div>

  <div class="footer">
    %s • %s
  </div>
</div>
</body>
</html>`,
		htmlLang, dir,
		html.EscapeString(docTitle),
		bodyFont, textAlign,
		gradeBg, gradeColor, gradeColor,
		html.EscapeString(docTitle), nowFormatted,
		html.EscapeString(printBtnText),
		grade,
		perfRatingTitle, grade,
		html.EscapeString(gradeText),
		html.EscapeString(sec1Title),
		html.EscapeString(lblDown), down, downPing,
		html.EscapeString(lblUp), up, upPing,
		html.EscapeString(lblIdlePing), ping, jitter,
		html.EscapeString(sec2Title),
		html.EscapeString(lblDownPing), downPing,
		html.EscapeString(lblUpPing), upPing,
		html.EscapeString(lblJitter+" / "+lblLoss), jitter, snap.PacketLoss,
		html.EscapeString(lblDataUsed), snap.TotalMB,
		peakDownTitle, snap.PeakDownloadMbps,
		peakUpTitle, snap.PeakUploadMbps,
		html.EscapeString(lblMode), html.EscapeString(modeLabel),
		html.EscapeString(lblServerIsp), html.EscapeString(ispLabel), html.EscapeString(serverLabel),
		func() string {
			if isAr {
				return "تقييم اختناق المخزن المؤقت (Bufferbloat)"
			}
			return "Bufferbloat Grade"
		}(),
		func() string {
			g := snap.BufferbloatGrade
			if g == "" {
				g = nettools.ComputeBufferbloatGrade(ping, downPing, upPing)
			}
			if g == "" {
				return "—"
			}
			return fmt.Sprintf("Grade %s (↓p95: %.1f ms | ↑p95: %.1f ms)", g, snap.DownloadLatencyP95, snap.UploadLatencyP95)
		}(),
		func() string {
			if isAr {
				return "توزيع الاستجابة المئوي (p50 / p95 / p99)"
			}
			return "Latency Percentiles (p50 / p95 / p99)"
		}(),
		fmt.Sprintf("%.1f / %.1f / %.1f ms", snap.LatencyP50Ms, snap.LatencyP95Ms, snap.LatencyP99Ms),
		html.EscapeString(sec3Title),
		html.EscapeString(thEdge),
		html.EscapeString(thEndpoint),
		html.EscapeString(thLatency),
		html.EscapeString(thJitter),
		html.EscapeString(thStatus),
		edgeRows.String(),
		html.EscapeString(sec4Title),
		html.EscapeString(methodologyTitle),
		html.EscapeString(methodologyDesc),
		html.EscapeString(footerCredits), nowFormatted,
	)
}
