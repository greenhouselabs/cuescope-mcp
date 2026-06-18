/**
 * Mask sensitive values (API keys, stream keys, Call passwords, passphrases, tokens)
 * before any preset-derived data leaves the server. Never masks a bare <Key>
 * (that is the input/instance GUID identifier, not a secret).
 */
import type { PresetFile, PresetScript } from './preset-types.js';

// Element-wrapped: <SomethingPassword>…</SomethingPassword> etc. \w* requires a
// qualifier around the sensitive word, so bare <Key> never matches.
const ELEMENT_SECRET = /<(\w*(?:API_?Key|ApiKey|StreamKey|Password|Passphrase|Secret|Token)\w*)>([^<]*)<\/\1>/gi;
// URL credentials: scheme://user:secret@host — the secret may contain '@' (greedy
// match keeps everything up to the last '@'). '/' and '?' are excluded from the
// secret so a port followed by a later '@' in the path/query (e.g.
// host:8080/x@y) is not misread as credentials.
const URL_CREDENTIAL_SECRET = /\b([a-z][a-z0-9+.-]*:\/\/[^/\s"<>@:]+:)([^\s"<>/?]+)@/gi;
// Secrets embedded in URL query strings, e.g. rtmp://host/app?key=SECRET. Values
// stop at the next query-string delimiter; runs before ASSIGN_SECRET so the
// remainder of the query string is never swallowed.
const URL_KEY_SECRET = /([?&](?:key|password|passphrase|streamkey|apikey|secret|token)=)([^"&\s<>]+)/gi;
// Assignment-form secrets: name = value or name := value (value only). Quoted
// values are masked in full — they may legally contain '&', spaces, '?', etc.
// (e.g. password="p&ssw0rd"). Unquoted values stop at whitespace/quote/markup/'&'
// so VB string concatenation and query strings are not over-consumed. 'key' is
// intentionally excluded — vMix scripts use `Key:=` as a named argument, not a secret.
const ASSIGN_SECRET = /\b(password|passphrase|streamkey|apikey|secret|token)(\s*:?=\s*)(?:"([^"]*)"|([^"&\s<>]+))/gi;
// Known limitation: stream keys embedded in URL *paths* (e.g. YouTube's
// rtmp://a.rtmp.youtube.com/live2/<stream-key>) cannot be reliably detected —
// there is no delimiter or name distinguishing the key from an ordinary path
// segment, and masking all path segments would destroy legitimate URLs.

export function redactSecrets(text: string): string {
  return text
    .replace(ELEMENT_SECRET, (_m, tag: string) => `<${tag}>[redacted]</${tag}>`)
    .replace(URL_CREDENTIAL_SECRET, (_m, prefix: string) => `${prefix}[redacted]@`)
    .replace(URL_KEY_SECRET, (_m, prefix: string) => `${prefix}[redacted]`)
    .replace(ASSIGN_SECRET, (_m, name: string, sep: string, quoted: string | undefined) =>
      quoted !== undefined ? `${name}${sep}"[redacted]"` : `${name}${sep}[redacted]`
    );
}

function redactScript(s: PresetScript): PresetScript {
  return { name: s.name, source: redactSecrets(s.source) };
}

/** Returns a copy with secrets masked; never mutates the input. */
export function redactPresetFile(preset: PresetFile): PresetFile {
  return {
    meta: { ...preset.meta },
    scripts: preset.scripts.map(redactScript),
    inputs: preset.inputs.map((i) => ({
      ...i,
      audio: i.audio ? { ...i.audio, busFlags: { ...i.audio.busFlags }, buses: [...i.audio.buses] } : null,
      videoCall: i.videoCall
        ? {
            ...i.videoCall,
            key: i.videoCall.key === null ? null : '[redacted]',
            hasKey: i.videoCall.hasKey,
          }
        : null,
      triggers: i.triggers.map((t) => ({ ...t, value: t.value === null ? null : redactSecrets(t.value) })),
    })),
    dataSources: preset.dataSources.map((d) => ({ ...d, tables: d.tables.map((t) => ({ ...t })) })),
  };
}
