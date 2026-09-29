import { z } from 'zod';

/**
 * POST /v1/auth/google — exchange a Google authorization code (obtained by the
 * extension through `identity.launchWebAuthFlow` with PKCE) for a Hamesh
 * session. The extension never sends a user id, email or name: identity
 * comes only from the verified Google ID token.
 */
export const GoogleSignInRequest = z.strictObject({
  code: z.string().min(1).max(2048),
  codeVerifier: z
    .string()
    .min(43)
    .max(128)
    .regex(/^[A-Za-z0-9\-._~]+$/),
  redirectUri: z.string().url().max(512),
  nonce: z.string().min(16).max(128),
});
export type GoogleSignInRequest = z.infer<typeof GoogleSignInRequest>;

export const SessionResponse = z.strictObject({
  /** Bearer token; shown once, store it only in the background service worker. */
  token: z.string(),
  expiresAt: z.number().int(),
});
export type SessionResponse = z.infer<typeof SessionResponse>;
