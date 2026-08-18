import React, { useState } from 'react';
import { SimulationConfig, SystemStatus } from '../shared/types.js';
import { PlaySquare, Pause, RotateCcw, AlertTriangle, Sliders, Activity } from 'lucide-react';

interface SimulationViewProps {
  status: SystemStatus | null;
  onStartSimulation: (config: SimulationConfig) => void;
  onPauseSimulation: () => void;
}

export const SimulationView: React.FC<SimulationViewProps> = ({
  status,
  onStartSimulation,
  onPauseSimulation,
}) => {
  const [config, setConfig] = useState<SimulationConfig>({
    workerCount: 4,
    cpuCapacity: 8,
    ramCapacity: 16384,
    failureProbability: 5,
    jobArrivalRateMs: 3000,
    jobComplexity: 5,
  });

  const handleStart = () => {
    onStartSimulation(config);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <PlaySquare className="w-5 h-5 text-amber-400" />
            Distributed Cluster Simulation Control Engine
          </h1>
          <p className="text-xs text-slate-400">
            Generate continuous computational job workloads and fault-injection scenarios connected to the live scheduler.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {status?.simulationActive ? (
            <button
              onClick={onPauseSimulation}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2.5 rounded-lg text-xs shadow-lg shadow-amber-500/20 transition-all"
            >
              <Pause className="w-4 h-4 fill-slate-950" />
              <span>Pause Simulation</span>
            </button>
          ) : (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold px-5 py-2.5 rounded-lg text-xs shadow-lg shadow-emerald-500/20 transition-all"
            >
              <PlaySquare className="w-4 h-4" />
              <span>Start Live Simulation</span>
            </button>
          )}
        </div>
      </div>

      {/* Config Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 font-mono">
          <Sliders className="w-4 h-4 text-cyan-400" />
          Simulation Parameters
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
          {/* Job Arrival Rate */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <label className="text-slate-400 font-bold block flex justify-between">
              <span>Job Arrival Interval</span>
              <span className="text-cyan-400">{config.jobArrivalRateMs} ms</span>
            </label>
            <input
              type="range"
              min="1000"
              max="10000"
              step="500"
              value={config.jobArrivalRateMs}
              onChange={(e) =>
                setConfig({ ...config, jobArrivalRateMs: parseInt(e.target.value) })
              }
              className="w-full accent-cyan-500"
            />
            <span className="text-[10px] text-slate-500 block">
              Submits a new job every {(config.jobArrivalRateMs / 1000).toFixed(1)} seconds
            </span>
          </div>

          {/* Job Complexity */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <label className="text-slate-400 font-bold block flex justify-between">
              <span>Job Complexity Level</span>
              <span className="text-purple-400">{config.jobComplexity}x</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={config.jobComplexity}
              onChange={(e) => setConfig({ ...config, jobComplexity: parseInt(e.target.value) })}
              className="w-full accent-purple-500"
            />
            <span className="text-[10px] text-slate-500 block">
              Scales matrix size, prime ranges, array sizes & tensor layers
            </span>
          </div>

          {/* Failure Probability */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <label className="text-slate-400 font-bold block flex justify-between">
              <span>Node Failure Injection Rate</span>
              <span className="text-rose-400">{config.failureProbability}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="25"
              value={config.failureProbability}
              onChange={(e) =>
                setConfig({ ...config, failureProbability: parseInt(e.target.value) })
              }
              className="w-full accent-rose-500"
            />
            <span className="text-[10px] text-slate-500 block">
              Probability of random worker crash during execution
            </span>
          </div>
        </div>
      </div>

      {/* Live Simulation Status Callout */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 font-mono text-xs space-y-3">
        <h3 className="font-bold text-slate-200 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          Live Simulation State
        </h3>
        <p className="text-slate-400 text-[11px] font-sans">
          When active, the simulation engine generates real computational workloads and dispatches them through the Main Node, Scheduler, and Worker nodes using the active scheduling algorithm.
        </p>
      </div>
    </div>
  );
};
