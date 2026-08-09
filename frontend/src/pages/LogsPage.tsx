import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  History,
  Download,
  Trash2,
  Search,
  Filter,
  AlertTriangle,
  Zap,
  Volume2,
  RefreshCw,
  Sparkles,
  Trees,
} from 'lucide-react';
import { fetchLogs, clearLogs } from '../services/api';
import { ANIMAL_CLASSES } from '../types';

export const LogsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [animalFilter, setAnimalFilter] = useState<string>('all');

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['logs'],
    queryFn: fetchLogs,
    refetchInterval: 2000,
  });

  const clearMutation = useMutation({
    mutationFn: clearLogs,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      toast.success('Intrusion logs history cleared');
    },
    onError: () => toast.error('Failed to clear logs'),
  });

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      (log.animal && log.animal.toLowerCase().includes(searchTerm.toLowerCase())) ||
      log.timestamp.includes(searchTerm) ||
      (log.action_taken && log.action_taken.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesAnimal =
      animalFilter === 'all' || (log.animal && log.animal.toLowerCase() === animalFilter.toLowerCase());

    return matchesSearch && matchesAnimal;
  });

  // Calculate Summary Statistics
  const totalIntrusions = logs.length;
  const animalCounts: Record<string, number> = {};
  let totalConfidence = 0;
  let confCount = 0;

  logs.forEach((log) => {
    if (log.animal) {
      animalCounts[log.animal] = (animalCounts[log.animal] || 0) + 1;
    }
    if (log.confidence) {
      totalConfidence += log.confidence;
      confCount += 1;
    }
  });

  let topIntruder = 'None';
  let maxCount = 0;
  Object.entries(animalCounts).forEach(([animal, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topIntruder = animal.toUpperCase();
    }
  });

  const avgConfidence = confCount > 0 ? Math.round((totalConfidence / confCount) * 100) : 0;

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error('No logs available to export');
      return;
    }

    const headers = ['ID', 'Timestamp', 'Animal', 'Confidence %', 'Distance (cm)', 'Alert', 'LED State', 'Buzzer State', 'Action Taken'];
    const rows = filteredLogs.map((log) => [
      log.id,
      log.timestamp,
      log.animal || 'N/A',
      log.confidence ? `${Math.round(log.confidence * 100)}%` : 'N/A',
      log.distance !== null ? log.distance : 'N/A',
      log.alert ? 'YES' : 'NO',
      log.led_state ? 'ON' : 'OFF',
      log.buzzer_state ? 'ON' : 'OFF',
      `"${log.action_taken}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `farmsentinal_intrusion_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV log report exported successfully!');
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-2xl bg-amber-100 text-amber-700 border border-amber-300">
            <History className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-emerald-950">Intrusion Event Audit Logs</h2>
            <p className="text-sm font-semibold text-emerald-700/80">Historical records of AI detections, ultrasonic alerts, and auto deterrent actions</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-2xl bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 transition-colors shadow-xs"
            title="Refresh Logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-md shadow-emerald-600/20"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to clear all intrusion logs?')) {
                clearMutation.mutate();
              }
            }}
            disabled={logs.length === 0}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 hover:border-rose-300 font-bold text-xs transition-all disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">Total Intrusions Logged</div>
          <div className="text-3xl font-black text-emerald-950">{totalIntrusions}</div>
        </div>

        <div className="glass-card p-5">
          <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1 flex items-center space-x-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Top Intruder Class</span>
          </div>
          <div className="text-3xl font-black text-amber-700">{topIntruder}</div>
        </div>

        <div className="glass-card p-5">
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">Average Detection Conf.</div>
          <div className="text-3xl font-black text-emerald-700">{avgConfidence}%</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-emerald-600" />
          <input
            type="text"
            placeholder="Search by animal, time, or action..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-emerald-50/60 border border-emerald-200 text-emerald-950 font-bold rounded-xl pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-emerald-700" />
          <select
            value={animalFilter}
            onChange={(e) => setAnimalFilter(e.target.value)}
            className="bg-emerald-50/60 border border-emerald-200 text-emerald-950 font-bold rounded-xl px-3 py-2 text-sm outline-none cursor-pointer"
          >
            <option value="all">All Animals</option>
            {ANIMAL_CLASSES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Data */}
      <div className="glass-card overflow-hidden border border-emerald-200/80">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-emerald-950">
            <thead className="bg-emerald-100/70 text-xs uppercase text-emerald-900 font-black border-b border-emerald-200">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Animal Class</th>
                <th className="px-6 py-4">Confidence</th>
                <th className="px-6 py-4">Sensor Distance</th>
                <th className="px-6 py-4">Proximity Alert</th>
                <th className="px-6 py-4">Deterrents Active</th>
                <th className="px-6 py-4">Action Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-emerald-700 font-bold">
                    Loading intrusion log history...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-emerald-700 font-bold">
                    No intrusion logs matching current filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-emerald-50/60 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-bold text-emerald-800 whitespace-nowrap">{log.timestamp}</td>
                    <td className="px-6 py-4 font-black text-emerald-950 uppercase flex items-center space-x-2">
                      <span>{log.animal ? log.animal : 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {log.confidence ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-black">
                          {Math.round(log.confidence * 100)}%
                        </span>
                      ) : (
                        '--'
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-emerald-900 font-bold">
                      {log.distance !== null ? `${log.distance.toFixed(1)} cm` : '--'}
                    </td>
                    <td className="px-6 py-4">
                      {log.alert ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>ALERT</span>
                        </span>
                      ) : (
                        <span className="text-emerald-700 text-xs font-bold">Normal</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`p-1 rounded-md ${
                            log.led_state ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-400'
                          }`}
                          title="LED State"
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </span>
                        <span
                          className={`p-1 rounded-md ${
                            log.buzzer_state ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-slate-100 text-slate-400'
                          }`}
                          title="Buzzer State"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-emerald-900">{log.action_taken}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
