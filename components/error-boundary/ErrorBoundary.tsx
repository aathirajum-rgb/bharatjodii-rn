// Catches React render-tree crashes that ErrorUtils/rejection-tracking can't
// see (those only cover uncaught exceptions and promise rejections, not
// errors thrown during render/lifecycle). Without this, a render crash is a
// blank white screen with nothing in the terminal. Must be a class component
// — getDerivedStateFromError/componentDidCatch have no hook equivalent.
import { Component, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { logCrash } from '../../utils/crashLogger'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    logCrash('REACT RENDER CRASH', error, { componentStack: info.componentStack })
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
        </View>
      )
    }
    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8, color: '#222' },
  message: { fontSize: 14, color: '#666', textAlign: 'center' },
})
