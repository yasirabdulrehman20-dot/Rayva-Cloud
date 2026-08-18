import React, { useState, useEffect } from 'react';
import {
  Database,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  FolderArchive,
  RotateCcw,
  X,
  ShieldCheck,
  HardDrive,
  Clock,
  Check,
  FileCheck2,
  Zap,
} from 'lucide-react';

interface DatabaseStatusData {
  dbPath: string;
  exists: boolean;
  sizeBytes: number;
  status: 'HEALTHY' | 'CORRUPT' | 'NO_DB';
  healthy: boolean;
  message: string;
  details?: string;
  backupCount: number;
  backups: Array<{
    filename: string;
    path: string;
    sizeBytes: number;
    createdAt: string;
  }>;
}

interface DatabaseRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshSystem?: () => void;
  onAddToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const DatabaseRecoveryModal: React.FC<DatabaseRecoveryModalProps> = ({
  isOpen,
  onClose,
  onRefreshSystem,
  onAddToast,
}) => {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [dbStatus, setDbStatus] = useState<DatabaseStatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);
  const [recoverySuccessMessage, setRecoverySuccessMessage] = useState<string | null>(null);

  const fetchDbStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/system/database/status');
      const json = await res.json();
      if (res.ok && json.data) {
        setDbStatus(json.data);
      } else {
        setError(json.error || 'Failed to fetch database status.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error checking database status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDbStatus();
      setConfirmStep(false);
      setRecoverySuccessMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunCheck = async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch('/api/system/database/check', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        await fetchDbStatus();
        if (onAddToast) {
          onAddToast(
            'INTEGRITY CHECK COMPLETE',
            `Status: ${json.data?.status} - ${json.data?.message}`,
            json.data?.healthy ? 'success' : 'warning'
          );
        }
      } else {
        setError(json.error || 'Integrity check failed.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to run integrity check.');
    } finally {
      setChecking(false);
    }
  };

  const handleTriggerRecovery = async () => {
    setRecovering(true);
    setError(null);
    setRecoverySuccessMessage(null);
    try {
      const res = await fetch('/api/system/database/recover', { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.data) {
        setRecoverySuccessMessage(json.data.message || 'Database cleanly re-initialized.');
        if (onAddToast) {
          onAddToast(
            'DATABASE RECOVERY SUCCESSFUL',
            `Backed up to: ${json.data.backupPath || 'backups/'}. Fresh database re-initialized.`,
            'success'
          );
        }
        await fetchDbStatus();
        if (onRefreshSystem) {
          onRefreshSystem();
        }
        setConfirmStep(false);
      } else {
        setError(json.error || 'Database recovery failed.');
        if (onAddToast) {
          onAddToast('RECOVERY FAILED', json.error || 'Failed to recover database', 'error');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Network error triggering database recovery.');
    } finally {
      setRecovering(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center p-4 pt-16 sm:pt-20 pb-12 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] flex flex-col font-sans my-auto">
        {/* Top Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-950/80 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">Database Recovery & Diagnostics</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  SQLITE UTILITY
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Detect malformed database files, preserve backups, & trigger clean re-initialization
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
          {/* Status Indicator Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
              dbStatus?.healthy
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : dbStatus?.status === 'CORRUPT'
                ? 'bg-rose-950/60 border-rose-500/50 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-300'
            }`}
          >
            {dbStatus?.healthy ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : dbStatus?.status === 'CORRUPT' ? (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
            ) : (
              <HardDrive className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            )}

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold uppercase tracking-wider text-xs">
                  {dbStatus?.healthy
                    ? 'DATABASE STATUS: HEALTHY & VERIFIED'
                    : dbStatus?.status === 'CORRUPT'
                    ? 'DATABASE STATUS: CORRUPT / MALFORMED FILE DETECTED'
                    : 'DATABASE STATUS: UNKNOWN / INITIALIZING'}
                </span>
                <button
                  onClick={fetchDbStatus}
                  disabled={loading}
                  className="text-[10px] font-mono text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700"
                  title="Refresh status"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              <p className="text-xs text-slate-300 font-sans">{dbStatus?.message || 'Checking database parameters...'}</p>

              {dbStatus?.details && (
                <div className="mt-2 text-[11px] font-mono bg-slate-950/60 p-2 rounded border border-slate-800/80 text-slate-400">
                  {dbStatus.details}
                </div>
              )}

              {dbStatus && (
                <div className="mt-2 pt-2 border-t border-slate-800/60 grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">DB File Path:</span>
                    <span className="text-slate-200 truncate block font-bold" title={dbStatus.dbPath}>
                      rayva_cloud_db.sqlite
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Disk Size:</span>
                    <span className="text-slate-200 block font-bold">{formatBytes(dbStatus.sizeBytes)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Backups Preserved:</span>
                    <span className="text-sky-400 block font-bold">{dbStatus.backupCount} Archives</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-lg text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {recoverySuccessMessage && (
            <div className="p-3.5 bg-emerald-950/80 border border-emerald-500/50 rounded-lg text-emerald-300 text-xs font-mono flex items-start gap-2.5 shadow-lg">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-200">RECOVERY & RE-INITIALIZATION COMPLETE</p>
                <p className="text-[11px] text-emerald-300/90 mt-0.5">{recoverySuccessMessage}</p>
              </div>
            </div>
          )}

          {/* Diagnostics Section */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-sky-400" />
                <h3 className="font-bold text-slate-200 text-xs">SQLite Integrity Diagnostics</h3>
              </div>
              <button
                onClick={handleRunCheck}
                disabled={checking}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 border border-slate-700 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Zap className={`w-3.5 h-3.5 ${checking ? 'animate-bounce text-amber-400' : ''}`} />
                <span>{checking ? 'Running PRAGMA...' : 'Run Diagnostics'}</span>
              </button>
            </div>
            <p className="text-[11px] font-sans text-slate-400">
              Executes <code className="text-sky-300 bg-slate-900 px-1 py-0.5 rounded">PRAGMA integrity_check</code> and
              tests core table schemas (users, jobs, workers) to detect header or byte corruption.
            </p>
          </div>

          {/* Automatic Backups & Moved Files */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderArchive className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-slate-200 text-xs">Preserved Backups & Moved Files</h3>
              </div>
              <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                Directory: /backups
              </span>
            </div>

            {dbStatus?.backups && dbStatus.backups.length > 0 ? (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {dbStatus.backups.map((bk, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800 text-[11px]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-slate-200 font-bold truncate" title={bk.path}>
                        {bk.filename}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-slate-400 text-[10px]">
                      <span>{formatBytes(bk.sizeBytes)}</span>
                      <span>{new Date(bk.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] font-sans text-slate-500 italic py-1">
                No archived backups found in the backup folder yet. Recovery operations automatically archive previous database
                files here.
              </p>
            )}
          </div>

          {/* Database Recovery Execution Card */}
          <div className="bg-slate-950/80 border border-rose-500/30 rounded-xl p-4 space-y-3 font-sans relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-sky-500" />

            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2 font-mono">
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  <span>Execute Database Recovery</span>
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  If the SQLite database file is corrupted or causing startup issues, this action will automatically move the
                  file to the backup folder (<code className="text-amber-300 font-mono">/backups</code>) and create a fresh, clean
                  database with the default admin account (<code className="text-sky-300 font-mono">admin@rayva.io</code>) initialized via{' '}
                  <code className="text-sky-300 font-mono">RAYVA_ADMIN_PASSWORD</code>.
                </p>
              </div>
            </div>

            {confirmStep ? (
              <div className="p-3 bg-amber-950/80 border border-amber-500/50 rounded-lg space-y-3 font-mono">
                <div className="flex items-start gap-2 text-amber-200 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>CONFIRMATION REQUIRED:</strong> Existing database state will be safely backed up to{' '}
                    <code className="text-amber-300">/backups</code> and the cluster will re-initialize with fresh default schema.
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setConfirmStep(false)}
                    disabled={recovering}
                    className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs cursor-pointer font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTriggerRecovery}
                    disabled={recovering}
                    className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs cursor-pointer flex items-center gap-1.5 shadow-md"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${recovering ? 'animate-spin' : ''}`} />
                    <span>{recovering ? 'RECOVERING & INITIALIZING...' : 'CONFIRM & RECOVER DATABASE'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400 font-mono">Preserves all prior state in backup archives</span>
                <button
                  onClick={() => setConfirmStep(true)}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-slate-950 font-extrabold text-xs rounded-lg transition-all shadow-md cursor-pointer flex items-center gap-2 font-mono"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>TRIGGER RECOVERY & CLEAN RE-INIT</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-xs text-slate-400 font-mono shrink-0">
          <span>Rayva Cloud System Maintenance & Safety Utility</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors cursor-pointer"
          >
            Close Utility
          </button>
        </div>
      </div>
    </div>
  );
};
