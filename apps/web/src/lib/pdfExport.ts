import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DeviceReport {
  device: {
    serialNumber: string;
    terminalName: string | null;
    firmwareVersion: string | null;
    macAddress: string | null;
    platformVersion: string | null;
  };
  stats: {
    batteryReadings: number;
    wifiReadings: number;
    roamEvents: number;
    connectionEvents: number;
  };
  operators: { operatorName: string; operatorExtId: string | null; sessionStart: string; sessionEnd: string; readingCount: number }[];
  anomalies: { serverTime: string; severity: string; family: string; title: string; offendingValue: string | null; thresholdValue: string | null }[];
  battery: { avgPercent: number | null; minPercent: number | null };
  wifi: { avgSignal: number | null; minSignal: number | null };
  logStart: string | null;
  logStop: string | null;
}

const COLORS = {
  honeywell: [200, 16, 46] as [number, number, number],
  darkBg: [15, 23, 42] as [number, number, number],
  headerBg: [30, 41, 59] as [number, number, number],
  text: [226, 232, 240] as [number, number, number],
  muted: [148, 163, 184] as [number, number, number],
  critical: [248, 113, 113] as [number, number, number],
  warning: [251, 191, 36] as [number, number, number],
};

export async function generatePDF(serial: string): Promise<void> {
  // Fetch all necessary data in parallel
  const [deviceRes, batteryRes, wifiRes, anomalyRes, operatorsRes] = await Promise.all([
    fetch(`/api/devices/${serial}`),
    fetch(`/api/devices/${serial}/battery`),
    fetch(`/api/devices/${serial}/wifi`),
    fetch(`/api/devices/${serial}/anomalies`),
    fetch(`/api/devices/${serial}/operators`),
  ]);

  const device = await deviceRes.json();
  const batteryData = await batteryRes.json();
  const wifiData = await wifiRes.json();
  const anomalies = await anomalyRes.json();
  const operators = await operatorsRes.json();

  const report: DeviceReport = {
    device: {
      serialNumber: device.serialNumber,
      terminalName: device.terminalName,
      firmwareVersion: device.firmwareVersion,
      macAddress: device.macAddress,
      platformVersion: device.platformVersion,
    },
    stats: device._count || { batteryReadings: 0, wifiReadings: 0, roamEvents: 0, connectionEvents: 0 },
    operators: Array.isArray(operators) ? operators : [],
    anomalies: Array.isArray(anomalies) ? anomalies : [],
    battery: {
      avgPercent: batteryData.length > 0 ? Math.round(batteryData.reduce((s: number, r: { percent: number }) => s + r.percent, 0) / batteryData.length) : null,
      minPercent: batteryData.length > 0 ? Math.min(...batteryData.map((r: { percent: number }) => r.percent)) : null,
    },
    wifi: {
      avgSignal: wifiData.length > 0 ? Math.round(wifiData.reduce((s: number, r: { signalPercent: number }) => s + r.signalPercent, 0) / wifiData.length) : null,
      minSignal: wifiData.length > 0 ? Math.min(...wifiData.map((r: { signalPercent: number }) => r.signalPercent)) : null,
    },
    logStart: device.logImports?.[0]?.logStartTime || null,
    logStop: device.logImports?.[0]?.logStopTime || null,
  };

  buildPDF(report);
}

function buildPDF(report: DeviceReport) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header bar
  doc.setFillColor(...COLORS.honeywell);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Honeywell Vocollect Device Report', 14, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Serial: ${report.device.serialNumber}   |   Generated: ${new Date().toLocaleString()}`, 14, 22);
  y = 36;

  // Device Information section
  y = sectionTitle(doc, 'Device Information', y);
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2, textColor: [50, 50, 50] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
    body: [
      ['Serial Number', report.device.serialNumber],
      ['Terminal Name', report.device.terminalName || '—'],
      ['Firmware', report.device.firmwareVersion || '—'],
      ['MAC Address', report.device.macAddress || '—'],
      ['Platform Version', report.device.platformVersion || '—'],
      ['Log Start', report.logStart ? new Date(report.logStart).toLocaleString() : '—'],
      ['Log Stop', report.logStop ? new Date(report.logStop).toLocaleString() : '—'],
    ],
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Statistics
  y = sectionTitle(doc, 'Statistics', y);
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [200, 200, 200], fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3 },
    head: [['Battery Readings', 'WiFi Surveys', 'AP Roams', 'Connection Events', 'Anomalies']],
    body: [[
      report.stats.batteryReadings,
      report.stats.wifiReadings,
      report.stats.roamEvents,
      report.stats.connectionEvents,
      report.anomalies.length,
    ]],
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  // Key Metrics
  y = sectionTitle(doc, 'Key Metrics', y);
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [200, 200, 200], fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3 },
    head: [['Avg Battery %', 'Min Battery %', 'Avg WiFi Signal %', 'Min WiFi Signal %']],
    body: [[
      report.battery.avgPercent != null ? `${report.battery.avgPercent}%` : '—',
      report.battery.minPercent != null ? `${report.battery.minPercent}%` : '—',
      report.wifi.avgSignal != null ? `${report.wifi.avgSignal}%` : '—',
      report.wifi.minSignal != null ? `${report.wifi.minSignal}%` : '—',
    ]],
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Operators
  if (report.operators.length > 0) {
    y = sectionTitle(doc, `Operators (${report.operators.length})`, y);
    autoTable(doc, {
      startY: y,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: [200, 200, 200], fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 2 },
      head: [['Name', 'ID', 'Start', 'End', 'Readings']],
      body: report.operators.map((o) => [
        o.operatorName,
        o.operatorExtId || '—',
        new Date(o.sessionStart).toLocaleString(),
        new Date(o.sessionEnd).toLocaleString(),
        o.readingCount,
      ]),
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Anomalies
  y = sectionTitle(doc, `Anomalies (${report.anomalies.length})`, y);
  if (report.anomalies.length > 0) {
    autoTable(doc, {
      startY: y,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: [200, 200, 200], fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2 },
      head: [['Time', 'Severity', 'Family', 'Title', 'Value', 'Threshold']],
      body: report.anomalies.map((a) => [
        new Date(a.serverTime).toLocaleString(),
        a.severity,
        a.family,
        a.title,
        a.offendingValue || '—',
        a.thresholdValue || '—',
      ]),
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 1) {
          const val = (data.row.raw as string[])[1];
          if (val === 'CRITICAL') data.cell.styles.textColor = [220, 50, 50];
          if (val === 'WARNING') data.cell.styles.textColor = [200, 140, 20];
        }
      },
    });
  } else {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('No anomalies detected.', 14, y + 4);
  }

  // Footer on every page
  const pageCount = (doc as unknown as { internal: { pages: unknown[] } }).internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 25, doc.internal.pageSize.getHeight() - 8);
    doc.text('Honeywell Vocollect Log Parser — Confidential', 14, doc.internal.pageSize.getHeight() - 8);
  }

  doc.save(`device_${report.device.serialNumber}_report.pdf`);
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y > pageHeight - 40) {
    doc.addPage();
    y = 15;
  }
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(title, 14, y);
  doc.setDrawColor(200, 16, 46);
  doc.setLineWidth(0.5);
  doc.line(14, y + 2, doc.internal.pageSize.getWidth() - 14, y + 2);
  doc.setFont('helvetica', 'normal');
  return y + 6;
}
