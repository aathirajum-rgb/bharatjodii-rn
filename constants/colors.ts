// Jodii design token — single source of truth for all colors.
// Import from here instead of hardcoding hex values in components.

export const Colors = {
  // ── Brand ─────────────────────────────────────────────────────────────────
  primary:          '#C62828',   // main brand red
  primaryDark:      '#B50033',   // darker red (borders, pressed states)
  primaryDeep:      '#8D0028',   // deep maroon (secondary text on light surfaces)
  primaryLight:     '#e57373',   // light red (disabled button bg)
  primarySurface:   '#fff0f0',   // very light red (badge background)
  primarySurfaceAlt:'#fff5f5',   // light red tint (OTP box filled bg)

  // ── Input border states ───────────────────────────────────────────────────
  inputBorder:      '#B0B0B0',   // default / unfocused
  inputFocus:       '#4797D9',   // focused (blue)
  inputError:       '#DE2A68',   // error (red-pink)

  // ── Text ──────────────────────────────────────────────────────────────────
  textPrimary:      '#111111',   // headings, body
  textDark:         '#333333',   // slightly lighter primary text
  textMedium:       '#555555',   // subtitle, softer body
  textSecondary:    '#666666',   // captions, descriptions
  textTertiary:     '#888888',   // dimmed labels, timers
  textPlaceholder:  '#999999',   // placeholder, terms
  textMuted:        '#aaaaaa',   // dev-only labels, very light

  // ── Background / Surface ──────────────────────────────────────────────────
  background:       '#f4f4f6',   // page/screen background
  surface:          '#ffffff',   // card, modal surface
  surfaceAlt:       '#fafafa',   // picker rows, OTP box bg
  surfaceInput:     '#f5f5f5',   // country-code picker button bg

  // ── Borders ───────────────────────────────────────────────────────────────
  border:           '#dddddd',   // default border (inputs, cards)
  borderLight:      '#cccccc',   // slightly lighter border
  divider:          '#f0f0f0',   // list dividers, card top borders
  borderBadge:      '#ffcccc',   // badge / chip border (light red)

  // ── Swiper pagination dots ────────────────────────────────────────────────
  // Angular global.scss: .explore-pagination .swiper-pagination-bullet
  paginationDotInactive: '#F4CECE',

  // ── Utility ───────────────────────────────────────────────────────────────
  white:            '#ffffff',
  black:            '#000000',
  shadow:           '#000000',

  // ── System accents (non-brand) ─────────────────────────────────────────────
  success:          '#30D158',   // OTA live badge
  devAccent:        '#1A237E',   // Component Library header / button

  // ── Link / CTA ──────────────────────────────────────────────────────────────
  link:             '#29339B',   // contact CTA blue (LinkCTA component)

  // ── Selection / form states ──────────────────────────────────────────────────
  selectionBg:     '#FFF1F5',              // checked row bg (checkbox / radio list)
  radioCheckedBg:  'rgba(181, 0, 51, 0.02)', // checked pill bg (nearly transparent)

  // ── Chip states ─────────────────────────────────────────────────────────────
  chipBorderActive:    'rgba(181, 0, 51, 0.40)',    // selected / checked border
  chipSurfaceSelected: '#FAE7ED',                   // selected fill
  chipSurfaceChecked:  'rgba(249, 230, 235, 0.20)', // checked fill (subtle)

  // ── Badge surfaces ───────────────────────────────────────────────────────────
  badgePaidBg:       '#FFF8E1',   // paid-member badge background
  badgePaidText:     '#E65100',   // paid-member text
  badgeVerifiedBg:   '#E8F0FE',   // id-verified badge background
  badgeVerifiedText: '#1565C0',   // id-verified text
  badgeNewBg:        '#E8F5E9',   // newly-joined badge background
  badgeNewText:      '#2E7D32',   // newly-joined text

  // ── Neutral borders ───────────────────────────────────────────────────────────
  borderNeutral:  '#8a8a8a',   // unselected chip / radio / text-input outline
  borderSoft:     '#d0d0d0',   // softer outline (checkbox list rows)
  borderSubtle:   '#e6e6e6',   // very light border (card dividers, row separators)

  // ── Extra surfaces ────────────────────────────────────────────────────────────
  surfaceDim:     '#f2f2f2',   // light-grey bg (tag chips, alternate input bg)

  // ── Text emphasis ─────────────────────────────────────────────────────────────
  textStrong:     '#1a1a1a',   // near-black (slightly softer than pure black)

  // ── Overlays / scrims ─────────────────────────────────────────────────────────
  scrim:          'rgba(0,0,0,0.55)',   // bottom-sheet / modal dark backdrop
  scrimMedium:    'rgba(0,0,0,0.45)',   // medium overlay (drawers, pickers)
  scrimLight:     'rgba(0,0,0,0.40)',   // light overlay (action sheets)
  scrimSubtle:    'rgba(0,0,0,0.35)',   // subtle overlay (tooltips, hints)

  // ── System (platform) ─────────────────────────────────────────────────────────
  iOSBlue:        '#007AFF',   // iOS system blue (native controls, links)
  iOSGreen:       '#34C759',   // iOS system green (success states)

  // ── Matches card ──────────────────────────────────────────────────────────────
  scrimStrong:      'rgba(0,0,0,0.7)',      // request-photo overlay card bg (MatchesScreen)
  overlayBorder:    'rgba(255,255,255,0.4)',// request-photo overlay card border
  whatsappGreen:    '#25D366',              // WhatsApp CTA background
  likedStripBg:     '#FFEAF7',              // liked-profile pink strip background
  likedStripText:   '#96286E',              // liked-profile strip text
  afterLikeBg:      '#FCEAF0',              // post-like CTA row background
  afterLikeBorder:  '#F5BDD0',              // post-like CTA row top border
  extendedCardTitle:'#4C4C4C',              // end-of-list "view more" card title

  // ── Promo banners (MatchesScreen) ────────────────────────────────────────────
  photoPromoGradientStart: '#FFDDDD',   // free-trial photo-promo banner gradient start (→ white)
  photoPromoTint:          'rgba(181, 0, 51, 0.05)', // photo-promo banner tint background
  addPhotoGradientStart:   '#F2F4FF',   // add-photo banner gradient start
  addPhotoGradientEnd:     '#DCFFF0',   // add-photo banner gradient end
  addPhotoCtaBg:           '#1C644C',   // add-photo banner CTA fallback background
  bulkLikeGradientStart:   '#FFF0F4',   // Bulk Like screen background gradient start (→ white)
  membershipCardBg:        '#FFFBF0',   // membership/festival offer card background

  // ── Payment options screen ───────────────────────────────────────────────────
  discountGreen:  '#029664',   // "Special discount" amount text (PaymentOptionsScreen)

  // ── Star match report (StarMatchingScreen) — exact hex from Angular's
  // star-matching.component.css, not this app's general design tokens.
  starMatchYes:      '#10b981',   // compatibility "YES" text / active star / progress fill
  starMatchNo:       '#ef4444',   // compatibility "NO" text
  starMatchCtaBg:    '#fcd34d',   // "View Detailed Report" button background
  starMatchNoteBg:   '#fef6db',   // footnote background
  starMatchNoteText: '#aa8606',   // footnote text
  starMatchPageBg:   '#dddddd',   // ion-content --background — gray page behind the white cards
}
