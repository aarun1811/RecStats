import { useMemo } from 'react'

import { useFilterStore } from '@/stores/filter-store'

export function useCrossFilteredData<T extends Record<string, unknown>>(
  data: T[] | undefined,
  chartId: string,
): T[] {
  const crossFilters = useFilterStore((s) => s.crossFilters)

  return useMemo(() => {
    if (!data) return []

    const activeFilters = Object.values(crossFilters).filter(
      (cf) => cf.chartId !== chartId,
    )

    if (activeFilters.length === 0) return data

    return data.filter((row) =>
      activeFilters.every((cf) => {
        const cellValue = row[cf.field]
        if (Array.isArray(cf.value)) {
          return cf.value.includes(String(cellValue))
        }
        return String(cellValue) === cf.value
      }),
    )
  }, [data, crossFilters, chartId])
}
