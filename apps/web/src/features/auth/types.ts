/** Request/response shapes for auth API calls */

export interface RegisterRequest {
  email: string
  password: string
}

export interface LoginRequest {
  email: string
  password: string
  device_fingerprint?: string
}

export interface LoginResponse {
  csrf_token: string
}

export interface ResendVerificationRequest {
  email: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  new_password: string
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

export interface SessionRecord {
  id: string
  created_at: string
  last_used_at: string | null
  expires_at: string
  ip_address: string | null
  user_agent: string | null
  device_fingerprint: string | null
}
