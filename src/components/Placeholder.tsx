import { Check, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = {
  icon: ReactNode
  titulo: string
  descripcion: string
  items: string[]
}

/** Pantalla de una sección que llega en la próxima etapa: explica qué va a tener. */
export function Placeholder({ icon, titulo, descripcion, items }: Props) {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 pt-4 pb-10 lg:px-8">
      <div className="flex max-w-xl flex-col gap-5 rounded-3xl border border-line bg-card p-6 shadow-card lg:p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-olive-soft text-olive">{icon}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warn-line bg-warn-soft px-2.5 py-1 text-xs font-medium text-warn">
            <Sparkles size={13} aria-hidden="true" />
            En construcción
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="m-0 text-lg font-semibold tracking-tight">{titulo}</h2>
          <p className="m-0 text-sm leading-relaxed text-muted">{descripcion}</p>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {items.map((it) => (
            <li key={it} className="flex items-start gap-2.5 text-sm text-ink-2">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-olive-soft text-olive">
                <Check size={12} strokeWidth={3} />
              </span>
              {it}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
