import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'kinpoyo:sessions:v1';

export type SessionStatus = 'pending' | 'uploaded' | 'failed';

export type LocalSession = {
  id: string;
  exerciseName: string;
  videoUri: string;
  recordedAt: string;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  status: SessionStatus;
  remoteSessionId?: number;
  lastError?: string;
};

export async function loadAll(): Promise<LocalSession[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalSession[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(sessions: LocalSession[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(sessions));
}

export async function add(session: LocalSession): Promise<void> {
  const all = await loadAll();
  all.unshift(session);
  await writeAll(all);
}

export async function update(
  id: string,
  patch: Partial<LocalSession>,
): Promise<void> {
  const all = await loadAll();
  const next = all.map((s) => (s.id === id ? { ...s, ...patch } : s));
  await writeAll(next);
}

export async function remove(id: string): Promise<void> {
  const all = await loadAll();
  await writeAll(all.filter((s) => s.id !== id));
}

export async function clear(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
