import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ToastNotification } from '../shared/types.js';
import {
  AlertTriangle,
  XCircle,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  Trash2,
  BellRing,
} from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  onClearAll,
}) => {
  if (toasts.length === 0) return null;

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  const getIcon = (type: ToastNotification['type']) => {
    switch (type) {
      case 'error':
        return <XCircle className="w-5 h-5 text-rose-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-[#38BDF8] shrink-0" />;
    }
  };

  const getStyleClasses = (type: ToastNotification['type']) => {
    switch (type) {
      case 'error':
        return {
          container: 'bg-[#180C10] border-rose-500/80 shadow-[0_4px_20px_rgba(244,63,94,0.25)]',
          badge: 'bg-rose-500 text-black',
          title: 'text-rose-200',
          message: 'text-rose-300/80',
          actionBtn: 'bg-rose-500 hover:bg-rose-400 text-black',
        };
      case 'warning':
        return {
          container: 'bg-[#18130C] border-amber-500/80 shadow-[0_4px_20px_rgba(245,158,11,0.2)]',
          badge: 'bg-amber-500 text-black',
          title: 'text-amber-200',
          message: 'text-amber-300/80',
          actionBtn: 'bg-amber-500 hover:bg-amber-400 text-black',
        };
      case 'success':
        return {
          container: 'bg-[#0C1A14] border-emerald-500/80 shadow-[0_4px_20px_rgba(16,185,129,0.2)]',
          badge: 'bg-emerald-500 text-black',
          title: 'text-emerald-200',
          message: 'text-emerald-300/80',
          actionBtn: 'bg-emerald-500 hover:bg-emerald-400 text-black',
        };
      case 'info':
      default:
        return {
          container: 'bg-[#0C151D] border-[#38BDF8]/80 shadow-[0_4px_20px_rgba(56,189,248,0.2)]',
          badge: 'bg-[#38BDF8] text-black',
          title: 'text-sky-200',
          message: 'text-sky-300/80',
          actionBtn: 'bg-[#38BDF8] hover:bg-sky-300 text-black',
        };
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full px-4 pointer-events-none font-sans">
      {/* Clear All Floating Header if > 1 toasts */}
      {toasts.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="pointer-events-auto flex items-center justify-between bg-[#12141A]/95 border border-[#22262E] backdrop-blur-md px-3 py-1.5 rounded-sm shadow-lg text-xs"
        >
          <div className="flex items-center gap-2 text-[#94A3B8] font-mono font-semibold text-[11px]">
            <BellRing className="w-3.5 h-3.5 text-[#38BDF8] animate-bounce" />
            <span>CRITICAL NOTIFICATIONS ({toasts.length})</span>
          </div>

          <button
            onClick={onClearAll}
            className="flex items-center gap-1 text-[11px] font-mono text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 px-2 py-0.5 rounded transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>DISMISS ALL</span>
          </button>
        </motion.div>
      )}

      {/* Toast Notification Items List */}
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const styles = getStyleClasses(toast.type);

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`pointer-events-auto border rounded-sm p-3.5 relative flex items-start gap-3 transition-all ${styles.container}`}
            >
              {/* Type Icon */}
              <div className="mt-0.5">{getIcon(toast.type)}</div>

              {/* Content Body */}
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className={`text-xs font-bold font-mono tracking-tight uppercase ${styles.title}`}>
                    {toast.title}
                  </h4>
                  <span className="text-[10px] font-mono text-[#94A3B8] shrink-0">
                    {getTimeAgo(toast.timestamp)}
                  </span>
                </div>

                <p className={`text-xs font-sans leading-relaxed ${styles.message}`}>
                  {toast.message}
                </p>

                {/* Optional Action Button */}
                {toast.actionLabel && toast.onAction && (
                  <div className="mt-2.5">
                    <button
                      onClick={() => {
                        toast.onAction?.();
                        onDismiss(toast.id);
                      }}
                      className={`text-[11px] font-mono font-extrabold px-2.5 py-1 rounded-xs transition-all cursor-pointer shadow-sm active:scale-95 ${styles.actionBtn}`}
                    >
                      {toast.actionLabel}
                    </button>
                  </div>
                )}
              </div>

              {/* Persistent Dismiss / Close Button */}
              <button
                onClick={() => onDismiss(toast.id)}
                className="absolute top-2.5 right-2.5 p-1 text-[#94A3B8] hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                title="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
