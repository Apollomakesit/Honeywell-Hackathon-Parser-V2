'use client';

import { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';

interface UploadZoneProps {
  onUploadComplete: () => void;
}

export default function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<{ name: string; status: string; error?: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      const items = Array.from(fileList).filter(
        (f) => f.name.endsWith('.txt') || f.name.endsWith('.zip')
      );
      if (!items.length) return;

      setUploading(true);
      const statuses: { name: string; status: string; error?: string }[] = items.map((f) => ({ name: f.name, status: 'uploading' }));
      setFiles(statuses);

      for (let i = 0; i < items.length; i++) {
        const form = new FormData();
        form.append('file', items[i]);

        try {
          const res = await fetch('/api/upload', { method: 'POST', body: form });
          const data = await res.json();

          if (!res.ok) {
            statuses[i] = { name: items[i].name, status: 'error', error: data.detail || data.error || 'Upload failed' };
          } else {
            statuses[i] = { name: items[i].name, status: 'done' };
          }
        } catch {
          statuses[i] = { name: items[i].name, status: 'error', error: 'Network error' };
        }

        setFiles([...statuses]);
      }

      setUploading(false);
      if (statuses.some((s) => s.status === 'done')) {
        onUploadComplete();
      }
    },
    [onUploadComplete]
  );

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={`max-w-xl w-full border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
          dragOver ? 'border-blue-500 bg-blue-500/5' : 'border-slate-600 hover:border-blue-500'
        }`}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
        <h3 className="text-xl font-semibold text-slate-100 mb-2">Drop log files here</h3>
        <p className="text-sm text-slate-400 mb-6">Supports .txt and .zip Vocollect Talkman log files</p>
        <input
          id="file-input"
          type="file"
          accept=".txt,.zip"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <button
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
          disabled={uploading}
        >
          {uploading ? 'Uploading...' : 'Select Files'}
        </button>
      </div>

      {files.length > 0 && (
        <div className="fixed bottom-6 right-6 bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-2xl min-w-72">
          <h4 className="text-sm font-medium text-slate-300 mb-2">Upload Progress</h4>
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs py-1">
              <span className={`w-2 h-2 rounded-full ${
                f.status === 'done' ? 'bg-emerald-500' :
                f.status === 'error' ? 'bg-red-500' :
                'bg-blue-500 animate-pulse'
              }`} />
              <span className="text-slate-300 truncate flex-1">{f.name}</span>
              {f.error && <span className="text-red-400 truncate max-w-40">{f.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
