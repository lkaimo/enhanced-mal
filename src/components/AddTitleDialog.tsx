import { useEffect, useMemo, useState } from 'react'
import { createCustom, KINDS, type CustomKind } from '../lib/custom'

const field = 'mt-1 w-full rounded-lg border border-line bg-background px-3 py-2 text-sm'

export function AddTitleDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<CustomKind>('manhwa')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose])

  function pick(f: File | null) {
    setError(null)
    if (f && !/^image\/(png|jpe?g|webp)$/.test(f.type)) { setError('Choose a PNG, JPG or WebP image.'); return }
    if (f && f.size > 10 * 1024 * 1024) { setError('That image is over 10 MB. Choose a smaller one.'); return }
    setFile(f)
  }
  async function submit() {
    const t = title.trim()
    if (!t) { setError('Enter a title.'); return }
    if (t.length > 200) { setError('The title is too long (200 characters max).'); return }
    setSaving(true); setError(null)
    try { await createCustom({ title: t, kind, file }); onDone() }
    catch (e) { setError(({ upload_failed: 'The cover upload failed. Try again.', unauthorized: 'Please sign in again.' } as Record<string, string>)[(e as Error).message] ?? 'Couldn’t save the title. Try again.'); setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Add a title manually" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg font-bold">Add a title manually</h2>
        <p className="mt-1 text-xs text-muted">For titles that aren’t on MyAnimeList. Only your account can see it, and it is never sent to MyAnimeList.</p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-muted">Title
            <input autoFocus value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className={field} /></label>
          <label className="block text-sm text-muted">Type
            <select value={kind} onChange={(e) => setKind(e.target.value as CustomKind)} className={field}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="block text-sm text-muted">Cover image (optional)
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => pick(e.target.files?.[0] ?? null)} className={`${field} file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-bold file:text-background`} /></label>
          {preview && <img src={preview} alt="Cover preview" className="h-40 w-auto rounded-lg border border-line object-cover" />}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-primary">{error}</p>}
        <div className="mt-5 flex gap-3">
          <button disabled={saving} onClick={submit} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-background disabled:opacity-60">{saving ? 'Saving…' : 'Add title'}</button>
          <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm hover:border-primary">Cancel</button>
        </div>
      </div>
    </div>
  )
}
