// Base adapter contract — mirrors Love project src/core/base/base.adapter.ts
// All adapters implement Adapter<T> so the API response shape stays isolated
// from the UI model shape.

export interface Adapter<T> {
  adapt(item: any): T
  onAdapt?: (result: T) => void
}
