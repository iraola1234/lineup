import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AuthProvider, useAuth } from './lib/auth'
import { LocalProvider, useLocal } from './lib/local'
import { ConfiguracionPage } from './pages/configuracion/ConfiguracionPage'
import { LoginPage } from './pages/LoginPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { CierrePage, MesPage, PropinasPage } from './pages/placeholders'
import { SemanaPage } from './pages/semana/SemanaPage'

function Cargando() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted" role="status">
      Cargando…
    </div>
  )
}

function AppRoutes() {
  const { local, loading, error } = useLocal()

  if (loading) return <Cargando />
  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-danger" role="alert">
        {error} Revisá la conexión y recargá la página.
      </div>
    )
  }
  if (!local) return <OnboardingPage />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<SemanaPage />} />
        <Route path="cierre" element={<CierrePage />} />
        <Route path="propinas" element={<PropinasPage />} />
        <Route path="mes" element={<MesPage />} />
        <Route path="configuracion" element={<ConfiguracionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function Gate() {
  const { session, loading } = useAuth()
  if (loading) return <Cargando />
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
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AuthProvider>
  )
}
