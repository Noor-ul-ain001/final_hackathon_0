import type {
  VaultMoveRequest,
  VaultMoveResponse,
  BriefingGenerateRequest,
  BriefingGenerateResponse,
  VaultStats,
  VaultAllData,
  WatchersResponse,
  LogsResponse,
  Briefing,
} from '@/types/vault';

export async function moveVaultFile(request: VaultMoveRequest): Promise<VaultMoveResponse> {
  const res = await fetch('/api/vault/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return res.json();
}

export async function generateBriefing(request: BriefingGenerateRequest): Promise<BriefingGenerateResponse> {
  const res = await fetch('/api/briefings/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return res.json();
}

export async function fetchVaultStats(): Promise<VaultStats> {
  const res = await fetch('/api/vault?action=stats');
  const data = await res.json();
  return data.stats;
}

export async function fetchVaultAll(): Promise<VaultAllData> {
  const res = await fetch('/api/vault?action=all');
  return res.json();
}

export async function fetchWatchers(): Promise<WatchersResponse> {
  const res = await fetch('/api/watchers');
  return res.json();
}

export async function fetchLogs(days: number = 7, actionType?: string): Promise<LogsResponse> {
  const params = new URLSearchParams({ action: 'logs', days: String(days) });
  if (actionType) params.set('type', actionType);
  const res = await fetch(`/api/vault?${params}`);
  return res.json();
}

export async function fetchBriefings(): Promise<Briefing[]> {
  const res = await fetch('/api/vault?action=briefings');
  const data = await res.json();
  return data.briefings || [];
}
