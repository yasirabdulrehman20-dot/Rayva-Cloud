import jsPDF from 'jspdf';
import { SystemLog, ExecutionRecord, SystemStatus, SystemSnapshot, WorkerNodeData, Job, User } from '../shared/types.js';
import { getWorkerDisplayName } from '../shared/workerUtils.js';

type ExportUser = Pick<User, 'id' | 'email' | 'role'>;

function isAdminUser(currentUser?: ExportUser | null): boolean {
  return currentUser?.role === 'Cluster Admin';
}

function logBelongsToUser(log: SystemLog, currentUser: ExportUser): boolean {
  if (log.component.toLowerCase() === 'auth') return false;

  const metadata = log.metadata || {};
  const metadataUserId = metadata.userId || metadata.ownerId || metadata.createdBy;
  const metadataEmail = metadata.userEmail || metadata.email;

  return metadataUserId === currentUser.id || metadataEmail === currentUser.email;
}

function filterLogsForExport(logs: SystemLog[], currentUser?: ExportUser | null): SystemLog[] {
  if (isAdminUser(currentUser)) return logs;
  if (!currentUser) return [];
  return logs.filter((log) => logBelongsToUser(log, currentUser));
}

function filterRecordsForExport(
  records: ExecutionRecord[],
  jobs: Job[] | undefined,
  currentUser?: ExportUser | null
): ExecutionRecord[] {
  if (isAdminUser(currentUser)) return records;
  if (!currentUser || !jobs) return [];

  const ownedJobIds = new Set(
    jobs.filter((job) => job.userId === currentUser.id).map((job) => job.id)
  );
  return records.filter((record) => ownedJobIds.has(record.jobId));
}

const PDF_CONTENT_LEFT = 14;
const PDF_CONTENT_RIGHT = 196;
const PDF_CONTENT_WIDTH = PDF_CONTENT_RIGHT - PDF_CONTENT_LEFT;
const PDF_SAFE_BOTTOM = 268;
const PDF_TABLE_ROW_HEIGHT = 6.5;
const PDF_TABLE_LINE_HEIGHT = 4.8;
const PDF_TABLE_TOP_PADDING = 2.2;
const PDF_TABLE_BOTTOM_PADDING = 2.2;

function fitPdfText(doc: jsPDF, value: unknown, maxWidth: number): string {
  const text = String(value ?? '');
  if (!text || maxWidth <= 0) return '';
  if (doc.getTextWidth(text) <= maxWidth) return text;

  let result = text;
  while (result.length > 1 && doc.getTextWidth(`${result}...`) > maxWidth) {
    result = result.slice(0, -1);
  }
  return result.length > 1 ? `${result}...` : '...';
}

function wrapPdfText(doc: jsPDF, value: unknown, maxWidth: number): string[] {
  const text = String(value ?? '');
  if (!text || maxWidth <= 0) return [''];

  const splitLines = doc.splitTextToSize(text, maxWidth) as string[];
  const lines: string[] = [];
  splitLines.forEach((splitLine) => {
    let line = '';
    for (const character of splitLine) {
      const candidate = line + character;
      if (line && doc.getTextWidth(candidate) > maxWidth) {
        lines.push(line);
        line = character;
      } else {
        line = candidate;
      }
    }
    if (line || !lines.length) lines.push(line);
  });
  return lines.length ? lines : [''];
}

interface PdfTableRowLayout {
  cells: string[][];
  rowHeight: number;
}

function createPdfTableRowLayout(
  doc: jsPDF,
  values: string[],
  columns: Array<{ x: number; width: number }>
): PdfTableRowLayout {
  const cells = columns.map((column, index) => wrapPdfText(doc, values[index], column.width - 4));
  const lineCount = Math.max(...cells.map((lines) => lines.length));
  const rowHeight = Math.max(
    PDF_TABLE_ROW_HEIGHT,
    lineCount * PDF_TABLE_LINE_HEIGHT + PDF_TABLE_TOP_PADDING + PDF_TABLE_BOTTOM_PADDING
  );
  return { cells, rowHeight };
}

function drawPdfTableHeader(
  doc: jsPDF,
  y: number,
  columns: Array<{ label: string; x: number; width: number }>
): number {
  doc.setFillColor(241, 245, 249);
  doc.rect(PDF_CONTENT_LEFT, y, PDF_CONTENT_WIDTH, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  columns.forEach((column) => {
    doc.text(fitPdfText(doc, column.label, column.width - 4), column.x + 2, y + 5.5);
  });
  return y + 11;
}

function drawPdfTableRow(
  doc: jsPDF,
  rowTop: number,
  layout: PdfTableRowLayout,
  columns: Array<{ x: number; width: number }>,
  rowIndex: number,
  colors: string[] = []
): number {
  if (rowIndex % 2 === 1) {
    doc.setFillColor(248, 250, 252);
    doc.rect(PDF_CONTENT_LEFT, rowTop, PDF_CONTENT_WIDTH, layout.rowHeight, 'F');
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  columns.forEach((column, index) => {
    doc.setTextColor(colors[index] || '334155');
    layout.cells[index].forEach((line, lineIndex) => {
      doc.text(line, column.x + 2, rowTop + PDF_TABLE_TOP_PADDING + lineIndex * PDF_TABLE_LINE_HEIGHT);
    });
  });
  return rowTop + layout.rowHeight;
}

function startContinuationPage(
  doc: jsPDF,
  title: string,
  subtitle: string,
  columns: Array<{ label: string; x: number; width: number }>
): number {
  doc.addPage();
  drawRayvaPdfHeader(doc, title, subtitle);
  return drawPdfTableHeader(doc, 38, columns);
}

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
  const truncatedTitle = fitPdfText(doc, titleText, 125);
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
  filterInfo?: { level: string; search: string },
  currentUser?: ExportUser | null
) {
  const exportLogs = filterLogsForExport(logs, currentUser);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `rayva_system_logs_${timestamp}.json`;

  const payload = {
    system: 'Rayva Cloud',
    exportType: 'System Audit Logs',
    exportedAt: new Date().toISOString(),
    totalCount: exportLogs.length,
    activeFilter: filterInfo || { level: 'ALL', search: '' },
    logs: exportLogs,
  };

  downloadJsonFile(filename, payload);
}

export function exportLogsToPdf(
  logs: SystemLog[],
  filterInfo?: { level: string; search: string },
  currentUser?: ExportUser | null
) {
  const exportLogs = filterLogsForExport(logs, currentUser);
  const doc = new jsPDF();
  const timestamp = new Date().toLocaleString();
  const columns = [
    { label: 'TIME', x: 14, width: 28 },
    { label: 'LEVEL', x: 42, width: 23 },
    { label: 'COMPONENT', x: 65, width: 38 },
    { label: 'MESSAGE', x: 103, width: 93 },
  ];

  drawRayvaPdfHeader(
    doc,
    'Audit Logs Report',
    `Exported: ${timestamp} | Filter: ${filterInfo?.level || 'ALL'} | Search: "${filterInfo?.search || ''}" | Count: ${exportLogs.length}`
  );

  let y = 38;

  y = drawPdfTableHeader(doc, y, columns);
  exportLogs.forEach((log, index) => {
    const values = [new Date(log.timestamp).toLocaleTimeString(), log.level, log.component, log.message];
    const layout = createPdfTableRowLayout(doc, values, columns);
    if (y + layout.rowHeight > PDF_SAFE_BOTTOM) {
      y = startContinuationPage(
        doc,
        'Audit Logs Report (Cont.)',
        `Exported: ${timestamp} | Filter: ${filterInfo?.level || 'ALL'}`,
        columns
      );
    }

    const levelColor = log.level === 'ERROR' ? 'e11d48' : log.level === 'WARNING' ? 'd97706' : '0284c7';
    y = drawPdfTableRow(
      doc,
      y,
      layout,
      columns,
      index,
      ['64748b', levelColor, '334155', '334155']
    );
  });

  const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  drawRayvaPdfFooter(doc);
  doc.save(`rayva_system_logs_${fileTimestamp}.pdf`);
}

export function exportLedgerToJson(
  records: ExecutionRecord[],
  verificationStatus?: { valid: boolean; recordCount: number; errors: string[] } | null,
  currentUser?: ExportUser | null,
  jobs?: Job[]
) {
  const exportRecords = filterRecordsForExport(records, jobs, currentUser);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `rayva_execution_ledger_${timestamp}.json`;

  const payload = {
    system: 'Rayva Cloud',
    exportType: 'Verifiable Execution Ledger Audit Chain',
    exportedAt: new Date().toISOString(),
    totalRecordsCount: exportRecords.length,
    verificationStatus: verificationStatus || null,
    records: exportRecords,
  };

  downloadJsonFile(filename, payload);
}

export function exportLedgerToPdf(
  records: ExecutionRecord[],
  verificationStatus?: { valid: boolean; recordCount: number; errors: string[] } | null,
  currentUser?: ExportUser | null,
  jobs?: Job[]
) {
  const exportRecords = filterRecordsForExport(records, jobs, currentUser);
  const doc = new jsPDF();
  const timestamp = new Date().toLocaleString();
  const columns = [
    { label: 'REC ID', x: 14, width: 40 },
    { label: 'JOB ID', x: 54, width: 36 },
    { label: 'WORKER', x: 90, width: 33 },
    { label: 'RECORD HASH (SHA-256)', x: 123, width: 73 },
  ];

  const statusText = verificationStatus?.valid ? 'VERIFIED VALID [100% Hash Match]' : 'AUDITED';

  drawRayvaPdfHeader(
    doc,
    'Execution Ledger Audit',
    `Exported: ${timestamp} | Chain Status: ${statusText} | Records: ${exportRecords.length}`
  );

  let y = 38;

  y = drawPdfTableHeader(doc, y, columns);
  exportRecords.forEach((r, index) => {
    const values = [r.recordId, r.jobId, getWorkerDisplayName(r.workerId, r.workerName), r.currentRecordHash];
    const layout = createPdfTableRowLayout(doc, values, columns);
    if (y + layout.rowHeight > PDF_SAFE_BOTTOM) {
      y = startContinuationPage(
        doc,
        'Execution Ledger Audit (Cont.)',
        `Exported: ${timestamp} | Chain Status: ${statusText}`,
        columns
      );
    }

    y = drawPdfTableRow(
      doc,
      y,
      layout,
      columns,
      index,
      ['0e7490', '334155', '334155', '10b981']
    );
  });

  const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  drawRayvaPdfFooter(doc);
  doc.save(`rayva_execution_ledger_${fileTimestamp}.pdf`);
}

export function exportFullAuditBundleToJson(
  logs: SystemLog[],
  records: ExecutionRecord[],
  status?: SystemStatus | null,
  currentUser?: ExportUser | null,
  jobs?: Job[]
) {
  const exportLogs = filterLogsForExport(logs, currentUser);
  const exportRecords = filterRecordsForExport(records, jobs, currentUser);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${isAdminUser(currentUser) ? 'rayva_full_audit_bundle' : 'rayva_user_audit_bundle'}_${timestamp}.json`;

  const payload = {
    system: 'Rayva Cloud',
    exportType: isAdminUser(currentUser) ? 'Full System Audit & Execution Ledger Bundle' : 'User Performance & Execution Bundle',
    exportedAt: new Date().toISOString(),
    clusterStatus: status || null,
    systemLogsCount: exportLogs.length,
    executionRecordsCount: exportRecords.length,
    systemLogs: exportLogs,
    executionLedger: exportRecords,
  };

  downloadJsonFile(filename, payload);
}

export function exportFullAuditBundleToPdf(
  logs: SystemLog[],
  records: ExecutionRecord[],
  status?: SystemStatus | null,
  currentUser?: ExportUser | null,
  jobs?: Job[]
) {
  const isAdmin = isAdminUser(currentUser);
  const exportLogs = filterLogsForExport(logs, currentUser);
  const exportRecords = filterRecordsForExport(records, jobs, currentUser);
  const doc = new jsPDF();
  const timestamp = new Date().toLocaleString();
  const reportTitle = isAdmin
    ? 'Cluster Performance & Execution Audit Report'
    : 'User Performance & Execution Report';
  const continuationTitle = isAdmin
    ? 'Cluster Performance & Execution Audit Report (Cont.)'
    : 'User Performance & Execution Report (Cont.)';

  drawRayvaPdfHeader(
    doc,
    reportTitle,
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
  const summaryLeft = 18;
  const summaryRight = 100;
  const summaryWidth = 78;
  [
    `• Overall Health Status: ${healthGrade}`,
    `• CPU Utilization: ${status?.systemCpuUsage || 0}%`,
    `• RAM Utilization: ${status?.systemRamUsage || 0}%`,
    `• Avg Execution Time: ${status?.avgExecutionTimeMs || 0} ms`,
  ].forEach((line, index) => doc.text(fitPdfText(doc, line, summaryWidth), summaryLeft, y + 14 + index * 6));
  [
    `• Active Scheduling Strategy: ${status?.activeStrategy || 'RESOURCE_AWARE'}`,
    `• Online / Total Workers: ${status?.onlineWorkers || 0} / ${status?.totalWorkers || 0} (Failed: ${status?.failedWorkers || 0})`,
    `• Jobs Processed (Total): ${totalJobs} (Active: ${status?.activeJobs || 0}, Queued: ${status?.queuedJobs || 0})`,
    `• Job Completion Rate: ${completionRate}% (Failure Rate: ${failureRate}%)`,
  ].forEach((line, index) => doc.text(fitPdfText(doc, line, summaryWidth), summaryRight, y + 14 + index * 6));

  y += 44;

  // Section 1: Execution Ledger Records
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(2, 132, 199);
  doc.text(`1. VERIFIABLE EXECUTION LEDGER RECORDS (${exportRecords.length})`, 14, y);

  y += 6;
  const ledgerColumns = [
    { label: 'REC ID', x: 14, width: 40 },
    { label: 'JOB ID', x: 54, width: 36 },
    { label: 'WORKER', x: 90, width: 33 },
    { label: 'RECORD HASH (SHA-256)', x: 123, width: 73 },
  ];
  y = drawPdfTableHeader(doc, y, ledgerColumns);

  exportRecords.forEach((r, index) => {
    const values = [r.recordId, r.jobId, getWorkerDisplayName(r.workerId, r.workerName), r.currentRecordHash];
    const layout = createPdfTableRowLayout(doc, values, ledgerColumns);
    if (y + layout.rowHeight > PDF_SAFE_BOTTOM) {
      y = startContinuationPage(doc, continuationTitle, `Generated: ${timestamp}`, ledgerColumns);
    }
    y = drawPdfTableRow(
      doc,
      y,
      layout,
      ledgerColumns,
      index,
      ['0e7490', '334155', '334155', '10b981']
    );
  });

  if (exportRecords.length === 0) {
    doc.setTextColor(100, 116, 139);
    doc.text('No ledger records recorded yet.', 16, y);
    y += 6;
  }

  y += 6;

  // Section 2: Recent Audit Logs
  const logColumns = [
    { label: 'TIME', x: 14, width: 28 },
    { label: 'LEVEL', x: 42, width: 23 },
    { label: 'COMPONENT', x: 65, width: 38 },
    { label: 'MESSAGE', x: 103, width: 93 },
  ];
  if (y + 8 + 11 + PDF_TABLE_ROW_HEIGHT > PDF_SAFE_BOTTOM) {
    doc.addPage();
    drawRayvaPdfHeader(doc, continuationTitle, `Generated: ${timestamp}`);
    y = 38;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(2, 132, 199);
  doc.text(`2. RECENT SYSTEM AUDIT LOGS (${exportLogs.length})`, 14, y);

  y += 6;
  y = drawPdfTableHeader(doc, y, logColumns);
  exportLogs.forEach((log, index) => {
    const values = [new Date(log.timestamp).toLocaleTimeString(), log.level, log.component, log.message];
    const layout = createPdfTableRowLayout(doc, values, logColumns);
    if (y + layout.rowHeight > PDF_SAFE_BOTTOM) {
      y = startContinuationPage(doc, continuationTitle, `Generated: ${timestamp}`, logColumns);
    }
    const levelColor = log.level === 'ERROR' ? 'e11d48' : log.level === 'WARNING' ? 'd97706' : '0284c7';
    y = drawPdfTableRow(
      doc,
      y,
      layout,
      logColumns,
      index,
      ['64748b', levelColor, '334155', '334155']
    );
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
  const snapshotSummaryWidth = 78;
  [
    `• System CPU Usage: ${snap.metricsSummary.cpuUsage}%`,
    `• System RAM Usage: ${snap.metricsSummary.ramUsage}%`,
    `• Total Worker Nodes: ${snap.metricsSummary.totalWorkers}`,
  ].forEach((line, index) => doc.text(fitPdfText(doc, line, snapshotSummaryWidth), 18, y + 14 + index * 6));
  [
    `• Total Jobs: ${snap.metricsSummary.totalJobs}`,
    `• Active Running Jobs: ${snap.metricsSummary.activeJobs}`,
    `• Completed Jobs: ${snap.metricsSummary.completedJobs}`,
  ].forEach((line, index) => doc.text(fitPdfText(doc, line, snapshotSummaryWidth), 100, y + 14 + index * 6));

  y += 40;

  // Workers
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(2, 132, 199);
  doc.text(`SNAPSHOT WORKERS (${snap.workers.length})`, 14, y);

  y += 6;
  const workerColumns = [
    { label: 'WORKER NAME', x: 14, width: 46 },
    { label: 'STATUS', x: 60, width: 35 },
    { label: 'CPU LOAD', x: 95, width: 35 },
    { label: 'RAM USAGE', x: 130, width: 35 },
    { label: 'COMPLETED JOBS', x: 165, width: 31 },
  ];
  y = drawPdfTableHeader(doc, y, workerColumns);

  snap.workers.forEach((w, index) => {
    const values = [
      getWorkerDisplayName(w.id, w.name),
      w.status,
      `${w.currentCpuUsage}%`,
      `${w.currentRamUsage}%`,
      `${w.completedJobs}`,
    ];
    const layout = createPdfTableRowLayout(doc, values, workerColumns);
    if (y + layout.rowHeight > PDF_SAFE_BOTTOM) {
      y = startContinuationPage(
        doc,
        `Snapshot: ${snap.name} (Cont.)`,
        `ID: ${snap.id} | Timestamp: ${timestamp}`,
        workerColumns
      );
    }
    const statusColor = w.status === 'BUSY' ? 'd97706' : w.status === 'IDLE' ? '10b981' : 'e11d48';
    y = drawPdfTableRow(
      doc,
      y,
      layout,
      workerColumns,
      index,
      ['334155', statusColor, '334155', '334155', '334155']
    );
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
  doc.text(
    fitPdfText(doc, `EXECUTIVE POSTURE GRADE: ${report.healthGrade} (${report.healthScore}/100)`, 174),
    18,
    y + 8
  );

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
  doc.text(fitPdfText(doc, `• Workers: ${report.metrics.workersOnline} / ${report.metrics.workersTotal} Online`, 58), 18, y + 13);
  doc.text(fitPdfText(doc, `• CPU Usage: ${report.metrics.cpuUsage}%`, 58), 18, y + 18);

  doc.text(fitPdfText(doc, `• RAM Usage: ${report.metrics.ramUsage}%`, 60), 80, y + 13);
  doc.text(fitPdfText(doc, `• Active Strategy: ${report.metrics.activeStrategy}`, 60), 80, y + 18);

  doc.text(fitPdfText(doc, `• Active/Queued Jobs: ${report.metrics.activeJobs} / ${report.metrics.queuedJobs}`, 49), 145, y + 13);
  doc.text(fitPdfText(doc, `• Maintenance Mode: ${report.metrics.maintenanceMode ? 'ACTIVE' : 'DISABLED'}`, 49), 145, y + 18);

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
    const observationLines = doc.splitTextToSize(`• ${obs}`, 178);
    observationLines.forEach((line: string) => {
      if (y > PDF_SAFE_BOTTOM) {
        doc.addPage();
        drawRayvaPdfHeader(doc, 'System Health Executive Report (Cont.)', `Generated: ${dateStr}`);
        y = 38;
      }
      doc.text(line, 16, y);
      y += 5.5;
    });
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
    const recommendationLines = doc.splitTextToSize(`• ${rec}`, 178);
    recommendationLines.forEach((line: string) => {
      if (y > PDF_SAFE_BOTTOM) {
        doc.addPage();
        drawRayvaPdfHeader(doc, 'System Health Executive Report (Cont.)', `Generated: ${dateStr}`);
        y = 38;
      }
      doc.text(line, 16, y);
      y += 5.5;
    });
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

