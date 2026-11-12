import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/toast'
import { AuthProvider, useAuth } from './lib/auth'
import { DataProvider } from './lib/data'
import { LocalProvider, useLocal } from './lib/local'
import { ConfiguracionPage } from './pages/configuracion/ConfiguracionPage'
import { LoginPage } from './pages/LoginPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { CierrePage } from './pages/cierre/CierrePage'
import { MesPage } from './pages/mes/MesPage'
import { PropinasPage } from './pages/propinas/PropinasPage'
import { SemanaPage } from './pages/semana/SemanaPage'

function Splash() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4" role="status" aria-label="Cargando">
      <img src="/favicon.svg" alt="" className="size-12 animate-pulse rounded-2xl" />
    </div>
  )
}

function AppRoutes() {
  const { local, loading, error, esAdmin } = useLocal()

  if (loading) return <Splash />
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
        <p className="m-0 text-sm text-danger">{error}</p>
        <button type="button" onClick={() => location.reload()} className="h-11 rounded-xl border border-line bg-card px-4 text-sm font-semibold hover:bg-hover">
          Reintentar
        </button>
      </div>
    )
  }
  if (!local) return <OnboardingPage />

  return (
    <DataProvider localId={local.id}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<SemanaPage />} />
          <Route path="cierre" element={<CierrePage />} />
          <Route path="propinas" element={<PropinasPage />} />
          <Route path="mes" element={<MesPage />} />
          <Route path="configuracion" element={esAdmin ? <ConfiguracionPage /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}

function Gate() {
  const { session, loading } = useAuth()
  if (loading) return <Splash />
  if (!session) return <LoginPage />
  return (
    <LocalProvider>
      <AppRoutes />
    </LocalProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Gate />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
