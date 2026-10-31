export default function Placeholder({ title, note }: { title: string; note: string }) {
  return <><h1 className="font-display text-3xl font-bold">{title}</h1><p className="mt-3 max-w-prose text-muted">{note}</p></>
}
