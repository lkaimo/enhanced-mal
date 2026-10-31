import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/Home'
import ExplorePage from './pages/Explore'
import LoginPage from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import SettingsPage from './pages/Settings'
import MyListPage from './pages/MyList'
import Placeholder from './pages/Placeholder'
import { RequireAuth } from './lib/auth'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="anime/:id" element={<Placeholder title="Anime details" note="Next milestone: details view with list status editing." />} />
        <Route path="manga/:id" element={<Placeholder title="Manga details" note="Next milestone: details view with list status editing." />} />
        <Route path="mylist" element={<RequireAuth><MyListPage /></RequireAuth>} />
        <Route path="statistics" element={<RequireAuth><Placeholder title="Statistics" note="Next milestone: computed from your list_entries." /></RequireAuth>} />
        <Route path="settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
      </Route>
    </Routes>
  )
}
