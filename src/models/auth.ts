export interface JwtClaims {
  sub: string;
  producer: string;
  scope: string[];
  iss: string;
  aud: string;
  exp: number;
  iat?: number;
}

export interface AuthorizerContext {
  principalId: string;
  producer: string;
  sub: string;
  scope: string[];
  apiKeyOwner: string;
}
