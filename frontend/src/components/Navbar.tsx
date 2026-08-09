import React from 'react';
import { NavLink } from 'react-router-dom';
import { ShieldAlert, LayoutDashboard, History, Settings, Activity, Cpu, Radio, Sprout, Trees } from 'lucide-react';
import { SensorStatus, AppSettings, DetectionStatus } from '../types';

interface NavbarProps {
  sensorStatus?: SensorStatus;
  detectionStatus?: DetectionStatus;
  settings?: AppSettings;
}

export const Navbar: React.FC<NavbarProps> = ({ sensorStatus, settings }) => {
  return (
    <header className="sticky top-0 z-50 glass-card border-b border-emerald-200/80 rounded-none bg-white/85 px-4 lg:px-8 py-3.5 backdrop-blur-md shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand Header */}
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25">
            <Trees className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-emerald-950 via-emerald-800 to-green-600 bg-clip-text text-transparent">
                FarmSentinal
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                🌱 Niral Thiruvizha
              </span>
            </div>
            <p className="text-xs font-medium text-emerald-700/80">Smart Agricultural &amp; Wildlife Intrusion Monitor</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1.5 glass-pill p-1.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/60 shadow-inner">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center space-x-2 px-4 py-2 text-sm font-bold rounded-xl transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 border border-emerald-500'
                  : 'text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100/60'
              }`
            }
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/logs"
            className={({ isActive }) =>
              `flex items-center space-x-2 px-4 py-2 text-sm font-bold rounded-xl transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 border border-emerald-500'
                  : 'text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100/60'
              }`
            }
          >
            <History className="w-4 h-4" />
            <span>Intrusion Logs</span>
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center space-x-2 px-4 py-2 text-sm font-bold rounded-xl transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 border border-emerald-500'
                  : 'text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100/60'
              }`
            }
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </NavLink>
        </nav>

        {/* Status Chips */}
        <div className="flex items-center space-x-2 text-xs">
          {/* Backend Status */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-200/80 shadow-xs">
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-emerald-800 font-medium">Backend:</span>
            <span className="flex items-center space-x-1 text-emerald-600 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping" />
              <span>Online</span>
            </span>
          </div>

          {/* ESP8266 Sensor Status */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-200/80 shadow-xs">
            <Radio className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-emerald-800 font-medium">ESP8266:</span>
            <span className={`font-bold ${sensorStatus?.online ? 'text-emerald-600' : 'text-rose-600'}`}>
              {sensorStatus?.online ? (settings?.simulation_mode ? 'Simulated' : 'Online') : 'Offline'}
            </span>
          </div>

          {/* YOLO AI Engine Status */}
          <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-200/80 shadow-xs">
            <Cpu className="w-3.5 h-3.5 text-teal-600" />
            <span className="text-emerald-800 font-medium">YOLOv8:</span>
            <span className="text-teal-700 font-bold">Nano</span>
          </div>
        </div>
      </div>
    </header>
  );
};
