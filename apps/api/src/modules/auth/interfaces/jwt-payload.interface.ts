export interface AccessTokenPayload {
  sub: string;
  companyId: string;
  email: string;
  sessionId: string;
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
}

export interface RequestUser {
  id: string;
  companyId: string;
  email: string;
  sessionId: string;
}
