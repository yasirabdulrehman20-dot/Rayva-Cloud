import React, { useState } from 'react';
import { Terminal, Send, HelpCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export const CliView: React.FC = () => {
  const { token } = useAuth();
  const [command, setCommand] = useState('');
  const [outputHistory, setOutputHistory] = useState<
    { cmd: string; result: string; timestamp: number }[]
  >([
    {
      cmd: 'rayva system status',
      result: `RAYVA CLOUD SYSTEM STATUS\n=========================\nType 'rayva help' for a list of available commands.`,
      timestamp: Date.now(),
    },
  ]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    const cmdStr = command.trim();
    setCommand('');
    setLoading(true);

    try {
      const res = await fetch('/api/cli/exec', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ command: cmdStr }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `CLI request failed with status ${res.status}`);
      }
      setOutputHistory((prev) => [
        { cmd: cmdStr, result: data.output || 'No output', timestamp: Date.now() },
        ...prev,
      ]);
    } catch (err: any) {
      setOutputHistory((prev) => [
        { cmd: cmdStr, result: `CLI Execution Error: ${err.message}`, timestamp: Date.now() },
        ...prev,
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sampleCommands = [
    'rayva system status',
    'rayva worker list',
    'rayva job list',
    'rayva scheduler status',
    'rayva about',
    'rayva job submit --type MATRIX_OPS --name "Benchmark Job" --priority CRITICAL',
  ];

  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto font-sans text-[#E2E8F0]">
      {/* Header */}
      <div>
        <h1 className="text-base font-bold text-white flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#38BDF8]" />
          Rayva Cloud Command Line Interface (CLI)
        </h1>
        <p className="text-xs text-[#94A3B8]">
          Interactive CLI console communicating with the unified cluster backend.
        </p>
      </div>

      {/* Preset Command Shortcuts */}
      <div className="flex flex-wrap gap-2 text-xs font-mono">
        <span className="text-slate-500 py-1 flex items-center gap-1 font-sans">
          <HelpCircle className="w-3.5 h-3.5" /> Quick Shortcuts:
        </span>
        {sampleCommands.map((cmd, i) => (
          <button
            key={i}
            onClick={() => setCommand(cmd)}
            className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:border-cyan-500 hover:text-cyan-400 transition-colors"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Terminal Window */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[550px]">
        {/* Terminal Header */}
        <div className="bg-[#12141A] border-b border-[#22262E] px-4 py-2 flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
          <span className="text-xs font-mono text-[#94A3B8] font-bold ml-2">rayva-cli v1.0</span>
        </div>

        {/* Terminal Output Stream */}
        <div className="flex-1 p-4 font-mono text-xs space-y-4 overflow-y-auto">
          {outputHistory.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center gap-2 text-cyan-400 font-bold">
                <span>$</span>
                <span>{item.cmd}</span>
                <span className="text-[10px] text-slate-600 font-normal">
                  [{new Date(item.timestamp).toLocaleTimeString()}]
                </span>
              </div>
              <pre className="text-slate-300 text-[11px] whitespace-pre-wrap font-mono pl-4 border-l border-slate-800">
                {item.result}
              </pre>
            </div>
          ))}
        </div>

        {/* Command Input Bar */}
        <form onSubmit={handleSubmit} className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
          <span className="text-cyan-400 font-mono font-bold flex items-center pl-2">$</span>
          <input
            type="text"
            placeholder="Type 'rayva help' or enter command..."
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            disabled={loading}
            className="flex-1 bg-transparent text-slate-100 font-mono text-xs focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
