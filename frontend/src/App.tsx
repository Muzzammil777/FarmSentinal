import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { LogsPage } from './pages/LogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { fetchSensorStatus, fetchDetectionStatus, fetchSettings } from './services/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AppContent: React.FC = () => {
  const { data: sensorStatus } = useQuery({
    queryKey: ['sensorStatus'],
    queryFn: fetchSensorStatus,
    refetchInterval: 1000,
  });

  const { data: detectionStatus } = useQuery({
    queryKey: ['detectionStatus'],
    queryFn: fetchDetectionStatus,
    refetchInterval: 1000,
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  return (
    <div className="min-h-screen bg-[#f2fbf5] text-emerald-950 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      <Navbar sensorStatus={sensorStatus} detectionStatus={detectionStatus} settings={settings} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      <footer className="glass-card rounded-none border-t border-emerald-200/80 bg-white/80 py-4 px-6 text-center text-xs font-semibold text-emerald-800/80 shadow-xs">
        🌱 FarmSentinal &bull; Smart Agricultural &amp; Wildlife Intrusion Prevention &bull; ESP8266 + XIAO ESP32S3 + YOLOv8 Nano
      </footer>

      <Toaster position="bottom-right" theme="light" richColors />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppContent />
      </Router>
    </QueryClientProvider>
  );
};

export default App;
