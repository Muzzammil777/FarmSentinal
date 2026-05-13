import { useCallback, useEffect, useRef, useState } from 'react';
import { getSensorData, resetSensorAlert } from '../services/api';

const HISTORY_LIMIT = 12;

export function useSensorData(pollingInterval = 1000) {
  const [sensorData, setSensorData] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeAlert, setActiveAlert] = useState(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isDeviceOffline, setIsDeviceOffline] = useState(false);
  const lastAlertKeyRef = useRef('');
  const lastSnapshotRef = useRef(null);
  const mountedRef = useRef(true);
  const pollingTimerRef = useRef(null);
  const inFlightRequestRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollingTimerRef.current) {
        window.clearTimeout(pollingTimerRef.current);
      }
    };
  }, []);

  const loadSensorData = useCallback(async ({ silent = false } = {}) => {
    if (inFlightRequestRef.current) {
      return null;
    }

    inFlightRequestRef.current = true;
    if (!silent) {
      setIsRefreshing(true);
    }
    setError('');

    try {
      const snapshot = await getSensorData();
      if (!mountedRef.current) {
        return snapshot;
      }

      const previousSnapshot = lastSnapshotRef.current;
      const hasMeaningfulChange =
        !previousSnapshot ||
        previousSnapshot.distanceCm !== snapshot.distanceCm ||
        previousSnapshot.alert !== snapshot.alert ||
        previousSnapshot.connected !== snapshot.connected;

      if (hasMeaningfulChange) {
        console.log('[sensor-hook] state update', {
          previous: previousSnapshot,
          next: snapshot,
        });

        lastSnapshotRef.current = snapshot;
        setSensorData(snapshot);
        setIsDeviceOffline(!snapshot.connected);

        if (snapshot.distanceCm !== null && snapshot.distanceCm !== undefined) {
          setHistory((currentHistory) => {
            const nextHistory = [...currentHistory, { value: snapshot.distanceCm, timestamp: snapshot.lastUpdated }];
            return nextHistory.slice(-HISTORY_LIMIT);
          });
        }

        if (snapshot.alert) {
          if (snapshot.alertKey !== lastAlertKeyRef.current) {
            lastAlertKeyRef.current = snapshot.alertKey;
            setActiveAlert(snapshot);
            setIsAlertOpen(true);
          }
        } else {
          lastAlertKeyRef.current = '';
          setIsAlertOpen(false);
        }
      } else {
        console.log('[sensor-hook] snapshot unchanged', snapshot);
      }

      setIsDeviceOffline((currentValue) => (snapshot.connected ? false : currentValue));
      setError((currentValue) => (currentValue ? '' : currentValue));
      return snapshot;
    } catch (loadError) {
      console.error('[sensor-hook] load failed', loadError);
      if (mountedRef.current) {
        const message = loadError instanceof Error ? loadError.message : 'Unable to load sensor data.';
        const isNetworkFailure =
          loadError instanceof TypeError ||
          message.includes('Failed to fetch') ||
          message.includes('NetworkError');

        setIsDeviceOffline(true);
        setError(isNetworkFailure ? 'Device Offline' : message);
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        if (!silent) {
          setIsRefreshing(false);
        }
      }
      inFlightRequestRef.current = false;
    }
  }, []);

  const acknowledgeAlert = useCallback(async () => {
    if (!activeAlert) {
      return;
    }

    await resetSensorAlert();
    lastAlertKeyRef.current = activeAlert.alertKey;
    setIsAlertOpen(false);
    setActiveAlert(null);
  }, [activeAlert]);

  useEffect(() => {
    let cancelled = false;

    const poll = async (silent = true) => {
      await loadSensorData({ silent });

      if (cancelled || !mountedRef.current || !pollingInterval) {
        return;
      }

      pollingTimerRef.current = window.setTimeout(() => {
        void poll(true);
      }, pollingInterval);
    };

    void poll(false);

    return () => {
      cancelled = true;
      if (pollingTimerRef.current) {
        window.clearTimeout(pollingTimerRef.current);
      }
    };
  }, [loadSensorData, pollingInterval]);

  return {
    sensorData,
    history,
    activeAlert,
    isAlertOpen,
    isLoading,
    isRefreshing,
    error,
    isDeviceOffline,
    refresh: loadSensorData,
    acknowledgeAlert,
    closeAlert: () => setIsAlertOpen(false),
  };
}
