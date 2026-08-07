import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/app-shell'
import { ContinuePage } from '@/pages/continue'
import { HistoryDetailPage, HistoryPage } from '@/pages/history'
import { HomePage } from '@/pages/home'
import { HostConfigPage, HostPage } from '@/pages/host'
import { JoinPage } from '@/pages/join'
import { SessionPage } from '@/pages/session'

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/host" element={<HostPage />} />
        <Route path="/host/:gameId" element={<HostConfigPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/continue" element={<ContinuePage />} />
        <Route path="/session/:code" element={<SessionPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/history/:id" element={<HistoryDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
