/// <reference types="vite/client" />
import type { MelpcApi } from '../../shared/api'

declare global {
  interface Window {
    melpc: MelpcApi
  }
}
