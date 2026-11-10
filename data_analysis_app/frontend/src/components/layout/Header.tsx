import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import UploadActivityModal from '../activity/UploadActivityModal'
import { useAuth } from '../../context/AuthContext'

interface HeaderProps {
  onActivityUploaded?: () => void
}

const NAV_ITEMS = [
  { label: 'Edit Activities', path: '/app' },
  { label: 'View Analysis', path: '/analysis' },
  { label: 'Build Models', path: '/build-model' },
  { label: 'Plan Routes', path: '/plan-routes' },
]

const CONTACT_EMAIL = 'downwind.consulting@gmail.com'

function Header({ onActivityUploaded }: HeaderProps) {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin, email, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const handleCopyEmail = async () => {
    await navigator.clipboard.writeText(CONTACT_EMAIL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleUploadSuccess = ({ activityId, isPlanned }: { activityId: string; isPlanned: boolean }) => {
    if (onActivityUploaded) {
      onActivityUploaded()
    }
    navigate(isPlanned ? '/plan-routes' : '/app', { state: { selectedActivityId: activityId } })
  }

  return (
    <>
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <button className="text-left cursor-pointer" onClick={() => navigate('/')}>
              <h1 className="text-3xl font-bold text-gray-900">Mountain G.O.A.T.</h1>
              <p className="mt-1 text-sm text-gray-500">Generative Outdoor Activity Tracker</p>
            </button>

            {/* Desktop Action Buttons */}
            <div className="hidden md:flex space-x-4">
              <button
                className="btn-primary"
                onClick={() => setIsUploadModalOpen(true)}
              >
                Add Activity
              </button>
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.path}
                  className={location.pathname === item.path ? 'btn-nav-active' : 'btn-nav'}
                  onClick={() => navigate(item.path)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Mobile Hamburger Menu Button */}
            <button
              className="md:hidden p-2 rounded-md hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                // Close icon (X)
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                // Hamburger icon (3 lines)
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-3 space-y-2">
              <button
                className="btn-primary w-full"
                onClick={() => {
                  setIsUploadModalOpen(true)
                  setMobileMenuOpen(false)
                }}
              >
                Add Activity
              </button>
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.path}
                  className={`w-full text-left px-4 py-2 rounded ${
                    location.pathname === item.path
                      ? 'bg-accent-50 text-accent-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    navigate(item.path)
                    setMobileMenuOpen(false)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Admin logged in banner */}
      {isAdmin && (
        <div className="bg-gray-700 text-white text-sm py-2">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
            <span>Logged in as Admin</span>
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-white text-gray-700 rounded font-medium hover:bg-gray-100"
            >
              Log Out
            </button>
          </div>
        </div>
      )}

      {/* Viewer mode banner */}
      {!isAdmin && (
        <div className="bg-accent-600 text-white text-sm py-2">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center md:justify-between gap-1 md:gap-4">
            <span>You are in Viewer Mode, some functionality is disabled.</span>
            <span className="flex items-center gap-2 md:flex-shrink-0">
              For a full demo contact Nate Downer
              <button
                onClick={handleCopyEmail}
                className="px-2 py-0.5 bg-white text-accent-600 rounded font-medium hover:bg-gray-100"
              >
                {copied ? 'Email Copied' : 'Contact'}
              </button>
            </span>
          </div>
        </div>
      )}

      <UploadActivityModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </>
  )
}

export default Header
