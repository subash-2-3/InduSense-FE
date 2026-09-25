import { IsoDateTime } from './common';

/** `CurrentUserResponse` from `GET /auth/me` (InduSense-BE `app/schemas/user.py`). */
export interface CurrentUser {
  id: number;
  company_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  is_verified: boolean;
  last_login_at: IsoDateTime | null;
  /** Role codes. */
  roles: string[];
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  company_code: string;
  company_name: string;
  /** e.g. `devices:view`, `telemetry:view`. */
  permissions: string[];
  /** Module codes enabled for the user's company. */
  modules: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

// No token types: authentication uses HttpOnly cookies (Phase 7), so tokens never reach the app.
