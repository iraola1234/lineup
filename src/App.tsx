import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AuthProvider, useAuth } from './lib/auth'
import { LoginPage } from './pages/LoginPage'
import { CierrePage, ConfiguracionPage, MesPage, PropinasPage, SemanaPage } from './pages/placeholders'

function AppRoutes() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted" role="status">
        Cargando…
      </div>
    )
  }

  if (!session) return <LoginPage />

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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
