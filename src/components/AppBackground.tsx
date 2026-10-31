import { useEffect, useRef, useState } from 'react'

/** Set to false to bring back the plain dark background (nothing else needs to change). */
const ENABLED = true
/** Overlay over the video. Kept light so the video shows around the edges; text sits on the reading panel in Layout.tsx. */
const SCRIM = 'bg-background/45'

// Reduced motion or Data Saver: show one still frame instead of loading and playing the video.
const wantsStill = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches || Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)

export default function AppBackground() {
  const video = useRef<HTMLVideoElement>(null)
  const [still, setStill] = useState(wantsStill)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setStill(wantsStill())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const v = video.current
    if (!v) return
    v.muted = true // browsers only allow autoplay when muted
    v.play().catch(() => { /* autoplay blocked: the poster frame stays visible */ })
  }, [still])

  if (!ENABLED) return null
  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden bg-background">
      {still ? (
        <img src="/bg/poster.jpg" alt="" className="h-full w-full object-cover" />
      ) : (
        <video ref={video} src="/bg/bg.mp4" poster="/bg/poster.jpg" autoPlay muted loop playsInline preload="auto" disablePictureInPicture className="h-full w-full object-cover" />
      )}
      <div className={`absolute inset-0 ${SCRIM}`} />
    </div>
  )
}
