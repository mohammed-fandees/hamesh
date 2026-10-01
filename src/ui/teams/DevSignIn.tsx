import { useState } from 'react';
import type { TeamsClient } from '@/teams/client';
import type { TeamsErrorCode } from '@/teams/errors';
import type { Lang } from '../i18n';
import { InlineError } from '../kit/Feedback';
import { getTeamsStrings } from './strings';

/**
 * Its own wording, not the Teams strings table: these five lines are only ever
 * shown in a build that asked for them, and a table is carried by every build.
 */
const WORDS = {
  en: {
    title: 'Sign in with a local token',
    hint: 'For a build pointed at a server on this machine. Run `pnpm dev:session` in the API repo and paste what it prints.',
    placeholder: 'Session token…',
    action: 'Use it',
    badToken: 'That is not a session token — they are 43 characters.',
  },
  ar: {
    title: 'تسجيل دخول بتوكن محلي',
    hint: 'لنسخة موجّهة إلى خادم على هذا الجهاز. شغّل `pnpm dev:session` في مستودع الـ API والصق ما يطبعه.',
    placeholder: 'توكن الجلسة…',
    action: 'استخدمه',
    badToken: 'هذا ليس توكن جلسة — طوله 43 حرفًا.',
  },
} as const;

/** Its own two rules, inline, so the stylesheet carries nothing for a widget
 *  that only a development build ever draws. Set apart from the account row
 *  above it, because it belongs to the build and not to the product. */
const BOX: React.CSSProperties = {
  marginTop: 'var(--hm-space-4)',
  padding: 'var(--hm-space-3) var(--hm-space-4)',
  border: '1px dashed var(--hm-ink-20)',
  borderRadius: 'var(--hm-radius-md)',
};
const TITLE: React.CSSProperties = { margin: 0, fontSize: 'var(--hm-text-body)', fontWeight: 500 };

interface DevSignInProps {
  lang: Lang;
  client: TeamsClient;
  /** Called once a session has been taken, so Settings can show the account. */
  onSignedIn: () => void;
}

/**
 * Signing in against a server running on this machine, without Google.
 *
 * Google needs a redirect URI registered for this exact build, and an unpacked
 * build's id changes every time it is loaded — which is a great deal of ceremony
 * for trying a feature against `wrangler dev`. The API repo can write a session
 * row into its local database and print the token (`pnpm dev:session`); this is
 * where that token goes.
 *
 * It is not a way past anything, and nothing here is a shortcut through
 * authentication: the token has to be one the server itself issued, and it is
 * checked on every request afterwards exactly as a Google sign-in's would be. A
 * made-up one is refused the moment it is used.
 *
 * Present only in a build that asked for it. The constant folds away everywhere
 * else, and this component goes with it.
 */
export function DevSignIn({ lang, client, onSignedIn }: DevSignInProps) {
  const words = WORDS[lang] ?? WORDS.en;
  const strings = getTeamsStrings(lang);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TeamsErrorCode | 'invalid_request' | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = token.trim();
    // The shape the server issues: 32 bytes, base64url. Checked here so a
    // mistyped paste is said so immediately rather than as a refusal later.
    if (!/^[A-Za-z0-9_-]{43}$/.test(trimmed)) {
      setError('invalid_request');
      return;
    }
    setBusy(true);
    setError(null);
    const reply = await client.devSignIn(trimmed);
    setBusy(false);
    if (reply.status.state === 'signed_in') {
      setToken('');
      onSignedIn();
      return;
    }
    setError(reply.error ?? 'internal');
  }

  return (
    <div style={BOX}>
      <p style={TITLE}>{words.title}</p>
      <p className="hm-setting-row__hint">{words.hint}</p>
      <form className="hm-team-invite" onSubmit={submit}>
        <input
          type="text"
          className="hm-input"
          spellCheck={false}
          autoComplete="off"
          placeholder={words.placeholder}
          aria-label={words.title}
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button
          type="submit"
          className="hm-btn hm-btn-ghost"
          disabled={busy || !token.trim()}
          aria-busy={busy}
        >
          {words.action}
        </button>
      </form>
      {error && (
        <InlineError>
          {error === 'invalid_request' ? words.badToken : strings.error(error)}
        </InlineError>
      )}
    </div>
  );
}
