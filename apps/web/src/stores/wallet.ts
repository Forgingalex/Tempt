import { create } from 'zustand'

interface WalletState {
  isConnecting: boolean
  setIsConnecting: (connecting: boolean) => void
}

export const useWalletStore = create<WalletState>((set) => ({
  isConnecting: false,
  setIsConnecting: (connecting) => set({ isConnecting: connecting }),
}))
