// Angular's home-banner.component.html binds BANNERBG/BRIDEBGCOLOR straight into
// a raw CSS `background` property ([attr.style]="'background: ' + heroBannerData
// ?.BANNERBG + ...'"), so the CMS is free to send either a plain color OR a full
// `linear-gradient(...)` string for the SAME field — RN has no equivalent of
// handing a raw CSS string to a View's style, so this parses it into whatever
// HeroBanner.tsx's Wrap (View vs expo-linear-gradient LinearGradient) needs.

export interface ParsedCssBackground {
  colors: string[]
  // Present only when every stop carried an explicit `N%` — omitted rather than
  // guessed, matching LinearGradient's own "even spread" default for `locations`.
  locations?: number[] | undefined
  start: { x: number; y: number }
  end:   { x: number; y: number }
}

const SOLID_COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|transparent)$/i

// CSS keyword directions → the equivalent `<angle>deg` (0deg = "to top",
// clockwise) — https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/linear-gradient.
const ANGLE_KEYWORDS: Record<string, number> = {
  'to top':          0,
  'to top right':    45, 'to right top':  45,
  'to right':        90,
  'to bottom right': 135, 'to right bottom': 135,
  'to bottom':       180,
  'to bottom left':  225, 'to left bottom':  225,
  'to left':         270,
  'to top left':     315, 'to left top':     315,
}

// Splits on top-level commas only — a plain .split(',') breaks on the commas
// inside rgba(0,0,0,.4)/hsla(...) color stops.
function splitTopLevel(str: string): string[] {
  const parts: string[] = []
  let depth = 0
  let last = 0
  for (let i = 0; i < str.length; i++) {
    const c = str[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === ',' && depth === 0) { parts.push(str.slice(last, i)); last = i + 1 }
  }
  parts.push(str.slice(last))
  return parts.map(p => p.trim()).filter(Boolean)
}

// CSS gradient-angle → a fractional start/end pair inside the box (0-1), the
// same approximation every CSS-to-native-gradient port uses (exact CSS gradient
// geometry depends on the element's aspect ratio via its bounding-box diagonal;
// this is visually equivalent for the near-square/wide banner shapes this
// actually renders on).
function angleToPoints(deg: number): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const rad = (deg * Math.PI) / 180
  const dx = Math.sin(rad)
  const dy = -Math.cos(rad)
  return {
    start: { x: 0.5 - dx / 2, y: 0.5 - dy / 2 },
    end:   { x: 0.5 + dx / 2, y: 0.5 + dy / 2 },
  }
}

function parseColorToRgba(c: string): [number, number, number, number] | null {
  const hex = c.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i)
  if (hex) {
    let h = hex[1]!
    if (h.length === 3 || h.length === 4) h = h.split('').map(ch => ch + ch).join('')
    return [
      parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16),
      h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    ]
  }
  const rgb = c.trim().match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i)
  if (rgb) return [parseFloat(rgb[1]!), parseFloat(rgb[2]!), parseFloat(rgb[3]!), rgb[4] !== undefined ? parseFloat(rgb[4]!) : 1]
  if (/^transparent$/i.test(c.trim())) return [0, 0, 0, 0]
  return null
}

function rgbaToCss([r, g, b, a]: [number, number, number, number]): string {
  const round = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  return a >= 1 ? `rgb(${round(r)}, ${round(g)}, ${round(b)})` : `rgba(${round(r)}, ${round(g)}, ${round(b)}, ${+a.toFixed(3)})`
}

// CSS gradient stops are allowed OUTSIDE 0%/100% (e.g. Figma's own
// "linear-gradient(180deg, #D9E7FF 12.59%, #FFF 137.6%)" — the 2nd stop sits
// past the visible box, so at the real bottom edge (100%) the color has only
// interpolated 87% of the way there, not reached solid white yet).
// LinearGradient's own `locations` can't go outside [0,1] the way raw CSS
// can, so naively clamping an out-of-range stop to 1 (as this used to) freezes
// the wrong, too-far-along color at the visible edge instead of the color CSS
// would actually show there. This resamples the whole stop list onto [0,1],
// computing the CORRECT interpolated color at each clipped boundary instead.
export function resampleGradientStops(colors: string[], locations: number[]): { colors: string[]; locations: number[] } {
  const rgbas = colors.map(parseColorToRgba)
  const needsResample = locations.some(l => l < 0 || l > 1)
  if (!needsResample || rgbas.some(c => c === null) || colors.length !== locations.length) {
    // Nothing out of range, or a color this parser doesn't understand (named
    // CSS colors, hsl(a)) — fall back to a plain clamp rather than guessing.
    return { colors, locations: locations.map(l => Math.max(0, Math.min(1, l))) }
  }
  const stops = locations.map((loc, i) => ({ loc, rgba: rgbas[i]! }))
  const colorAt = (target: number): [number, number, number, number] => {
    if (target <= stops[0]!.loc) return stops[0]!.rgba
    const lastStop = stops[stops.length - 1]!
    if (target >= lastStop.loc) return lastStop.rgba
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i]!, b = stops[i + 1]!
      if (target >= a.loc && target <= b.loc) {
        const t = b.loc === a.loc ? 0 : (target - a.loc) / (b.loc - a.loc)
        return [0, 1, 2, 3].map(k => a.rgba[k]! + (b.rgba[k]! - a.rgba[k]!) * t) as [number, number, number, number]
      }
    }
    return lastStop.rgba
  }
  const outColors: string[] = [rgbaToCss(colorAt(0))]
  const outLocations: number[] = [0]
  for (const s of stops) {
    if (s.loc > 0 && s.loc < 1) { outColors.push(rgbaToCss(s.rgba)); outLocations.push(s.loc) }
  }
  outColors.push(rgbaToCss(colorAt(1)))
  outLocations.push(1)
  return { colors: outColors, locations: outLocations }
}

// Finds `linear-gradient(...)` anywhere in a string and returns just its
// argument list, matching parens by depth rather than greedy/lazy regex —
// needed because CSS's `border-image` shorthand packs EXTRA slice/width/
// outset/repeat values after the gradient's own closing paren (e.g.
// "linear-gradient(to right, rgb(207, 219, 240) 67%, transparent 68%) 45% 1 /
// 1 / 0 stretch"), which a `^linear-gradient\((.*)\)$`-anchored match can't
// tolerate (the trailing text breaks the end anchor).
function extractLinearGradientArgs(v: string): string | undefined {
  const start = v.search(/linear-gradient\(/i)
  if (start === -1) return undefined
  const openIdx = v.indexOf('(', start)
  let depth = 0
  for (let i = openIdx; i < v.length; i++) {
    if (v[i] === '(') depth++
    else if (v[i] === ')') {
      depth--
      if (depth === 0) return v.slice(openIdx + 1, i)
    }
  }
  return undefined
}

// Returns undefined for anything unparseable (radial-gradient, url(...) images,
// empty/missing values) so callers can fall back to their own default rather
// than rendering a broken gradient.
export function parseCssBackground(raw: unknown): { solid: string } | { gradient: ParsedCssBackground } | undefined {
  if (typeof raw !== 'string') return undefined
  const v = raw.trim()
  if (!v) return undefined

  const gradArgs = extractLinearGradientArgs(v)
  if (gradArgs !== undefined) {
    const parts = splitTopLevel(gradArgs)
    let angleDeg = 540 // CSS default direction when the angle/keyword is omitted: "to bottom".
    let stopParts = parts
    const first = (parts[0] ?? '').toLowerCase()
    const degMatch = first.match(/^(-?[\d.]+)deg$/)
    if (degMatch) {
      angleDeg = parseFloat(degMatch[1]!)
      stopParts = parts.slice(1)
    } else if (first.startsWith('to ') && ANGLE_KEYWORDS[first] !== undefined) {
      angleDeg = ANGLE_KEYWORDS[first]!
      stopParts = parts.slice(1)
    }

    let colors: string[] = []
    let locations: number[] = []
    let everyStopHasLocation = true
    for (const stop of stopParts) {
      const m = stop.match(/^(.+?)\s+(-?[\d.]+)%$/)
      if (m) {
        colors.push(m[1]!.trim())
        locations.push(parseFloat(m[2]!) / 100)
      } else {
        colors.push(stop)
        everyStopHasLocation = false
      }
    }
    if (colors.length < 2) return undefined
    if (everyStopHasLocation && locations.some(l => l < 0 || l > 1)) {
      ({ colors, locations } = resampleGradientStops(colors, locations))
    }
    // Normalize the bare `transparent` keyword to its exact CSS-spec value
    // (rgba(0,0,0,0)) rather than passing the keyword through as-is — some
    // native color-processing paths handle a literal "transparent" string
    // less reliably than an explicit rgba() with alpha 0, and TIMERBG's own
    // "linear-gradient(to right, rgb(226, 236, 248), transparent)" depends on
    // this specific stop actually reaching zero alpha to fade out correctly.
    colors = colors.map(c => (/^transparent$/i.test(c.trim()) ? 'rgba(0,0,0,0)' : c))
    return { gradient: { colors, locations: everyStopHasLocation ? locations : undefined, ...angleToPoints(angleDeg) } }
  }

  if (SOLID_COLOR_RE.test(v)) return { solid: v }
  return undefined
}

// Pulls the color token out of a full CSS `border` shorthand — Angular binds
// TIMERBORDER straight into the raw `border` property ([ngStyle]="{'border':
// heroBannerData?.TIMERBORDER}"), e.g. "1px solid rgb(207, 219, 240)", not a
// bare color the way most other server-driven fields are — RN's `borderColor`
// needs just the color, so this extracts the one color-shaped token out of the
// shorthand rather than requiring callers to split "width style color" (which
// breaks on rgb()/rgba()'s own internal commas).
export function extractCssColor(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const m = raw.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\btransparent\b/i)
  return m ? m[0] : undefined
}
