'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  VaultStats,
  VaultAllData,
  WatchersResponse,
  LogsResponse,
  Briefing,
} from '@/types/vault';
import {
  fetchVaultStats,
  fetchVaultAll,
  fetchWatchers,
  fetchLogs,
  fetchBriefings,
} from '@/lib/api';

// Hook for fetching vault stats with auto-refresh
export function useVaultStats(refreshInterval: number = 30000) {
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchVaultStats();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (refreshInterval > 0) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refresh, refreshInterval]);

  return { stats, loading, error, refresh };
}

// Hook for fetching all vault data with auto-refresh
export function useVaultAll(refreshInterval: number = 30000) {
  const [data, setData] = useState<VaultAllData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchVaultAll();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vault data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (refreshInterval > 0) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refresh, refreshInterval]);

  return { data, loading, error, refresh };
}

// Hook for fetching watcher status with auto-refresh
export function useWatchers(refreshInterval: number = 10000) {
  const [data, setData] = useState<WatchersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchWatchers();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch watchers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (refreshInterval > 0) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refresh, refreshInterval]);

  return { data, loading, error, refresh };
}

// Hook for fetching audit logs
export function useLogs(days: number = 7, actionType?: string) {
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchLogs(days, actionType);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, [days, actionType]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

// Hook for fetching briefings
export function useBriefings(refreshInterval: number = 60000) {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchBriefings();
      setBriefings(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch briefings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (refreshInterval > 0) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refresh, refreshInterval]);

  return { briefings, loading, error, refresh };
}

// Combined hook for dashboard data
export function useDashboardData(refreshInterval: number = 30000) {
  const { stats, loading: statsLoading, error: statsError, refresh: refreshStats } = useVaultStats(refreshInterval);
  const { data: watchersData, loading: watchersLoading, error: watchersError, refresh: refreshWatchers } = useWatchers(refreshInterval);

  const refresh = useCallback(() => {
    refreshStats();
    refreshWatchers();
  }, [refreshStats, refreshWatchers]);

  return {
    stats,
    watchers: watchersData?.watchers || [],
    systemStatus: watchersData?.systemStatus,
    loading: statsLoading || watchersLoading,
    error: statsError || watchersError,
    refresh,
  };
}
