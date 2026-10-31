import { NavLink, Outlet } from 'react-router-dom'
import AutoSync from './AutoSync'
import { Home, CalendarDays, Compass, ListChecks, BarChart3, Settings } from 'lucide-react'

const nav = [
  { to: '/', label: 'Home', icon: Home }, { to: '/seasonal', label: 'Seasonal', icon: CalendarDays },
  { to: '/explore', label: 'Explore', icon: Compass }, { to: '/mylist', label: 'MyList', icon: ListChecks },
  { to: '/statistics', label: 'Statistics', icon: BarChart3 }, { to: '/settings', label: 'Settings', icon: Settings }
]

export default function Layout() {
  return (
    <div className="min-h-screen md:flex">
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-line bg-surface p-2 md:sticky md:inset-auto md:top-0 md:h-screen md:w-56 md:shrink-0 md:self-start md:flex-col md:justify-start md:gap-1 md:border-r md:border-t-0 md:p-4">
        <span className="hidden px-3 pb-6 pt-2 font-display text-lg font-bold md:block">Enhanced <span className="text-primary">MAL</span></span>
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? 'bg-primary/15 font-bold text-primary' : 'text-muted hover:text-ink'}`}>
            <Icon size={18} aria-hidden /><span className="max-md:sr-only">{label}</span>
          </NavLink>
        ))}
      </nav>
      <AutoSync />
      <main className="mx-auto min-h-screen w-full max-w-6xl bg-background/75 px-4 pb-24 pt-8 backdrop-blur-md md:my-6 md:min-h-[calc(100vh-3rem)] md:rounded-2xl md:px-8 md:pb-12"><Outlet /></main>
    </div>
  )
}
