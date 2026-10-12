/**
 * Response envelopes of the InduSense API (InduSense-BE `app/schemas/common.py`).
 *
 *   {"success": true, "data": {...}}                                     single object
 *   {"success": true, "data": [...], "pagination": {...}}                  one page of a list
 *   {"success": false, "code": "...", "message": "...", "details": [...]}  error
 */

export interface DataResponse<T> {
  success: true;
  data: T;
}

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface PageResponse<T> {
  success: true;
  data: T[];
  pagination: Pagination;
}

export interface ApiErrorDetail {
  /** Dotted location of the invalid input, e.g. `body.email` or `query.page_size`. */
  field?: string;
  message: string;
}

export interface ApiErrorBody {
  success: false;
  code: string;
  message: string;
  details?: ApiErrorDetail[];
}

/**
 * Paging of raw telemetry lists (`/telemetry`, `/reports/energy/details`). Cursor mode (send `cursor`,
 * empty for the first page): `page`/`total` are null; continue with `next_cursor` while `has_more`.
 * Page-number mode: `page`/`total` are set (the server counts the whole range).
 */
export interface CursorPagination {
  page: number | null;
  page_size: number;
  total: number | null;
  total_pages: number | null;
  next_cursor: string | null;
  has_more: boolean;
}

/** An unwrapped page: the items plus paging metadata. */
export interface Page<T> {
  items: T[];
  pagination: Pagination;
}

/** Common list parameters. The backend caps `page_size` at 100 (telemetry history: 1000). */
export interface PageParams {
  page?: number;
  page_size?: number;
}

export const MAX_PAGE_SIZE = 100;
