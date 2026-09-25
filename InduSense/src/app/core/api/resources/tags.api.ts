import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { Tag, TagFilters } from '../../models';
import { Page, PageParams } from '../api-envelope';
import { ApiService } from '../api.service';

/**
 * Picks the tag for a name from search results: an exact (case-insensitive) `tag_name` match
 * first, then an exact `display_name` match. Search results that only contain the name are ignored.
 */
export function matchTagByName(tags: readonly Tag[], name: string): Tag | null {
  const wanted = name.trim().toLowerCase();
  const active = tags.filter((t) => t.is_active);
  return (
    active.find((t) => t.tag_name.toLowerCase() === wanted) ??
    active.find((t) => t.display_name?.toLowerCase() === wanted) ??
    null
  );
}

/** `/tags` (requires `tags:view`). */
@Injectable({ providedIn: 'root' })
export class TagsApi {
  private readonly api = inject(ApiService);

  list(filters: TagFilters & PageParams = {}): Observable<Page<Tag>> {
    return this.api.getPage<Tag>('/tags', { ...filters });
  }

  get(id: number): Observable<Tag> {
    return this.api.get<Tag>(`/tags/${id}`);
  }

  /** The active tag with this name (optionally on one device), or null. */
  findByName(name: string, deviceId?: number): Observable<Tag | null> {
    return this.api
      .getAllPages<Tag>('/tags', { search: name.trim(), device_id: deviceId, is_active: true })
      .pipe(map((tags) => matchTagByName(tags, name)));
  }
}
