import React from 'react';
import { Eye, AlertOctagon, CheckCircle2, Sparkles, Trees } from 'lucide-react';
import { DetectionStatus, ANIMAL_CLASSES } from '../types';

interface DetectionCardProps {
  detection: DetectionStatus | undefined;
}

export const DetectionCard: React.FC<DetectionCardProps> = ({ detection }) => {
  const isDetected = detection?.detected ?? false;
  const animalName = detection?.animal ?? null;
  const confidence = detection?.confidence ?? null;
  const timestamp = detection?.timestamp ?? null;

  const animalObj = ANIMAL_CLASSES.find((a) => a.id === animalName?.toLowerCase());
  const animalLabel = animalObj ? animalObj.label : animalName ? animalName.toUpperCase() : 'Unknown';

  return (
    <div
      className={`glass-card p-6 relative overflow-hidden transition-all duration-300 ${
        isDetected ? 'bg-amber-50/90 border-amber-300 shadow-amber-500/10' : 'glass-card-hover'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded-2xl ${isDetected ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
            <Trees className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-emerald-950 text-lg">AI Intruder Recognition</h3>
            <p className="text-xs text-emerald-700/80">YOLOv8 Nano continuous animal classification</p>
          </div>
        </div>

        {isDetected ? (
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-200/80 text-amber-900 border border-amber-400 animate-pulse">
            <AlertOctagon className="w-3.5 h-3.5 text-amber-700" />
            <span>Intruder Present</span>
          </span>
        ) : (
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Field Secure</span>
          </span>
        )}
      </div>

      {/* Main Large Indicator Card */}
      <div className={`my-2 p-6 rounded-2xl border text-center flex flex-col items-center justify-center space-y-3 min-h-[160px] ${
        isDetected ? 'bg-white/90 border-amber-300 shadow-sm' : 'bg-white/80 border-emerald-200/80 shadow-xs'
      }`}>
        {isDetected ? (
          <>
            <div className="text-5xl animate-bounce">{animalLabel.split(' ')[1] || '🐾'}</div>
            <div>
              <div className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1 flex items-center justify-center space-x-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Detected Intruder</span>
              </div>
              <h2 className="text-3xl font-black text-amber-950 tracking-tight uppercase">
                {animalName}
              </h2>
            </div>

            {confidence !== null && (
              <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-mono text-sm font-black shadow-xs">
                <span>Confidence:</span>
                <span className="text-base text-amber-950">{Math.round(confidence * 100)}%</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h4 className="text-xl font-black text-emerald-950">No Animal Detected</h4>
              <p className="text-xs text-emerald-700 mt-1">Monitoring crop boundaries &amp; forest perimeter...</p>
            </div>
          </>
        )}
      </div>

      <div className="text-right text-[11px] font-bold text-emerald-700/80 mt-2 font-mono">
        Last scan: {timestamp || 'Just now'}
      </div>
    </div>
  );
};
