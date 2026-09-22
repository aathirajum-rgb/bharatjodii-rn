// HTML entity decoding for API-supplied text.
//
// The registration APIs (registrationform/v1 → initialfetch) return vernacular
// option labels as HTML numeric character references rather than literal UTF-8:
//   Tamil  "எனக்காக" arrives as "&#x0B8E;&#x0BA9;&#x0B95;&#x0BCD;&#x0BBE;&#x0B95;"
//   Telugu "నాకోసం"  arrives as "&#x0C28;&#x0C3E;&#x0C15;&#x0C4B;&#x0C38;&#x0C02;"
//
// Angular decodes these in common.ts's decodeEntities(): it strips <script>
// blocks and tags, then assigns to a div's innerHTML and reads back textContent,
// letting the browser's parser do the decoding. React Native has no DOM, so that
// trick is unavailable — this is a pure-JS equivalent covering the numeric forms
// the API actually emits, plus the five named entities that are always predefined
// in HTML/XML. It deliberately does NOT implement the full ~2000-entry named
// entity table: the API sends numeric references, and a partial named-entity map
// would silently corrupt any label containing a literal "&word;" sequence.
//
// Tag stripping mirrors Angular's order — script contents removed first (so their
// text doesn't survive as content), then remaining tags, then entities decoded.
// Entities are decoded LAST so an encoded "&lt;b&gt;" can never turn into a live
// tag after stripping.

// Named entities that are predefined in every HTML/XML parser.
const NAMED: Record<string, string> = {
  amp:   '&',
  lt:    '<',
  gt:    '>',
  quot:  '"',
  apos:  "'",
  nbsp:  '\u00a0',
}

// Decodes numeric (&#1234; / &#x04D2;) and the predefined named entities.
// Leaves anything unrecognised exactly as-is rather than guessing.
export function decodeEntities(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return ''
  if (raw.indexOf('&') === -1) return raw          // fast path — most strings have none

  return raw.replace(/&(#[Xx][0-9A-Fa-f]+|#\d+|[A-Za-z][A-Za-z0-9]*);/g, (match, body: string) => {
    if (body.charAt(0) === '#') {
      const isHex = body.charAt(1) === 'x' || body.charAt(1) === 'X'
      const code  = parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10)

      // Reject values that String.fromCodePoint would throw on, plus the
      // surrogate range (never valid as a standalone scalar value).
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match
      if (code >= 0xd800 && code <= 0xdfff) return match

      try {
        return String.fromCodePoint(code)
      } catch {
        return match
      }
    }

    const named = NAMED[body.toLowerCase()]
    return named !== undefined ? named : match
  })
}

// Angular parity: common.ts decodeEntities() — strip <script> blocks, strip the
// remaining tags, then decode entities. Use this for any API string rendered into
// an RN <Text>, which cannot render markup.
export function stripAndDecodeHtml(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return ''
  const withoutMarkup = raw
    .replace(/<script[^>]*>[\S\s]*?<\/script>/gim, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  return decodeEntities(withoutMarkup).trim()
}

// Same as stripAndDecodeHtml, but collapses <br> to a single space instead of a
// newline. Some locale strings carry a <br> meant for a two-line title (e.g. a
// section header rendered into a plain multi-line <Text>) but get reused in a
// numberOfLines={1} context (a page header, a card counter) — a literal '\n'
// there just truncates everything after it instead of wrapping.
export function stripAndDecodeHtmlInline(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return ''
  const withoutMarkup = raw
    .replace(/<script[^>]*>[\S\s]*?<\/script>/gim, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
  return decodeEntities(withoutMarkup).replace(/\s+/g, ' ').trim()
}
