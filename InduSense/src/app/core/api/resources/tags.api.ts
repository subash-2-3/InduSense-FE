import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  DefaultTagItem,
  Tag,
  TagCreate,
  TagFilters,
  TagMetadata,
  TagType,
  TagUpdate,
  TagsFromDefinitionsResult,
} from '../../models';
import { Page, PageParams } from '../api-envelope';
import { ApiService, queryOf } from '../api.service';

/**
 * Picks the tag for a name from search results: an exact (case-insensitive) `tag_name` match
 * first, then an exact `display_name` match. Search results that only contain the name are ignored.
 */
export function matchTagByName(tags: readonly Tag[], name: string): Tag | null {
  const wanted = name.trim().toLowerCase();
  const active = tags.filter((t) => t.status === 'active');
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
    return this.api.getPage<Tag>('/tags', queryOf(filters));
  }

  /** Every page (a V-BOX can report hundreds of tags). */
  listAll(filters: TagFilters = {}): Observable<Tag[]> {
    return this.api.getAllPages<Tag>('/tags', queryOf(filters));
  }

  get(id: number): Observable<Tag> {
    return this.api.get<Tag>(`/tags/${id}`);
  }

  create(body: TagCreate): Observable<Tag> {
    return this.api.post<Tag>('/tags', body);
  }

  update(id: number, body: TagUpdate): Observable<Tag> {
    return this.api.patch<Tag>(`/tags/${id}`, body);
  }

  /** Soft delete (`tags:delete`); restore with `update(id, { status: 'active' })`. */
  delete(id: number): Observable<Tag> {
    return this.api.delete<Tag>(`/tags/${id}`);
  }

  /** Allowed tag types, round-off range and the default tag catalog (optionally one type). */
  metadata(tagType?: TagType): Observable<TagMetadata> {
    return this.api.get<TagMetadata>('/tag-definitions', { tag_type: tagType });
  }

  /** Device tags for the chosen defaults; existing codes are skipped, deleted ones restored. */
  createFromDefinitions(
    deviceId: number,
    items: DefaultTagItem[],
  ): Observable<TagsFromDefinitionsResult> {
    return this.api.post<TagsFromDefinitionsResult>('/tags/from-definitions', {
      device_id: deviceId,
      items,
    });
  }

  /** The active tag with this name (optionally on one device), or null. */
  findByName(name: string, deviceId?: number): Observable<Tag | null> {
    return this.api
      .getAllPages<Tag>('/tags', { search: name.trim(), device_id: deviceId, status: 'active' })
      .pipe(map((tags) => matchTagByName(tags, name)));
  }
}
