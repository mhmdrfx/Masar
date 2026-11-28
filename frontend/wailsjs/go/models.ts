export namespace main {
	
	export class UpdateInfo {
	    available: boolean;
	    currentVersion: string;
	    latestVersion: string;
	    releaseName: string;
	    releaseNotes: string;
	    releaseUrl: string;
	    publishedAt: string;
	    downloadUrl: string;
	    checksumUrl: string;
	    sizeBytes: number;
	    checkedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.available = source["available"];
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.releaseName = source["releaseName"];
	        this.releaseNotes = source["releaseNotes"];
	        this.releaseUrl = source["releaseUrl"];
	        this.publishedAt = source["publishedAt"];
	        this.downloadUrl = source["downloadUrl"];
	        this.checksumUrl = source["checksumUrl"];
	        this.sizeBytes = source["sizeBytes"];
	        this.checkedAt = source["checkedAt"];
	    }
	}

}

export namespace mtr {
	
	export class HealthReport {
	    score: number;
	    severity: string;
	    status: string;
	    detail: string;
	    culpritHop: number;
	
	    static createFrom(source: any = {}) {
	        return new HealthReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.score = source["score"];
	        this.severity = source["severity"];
	        this.status = source["status"];
	        this.detail = source["detail"];
	        this.culpritHop = source["culpritHop"];
	    }
	}
	export class HopStat {
	    hop: number;
	    ip: string;
	    altIps?: string[];
	    routeChanges?: number;
	    hostname: string;
	    location: string;
	    asn: string;
	    sent: number;
	    received: number;
	    lossPercent: number;
	    lastMs: number;
	    avgMs: number;
	    bestMs: number;
	    worstMs: number;
	    jitterMs: number;
	    mos?: number;
	    history: number[];
	    reachedDest: boolean;
	
	    static createFrom(source: any = {}) {
	        return new HopStat(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hop = source["hop"];
	        this.ip = source["ip"];
	        this.altIps = source["altIps"];
	        this.routeChanges = source["routeChanges"];
	        this.hostname = source["hostname"];
	        this.location = source["location"];
	        this.asn = source["asn"];
	        this.sent = source["sent"];
	        this.received = source["received"];
	        this.lossPercent = source["lossPercent"];
	        this.lastMs = source["lastMs"];
	        this.avgMs = source["avgMs"];
	        this.bestMs = source["bestMs"];
	        this.worstMs = source["worstMs"];
	        this.jitterMs = source["jitterMs"];
	        this.mos = source["mos"];
	        this.history = source["history"];
	        this.reachedDest = source["reachedDest"];
	    }
	}
	export class TraceSnapshot {
	    running: boolean;
	    target: string;
	    resolvedIp: string;
	    protocol?: string;
	    ipVersion?: number;
	    mosScore?: number;
	    mosGrade?: string;
	    updatedAt: string;
	    hops: HopStat[];
	    health: HealthReport;
	
	    static createFrom(source: any = {}) {
	        return new TraceSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.running = source["running"];
	        this.target = source["target"];
	        this.resolvedIp = source["resolvedIp"];
	        this.protocol = source["protocol"];
	        this.ipVersion = source["ipVersion"];
	        this.mosScore = source["mosScore"];
	        this.mosGrade = source["mosGrade"];
	        this.updatedAt = source["updatedAt"];
	        this.hops = this.convertValues(source["hops"], HopStat);
	        this.health = this.convertValues(source["health"], HealthReport);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace nettools {
	
	export class DNSRecordItem {
	    type: string;
	    value: string;
	    ttl?: number;
	    latencyMs?: number;
	    dnssec?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DNSRecordItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.value = source["value"];
	        this.ttl = source["ttl"];
	        this.latencyMs = source["latencyMs"];
	        this.dnssec = source["dnssec"];
	    }
	}
	export class DNSReport {
	    target: string;
	    resolver?: string;
	    useDoH?: boolean;
	    dnssecValidated?: boolean;
	    queryTimeMs: number;
	    records: DNSRecordItem[];
	    checkedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new DNSReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.target = source["target"];
	        this.resolver = source["resolver"];
	        this.useDoH = source["useDoH"];
	        this.dnssecValidated = source["dnssecValidated"];
	        this.queryTimeMs = source["queryTimeMs"];
	        this.records = this.convertValues(source["records"], DNSRecordItem);
	        this.checkedAt = source["checkedAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EdgePingItem {
	    provider: string;
	    endpoint: string;
	    latencyMs: number;
	    avgMs: number;
	    bestMs: number;
	    history: number[];
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new EdgePingItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.provider = source["provider"];
	        this.endpoint = source["endpoint"];
	        this.latencyMs = source["latencyMs"];
	        this.avgMs = source["avgMs"];
	        this.bestMs = source["bestMs"];
	        this.history = source["history"];
	        this.status = source["status"];
	    }
	}
	export class PortResult {
	    port: number;
	    service: string;
	    state: string;
	    latencyMs: number;
	
	    static createFrom(source: any = {}) {
	        return new PortResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.port = source["port"];
	        this.service = source["service"];
	        this.state = source["state"];
	        this.latencyMs = source["latencyMs"];
	    }
	}
	export class PortScanReport {
	    host: string;
	    resolvedIp: string;
	    openCount: number;
	    totalPorts: number;
	    durationMs: number;
	    results: PortResult[];
	
	    static createFrom(source: any = {}) {
	        return new PortScanReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.resolvedIp = source["resolvedIp"];
	        this.openCount = source["openCount"];
	        this.totalPorts = source["totalPorts"];
	        this.durationMs = source["durationMs"];
	        this.results = this.convertValues(source["results"], PortResult);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SpeedMeta {
	    clientIp: string;
	    clientIsp: string;
	    clientLocation: string;
	    serverName: string;
	    serverLocation: string;
	
	    static createFrom(source: any = {}) {
	        return new SpeedMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.clientIp = source["clientIp"];
	        this.clientIsp = source["clientIsp"];
	        this.clientLocation = source["clientLocation"];
	        this.serverName = source["serverName"];
	        this.serverLocation = source["serverLocation"];
	    }
	}
	export class SpeedSnapshot {
	    seq: number;
	    running: boolean;
	    completed: boolean;
	    progress: number;
	    phase: string;
	    error?: string;
	    connectionMode: string;
	    activeStreams: number;
	    downloadMbps: number;
	    peakDownloadMbps: number;
	    finalDownloadMbps: number;
	    uploadMbps: number;
	    peakUploadMbps: number;
	    finalUploadMbps: number;
	    pingMs: number;
	    bestPingMs: number;
	    maxPingMs: number;
	    latencyP50Ms?: number;
	    latencyP95Ms?: number;
	    latencyP99Ms?: number;
	    loadedPingMs: number;
	    downloadLatencyMs: number;
	    downloadLatencyP95?: number;
	    uploadLatencyMs: number;
	    uploadLatencyP95?: number;
	    bufferbloatGrade?: string;
	    jitterMs: number;
	    packetLoss: number;
	    totalMB: number;
	    clientIp: string;
	    clientIsp: string;
	    clientLocation: string;
	    serverName: string;
	    serverLocation: string;
	    downloadHistory: number[];
	    uploadHistory: number[];
	    pingHistory: number[];
	    edgePings: EdgePingItem[];
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new SpeedSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.seq = source["seq"];
	        this.running = source["running"];
	        this.completed = source["completed"];
	        this.progress = source["progress"];
	        this.phase = source["phase"];
	        this.error = source["error"];
	        this.connectionMode = source["connectionMode"];
	        this.activeStreams = source["activeStreams"];
	        this.downloadMbps = source["downloadMbps"];
	        this.peakDownloadMbps = source["peakDownloadMbps"];
	        this.finalDownloadMbps = source["finalDownloadMbps"];
	        this.uploadMbps = source["uploadMbps"];
	        this.peakUploadMbps = source["peakUploadMbps"];
	        this.finalUploadMbps = source["finalUploadMbps"];
	        this.pingMs = source["pingMs"];
	        this.bestPingMs = source["bestPingMs"];
	        this.maxPingMs = source["maxPingMs"];
	        this.latencyP50Ms = source["latencyP50Ms"];
	        this.latencyP95Ms = source["latencyP95Ms"];
	        this.latencyP99Ms = source["latencyP99Ms"];
	        this.loadedPingMs = source["loadedPingMs"];
	        this.downloadLatencyMs = source["downloadLatencyMs"];
	        this.downloadLatencyP95 = source["downloadLatencyP95"];
	        this.uploadLatencyMs = source["uploadLatencyMs"];
	        this.uploadLatencyP95 = source["uploadLatencyP95"];
	        this.bufferbloatGrade = source["bufferbloatGrade"];
	        this.jitterMs = source["jitterMs"];
	        this.packetLoss = source["packetLoss"];
	        this.totalMB = source["totalMB"];
	        this.clientIp = source["clientIp"];
	        this.clientIsp = source["clientIsp"];
	        this.clientLocation = source["clientLocation"];
	        this.serverName = source["serverName"];
	        this.serverLocation = source["serverLocation"];
	        this.downloadHistory = source["downloadHistory"];
	        this.uploadHistory = source["uploadHistory"];
	        this.pingHistory = source["pingHistory"];
	        this.edgePings = this.convertValues(source["edgePings"], EdgePingItem);
	        this.updatedAt = source["updatedAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TLSCertReport {
	    host: string;
	    port: number;
	    protocolVersion: string;
	    cipherSuite: string;
	    handshakeMs: number;
	    subject: string;
	    issuer: string;
	    sans: string[];
	    notBefore: string;
	    notAfter: string;
	    daysRemaining: number;
	    verified: boolean;
	    verifyError?: string;
	    chainSubjects: string[];
	    checkedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new TLSCertReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.port = source["port"];
	        this.protocolVersion = source["protocolVersion"];
	        this.cipherSuite = source["cipherSuite"];
	        this.handshakeMs = source["handshakeMs"];
	        this.subject = source["subject"];
	        this.issuer = source["issuer"];
	        this.sans = source["sans"];
	        this.notBefore = source["notBefore"];
	        this.notAfter = source["notAfter"];
	        this.daysRemaining = source["daysRemaining"];
	        this.verified = source["verified"];
	        this.verifyError = source["verifyError"];
	        this.chainSubjects = source["chainSubjects"];
	        this.checkedAt = source["checkedAt"];
	    }
	}

}

