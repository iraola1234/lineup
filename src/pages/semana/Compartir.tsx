import { toBlob } from 'html-to-image'
import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { Button, Notice, Sheet } from '../../components/ui'
import { ImagenSemana } from './ImagenSemana'

type Props = ComponentProps<typeof ImagenSemana> & { open: boolean; onClose: () => void }

/**
 * Genera la imagen de la semana y la deja lista para mandar.
 * La imagen se arma ANTES de tocar "Compartir": en iPhone, compartir tiene que
 * ocurrir enseguida del toque, sin esperas.
 */
export function Compartir({ open, onClose, ...imagen }: Props) {
  const nodo = useRef<HTMLDivElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelado = false
    let objectUrl: string | null = null
    setArchivo(null)
    setUrl(null)
    setError(null)
    ;(async () => {
      try {
        await document.fonts.ready
        await new Promise((r) => requestAnimationFrame(() => r(null)))
        if (!nodo.current) return
        const blob = await toBlob(nodo.current, { pixelRatio: 2, backgroundColor: '#FFFFFF', cacheBust: true })
        if (!blob || cancelado) return
        const f = new File([blob], `horarios-${imagen.lunes}.png`, { type: 'image/png' })
        objectUrl = URL.createObjectURL(blob)
        setArchivo(f)
        setUrl(objectUrl)
      } catch {
        if (!cancelado) setError('No se pudo generar la imagen. Probá de nuevo.')
      }
    })()
    return () => {
      cancelado = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // La imagen se genera al abrir; si cambian los turnos se vuelve a abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const puedeCompartir =
    !!archivo && typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [archivo] })

  const compartir = async () => {
    if (!archivo) return
    try {
      await navigator.share({ files: [archivo], title: 'Horarios de la semana' })
    } catch {
      // el usuario canceló el menú de compartir: no es un error
    }
  }

  const descargar = () => {
    if (!url || !archivo) return
    const a = document.createElement('a')
    a.href = url
    a.download = archivo.name
    a.click()
  }

  return (
    <>
      {open && (
        <div aria-hidden="true" style={{ position: 'fixed', left: -20000, top: 0, pointerEvents: 'none' }}>
          <ImagenSemana ref={nodo} {...imagen} />
        </div>
      )}
      <Sheet
        open={open}
        title="Compartir la semana"
        onClose={onClose}
        footer={
          <>
            <span className="flex-1" />
            <Button onClick={descargar} disabled={!url}>
              Descargar
            </Button>
            {puedeCompartir && (
              <Button variant="primary" onClick={compartir}>
                Compartir
              </Button>
            )}
          </>
        }
      >
        {error && <Notice tone="error">{error}</Notice>}
        {!url && !error && (
          <p role="status" className="m-0 py-10 text-center text-sm text-muted">
            Armando la imagen…
          </p>
        )}
        {url && (
          <>
            <img src={url} alt="Vista previa de la imagen con los horarios de la semana" className="w-full rounded-xl border border-line" />
            <p className="m-0 text-xs text-muted">
              {puedeCompartir
                ? 'Tocá Compartir y elegí WhatsApp y el grupo del equipo.'
                : 'Descargala y mandala al grupo de WhatsApp desde WhatsApp Web o el celular.'}
            </p>
          </>
        )}
      </Sheet>
    </>
  )
}
