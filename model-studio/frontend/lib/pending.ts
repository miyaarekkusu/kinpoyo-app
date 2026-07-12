import AsyncStorage from '@react-native-async-storage/async-storage';

import { deleteVideo } from './files';

const STORAGE_KEY = 'pending_uploads_v1';

export type PendingSegment = {
  id: string;
  startTime: number;
  endTime: number;
};

export type PendingItem = {
  id: string;
  videoUri: string;
  exerciseName: string;
  segments: PendingSegment[];
  createdAt: number;
};

export type PendingRow = {
  itemId: string;
  videoUri: string;
  exerciseName: string;
  createdAt: number;
  segment: PendingSegment;
};

async function loadAll(): Promise<PendingItem[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingItem[]) : [];
  } catch {
    return [];
  }
}

async function saveAll(items: PendingItem[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function addPending(item: PendingItem): Promise<void> {
  if (item.segments.length === 0) return;
  const items = await loadAll();
  const existingIdx = items.findIndex((i) => i.id === item.id);
  if (existingIdx >= 0) {
    const existing = items[existingIdx];
    const existingSegIds = new Set(existing.segments.map((s) => s.id));
    const merged = [
      ...existing.segments,
      ...item.segments.filter((s) => !existingSegIds.has(s.id)),
    ];
    items[existingIdx] = { ...existing, segments: merged };
  } else {
    items.push(item);
  }
  await saveAll(items);
}

export async function listPendingItems(): Promise<PendingItem[]> {
  return loadAll();
}

export async function listPendingRows(): Promise<PendingRow[]> {
  const items = await loadAll();
  const rows: PendingRow[] = [];
  // Newest item first; within an item keep the original segment order so
  // 区間#1, #2, ... stays readable in the UI.
  const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);
  for (const it of sorted) {
    for (const seg of it.segments) {
      rows.push({
        itemId: it.id,
        videoUri: it.videoUri,
        exerciseName: it.exerciseName,
        createdAt: it.createdAt,
        segment: seg,
      });
    }
  }
  return rows;
}

export async function pendingCount(): Promise<number> {
  const items = await loadAll();
  return items.reduce((acc, i) => acc + i.segments.length, 0);
}

/** Remove specific (itemId, segmentId) pairs. When an item loses its last
 * segment, its video file is deleted from the documents directory too. */
export async function removePendingRows(
  keys: { itemId: string; segmentId: string }[],
): Promise<void> {
  if (keys.length === 0) return;
  const byItem = new Map<string, Set<string>>();
  for (const k of keys) {
    const set = byItem.get(k.itemId) ?? new Set<string>();
    set.add(k.segmentId);
    byItem.set(k.itemId, set);
  }

  const items = await loadAll();
  const next: PendingItem[] = [];
  const videosToDelete: string[] = [];
  for (const it of items) {
    const drop = byItem.get(it.id);
    if (!drop) {
      next.push(it);
      continue;
    }
    const remaining = it.segments.filter((s) => !drop.has(s.id));
    if (remaining.length === 0) {
      videosToDelete.push(it.videoUri);
    } else {
      next.push({ ...it, segments: remaining });
    }
  }
  await saveAll(next);
  await Promise.all(videosToDelete.map((uri) => deleteVideo(uri)));
}
