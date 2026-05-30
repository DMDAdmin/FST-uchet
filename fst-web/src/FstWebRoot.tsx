import { FstAuthProvider, useFstAuth } from '@/context/FstAuthContext'
import { FstWebAuthGate } from '@/components/web/FstWebAuthGate'
import App from '@/App'

function AppWithFstAccess() {
  const { isAdmin } = useFstAuth()
  return <App forceFullAccess={isAdmin} />
}

export function FstWebRoot() {
  return (
    <FstAuthProvider>
      <FstWebAuthGate>
        <AppWithFstAccess />
      </FstWebAuthGate>
    </FstAuthProvider>
  )
}
