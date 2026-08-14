// Mirrors the Angular app's _variable.scss font scale (--font8..--font40, rem-based
// with 1rem = 16px). React Native's StyleSheet only accepts unitless dp numbers for
// fontSize, so these are the equivalent px/dp values, keyed the same way for easy
// cross-reference against the old app.
export const FontSizes = {
  font8:  8,
  font9:  9,
  font10: 10,
  font11: 11,
  font12: 12,
  font13: 13,
  font14: 14,
  font15: 15,
  font16: 16,
  font17: 17,
  font18: 18,
  font19: 19,
  font20: 20,
  font22: 22,
  font23: 23,
  font24: 24,
  font25: 25,
  font26: 26,
  font27: 27,
  font28: 28,
  font30: 30,
  font32: 32,
  font34: 34,
  font40: 40,
} as const
