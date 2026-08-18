import jsPDF from 'jspdf';
import { SystemLog, ExecutionRecord, SystemStatus, SystemSnapshot, WorkerNodeData, Job } from '../shared/types.js';
import { getWorkerDisplayName } from '../shared/workerUtils.js';

export function downloadJsonFile(filename: string, data: unknown) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Draws the official Rayva Cloud logo mark and header bar on jsPDF documents.
 * Sets document properties so when opened in a browser tab, the tab title shows
 * "Rayva Cloud — Cloud Infrastructure Platform".
 */
function drawRayvaPdfHeader(doc: jsPDF, titleText: string, subtitleText: string) {
  // Set document metadata title so browser tabs render official branding
  doc.setProperties({
    title: `Rayva Cloud — ${titleText}`,
    subject: 'Rayva Cloud Infrastructure Operational Audit Report',
    author: 'Rayva Cloud Platform',
    creator: 'Rayva Cloud Platform',
  });

  // Top Header Background Bar
  doc.setFillColor(18, 20, 26);
  doc.rect(0, 0, 210, 30, 'F');

  // Accent Bottom Line
  doc.setFillColor(56, 189, 248);
  doc.rect(0, 29.2, 210, 0.8, 'F');

  // Draw Rayva Cloud Logo Box at x=12, y=6
  const lx = 12;
  const ly = 6;

  // Outer Icon Box Background
  doc.setFillColor(10, 11, 14);
  doc.roundedRect(lx, ly, 18, 18, 2, 2, 'F');
  doc.setDrawColor(56, 189, 248);
  doc.setLineWidth(0.6);
  doc.roundedRect(lx, ly, 18, 18, 2, 2, 'S');

  // Cloud Outline Arc (Cyan)
  doc.setDrawColor(56, 189, 248);
  doc.setLineWidth(0.7);

  // Cloud Base
  doc.line(lx + 4, ly + 13.5, lx + 14, ly + 13.5);

  // Cloud Arcs
  doc.circle(lx + 5.5, ly + 11, 2.2, 'S');
  doc.circle(lx + 9, ly + 8, 3, 'S');
  doc.circle(lx + 12.5, ly + 11, 2.2, 'S');

  // Mask overlap
  doc.setFillColor(10, 11, 14);
  doc.circle(lx + 9, ly + 10.5, 2.4, 'F');

  // Interconnected Nodes
  doc.setFillColor(56, 189, 248);
  doc.circle(lx + 6, ly + 11.5, 1, 'F');
  doc.circle(lx + 9, ly + 8.5, 1.2, 'F');
  doc.circle(lx + 12, ly + 11.5, 1, 'F');

  // Connection Lines
  doc.setLineWidth(0.4);
  doc.line(lx + 6, ly + 11.5, lx + 9, ly + 8.5);
  doc.line(lx + 9, ly + 8.5, lx + 12, ly + 11.5);
  doc.line(lx + 6, ly + 11.5, lx + 12, ly + 11.5);

  // Brand Name
  doc.setTextColor(56, 189, 248);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('RAYVA CLOUD', 35, 14.5);

  // Report Title
  doc.setTextColor(226, 232, 240);
  doc.setFontSize(9.5);
  const truncatedTitle = titleText.length > 36 ? titleText.substring(0, 34) + '...' : titleText;
  doc.text(`—  ${truncatedTitle.toUpperCase()}`, 74, 14.5);

  // Subtitle Metadata Line
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(subtitleText, 35, 22);
}

/**
 * Draws the official Rayva Cloud document footer across all pages in a jsPDF document,
 * including page numbering and developer attribution.
 */
function drawRayvaPdfFooter(doc: jsPDF) {
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);

    // Subtle divider line at footer top
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(12, 284, 198, 284);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);

    // Left: Page numbering & platform tag
    doc.text(`Rayva Cloud Operational Audit Report • Page ${pageNum} of ${totalPages}`, 12, 289);

    // Right: Developer credit
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Developed by Abdul Rehman Yasir', 198, 289, { align: 'right' });
  }
}

export function exportLogsToJson(
  logs: SystemLog[],
  filterInfo?: { level: string; search: string }
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `rayva_system_logs_${timestamp}.json`;

  const payload = {
    system: 'Rayva Cloud',
    exportType: 'System Audit Logs',
    exportedAt: new Date().toISOString(),
    totalCount: logs.length,
    activeFilter: filterInfo || { level: 'ALL', search: '' },
    logs,
  };

  downloadJsonFile(filename, payload);
}

export function exportLogsToPdf(
  logs: SystemLog[],
  filterInfo?: { level: string; search: string }
) {
  const doc = new jsPDF();
  const timestamp = new Date().toLocaleString();

  drawRayvaPdfHeader(
    doc,
    'Audit Logs Report',
    `Exported: ${timestamp} | Filter: ${filterInfo?.level || 'ALL'} | Search: "${filterInfo?.search || ''}" | Count: ${logs.length}`
  );

  let y = 38;

  // Table header
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 182, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('TIMESTAMP', 16, y + 5.5);
  doc.text('LEVEL', 50, y + 5.5);
  doc.text('COMPONENT', 75, y + 5.5);
  doc.text('EVENT MESSAGE', 110, y + 5.5);

  y += 11;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  const pageHeight = 280;

  logs.slice(0, 100).forEach((log) => {
    if (y > pageHeight) {
      doc.addPage();
      drawRayvaPdfHeader(
        doc,
        'Audit Logs Report (Cont.)',
        `Exported: ${timestamp} | Filter: ${filterInfo?.level || 'ALL'}`
      );
      y = 38;
      // Header for sub-pages
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text('TIMESTAMP', 16, y + 5.5);
      doc.text('LEVEL', 50, y + 5.5);
      doc.text('COMPONENT', 75, y + 5.5);
      doc.text('EVENT MESSAGE', 110, y + 5.5);
      y += 11;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }

    const timeStr = new Date(log.timestamp).toLocaleTimeString();

    doc.setTextColor(100, 116, 139);
    doc.text(timeStr, 16, y);

    if (log.level === 'ERROR') doc.setTextColor(225, 29, 72);
    else if (log.level === 'WARNING') doc.setTextColor(217, 119, 6);
    else doc.setTextColor(2, 132, 199);

    doc.setFont('helvetica', 'bold');
    doc.text(log.level, 50, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(log.component.substring(0, 16), 75, y);

    const truncatedMsg = log.message.length > 52 ? log.message.substring(0, 50) + '...' : log.message;
    doc.text(truncatedMsg, 110, y);

    y += 6;
  });

  if (logs.length > 100) {
    y += 4;
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(148, 163, 184);
    doc.text(`* Truncated to first 100 log entries out of ${logs.length} total. Export JSON for full dataset.`, 14, y);
  }

  const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  drawRayvaPdfFooter(doc);
  doc.save(`rayva_system_logs_${fileTimestamp}.pdf`);
}

export function exportLedgerToJson(
  records: ExecutionRecord[],
  verificationStatus?: { valid: boolean; recordCount: number; errors: string[] } | null
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `rayva_execution_ledger_${timestamp}.json`;

  const payload = {
    system: 'Rayva Cloud',
    exportType: 'Verifiable Execution Ledger Audit Chain',
    exportedAt: new Date().toISOString(),
    totalRecordsCount: records.length,
    verificationStatus: verificationStatus || null,
    records,
  };

  downloadJsonFile(filename, payload);
}

export function exportLedgerToPdf(
  records: ExecutionRecord[],
  verificationStatus?: { valid: boolean; recordCount: number; errors: string[] } | null
) {
  const doc = new jsPDF();
  const timestamp = new Date().toLocaleString();

  const statusText = verificationStatus?.valid ? 'VERIFIED VALID [100% Hash Match]' : 'AUDITED';

  drawRayvaPdfHeader(
    doc,
    'Execution Ledger Audit',
    `Exported: ${timestamp} | Chain Status: ${statusText} | Records: ${records.length}`
  );

  let y = 38;

  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 182, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('REC ID', 16, y + 5.5);
  doc.text('JOB ID', 38, y + 5.5);
  doc.text('WORKER', 68, y + 5.5);
  doc.text('TIMESTAMP', 102, y + 5.5);
  doc.text('RECORD HASH (SHA-256)', 138, y + 5.5);

  y += 11;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  const pageHeight = 280;

  records.forEach((r) => {
    if (y > pageHeight) {
      doc.addPage();
      drawRayvaPdfHeader(
        doc,
        'Execution Ledger Audit (Cont.)',
        `Exported: ${timestamp} | Chain Status: ${statusText}`
      );
      y = 38;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text('REC ID', 16, y + 5.5);
      doc.text('JOB ID', 38, y + 5.5);
      doc.text('WORKER', 68, y + 5.5);
      doc.text('TIMESTAMP', 102, y + 5.5);
      doc.text('RECORD HASH (SHA-256)', 138, y + 5.5);
      y += 11;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }

    doc.setTextColor(14, 116, 144);
    doc.setFont('helvetica', 'bold');
    doc.text(r.recordId, 16, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(r.jobId, 38, y);
    doc.text(getWorkerDisplayName(r.workerId, r.workerName).substring(0, 16), 68, y);
    doc.text(new Date(r.timestamp).toLocaleTimeString(), 102, y);

    doc.setTextColor(16, 185, 129);
    doc.setFont('helvetica', 'bold');
    doc.text(r.currentRecordHash.substring(0, 22) + '...', 138, y);

    y += 6.5;
  });

  const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  drawRayvaPdfFooter(doc);
  doc.save(`rayva_execution_ledger_${fileTimestamp}.pdf`);
}

export function exportFullAuditBundleToJson(
  logs: SystemLog[],
  records: ExecutionRecord[],
  status?: SystemStatus | null
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `rayva_full_audit_bundle_${timestamp}.json`;

  const payload = {
    system: 'Rayva Cloud',
    exportType: 'Full System Audit & Execution Ledger Bundle',
    exportedAt: new Date().toISOString(),
    clusterStatus: status || null,
    systemLogsCount: logs.length,
    executionRecordsCount: records.length,
    systemLogs: logs,
    executionLedger: records,
  };

  downloadJsonFile(filename, payload);
}

export function exportFullAuditBundleToPdf(
  logs: SystemLog[],
  records: ExecutionRecord[],
  status?: SystemStatus | null
) {
  const doc = new jsPDF();
  const timestamp = new Date().toLocaleString();

  drawRayvaPdfHeader(
    doc,
    'Cluster Performance & Execution Audit Report',
    `Generated: ${timestamp} | Active Strategy: ${status?.activeStrategy || 'RESOURCE_AWARE'}`
  );

  let y = 42;

  // Calculate stats
  const totalJobs = status?.totalJobs || 0;
  const completedJobs = status?.completedJobs || 0;
  const failedJobs = status?.failedJobs || 0;
  const completionRate = totalJobs > 0 ? ((completedJobs / totalJobs) * 100).toFixed(1) : '100.0';
  const failureRate = totalJobs > 0 ? ((failedJobs / totalJobs) * 100).toFixed(1) : '0.0';

  let healthGrade = 'OPTIMAL (A+)';
  if ((status?.failedWorkers || 0) > 0 || parseFloat(failureRate) > 10) {
    healthGrade = 'DEGRADED (B)';
  } else if ((status?.failedWorkers || 0) > 1 || parseFloat(failureRate) > 25) {
    healthGrade = 'CRITICAL (C)';
  }

  // Cluster Summary Box
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, 182, 36, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, y, 182, 36, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('RAYVA CLOUD SYSTEM AUDIT TELEMETRY', 18, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`• Overall Health Status: ${healthGrade}`, 18, y + 14);
  doc.text(`• CPU Utilization: ${status?.systemCpuUsage || 0}%`, 18, y + 20);
  doc.text(`• RAM Utilization: ${status?.systemRamUsage || 0}%`, 18, y + 26);
  doc.text(`• Avg Execution Time: ${status?.avgExecutionTimeMs || 0} ms`, 18, y + 32);

  doc.text(`• Active Scheduling Strategy: ${status?.activeStrategy || 'RESOURCE_AWARE'}`, 100, y + 14);
  doc.text(`• Online / Total Workers: ${status?.onlineWorkers || 0} / ${status?.totalWorkers || 0} (Failed: ${status?.failedWorkers || 0})`, 100, y + 20);
  doc.text(`• Jobs Processed (Total): ${totalJobs} (Active: ${status?.activeJobs || 0}, Queued: ${status?.queuedJobs || 0})`, 100, y + 26);
  doc.text(`• Job Completion Rate: ${completionRate}% (Failure Rate: ${failureRate}%)`, 100, y + 32);

  y += 44;

  // Section 1: Execution Ledger Records
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(2, 132, 199);
  doc.text(`1. VERIFIABLE EXECUTION LEDGER RECORDS (${records.length})`, 14, y);

  y += 6;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 182, 7, 'F');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('REC ID', 16, y + 5);
  doc.text('JOB ID', 40, y + 5);
  doc.text('WORKER', 70, y + 5);
  doc.text('RECORD HASH (SHA-256)', 115, y + 5);

  y += 10;
  doc.setFont('helvetica', 'normal');

  records.slice(0, 15).forEach((r) => {
    if (y > 275) {
      doc.addPage();
      drawRayvaPdfHeader(doc, 'Cluster Performance & Execution Audit Report (Cont.)', `Generated: ${timestamp}`);
      y = 38;
    }
    doc.setTextColor(14, 116, 144);
    doc.text(r.recordId, 16, y);
    doc.setTextColor(51, 65, 85);
    doc.text(r.jobId, 40, y);
    doc.text(getWorkerDisplayName(r.workerId, r.workerName).substring(0, 16), 70, y);
    doc.setTextColor(16, 185, 129);
    doc.text(r.currentRecordHash.substring(0, 28) + '...', 115, y);
    y += 5.5;
  });

  if (records.length === 0) {
    doc.setTextColor(100, 116, 139);
    doc.text('No ledger records recorded yet.', 16, y);
    y += 6;
  }

  y += 6;

  // Section 2: Recent Audit Logs
  if (y > 210) {
    doc.addPage();
    drawRayvaPdfHeader(doc, 'Cluster Performance & Execution Audit Report (Cont.)', `Generated: ${timestamp}`);
    y = 38;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(2, 132, 199);
  doc.text(`2. RECENT SYSTEM AUDIT LOGS (${logs.length})`, 14, y);

  y += 6;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 182, 7, 'F');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('TIME', 16, y + 5);
  doc.text('LEVEL', 42, y + 5);
  doc.text('COMPONENT', 65, y + 5);
  doc.text('MESSAGE', 105, y + 5);

  y += 10;
  doc.setFont('helvetica', 'normal');

  logs.slice(0, 25).forEach((log) => {
    if (y > 275) {
      doc.addPage();
      drawRayvaPdfHeader(doc, 'Cluster Performance & Execution Audit Report (Cont.)', `Generated: ${timestamp}`);
      y = 38;
    }
    doc.setTextColor(100, 116, 139);
    doc.text(new Date(log.timestamp).toLocaleTimeString(), 16, y);

    if (log.level === 'ERROR') doc.setTextColor(225, 29, 72);
    else if (log.level === 'WARNING') doc.setTextColor(217, 119, 6);
    else doc.setTextColor(2, 132, 199);

    doc.setFont('helvetica', 'bold');
    doc.text(log.level, 42, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(log.component.substring(0, 14), 65, y);
    doc.text(log.message.substring(0, 48), 105, y);

    y += 5.5;
  });

  const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  drawRayvaPdfFooter(doc);
  doc.save(`rayva_cluster_audit_report_${fileTimestamp}.pdf`);
}

export function exportSnapshotToJson(snap: SystemSnapshot) {
  const filename = `rayva_snapshot_${snap.name.toLowerCase().replace(/\s+/g, '-')}.json`;
  downloadJsonFile(filename, snap);
}

export function exportSnapshotToPdf(snap: SystemSnapshot) {
  const doc = new jsPDF();
  const timestamp = new Date(snap.timestamp).toLocaleString();

  drawRayvaPdfHeader(
    doc,
    `Snapshot: ${snap.name}`,
    `ID: ${snap.id} | Timestamp: ${timestamp} | Strategy: ${snap.status?.activeStrategy || 'RESOURCE_AWARE'}`
  );

  let y = 42;

  // Overview box
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, 182, 32, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, y, 182, 32, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('SNAPSHOT METRICS SUMMARY', 18, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`• System CPU Usage: ${snap.metricsSummary.cpuUsage}%`, 18, y + 14);
  doc.text(`• System RAM Usage: ${snap.metricsSummary.ramUsage}%`, 18, y + 20);
  doc.text(`• Total Worker Nodes: ${snap.metricsSummary.totalWorkers}`, 18, y + 26);

  doc.text(`• Total Jobs: ${snap.metricsSummary.totalJobs}`, 100, y + 14);
  doc.text(`• Active Running Jobs: ${snap.metricsSummary.activeJobs}`, 100, y + 20);
  doc.text(`• Completed Jobs: ${snap.metricsSummary.completedJobs}`, 100, y + 26);

  y += 40;

  // Workers
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(2, 132, 199);
  doc.text(`SNAPSHOT WORKERS (${snap.workers.length})`, 14, y);

  y += 6;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 182, 7, 'F');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('WORKER NAME', 16, y + 5);
  doc.text('STATUS', 60, y + 5);
  doc.text('CPU LOAD', 95, y + 5);
  doc.text('RAM USAGE', 130, y + 5);
  doc.text('COMPLETED JOBS', 165, y + 5);

  y += 10;
  doc.setFont('helvetica', 'normal');

  snap.workers.forEach((w) => {
    doc.setTextColor(51, 65, 85);
    doc.text(getWorkerDisplayName(w.id, w.name), 16, y);

    if (w.status === 'BUSY') doc.setTextColor(217, 119, 6);
    else if (w.status === 'IDLE') doc.setTextColor(16, 185, 129);
    else doc.setTextColor(225, 29, 72);

    doc.setFont('helvetica', 'bold');
    doc.text(w.status, 60, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`${w.currentCpuUsage}%`, 95, y);
    doc.text(`${w.currentRamUsage}%`, 130, y);
    doc.text(`${w.completedJobs}`, 165, y);

    y += 6;
  });

  const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  drawRayvaPdfFooter(doc);
  doc.save(`rayva_snapshot_${snap.name.toLowerCase().replace(/\s+/g, '-')}_${fileTimestamp}.pdf`);
}

export function exportHealthReportToPdf(report: {
  timestamp: number;
  healthGrade: string;
  healthScore: number;
  generatedBy: string;
  executiveSummary: string;
  keyObservations: string[];
  metrics: {
    workersOnline: number;
    workersTotal: number;
    activeJobs: number;
    queuedJobs: number;
    completedJobs: number;
    failedJobs: number;
    cpuUsage: number;
    ramUsage: number;
    activeStrategy: string;
    maintenanceMode: boolean;
  };
  recommendations: string[];
}) {
  const doc = new jsPDF();
  const dateStr = new Date(report.timestamp).toLocaleString();

  drawRayvaPdfHeader(
    doc,
    'System Health Executive Report',
    `Generated: ${dateStr} | Posture: ${report.healthGrade} (${report.healthScore}/100) | Engine: ${report.generatedBy}`
  );

  let y = 42;

  // Grade & Summary Box
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, 182, 38, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, y, 182, 38, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`EXECUTIVE POSTURE GRADE: ${report.healthGrade} (${report.healthScore}/100)`, 18, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  const lines = doc.splitTextToSize(report.executiveSummary, 174);
  doc.text(lines.slice(0, 4), 18, y + 16);

  y += 46;

  // Key Metrics Grid Box
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 182, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(2, 132, 199);
  doc.text('CLUSTER TELEMETRY POSTURE', 18, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`• Workers: ${report.metrics.workersOnline} / ${report.metrics.workersTotal} Online`, 18, y + 13);
  doc.text(`• CPU Usage: ${report.metrics.cpuUsage}%`, 18, y + 18);

  doc.text(`• RAM Usage: ${report.metrics.ramUsage}%`, 80, y + 13);
  doc.text(`• Active Strategy: ${report.metrics.activeStrategy}`, 80, y + 18);

  doc.text(`• Active/Queued Jobs: ${report.metrics.activeJobs} / ${report.metrics.queuedJobs}`, 145, y + 13);
  doc.text(`• Maintenance Mode: ${report.metrics.maintenanceMode ? 'ACTIVE' : 'DISABLED'}`, 145, y + 18);

  y += 30;

  // Key Observations
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(2, 132, 199);
  doc.text('KEY OPERATIONAL OBSERVATIONS', 14, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  report.keyObservations.forEach((obs) => {
    doc.text(`• ${obs}`, 16, y);
    y += 5.5;
  });

  y += 6;

  // Actionable Recommendations
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(217, 119, 6);
  doc.text('ACTIONABLE RECOMMENDATIONS', 14, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  report.recommendations.forEach((rec) => {
    doc.text(`• ${rec}`, 16, y);
    y += 5.5;
  });

  const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  drawRayvaPdfFooter(doc);
  doc.save(`rayva_health_report_${fileTimestamp}.pdf`);
}

export function downloadCsvFile(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportAnalyticsToCsv(
  status: SystemStatus | null,
  workers: WorkerNodeData[],
  jobs: Job[],
  heatmapData: Array<{
    worker: WorkerNodeData;
    history: Array<{
      slotId: string;
      timeLabel: string;
      timeStr: string;
      cpu: number;
      ram: number;
      workload: number;
      jobsCount: number;
    }>;
  }>
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `rayva_analytics_telemetry_${timestamp}.csv`;

  const escapeCsv = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const lines: string[] = [];

  // Metadata
  lines.push(`"# RAYVA CLOUD - CLUSTER PERFORMANCE & TELEMETRY REPORT"`);
  lines.push(`"# Exported At: ${new Date().toISOString()}"`);
  lines.push('');

  // 1. Cluster Status Overview
  lines.push(`"# SECTION 1: CLUSTER TELEMETRY OVERVIEW"`);
  lines.push(['Parameter', 'Value'].map(escapeCsv).join(','));
  if (status) {
    lines.push(['Total Workers', status.totalWorkers].map(escapeCsv).join(','));
    lines.push(['Online Workers', status.onlineWorkers].map(escapeCsv).join(','));
    lines.push(['Failed Workers', status.failedWorkers].map(escapeCsv).join(','));
    lines.push(['System CPU Usage (%)', status.systemCpuUsage.toFixed(1)].map(escapeCsv).join(','));
    lines.push(['System RAM Usage (%)', status.systemRamUsage.toFixed(1)].map(escapeCsv).join(','));
    lines.push(['Total Jobs Processed', status.totalJobs].map(escapeCsv).join(','));
    lines.push(['Active Running Jobs', status.activeJobs].map(escapeCsv).join(','));
    lines.push(['Queued Jobs', status.queuedJobs].map(escapeCsv).join(','));
    lines.push(['Completed Jobs', status.completedJobs].map(escapeCsv).join(','));
    lines.push(['Failed Jobs', status.failedJobs].map(escapeCsv).join(','));
    lines.push(['Average Latency (ms)', status.avgExecutionTimeMs].map(escapeCsv).join(','));
    lines.push(['Active Strategy', status.activeStrategy].map(escapeCsv).join(','));
  }
  lines.push('');

  // 2. Worker Performance Metrics
  lines.push(`"# SECTION 2: WORKER NODE PERFORMANCE METRICS"`);
  lines.push([
    'Worker ID',
    'Worker Name',
    'Status',
    'CPU Capacity (Cores)',
    'RAM Capacity (MB)',
    'Current CPU Usage (%)',
    'Current RAM Usage (%)',
    'Current Workload Intensity (%)',
    'Active Jobs',
    'Completed Jobs',
    'Failed Jobs',
    'Success Rate (%)',
    'Avg Execution Time (ms)',
  ].map(escapeCsv).join(','));

  workers.forEach((w) => {
    lines.push([
      w.id,
      getWorkerDisplayName(w.id, w.name),
      w.status,
      w.cpuCapacity,
      w.ramCapacity,
      w.currentCpuUsage,
      w.currentRamUsage,
      w.currentWorkload,
      w.activeJobs,
      w.completedJobs,
      w.failedJobs,
      w.successRate,
      w.avgExecutionTimeMs,
    ].map(escapeCsv).join(','));
  });
  lines.push('');

  // 3. Worker Rolling Heatmap History (12 Intervals)
  lines.push(`"# SECTION 3: WORKER ROLLING HEATMAP TELEMETRY (LAST 60 MINS)"`);
  lines.push([
    'Worker Name',
    'Time Slot Label',
    'Time String',
    'CPU Load (%)',
    'RAM Usage (%)',
    'Workload Intensity (%)',
    'Concurrent Jobs Count',
  ].map(escapeCsv).join(','));

  heatmapData.forEach((row) => {
    row.history.forEach((slot) => {
      lines.push([
        getWorkerDisplayName(row.worker.id, row.worker.name),
        slot.timeLabel,
        slot.timeStr,
        slot.cpu,
        slot.ram,
        slot.workload,
        slot.jobsCount,
      ].map(escapeCsv).join(','));
    });
  });
  lines.push('');

  // 4. Job Workload Records
  lines.push(`"# SECTION 4: RECENT JOB WORKLOADS LOG"`);
  lines.push([
    'Job ID',
    'Job Name',
    'Type',
    'Status',
    'Priority',
    'Assigned Worker',
    'Execution Time (ms)',
    'Submitted Time',
  ].map(escapeCsv).join(','));

  jobs.forEach((j) => {
    lines.push([
      j.id,
      j.name,
      j.type,
      j.status,
      j.priority,
      getWorkerDisplayName(j.assignedWorkerId, j.assignedWorkerName) || 'Unassigned',
      j.executionTimeMs ?? 'N/A',
      j.submittedTime ? new Date(j.submittedTime).toISOString() : 'N/A',
    ].map(escapeCsv).join(','));
  });

  const csvContent = lines.join('\n');
  downloadCsvFile(filename, csvContent);
}

