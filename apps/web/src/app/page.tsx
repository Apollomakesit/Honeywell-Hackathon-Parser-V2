'use client';

import { useState, useEffect, useCallback } from 'react';
import DeviceSidebar from '@/components/DeviceSidebar';
import UploadZone from '@/components/UploadZone';
import TabBar from '@/components/TabBar';
import OverviewTab from '@/components/OverviewTab';
import BatteryTab from '@/components/BatteryTab';
import WifiRoamingTab from '@/components/WifiRoamingTab';
import AnomaliesTab from '@/components/AnomaliesTab';
import TimelineTab from '@/components/TimelineTab';
import RawLogTab from '@/components/RawLogTab';
import ExportButtons from '@/components/ExportButtons';

interface DeviceEntry {
  id: string;
  serialNumber: string;
  firmwareVersion: string | null;
  firstSeen: string;
  lastSeen: string;
  operators: string[];
  criticalCount: number;
  warningCount: number;
  logImports: { logStartTime: string; logStopTime: string }[];
}

export default function DashboardPage() {
  const [devices, setDevices] = useState<DeviceEntry[]>([]);
  const [selectedSerial, setSelectedSerial] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showUpload, setShowUpload] = useState(false);

  const loadDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/devices');
      const data = await res.json();
      setDevices(data);
      if (data.length > 0 && !selectedSerial) {
        setSelectedSerial(data[0].serialNumber);
      }
    } catch {
      // ignore
    }
  }, [selectedSerial]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleUploadComplete = useCallback(() => {
    setShowUpload(false);
    loadDevices();
  }, [loadDevices]);

  // No devices → show upload
  if (devices.length === 0 && !showUpload) {
    return (
      <div className="min-h-screen bg-slate-950">
        <header className="h-14 bg-slate-900 border-b border-slate-700/50 flex items-center px-6">
          <h1 className="text-sm font-semibold text-slate-100">Honeywell Vocollect Log Parser</h1>
        </header>
        <UploadZone onUploadComplete={handleUploadComplete} />
      </div>
    );
  }

  if (showUpload) {
    return (
      <div className="min-h-screen bg-slate-950">
        <header className="h-14 bg-slate-900 border-b border-slate-700/50 flex items-center px-6">
          <h1 className="text-sm font-semibold text-slate-100">Honeywell Vocollect Log Parser</h1>
          <button
            onClick={() => setShowUpload(false)}
            className="ml-auto px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            ← Back to Dashboard
          </button>
        </header>
        <UploadZone onUploadComplete={handleUploadComplete} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="h-14 bg-slate-900 border-b border-slate-700/50 flex items-center px-6 shrink-0">
        <h1 className="text-sm font-semibold text-slate-100">Honeywell Vocollect Log Parser</h1>
        <div className="ml-auto flex items-center gap-2">
          {selectedSerial && <ExportButtons serial={selectedSerial} />}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <DeviceSidebar
          devices={devices}
          selected={selectedSerial}
          onSelect={(s) => { setSelectedSerial(s); setActiveTab('overview'); }}
          onUploadClick={() => setShowUpload(true)}
        />

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <TabBar active={activeTab} onChange={setActiveTab} />
          <div className="flex-1 overflow-y-auto">
            {selectedSerial && activeTab === 'overview' && <OverviewTab serial={selectedSerial} />}
            {selectedSerial && activeTab === 'battery' && <BatteryTab serial={selectedSerial} />}
            {selectedSerial && activeTab === 'wifi' && <WifiRoamingTab serial={selectedSerial} />}
            {selectedSerial && activeTab === 'anomalies' && <AnomaliesTab serial={selectedSerial} />}
            {selectedSerial && activeTab === 'timeline' && <TimelineTab serial={selectedSerial} />}
            {selectedSerial && activeTab === 'rawlog' && <RawLogTab serial={selectedSerial} />}
          </div>
        </main>
      </div>
    </div>
  );
}
