import type { Dataset, DatasetColumn, DatasetDataRequest, DatasetDataResponse } from '@/types/dataset'
import { api } from '@/lib/api-client'

export function fetchDatasets(): Promise<Dataset[]> {
  return api.get<Dataset[]>('/datasets')
}

export function fetchDatasetData(
  datasetId: number,
  params: DatasetDataRequest,
): Promise<DatasetDataResponse> {
  return api.post<DatasetDataResponse>(`/datasets/${datasetId}/data`, params)
}

export function fetchDatasetSchema(
  datasetId: number,
): Promise<DatasetColumn[]> {
  return api.get<DatasetColumn[]>(`/datasets/${datasetId}/schema`)
}
