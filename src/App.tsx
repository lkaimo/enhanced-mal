import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/Home'
import SeasonalPage from './pages/Seasonal'
import ExplorePage from './pages/Explore'
import LoginPage from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import SettingsPage from './pages/Settings'
import MyListPage from './pages/MyList'
import DetailPage from './pages/Detail'
import StatisticsPage from './pages/Statistics'
import { RequireAuth } from './lib/auth'
import AppBackground from './components/AppBackground'

export default function App() {
  return (
    <>
    <AppBackground />
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="seasonal" element={<SeasonalPage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="anime/:id" element={<DetailPage type="anime" />} />
        <Route path="manga/:id" element={<DetailPage type="manga" />} />
        <Route path="mylist" element={<RequireAuth><MyListPage /></RequireAuth>} />
        <Route path="statistics" element={<RequireAuth><StatisticsPage /></RequireAuth>} />
        <Route path="settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
      </Route>
    </Routes>
    </>
  )
}
