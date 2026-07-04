// Breakpoint for the desktop web layout (Figma "Jodii Desktop" designs).
// Native iOS/Android and narrow mobile-web always keep the mobile layout —
// only a wide browser window switches to the desktop layout.
//
// Subscribes to Dimensions changes directly (not useWindowDimensions) and only
// updates state when the derived boolean actually flips. useWindowDimensions
// would re-render every consumer on every intermediate resize pixel — for a
// screen-level hook like this, that means re-rendering the whole screen on
// every drag-resize tick even though only the desktop/mobile switch matters.
import { useEffect, useState } from 'react'
import { Dimensions, Platform } from 'react-native'

export const DESKTOP_WEB_MIN_WIDTH = 1024

function computeIsDesktop(width: number): boolean {
  return Platform.OS === 'web' && width >= DESKTOP_WEB_MIN_WIDTH
}

export function useIsDesktopWeb(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => computeIsDesktop(Dimensions.get('window').width))

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setIsDesktop(prev => {
        const next = computeIsDesktop(window.width)
        return prev === next ? prev : next
      })
    })
    return () => sub.remove()
  }, [])

  return isDesktop
}
