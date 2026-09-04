// Previously this project had no babel.config.js at all — Expo's Metro
// config falls back to babel-preset-expo by default in that case, so this
// preset line changes nothing that wasn't already happening. What this file
// adds is transform-remove-console: production builds silently relied on
// every console.* call being manually wrapped in `if (__DEV__)`, and that
// discipline had already slipped in a handful of places (raw payment
// responses/merchant keys logged unguarded — see paymentService.ts history).
// This strips every console.* call from production bundles regardless,
// so a future unguarded call can't ship the same way again.
module.exports = function (api) {
  api.cache(true)
  const plugins = []
  if (process.env.NODE_ENV === 'production') {
    plugins.push('transform-remove-console')
  }
  return {
    presets: ['babel-preset-expo'],
    plugins,
  }
}
