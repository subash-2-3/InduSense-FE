/** ISO 8601 timestamp with offset, as sent by the API (UTC), e.g. `2026-09-25T12:00:00Z`. */
export type IsoDateTime = string;

/** Lifecycle of business records (InduSense-BE `Status`). `delete` = soft-deleted, hidden by default. */
export type RecordStatus = 'active' | 'inactive' | 'delete';

/** What a PATCH may set: `active` also restores a deleted record. Deleting is DELETE on the resource. */
export type EditableStatus = 'active' | 'inactive';

/** List filter: one status or several (`?status=active&status=inactive`). Default on the server: `active`. */
export type StatusFilter = RecordStatus | RecordStatus[];
