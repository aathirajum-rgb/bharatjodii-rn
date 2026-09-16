import { EnvConfig } from './env'

const BASE = EnvConfig.image  // e.g. 'https://imgs.bharatjodii.com/'

export const CDN        = BASE
export const CDN_REG    = `${BASE}assets/images/svg/registration-new/`
export const CDN_SVG    = `${BASE}assets/images/svg/`
export const CDN_LOTTIE = `${BASE}assets/jodii-lottie-files/`
export const CDN_IMG    = `${BASE}assets/images/`
export const CDN_REVAMP = `${BASE}assets/images/revamp-img/`
export const CDN_REACT  = `${BASE}assets/images/react`
// Lottie JSON uploaded specifically for this app, alongside the react/ icons —
// server path /home/nbimg/www/assets/images/svg/react/lottie-files.
// Distinct from CDN_LOTTIE, which is the Angular app's own animation folder.
// Note the trailing slash (CDN_REACT deliberately has none — its callers write
// CDN_REACT + '/name.svg').
export const CDN_REACT_LOTTIE = `${BASE}assets/images/react/lottie-files/`
// Per-flavor static splash images (one file per app flavor, e.g.
// 'adidravidar.png' — filename is the flavor key, no prefix). BharatJodii
// rebrand replaced the old per-flavor Lottie splash animation
// (res/raw/splash_anim.json) with a static image, matching the native
// Android app's same migration (activity_splash.xml: LottieAnimationView ->
// plain ImageView). The 9 flavors Android actually redesigned art for
// (jodii + tamil/malayalam/telugu/kannada/oriya/bengali/marathi/gujarati/
// punjabi) don't hit this CDN path at all — SplashAnimationScreen bundles
// those locally (assets/splash-<flavor>.png). Every other (community/caste)
// flavor falls back to this CDN path, though no files have been uploaded
// here yet, so they currently just show the plain brand-color background.
export const CDN_SPLASH_STATIC = `${BASE}assets/splash-static-files/`
