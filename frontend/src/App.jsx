import { Navigate, Route, Routes } from 'react-router-dom'
import SiteFooter from './components/layout/SiteFooter'
import SiteHeader from './components/layout/SiteHeader'
import LandingPage from './pages/LandingPage'
import AnalyzePage from './pages/AnalyzePage'
import ResultsPage from './pages/ResultsPage'
import HistoryPage from './pages/HistoryPage'
import NotFoundPage from './pages/NotFoundPage'
import AuthPage from './pages/AuthPage.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import MattersPage from './pages/MattersPage.jsx'
import RequireAuth from './components/layout/RequireAuth.jsx'
import MatterDetailPage from './pages/MatterDetailPage.jsx'

export default function App() {
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/analyze" element={<AnalyzePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/results/*" element={<Navigate to="/results" replace />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/matters" element={<RequireAuth><MattersPage /></RequireAuth>} />
            <Route path="/matters/:id" element={<RequireAuth><MatterDetailPage /></RequireAuth>} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <SiteFooter />
      </div>
    </AuthProvider>
  )
}
