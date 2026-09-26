import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  Observable,
  catchError,
  map,
  mergeMap,
  of,
  range,
  switchMap,
  throwError,
  toArray,
} from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { DataResponse, MAX_PAGE_SIZE, Page, PageResponse } from './api-envelope';
import { ApiError } from './api-error';

type QueryValue = string | number | boolean | null | undefined;

/** Query parameters; `null`/`undefined` are omitted and arrays repeat the key (`?tag_id=1&tag_id=2`). */
export type QueryParams = Record<string, QueryValue | readonly (string | number)[]>;

export interface GetAllOptions {
  pageSize?: number;
  /** Safety cap: more pages than this is an error rather than a silent truncation. */
  maxPages?: number;
  /** Pages fetched in parallel after the first. */
  concurrency?: number;
}

export const TOO_MANY_PAGES = 'TOO_MANY_PAGES';

/** Filter objects (typed interfaces) as query parameters; their values are all QueryValue-compatible. */
export function queryOf(filters: object): QueryParams {
  return { ...filters } as QueryParams;
}

export function toHttpParams(params: QueryParams = {}): HttpParams {
  let result = new HttpParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        result = result.append(key, String(item));
      }
    } else {
      result = result.set(key, String(value));
    }
  }
  return result;
}

/**
 * Thin, typed access to the InduSense API: builds URLs from `APP_CONFIG.apiBaseUrl`, unwraps the
 * response envelopes and turns every failure into an ApiError.
 * Credentials (cookies) are attached by `apiCredentialsInterceptor`.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(APP_CONFIG).apiBaseUrl.replace(/\/+$/, '');

  /** Absolute or root-relative URL for an API path such as `/devices/3`. */
  url(path: string): string {
    return `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
  }

  /** `GET` a single object (`{success, data}`) and return `data`. */
  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.http.get<DataResponse<T>>(this.url(path), { params: toHttpParams(params) }).pipe(
      map((response) => response.data),
      catchError(toApiError),
    );
  }

  /** `GET` one page of a list (`{success, data, pagination}`). */
  getPage<T>(path: string, params?: QueryParams): Observable<Page<T>> {
    return this.http.get<PageResponse<T>>(this.url(path), { params: toHttpParams(params) }).pipe(
      map((response) => ({ items: response.data, pagination: response.pagination })),
      catchError(toApiError),
    );
  }

  /** `GET` the entire envelope response (e.g. for reports with data and pagination). */
  getRaw<T>(path: string, params?: QueryParams): Observable<T> {
    return this.http.get<T>(this.url(path), { params: toHttpParams(params) }).pipe(
      catchError(toApiError),
    );
  }

  /**
   * Every item of a list: fetches the first page, then the remaining pages in parallel, and
   * returns the items in server order.
   */
  getAllPages<T>(
    path: string,
    params: QueryParams = {},
    options: GetAllOptions = {},
  ): Observable<T[]> {
    const pageSize = Math.min(options.pageSize ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE);
    const maxPages = options.maxPages ?? 50;
    const concurrency = options.concurrency ?? 4;
    const pageOf = (page: number) =>
      this.getPage<T>(path, { ...params, page, page_size: pageSize });

    return pageOf(1).pipe(
      switchMap((first) => {
        const totalPages = first.pagination.total_pages;
        if (totalPages > maxPages) {
          return throwError(
            () =>
              new ApiError(
                0,
                TOO_MANY_PAGES,
                `The list is too large to load at once (${first.pagination.total} items).`,
              ),
          );
        }
        if (totalPages <= 1) {
          return of(first.items);
        }
        return range(2, totalPages - 1).pipe(
          mergeMap(
            (page) => pageOf(page).pipe(map((result) => ({ page, items: result.items }))),
            concurrency,
          ),
          toArray(),
          map((pages) => [
            ...first.items,
            ...pages.sort((a, b) => a.page - b.page).flatMap((p) => p.items),
          ]),
        );
      }),
    );
  }

  /** `POST` and return `data`; resolves to `undefined` for `204 No Content`. */
  post<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.post<DataResponse<T> | null>(this.url(path), body).pipe(
      map((response) => response?.data as T),
      catchError(toApiError),
    );
  }

  /** `PATCH` and return `data`; resolves to `undefined` for `204 No Content`. */
  patch<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.patch<DataResponse<T> | null>(this.url(path), body).pipe(
      map((response) => response?.data as T),
      catchError(toApiError),
    );
  }

  /** `PUT` and return `data`; resolves to `undefined` for `204 No Content`. */
  put<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.put<DataResponse<T> | null>(this.url(path), body).pipe(
      map((response) => response?.data as T),
      catchError(toApiError),
    );
  }

  /** `DELETE` and return `data` (or void for `204 No Content`). */
  delete<T = void>(path: string): Observable<T> {
    return this.http.delete<DataResponse<T> | null>(this.url(path)).pipe(
      map((response) => response?.data as T),
      catchError(toApiError),
    );
  }
}

function toApiError(error: unknown): Observable<never> {
  return throwError(() => ApiError.from(error));
}
