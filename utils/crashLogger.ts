// Dev-time crash visibility. Logs every JS-thread crash path RN can hit —
// uncaught JS exceptions (ErrorUtils), unhandled promise rejections, and
// (via ErrorBoundary) React render crashes — to the console with a grep-able
// [CRASH] tag AND to a file under the app's document directory. The file
// matters because a *fatal* JS error tears down the Metro connection almost
// immediately, so the terminal log can get cut off before you finish reading
// it; the file survives that and can be pulled after the fact, e.g.:
//   adb shell run-as com.jodii.app cat files/crash-log.txt
import { Platform } from 'react-native'
import { File, Paths } from 'expo-file-system'

const LOG_FILE_NAME = 'crash-log.txt'
// Trim rather than let this grow unbounded across a long emulator test session.
const MAX_LOG_BYTES = 200_000

function getLogFile(): File {
  return new File(Paths.document, LOG_FILE_NAME)
}

function appendToLogFile(entry: string): void {
  if (Platform.OS === 'web') return
  try {
    const file = getLogFile()
    if (!file.exists) file.create()
    else if (file.size > MAX_LOG_BYTES) file.write('')
    file.write(entry, { append: true })
  } catch {
    // Logging must never itself be a new source of crashes.
  }
}

function formatEntry(label: string, error: unknown, extra?: Record<string, unknown>): string {
  const err = error instanceof Error ? error : new Error(String(error))
  const lines = [
    `\n[${new Date().toISOString()}] ${label}`,
    `message: ${err.message}`,
    err.stack ? `stack:\n${err.stack}` : '',
    extra ? `extra: ${JSON.stringify(extra)}` : '',
  ].filter(Boolean)
  return lines.join('\n') + '\n'
}

export function logCrash(label: string, error: unknown, extra?: Record<string, unknown>): void {
  const entry = formatEntry(label, error, extra)
  console.error(`[CRASH]${entry}`)
  appendToLogFile(entry)
}

export function getCrashLogPath(): string | null {
  if (Platform.OS === 'web') return null
  return getLogFile().uri
}

let initialized = false

// Call once, as early as possible (top of App.tsx module scope).
export function initCrashLogger(): void {
  if (initialized) return
  initialized = true

  const rnGlobal = globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void
      setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void
    }
  }
  const previousHandler = rnGlobal.ErrorUtils?.getGlobalHandler?.()
  rnGlobal.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
    logCrash(isFatal ? 'FATAL JS ERROR' : 'JS ERROR', error, { isFatal })
    previousHandler?.(error, isFatal)
  })

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('promise/setimmediate/rejection-tracking').enable({
      allRejections: true,
      onUnhandled: (id: number, error: unknown) => {
        logCrash('UNHANDLED PROMISE REJECTION', error, { id })
      },
    })
  } catch {
    // Rejection tracking is best-effort; never block startup on it.
  }

  console.log(`[CRASH] crash logger ready — log file: ${getCrashLogPath() ?? '(web, console only)'}`)
}
