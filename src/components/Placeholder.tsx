type Props = {
  etapa: string
  items: string[]
}

/** Marcador temporal para las pantallas que llegan en etapas siguientes. */
export function Placeholder({ etapa, items }: Props) {
  return (
    <div className="p-4 lg:px-8">
      <div className="flex max-w-2xl flex-col gap-3 rounded-2xl border border-line bg-card p-4 lg:p-6">
        <span className="self-start rounded-full border border-manana-bd bg-manana-bg px-2.5 py-0.5 text-xs font-medium text-manana-fg">
          {etapa}
        </span>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm text-muted">
          {items.map((it) => (
            <li key={it} className="flex gap-2">
              <span aria-hidden="true">·</span>
              {it}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
