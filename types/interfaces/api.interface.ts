import { EApiResultStatus } from '../enums/api.enum'

// Generic wrapper for all API responses — use T for the data shape per endpoint
export interface IApiResponse<T = unknown> {
  status: EApiResultStatus
  data: T
  message?: string
  errorCode?: string
}

// Paginated list response — used for matches, activity, search results
export interface IPagedResponse<T = unknown> {
  data: T[]
  totalCount: number
  currentPage: number
  hasMore: boolean
}
