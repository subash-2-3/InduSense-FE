import { IsoDateTime } from './common';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
}

/** `UserResponse` (InduSense-BE `app/schemas/user.py`). */
export interface User {
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
}

/** `CurrentUserResponse` from `GET /auth/me` (InduSense-BE `app/schemas/user.py`). */
export interface CurrentUser extends User {
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
