import { lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigationType, useParams } from 'react-router-dom'
import { PublicLayout } from './components/PublicLayout'
import { AdminLayout } from './components/AdminLayout'
import { ProjectList } from './pages/ProjectList'
import { ProjectDetail } from './pages/ProjectDetail'
import { AuthPage } from './pages/AuthPage'
import { NotFound } from './pages/NotFound'

// Admin pages (and the TipTap editor) load on demand so public visitors never download them.
const Projects = lazy(() => import('./pages/admin/Projects').then((m) => ({ default: m.Projects })))
const ProjectEditor = lazy(() => import('./pages/admin/ProjectEditor').then((m) => ({ default: m.ProjectEditor })))
const ProjectResponses = lazy(() => import('./pages/admin/ProjectResponses').then((m) => ({ default: m.ProjectResponses })))
const Users = lazy(() => import('./pages/admin/Users').then((m) => ({ default: m.Users })))

/** Remount the editor when switching between projects so its state starts fresh. */
function KeyedProjectEditor() {
  const { id } = useParams()
  return <ProjectEditor key={id ?? 'new'} />
}

/** Old /posts/:id links still work: posts became projects with the same id. */
function PostRedirect() {
  const { id } = useParams()
  return <Navigate to={`/projects/${id}`} replace />
}

/**
 * Start each newly opened page at the top. The router keeps the previous page's scroll position otherwise,
 * so opening a project from far down the list landed on its PDF viewer. Back/forward (POP) is left to the browser.
 */
function ScrollToTop() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  useEffect(() => {
    if (navigationType !== 'POP') window.scrollTo(0, 0)
  }, [pathname, navigationType])
  return null
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<ProjectList />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="posts/:id" element={<PostRedirect />} />
          <Route path="login" element={<AuthPage mode="login" />} />
          <Route path="register" element={<AuthPage mode="register" />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Admin-only; AdminLayout redirects everyone else. */}
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="projects" replace />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/new" element={<KeyedProjectEditor />} />
          <Route path="projects/:id/edit" element={<KeyedProjectEditor />} />
          <Route path="projects/:id/responses" element={<ProjectResponses />} />
          <Route path="users" element={<Users />} />
        </Route>
      </Routes>
    </>
  )
}
