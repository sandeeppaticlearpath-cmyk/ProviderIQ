import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CandidatesPage from './pages/CandidatesPage'
import CandidateDetailPage from './pages/CandidateDetailPage'
import JobsPage from './pages/JobsPage'
import JobDetailPage from './pages/JobDetailPage'
import PipelinePage from './pages/PipelinePage'
import OutreachPage from './pages/OutreachPage'
import ProvidersPage from './pages/ProvidersPage'
import AnalyticsPage from './pages/AnalyticsPage'
import BOBPage from './pages/BOBPage'
import ManagerPage from './pages/ManagerPage'
import UploadPage from './pages/UploadPage'
import SourcePage from './pages/SourcePage'
import PlacementsPage from './pages/PlacementsPage'
import IntegrationsPage from './pages/IntegrationsPage'
import SettingsPage from './pages/SettingsPage'

function Protected({ children }) {
  const user = useAuthStore(s => s.user)
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"    element={<DashboardPage />} />
        <Route path="candidates"   element={<CandidatesPage />} />
        <Route path="candidates/:id" element={<CandidateDetailPage />} />
        <Route path="jobs"         element={<JobsPage />} />
        <Route path="jobs/:id"     element={<JobDetailPage />} />
        <Route path="pipeline"     element={<PipelinePage />} />
        <Route path="outreach"     element={<OutreachPage />} />
        <Route path="upload"       element={<UploadPage />} />
        <Route path="source"       element={<SourcePage />} />
        <Route path="providers"    element={<ProvidersPage />} />
        <Route path="analytics"    element={<AnalyticsPage />} />
        <Route path="bob"          element={<BOBPage />} />
        <Route path="manager"      element={<ManagerPage />} />
        <Route path="placements"   element={<PlacementsPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        <Route path="settings"     element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
