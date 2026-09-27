import { IsoDateTime } from './common';

/** `UserResponse` (InduSense-BE `app/schemas/user.py`). */
export interface User {
  id: number;
  /** `null` for platform administrators, who belong to no company. */
  company_id: number | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  is_verified: boolean;
  last_login_at: IsoDateTime | null;
  /** Role codes. */
  roles: string[];
  /** Plants the user is limited to; empty = every plant of the company. */
  plant_ids: number[];
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** `CurrentUserResponse` from `GET /auth/me` (InduSense-BE `app/schemas/user.py`). */
export interface CurrentUser extends User {
  /** `null` for platform administrators. */
  company_code: string | null;
  company_name: string | null;
  /** e.g. `devices:view`, `telemetry:view`. */
  permissions: string[];
  /** Module codes enabled for the user's company. */
  modules: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

// No token types: authentication uses HttpOnly cookies, so tokens never reach the app.
