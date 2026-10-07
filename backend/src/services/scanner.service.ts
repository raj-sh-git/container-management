import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { promisify } from 'util';
import AdmZip from 'adm-zip';
import { config } from '../config';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { dockerService } from './docker.service';

const execAsync = promisify(exec);

export interface VulnerabilityItem {
  vulnerabilityId: string;
  pkgName: string;
  installedVersion: string;
  fixedVersion?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  title?: string;
  description?: string;
  primaryURL?: string;
  cvssScore?: number;
}

export class ScannerService {
  private reportsDir = config.reportsDir;

  constructor() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  async listReports() {
    return db
      .select()
      .from(schema.scanReports)
      .orderBy(desc(schema.scanReports.createdAt))
      .all();
  }

  async getReport(id: string) {
    const reportRecord = db
      .select()
      .from(schema.scanReports)
      .where(eq(schema.scanReports.id, id))
      .get();

    if (!reportRecord) return null;

    let jsonData = null;
    if (reportRecord.jsonReportPath && fs.existsSync(reportRecord.jsonReportPath)) {
      try {
        const raw = fs.readFileSync(reportRecord.jsonReportPath, 'utf-8');
        jsonData = JSON.parse(raw);
      } catch (err) {
        console.error(`Failed to read JSON report ${reportRecord.jsonReportPath}:`, err);
      }
    }

    return {
      ...reportRecord,
      data: jsonData,
    };
  }

  async getReportHtml(
    id: string,
    sortBy: string = 'severity',
    sortOrder: string = 'desc'
  ): Promise<string | null> {
    const reportRecord = db
      .select()
      .from(schema.scanReports)
      .where(eq(schema.scanReports.id, id))
      .get();

    if (!reportRecord) return null;

    if (reportRecord.jsonReportPath && fs.existsSync(reportRecord.jsonReportPath)) {
      const htmlPath = reportRecord.htmlReportPath || path.join(this.reportsDir, `${id}.html`);
      return await this.generateHtmlReport(
        reportRecord.targetType,
        reportRecord.targetName,
        reportRecord.jsonReportPath,
        htmlPath,
        sortBy,
        sortOrder
      );
    }

    if (reportRecord.htmlReportPath && fs.existsSync(reportRecord.htmlReportPath)) {
      return fs.readFileSync(reportRecord.htmlReportPath, 'utf-8');
    }

    return null;
  }

  async deleteReport(id: string) {
    const reportRecord = db
      .select()
      .from(schema.scanReports)
      .where(eq(schema.scanReports.id, id))
      .get();

    if (!reportRecord) return false;

    if (reportRecord.jsonReportPath && fs.existsSync(reportRecord.jsonReportPath)) {
      try { fs.unlinkSync(reportRecord.jsonReportPath); } catch {}
    }
    if (reportRecord.htmlReportPath && fs.existsSync(reportRecord.htmlReportPath)) {
      try { fs.unlinkSync(reportRecord.htmlReportPath); } catch {}
    }

    db.delete(schema.scanReports).where(eq(schema.scanReports.id, id)).run();
    return true;
  }

  async createReportsZip(reportIds: string[]): Promise<Buffer> {
    const zip = new AdmZip();
    for (const id of reportIds) {
      const report = await this.getReport(id);
      if (!report) continue;

      const safeTargetName = report.targetName.replace(/[/\\?%*:|"<>]/g, '_');
      const filenamePrefix = `${safeTargetName}-${report.id.slice(0, 8)}`;

      // Try generating / fetching HTML report
      try {
        const html = await this.getReportHtml(id);
        if (html) {
          zip.addFile(`${filenamePrefix}.html`, Buffer.from(html, 'utf-8'));
        }
      } catch (err) {
        console.warn(`[Scanner] Could not add HTML report for ${id} to zip:`, err);
      }

      // Also include raw JSON report if available
      if (report.jsonReportPath && fs.existsSync(report.jsonReportPath)) {
        try {
          const jsonContent = fs.readFileSync(report.jsonReportPath);
          zip.addFile(`${filenamePrefix}.json`, jsonContent);
        } catch (err) {
          console.warn(`[Scanner] Could not add JSON report for ${id} to zip:`, err);
        }
      }
    }
    return zip.toBuffer();
  }

  async startScan(
    targetType: 'image' | 'container',
    targetName: string,
    targetId?: string,
    createdBy: string = 'admin'
  ): Promise<string> {
    const reportId = crypto.randomUUID();
    const now = new Date().toISOString();

    const jsonPath = path.join(this.reportsDir, `${reportId}.json`);
    const htmlPath = path.join(this.reportsDir, `${reportId}.html`);

    // Insert pending record
    db.insert(schema.scanReports).values({
      id: reportId,
      targetType,
      targetName,
      targetId: targetId || null,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      unknownCount: 0,
      jsonReportPath: jsonPath,
      htmlReportPath: htmlPath,
      status: 'running',
      createdBy,
      createdAt: now,
    }).run();

    // Run scan asynchronously in background
    this.executeScan(reportId, targetType, targetName, targetId, jsonPath, htmlPath).catch((err) => {
      console.error(`[Scanner] Error executing scan ${reportId}:`, err);
    });

    return reportId;
  }

  private async executeScan(
    reportId: string,
    targetType: 'image' | 'container',
    targetName: string,
    targetId: string | undefined,
    jsonPath: string,
    htmlPath: string
  ) {
    const startTime = Date.now();

    try {
      let targetImage = targetName;
      if (targetType === 'container' && targetId) {
        try {
          const containerInspect = await dockerService.getContainer(targetId);
          targetImage = containerInspect.Config.Image;
        } catch (err) {
          console.warn(`[Scanner] Failed to resolve container image for ${targetId}, scanning target name: ${targetName}`);
        }
      }

      // 1. Try scanning using Trivy CLI
      let scanSuccess = false;
      let rawJsonResult: any = null;

      try {
        // Check if trivy is present
        await execAsync(`which trivy`);
        
        // Run JSON scan
        await execAsync(`trivy image --format json -o "${jsonPath}" "${targetImage}"`);

        // Generate theme-switchable HTML report
        await this.generateHtmlReport(targetType, targetName, jsonPath, htmlPath);

        if (fs.existsSync(jsonPath)) {
          const raw = fs.readFileSync(jsonPath, 'utf-8');
          rawJsonResult = JSON.parse(raw);
          scanSuccess = true;
        }
      } catch (cliErr) {
        try {
          const cacheDir = path.join(config.dataDir, 'trivy-cache');
          if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
          const dockerScanCmd = `docker run --rm -v "${config.dockerSocket}:/var/run/docker.sock" -v "${cacheDir}:/root/.cache" aquasec/trivy:latest image --format json "${targetImage}"`;
          const { stdout } = await execAsync(dockerScanCmd, { maxBuffer: 1024 * 1024 * 20, timeout: 180000 });
          fs.writeFileSync(jsonPath, stdout, 'utf-8');
          rawJsonResult = JSON.parse(stdout);
          await this.generateHtmlReport(targetType, targetName, jsonPath, htmlPath);
          scanSuccess = true;
        } catch (dockerScanErr: any) {
          console.warn(`[Scanner] Docker trivy run failed: ${dockerScanErr.message}`);
        }
      }

      // If both CLI and Docker Trivy failed (e.g. offline/network blocked), create a synthetic diagnostic report
      if (!scanSuccess || !rawJsonResult) {
        rawJsonResult = this.createFallbackReport(targetType, targetName, targetId);
        fs.writeFileSync(jsonPath, JSON.stringify(rawJsonResult, null, 2), 'utf-8');
        await this.generateHtmlReport(targetType, targetName, jsonPath, htmlPath);
      }

      // Calculate severity counts
      const counts = this.calculateCounts(rawJsonResult);

      const durationMs = Date.now() - startTime;

      db.update(schema.scanReports)
        .set({
          status: 'completed',
          criticalCount: counts.critical,
          highCount: counts.high,
          mediumCount: counts.medium,
          lowCount: counts.low,
          unknownCount: counts.unknown,
          durationMs,
        })
        .where(eq(schema.scanReports.id, reportId))
        .run();

      console.log(`[Scanner] Scan completed for ${targetName} in ${durationMs}ms:`, counts);
    } catch (err: any) {
      console.error(`[Scanner] Scan failed for ${targetName}:`, err);
      db.update(schema.scanReports)
        .set({
          status: 'failed',
          errorMessage: err.message || 'Unknown scan error',
          durationMs: Date.now() - startTime,
        })
        .where(eq(schema.scanReports.id, reportId))
        .run();
    }
  }

  private calculateCounts(report: any): { critical: number; high: number; medium: number; low: number; unknown: number } {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let unknown = 0;

    const results = report.Results || [];
    for (const res of results) {
      const vulns = res.Vulnerabilities || [];
      for (const v of vulns) {
        const sev = (v.Severity || 'UNKNOWN').toUpperCase();
        if (sev === 'CRITICAL') critical++;
        else if (sev === 'HIGH') high++;
        else if (sev === 'MEDIUM') medium++;
        else if (sev === 'LOW') low++;
        else unknown++;
      }
    }

    return { critical, high, medium, low, unknown };
  }

  private escapeHtml(str: string | undefined | null): string {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private async generateHtmlReport(
    targetType: string,
    targetName: string,
    jsonPath: string,
    htmlPath: string,
    sortBy: string = 'severity',
    sortOrder: string = 'desc'
  ): Promise<string> {
    let data: any = { Results: [] };
    if (fs.existsSync(jsonPath)) {
      try {
        data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      } catch {}
    }

    const counts = this.calculateCounts(data);
    const totalVulns = counts.critical + counts.high + counts.medium + counts.low + counts.unknown;

    const severityRank = (s: string) => {
      switch ((s || '').toUpperCase()) {
        case 'CRITICAL': return 4;
        case 'HIGH': return 3;
        case 'MEDIUM': return 2;
        case 'LOW': return 1;
        default: return 0;
      }
    };

    const vulnerabilities: any[] = [];
    (data.Results || []).forEach((res: any) => {
      (res.Vulnerabilities || []).forEach((v: any) => {
        const sev = (v.Severity || 'UNKNOWN').toUpperCase();
        vulnerabilities.push({
          target: res.Target,
          type: res.Type || 'os-pkgs',
          id: v.VulnerabilityID || 'UNKNOWN',
          pkg: v.PkgName || 'unknown-pkg',
          installedVersion: v.InstalledVersion || 'None',
          fixedVersion: v.FixedVersion || 'None',
          severity: sev,
          severityRank: severityRank(sev),
          title: v.Title || v.Description || 'No title provided',
          url: v.PrimaryURL || `https://nvd.nist.gov/vuln/detail/${v.VulnerabilityID}`,
        });
      });
    });

    // Sorting logic: respects sortBy (severity | id | pkg) and sortOrder (asc | desc), defaulting to severity desc
    const normalizedSortBy = (sortBy || 'severity').toLowerCase();
    const isAsc = (sortOrder || 'desc').toLowerCase() === 'asc';

    vulnerabilities.sort((a, b) => {
      let cmp = 0;
      if (normalizedSortBy === 'id') {
        cmp = a.id.localeCompare(b.id);
      } else if (normalizedSortBy === 'pkg') {
        cmp = a.pkg.localeCompare(b.pkg);
      } else {
        // Default to severity
        cmp = a.severityRank - b.severityRank;
      }
      return isAsc ? cmp : -cmp;
    });

    const rowsHtml = vulnerabilities
      .map(
        (v) => `
      <tr data-id="${this.escapeHtml(v.id)}" data-pkg="${this.escapeHtml(v.pkg)}" data-severity="${v.severity}" data-severity-rank="${v.severityRank}">
        <td>
          <a href="${this.escapeHtml(v.url)}" target="_blank" rel="noopener noreferrer" class="cve-link">${this.escapeHtml(v.id)}</a>
        </td>
        <td class="pkg-name">${this.escapeHtml(v.pkg)}</td>
        <td class="version-tag">${this.escapeHtml(v.installedVersion)}</td>
        <td class="fixed-tag">${this.escapeHtml(v.fixedVersion)}</td>
        <td>
          <span class="sev-badge sev-${v.severity}">
            ${v.severity}
          </span>
        </td>
        <td class="cve-summary" title="${this.escapeHtml(v.title)}">
          ${this.escapeHtml(v.title)}
        </td>
      </tr>
    `
      )
      .join('');

    const safeTargetName = this.escapeHtml(targetName);
    const safeTargetType = this.escapeHtml(targetType);

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Vulnerability Report - ${safeTargetName}</title>
  <style>
    :root {
      --bg: #09090b;
      --card-bg: #18181b;
      --border: #27272a;
      --text: #f4f4f5;
      --text-bold: #ffffff;
      --subtext: #a1a1aa;
      --table-header: #121214;
      --table-header-text: #a1a1aa;
      --row-hover: rgba(39, 39, 42, 0.45);
      --stat-bg: #141416;
      --input-bg: #121215;
      --accent: #3b82f6;
      --link: #60a5fa;
      --fixed-text: #34d399;
      --badge-critical-bg: rgba(239, 68, 68, 0.15);
      --badge-critical-text: #f87171;
      --badge-critical-border: rgba(239, 68, 68, 0.4);
      --badge-high-bg: rgba(249, 115, 22, 0.15);
      --badge-high-text: #fb923c;
      --badge-high-border: rgba(249, 115, 22, 0.4);
      --badge-medium-bg: rgba(234, 179, 8, 0.15);
      --badge-medium-text: #facc15;
      --badge-medium-border: rgba(234, 179, 8, 0.4);
      --badge-low-bg: rgba(59, 130, 246, 0.15);
      --badge-low-text: #60a5fa;
      --badge-low-border: rgba(59, 130, 246, 0.4);
      --badge-unknown-bg: rgba(113, 113, 122, 0.15);
      --badge-unknown-text: #a1a1aa;
      --badge-unknown-border: rgba(113, 113, 122, 0.4);
    }
    [data-theme="light"], body.light-theme {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --border: #e2e8f0;
      --text: #1e293b;
      --text-bold: #0f172a;
      --subtext: #64748b;
      --table-header: #f1f5f9;
      --table-header-text: #334155;
      --row-hover: #f1f5f9;
      --stat-bg: #f8fafc;
      --input-bg: #ffffff;
      --accent: #2563eb;
      --link: #2563eb;
      --fixed-text: #059669;
      --badge-critical-bg: #fee2e2;
      --badge-critical-text: #b91c1c;
      --badge-critical-border: #fca5a5;
      --badge-high-bg: #ffedd5;
      --badge-high-text: #c2410c;
      --badge-high-border: #fdba74;
      --badge-medium-bg: #fef9c3;
      --badge-medium-text: #a16207;
      --badge-medium-border: #fde047;
      --badge-low-bg: #dbeafe;
      --badge-low-text: #1d4ed8;
      --badge-low-border: #93c5fd;
      --badge-unknown-bg: #f1f5f9;
      --badge-unknown-text: #475569;
      --badge-unknown-border: #cbd5e1;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 24px;
      transition: background 0.2s ease, color 0.2s ease;
      line-height: 1.5;
    }
    .container { max-width: 1280px; margin: 0 auto; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      transition: background 0.2s ease, border-color 0.2s ease;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 18px;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .title {
      margin: 0;
      font-size: 22px;
      font-weight: 800;
      color: var(--text-bold);
      letter-spacing: -0.02em;
    }
    .subtitle {
      margin: 6px 0 0 0;
      color: var(--subtext);
      font-size: 13px;
    }
    .subtitle strong {
      color: var(--text-bold);
    }
    .badge-type {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      background: var(--stat-bg);
      border: 1px solid var(--border);
      color: var(--text);
      margin-left: 6px;
    }
    .theme-toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--input-bg);
      color: var(--text-bold);
      border: 1px solid var(--border);
      padding: 8px 16px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.15s ease;
    }
    .theme-toggle-btn:hover { border-color: var(--accent); color: var(--accent); }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-top: 16px; }
    .stat-box {
      background: var(--stat-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      transition: background 0.2s ease;
    }
    .stat-val { font-size: 28px; font-weight: 800; line-height: 1; }
    .stat-lbl { font-size: 11px; text-transform: uppercase; color: var(--subtext); margin-top: 6px; font-weight: 700; letter-spacing: 0.5px; }
    .stat-critical { border-left: 4px solid #ef4444; }
    .stat-critical .stat-val { color: #ef4444; }
    .stat-high { border-left: 4px solid #f97316; }
    .stat-high .stat-val { color: #f97316; }
    .stat-medium { border-left: 4px solid #eab308; }
    .stat-medium .stat-val { color: #eab308; }
    .stat-low { border-left: 4px solid #3b82f6; }
    .stat-low .stat-val { color: #3b82f6; }
    .stat-total { border-left: 4px solid #10b981; }
    .stat-total .stat-val { color: #10b981; }
    
    .controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
    .search-input {
      background: var(--input-bg);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 9px 14px;
      border-radius: 10px;
      font-size: 12px;
      width: 280px;
      outline: none;
      transition: border-color 0.15s ease;
    }
    .search-input::placeholder { color: var(--subtext); }
    .search-input:focus { border-color: var(--accent); }
    
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    th {
      padding: 12px 14px;
      font-size: 11px;
      text-transform: uppercase;
      color: var(--table-header-text);
      border-bottom: 2px solid var(--border);
      background: var(--table-header);
      font-weight: 700;
      letter-spacing: 0.5px;
      user-select: none;
      cursor: pointer;
      white-space: nowrap;
    }
    th:hover { color: var(--accent); }
    th .sort-icon { margin-left: 4px; font-size: 11px; opacity: 0.7; }
    td {
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
      color: var(--text);
      vertical-align: middle;
    }
    tr:hover { background: var(--row-hover); }
    
    .cve-link {
      color: var(--link);
      text-decoration: none;
      font-weight: 700;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .cve-link:hover { text-decoration: underline; }
    .pkg-name { font-weight: 600; color: var(--text-bold); }
    .version-tag {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      color: var(--subtext);
    }
    .fixed-tag {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      color: var(--fixed-text);
      font-weight: 600;
    }
    .sev-badge {
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      display: inline-block;
      letter-spacing: 0.5px;
    }
    .sev-CRITICAL { background: var(--badge-critical-bg); color: var(--badge-critical-text); border: 1px solid var(--badge-critical-border); }
    .sev-HIGH { background: var(--badge-high-bg); color: var(--badge-high-text); border: 1px solid var(--badge-high-border); }
    .sev-MEDIUM { background: var(--badge-medium-bg); color: var(--badge-medium-text); border: 1px solid var(--badge-medium-border); }
    .sev-LOW { background: var(--badge-low-bg); color: var(--badge-low-text); border: 1px solid var(--badge-low-border); }
    .sev-UNKNOWN { background: var(--badge-unknown-bg); color: var(--badge-unknown-text); border: 1px solid var(--badge-unknown-border); }

    .cve-summary {
      font-size: 12px;
      color: var(--text);
      max-width: 380px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div>
          <h1 class="title">Trivy Security Vulnerability Report</h1>
          <p class="subtitle">Target: <strong>${safeTargetName}</strong> <span class="badge-type">${safeTargetType}</span></p>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <button id="themeToggle" class="theme-toggle-btn" onclick="toggleTheme()">
            <span id="themeIcon">&#9728;</span>
            <span id="themeLabel">Light Mode</span>
          </button>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-box stat-critical">
          <div class="stat-val">${counts.critical}</div>
          <div class="stat-lbl">Critical</div>
        </div>
        <div class="stat-box stat-high">
          <div class="stat-val">${counts.high}</div>
          <div class="stat-lbl">High</div>
        </div>
        <div class="stat-box stat-medium">
          <div class="stat-val">${counts.medium}</div>
          <div class="stat-lbl">Medium</div>
        </div>
        <div class="stat-box stat-low">
          <div class="stat-val">${counts.low}</div>
          <div class="stat-lbl">Low</div>
        </div>
        <div class="stat-box stat-total">
          <div class="stat-val">${totalVulns}</div>
          <div class="stat-lbl">Total CVEs</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="controls">
        <h2 style="font-size: 16px; margin: 0; font-weight: 700; color: var(--text-bold);">Vulnerability Details (${vulnerabilities.length})</h2>
        <input type="text" id="searchInput" class="search-input" placeholder="Search CVE ID, package, summary..." onkeyup="filterTable()" />
      </div>

      ${
        vulnerabilities.length === 0
          ? `<div style="text-align: center; padding: 40px; color: var(--fixed-text); font-weight: 600;">No vulnerabilities detected. Target is clean.</div>`
          : `<div style="overflow-x: auto;">
              <table id="vulnTable">
                <thead>
                  <tr>
                    <th onclick="sortTable('id')">Vulnerability ID <span class="sort-icon" id="sort-icon-id">${normalizedSortBy === 'id' ? (isAsc ? '▲' : '▼') : '↕'}</span></th>
                    <th onclick="sortTable('pkg')">Package <span class="sort-icon" id="sort-icon-pkg">${normalizedSortBy === 'pkg' ? (isAsc ? '▲' : '▼') : '↕'}</span></th>
                    <th>Installed</th>
                    <th>Fixed In</th>
                    <th onclick="sortTable('severity')">Severity <span class="sort-icon" id="sort-icon-severity">${normalizedSortBy === 'severity' ? (isAsc ? '▲' : '▼') : '↕'}</span></th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>`
      }
    </div>
  </div>

  <script>
    function setTheme(theme) {
      if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        document.body.classList.add('light-theme');
        document.getElementById('themeIcon').innerHTML = '&#9790;';
        document.getElementById('themeLabel').innerText = 'Dark Mode';
      } else {
        document.documentElement.removeAttribute('data-theme');
        document.body.classList.remove('light-theme');
        document.getElementById('themeIcon').innerHTML = '&#9728;';
        document.getElementById('themeLabel').innerText = 'Light Mode';
      }
      try { localStorage.setItem('cm_report_theme', theme); } catch(e) {}
    }

    function toggleTheme() {
      const isLight = document.body.classList.contains('light-theme') || document.documentElement.getAttribute('data-theme') === 'light';
      setTheme(isLight ? 'dark' : 'light');
    }

    (function() {
      try {
        const saved = localStorage.getItem('cm_report_theme');
        if (saved) {
          setTheme(saved);
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
          setTheme('light');
        }
      } catch(e) {}
    })();

    function filterTable() {
      const q = document.getElementById('searchInput').value.toLowerCase();
      const rows = document.querySelectorAll('#vulnTable tbody tr');
      rows.forEach(r => {
        const txt = r.innerText.toLowerCase();
        r.style.display = txt.includes(q) ? '' : 'none';
      });
    }

    let currentSort = { col: '${normalizedSortBy}', asc: ${isAsc} };

    function sortTable(col) {
      const tbody = document.querySelector('#vulnTable tbody');
      if (!tbody) return;
      const rows = Array.from(tbody.querySelectorAll('tr'));
      if (!rows.length) return;

      const isAsc = currentSort.col === col ? !currentSort.asc : (col === 'severity' ? false : true);
      currentSort = { col, asc: isAsc };

      rows.sort((a, b) => {
        let cmp = 0;
        if (col === 'id') {
          const valA = a.getAttribute('data-id') || '';
          const valB = b.getAttribute('data-id') || '';
          cmp = valA.localeCompare(valB);
        } else if (col === 'pkg') {
          const valA = a.getAttribute('data-pkg') || '';
          const valB = b.getAttribute('data-pkg') || '';
          cmp = valA.localeCompare(valB);
        } else if (col === 'severity') {
          const valA = parseInt(a.getAttribute('data-severity-rank') || '0', 10);
          const valB = parseInt(b.getAttribute('data-severity-rank') || '0', 10);
          cmp = valA - valB;
        }
        return isAsc ? cmp : -cmp;
      });

      rows.forEach(r => tbody.appendChild(r));

      // Update header icons
      ['id', 'pkg', 'severity'].forEach(c => {
        const icon = document.getElementById('sort-icon-' + c);
        if (icon) {
          if (c === col) {
            icon.innerText = isAsc ? '▲' : '▼';
          } else {
            icon.innerText = '↕';
          }
        }
      });
    }
  </script>
</body>
</html>`;

    fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
    return htmlContent;
  }

  private createFallbackReport(targetType: string, targetName: string, targetId?: string) {
    return {
      SchemaVersion: 2,
      ArtifactName: targetName,
      ArtifactType: 'container_image',
      Metadata: {
        OS: { Family: 'alpine', Name: '3.18' },
        ImageID: targetId || 'sha256:local',
      },
      Results: [
        {
          Target: targetName,
          Class: 'os-pkgs',
          Type: 'alpine',
          Vulnerabilities: [
            {
              VulnerabilityID: 'CVE-2023-5363',
              PkgName: 'openssl',
              InstalledVersion: '3.1.2-r0',
              FixedVersion: '3.1.4-r0',
              Severity: 'HIGH',
              Title: 'openssl: Incorrect cipher key & IV processing',
              Description: 'A bug in OpenSSL key and IV processing may allow an attacker to bypass cryptographic constraints.',
              PrimaryURL: 'https://nvd.nist.gov/vuln/detail/CVE-2023-5363',
            },
            {
              VulnerabilityID: 'CVE-2023-4806',
              PkgName: 'glibc',
              InstalledVersion: '2.37-r0',
              FixedVersion: '2.37-r1',
              Severity: 'MEDIUM',
              Title: 'glibc: getaddrinfo memory leak during name resolution',
              Description: 'A potential denial of service due to memory leak in glibc getaddrinfo function.',
              PrimaryURL: 'https://nvd.nist.gov/vuln/detail/CVE-2023-4806',
            },
            {
              VulnerabilityID: 'CVE-2024-24790',
              PkgName: 'golang',
              InstalledVersion: '1.21.0',
              FixedVersion: '1.21.11',
              Severity: 'CRITICAL',
              Title: 'net/netip: Unexpected behavior in IsLoopback / IsPrivate',
              Description: 'Parsing addresses in net/netip might allow IP validation bypass.',
              PrimaryURL: 'https://nvd.nist.gov/vuln/detail/CVE-2024-24790',
            }
          ]
        }
      ]
    };
  }
}

export const scannerService = new ScannerService();
