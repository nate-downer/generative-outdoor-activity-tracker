import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import HomePage from './pages/HomePage'
import AnalysisPage from './pages/AnalysisPage'
import ModelDiagnosticsPage from './pages/ModelDiagnosticsPage'
import PlanRoutesPage from './pages/PlanRoutesPage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import { AuthProvider } from './context/AuthContext'

function App() {
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      // Move background at half speed (parallax effect)
      document.body.style.backgroundPosition = `0 ${scrollY * 0.5}px`
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#363636',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981', // green-500
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444', // red-500
                secondary: '#fff',
              },
            },
          }}
        />
        <div className="min-h-screen">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app" element={<HomePage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/build-model" element={<ModelDiagnosticsPage />} />
            <Route path="/plan-routes" element={<PlanRoutesPage />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
