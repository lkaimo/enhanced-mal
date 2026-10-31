# Enhanced MyAnimeList

A modern, dark-themed tracker for **anime, manga, manhwa and manhua** that syncs with your [MyAnimeList](https://myanimelist.net) account. Sign in with MyAnimeList, keep your list in sync both ways, and get a cleaner interface, richer statistics, and the ability to track titles MyAnimeList doesn't have.

> **Unofficial project.** Enhanced MyAnimeList is not affiliated with or endorsed by MyAnimeList. It uses the official [MyAnimeList API v2](https://myanimelist.net/apiconfig/references/api/v2). All catalog data and artwork belong to their respective owners.

---

## Features

### Sign in and sync
- **Sign in with MyAnimeList** using OAuth 2.0 with PKCE. Your MAL password is never seen by this app.
- **Two-way sync.** Import your existing list, and every change you make here is pushed back to MyAnimeList.
- **Automatic sync.** Your list refreshes in the background when you open the app or return to the tab, and an optional hourly scheduled sync keeps it current while the app is closed.
- **Safe by design.** Edits that haven't reached MyAnimeList yet are never overwritten by an import, failed updates show a clear status with a **Retry** button, and titles you remove on MyAnimeList disappear here too.

### Discover
- **Home:** popular anime, top movies, top manga, top manhwa and top manhua.
- **Seasonal:** this season's new premieres only (continuing shows from earlier seasons are left out), with a season and year picker going back to 1990.
- **Explore:** live search with Anime, Manga, Manhwa and Manhua filters, ranking shelves (airing now, most popular, upcoming, most favorited and more), shareable search links, and titles that MyAnimeList's default filter would otherwise hide.
- **Quick add:** a **+** button on any cover adds a title to Plan to watch or Plan to read, and cards show when a title is already on your list.
- **Detail pages:** synopsis, genres, dates, score, rank, popularity, related and recommended titles, with your own status, progress and score right on the page.

### Your list
- **MyList** has separate **Anime, Manga, Manhwa and Manhua** tabs.
- **List view or card view**, with status filters, search and sorting.
- **Edit in place:** change status, add an episode or chapter with one click, set a score, or remove a title without leaving the page.

### Manual titles
- **Add titles that aren't on MyAnimeList** with a name, type and optional cover image.
- **Private to your account.** Manual titles and their covers are visible only to you and are never sent to MyAnimeList.
- **Clean deletion.** Deleting a manual title permanently removes the record **and** the uploaded cover image.
- **Show or hide** them on MyList and Statistics with one filter.

### Statistics
- Entry counts, completed counts and chapters read, **broken down separately** for manga, manhwa and manhua, plus episodes watched.
- **Status breakdown charts** for anime, manga, manhwa and manhua, side by side.
- Top genres, score distribution, mean score and completion rate.
- A **line chart of your activity** over the last 12 months.

### Design and accessibility
- Dark, anime-inspired design with an **animated video background** and a readable content panel. It falls back to a still image for visitors who prefer reduced motion or use Data Saver.
- **Fully responsive** across phone, tablet and desktop.
- Keyboard navigation, visible focus states, semantic markup, and text contrast checked against the brightest frame of the background video.

---

## How it improves on MyAnimeList

| | MyAnimeList | Enhanced MyAnimeList |
|---|---|---|
| **Manhwa and manhua** | Filed together with manga as manga types | Their own tabs on MyList and their own statistics |
| **Titles not in the database** | New entries go through MyAnimeList's submission and review process | Add them instantly and privately, with your own cover image |
| **Seasonal anime** | A single season page | Premieres only, with a year and season picker |
| **List editing** | Edit one entry at a time | Inline status, one-click progress and a quick-add button on every cover |
| **Statistics** | Account-level statistics | Per-type breakdowns, status charts side by side, and a monthly activity line chart |
| **Views** | One list layout | Switch between list view and card view |
| **Sync feedback** | Not applicable | Clear sync status on every entry, retry on failure, and automatic background sync |
| **Appearance** | Fixed theme | Dark theme with an animated background and responsive layout |

---

## Tech stack

**Frontend**
- [React](https://react.dev) 18 and [TypeScript](https://www.typescriptlang.org) (strict mode)
- [Vite](https://vitejs.dev) for development and builds
- [React Router](https://reactrouter.com) for navigation
- [TanStack Query](https://tanstack.com/query) for data fetching, caching and optimistic updates
- [Tailwind CSS](https://tailwindcss.com) with a design-token palette
- [Lucide](https://lucide.dev) icons
- A hand-built SVG line chart (no charting library)

**Backend** ([Supabase](https://supabase.com))
- **PostgreSQL** with **Row Level Security**, so every user can only access their own data
- **Supabase Auth** for app sessions
- **Edge Functions** (Deno) for everything that needs a secret: the MyAnimeList OAuth flow, catalog requests, list import and sync, list updates, and manual-title deletion
- **Storage** (private bucket) for manual-title cover images
- **pg_cron** and **pg_net** for the optional scheduled sync

**Data and hosting**
- [MyAnimeList API v2](https://myanimelist.net/apiconfig/references/api/v2) for catalog data and list sync
- [Vercel](https://vercel.com) for hosting the frontend

---

## Security

- MyAnimeList tokens and client secrets are stored **server-side only** and are never exposed to the browser.
- OAuth uses a single-use `state` value and PKCE, and the authorization code is exchanged in an Edge Function.
- All user data is protected by Row Level Security, and privileged actions run in Edge Functions that verify the signed-in user.
- Manual-title covers live in a **private** storage bucket and are served through short-lived signed links.
- Only the public Supabase URL and publishable key are included in the frontend build.
