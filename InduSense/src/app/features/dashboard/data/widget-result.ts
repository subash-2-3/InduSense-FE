/** Outcome of loading one widget's data. Widgets fail independently. */
export type WidgetResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const ok = <T>(data: T): WidgetResult<T> => ({ ok: true, data });
export const failed = <T>(error: string): WidgetResult<T> => ({ ok: false, error });
