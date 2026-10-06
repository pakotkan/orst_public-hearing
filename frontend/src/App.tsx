import { lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigationType, useParams } from 'react-router-dom'
import { PublicLayout } from './components/PublicLayout'
import { AdminLayout } from './components/AdminLayout'
import { PostList } from './pages/PostList'
import { PostDetail } from './pages/PostDetail'
import { AuthPage } from './pages/AuthPage'
import { NotFound } from './pages/NotFound'

// Admin pages (and the TipTap editor) load on demand so public visitors never download them.
const Posts = lazy(() => import('./pages/admin/Posts').then((m) => ({ default: m.Posts })))
const PostEditor = lazy(() => import('./pages/admin/PostEditor').then((m) => ({ default: m.PostEditor })))
const PostComments = lazy(() => import('./pages/admin/PostComments').then((m) => ({ default: m.PostComments })))
const Users = lazy(() => import('./pages/admin/Users').then((m) => ({ default: m.Users })))

/** Remount the editor when switching between posts so its state starts fresh. */
function KeyedPostEditor() {
  const { id } = useParams()
  return <PostEditor key={id ?? 'new'} />
}

/**
 * Start each newly opened page at the top. The router keeps the previous page's scroll position otherwise,
 * so opening a post from far down the list landed on its PDF viewer. Back/forward (POP) is left to the browser.
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
          <Route index element={<PostList />} />
          <Route path="posts/:id" element={<PostDetail />} />
          <Route path="login" element={<AuthPage mode="login" />} />
          <Route path="register" element={<AuthPage mode="register" />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Admin-only; AdminLayout redirects everyone else. */}
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="posts" replace />} />
          <Route path="posts" element={<Posts />} />
          <Route path="posts/new" element={<KeyedPostEditor />} />
          <Route path="posts/:id/edit" element={<KeyedPostEditor />} />
          <Route path="posts/:id/comments" element={<PostComments />} />
          <Route path="users" element={<Users />} />
        </Route>
      </Routes>
    </>
  )
}
