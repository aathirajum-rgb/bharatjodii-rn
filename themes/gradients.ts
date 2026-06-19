// Gradient definitions for use with react-native-linear-gradient.
// Angular defined these as CSS gradient strings — converted to color arrays here.
//
// Usage:
//   <LinearGradient
//     colors={Gradients.primaryButton.colors}
//     start={Gradients.primaryButton.start}
//     end={Gradients.primaryButton.end}
//   />

export const Gradients = {

  // Main CTA button — horizontal pink to orange
  primaryButton: {
    colors: ['#CC3E69', '#FF9800'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },

  // Secondary / OTP continue button — vertical dark pink to orange
  secondaryButton: {
    colors: ['#A2113C', '#CD3F68', '#E56A37'] as const,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },

  // WhatsApp action button
  whatsApp: {
    colors: ['#4AC14B', '#06853A'] as const,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },

  // Paid membership header background
  membershipHeader: {
    colors: ['#D9E7FF', '#FFFFFF'] as const,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },

} as const

export type GradientKey = keyof typeof Gradients
