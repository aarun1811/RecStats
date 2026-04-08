import type { DatasetColumnMeta } from '@/types/managed-dataset'

export type MergeStatus = 'unchanged' | 'new' | 'missing'

export interface MergedColumn extends DatasetColumnMeta {
  status: MergeStatus
}

export function mergeColumns(
  existing: DatasetColumnMeta[],
  detected: DatasetColumnMeta[],
): MergedColumn[] {
  const existingMap = new Map<string, DatasetColumnMeta>()
  for (const col of existing) {
    existingMap.set(col.name, col)
  }

  const detectedNames = new Set(detected.map((c) => c.name))

  const merged: MergedColumn[] = []

  // Process detected columns: unchanged if exists in existing, new otherwise
  for (const col of detected) {
    const prev = existingMap.get(col.name)
    if (prev) {
      merged.push({ ...prev, status: 'unchanged' })
    } else {
      merged.push({ ...col, status: 'new' })
    }
  }

  // Process existing columns not in detected: missing
  for (const col of existing) {
    if (!detectedNames.has(col.name)) {
      merged.push({ ...col, status: 'missing' })
    }
  }

  return merged
}
