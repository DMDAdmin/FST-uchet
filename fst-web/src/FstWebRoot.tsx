import { FstAuthProvider } from '@/context/FstAuthContext'
import { FstWebAuthGate } from '@/components/web/FstWebAuthGate'
import App from '@/App'

export function FstWebRoot() {
  return (
    <FstAuthProvider>
      <FstWebAuthGate>
        <App />
      </FstWebAuthGate>
    </FstAuthProvider>
  )
}
