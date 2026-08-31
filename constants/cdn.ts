import { EnvConfig } from './env'

const BASE = EnvConfig.image  // e.g. 'https://imgs.jodii.app/'

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
