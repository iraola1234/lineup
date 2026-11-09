import ExcelJS from 'exceljs'
import { DIAS } from '../../lib/fechas'
import { nombreMes } from '../../lib/mes'
import { horasReales } from '../../lib/semana'
import { hhmm } from '../../lib/time'
import type { ResumenMes } from './calculo'

const OLIVA = 'FF55624A'
const FONDO_TOTAL = 'FFF3F2EE'
const BORDE = 'FFE6E4DD'
const FMT_HORAS = '0.0'
const FMT_PESOS = '"$" #,##0'
const FMT_FECHA = 'dd/mm/yyyy'
const ESTADOS = { sin: 'Sin turnos', futuro: 'Futuro', pendiente: 'Sin cerrar', confirmado: 'Confirmado' } as const

const fecha = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const dia = (s: string) => DIAS[(new Date(fecha(s)).getUTCDay() + 6) % 7]

/** Título, encabezado con estilo y anchos de columna. Devuelve la fila del encabezado. */
function preparar(ws: ExcelJS.Worksheet, titulo: string, columnas: { header: string; width: number; fmt?: string }[]) {
  ws.getCell('A1').value = titulo
  ws.getCell('A1').font = { bold: true, size: 14 }
  ws.mergeCells(1, 1, 1, columnas.length)
  const head = ws.getRow(3)
  columnas.forEach((c, i) => {
    const col = ws.getColumn(i + 1)
    col.width = c.width
    if (c.fmt) col.numFmt = c.fmt
    const cell = head.getCell(i + 1)
    cell.value = c.header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: OLIVA } }
    cell.alignment = { vertical: 'middle', horizontal: c.fmt ? 'right' : 'left' }
  })
  head.height = 22
  ws.views = [{ state: 'frozen', ySplit: 3 }]
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: columnas.length } }
}

function bordes(ws: ExcelJS.Worksheet, desde: number, hasta: number, cols: number) {
  for (let r = desde; r <= hasta; r++)
    for (let c = 1; c <= cols; c++) ws.getRow(r).getCell(c).border = { bottom: { style: 'thin', color: { argb: BORDE } } }
}

function filaTotal(ws: ExcelJS.Worksheet, fila: number, sumar: number[], hasta: number, cols: number) {
  const row = ws.getRow(fila)
  row.getCell(1).value = 'Total'
  for (const c of sumar) {
    const letra = ws.getColumn(c).letter
    row.getCell(c).value = { formula: `SUBTOTAL(9,${letra}4:${letra}${hasta})` }
  }
  for (let c = 1; c <= cols; c++) {
    row.getCell(c).font = { bold: true }
    row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FONDO_TOTAL } }
  }
}

export async function exportarExcel(r: ResumenMes, mes: string, local: string) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Lineup'
  wb.created = new Date()
  const titulo = `${local} · ${nombreMes(mes)}`

  /* ---- Resumen por persona ---- */
  const res = wb.addWorksheet('Resumen')
  const colsRes = [
    { header: 'Área', width: 14 },
    { header: 'Persona', width: 26 },
    { header: 'Puesto', width: 18 },
    { header: 'Días trabajados', width: 15, fmt: '0' },
    { header: 'Ausencias', width: 11, fmt: '0' },
    { header: 'Horas planificadas', width: 18, fmt: FMT_HORAS },
    { header: 'Horas reales', width: 14, fmt: FMT_HORAS },
    { header: 'Diferencia', width: 12, fmt: '+0.0;-0.0;0' },
    { header: 'Propina', width: 14, fmt: FMT_PESOS },
  ]
  preparar(res, `${titulo} · Resumen`, colsRes)
  r.personas.forEach((p, i) => {
    const n = 4 + i
    res.getRow(n).values = [p.area?.nombre ?? '', p.emp.nombre, p.emp.puesto, p.dias, p.ausencias, p.plan, p.reales, { formula: `G${n}-F${n}` }, Math.round(p.propina * 100) / 100]
  })
  const finRes = 3 + r.personas.length
  bordes(res, 4, finRes, colsRes.length)
  filaTotal(res, finRes + 1, [4, 5, 6, 7, 8, 9], finRes, colsRes.length)
  if (r.totales.diasPendientes > 0) {
    res.getCell(`A${finRes + 3}`).value = `Atención: ${r.totales.diasPendientes} día(s) sin cerrar. En esos días se cuentan las horas planificadas.`
    res.getCell(`A${finRes + 3}`).font = { italic: true, color: { argb: 'FF8A5A12' } }
  }

  /* ---- Detalle por turno ---- */
  const det = wb.addWorksheet('Detalle')
  const colsDet = [
    { header: 'Fecha', width: 12, fmt: FMT_FECHA },
    { header: 'Día', width: 11 },
    { header: 'Persona', width: 26 },
    { header: 'Área', width: 14 },
    { header: 'Turno', width: 14 },
    { header: 'Entrada', width: 9 },
    { header: 'Salida', width: 9 },
    { header: 'Horas planificadas', width: 18, fmt: FMT_HORAS },
    { header: 'Horas reales', width: 14, fmt: FMT_HORAS },
    { header: 'Ausente', width: 10 },
    { header: 'Propina del día', width: 15, fmt: FMT_PESOS },
    { header: 'Estado del día', width: 14 },
  ]
  preparar(det, `${titulo} · Detalle por turno`, colsDet)
  const estadoDe = new Map(r.dias.map((d) => [d.fecha, d.estado]))
  const filas = r.personas
    .flatMap((p) => p.turnos.map((a) => ({ p, a })))
    .sort((x, y) => x.a.fecha_jornada.localeCompare(y.a.fecha_jornada) || x.a.inicio_plan.localeCompare(y.a.inicio_plan) || x.p.emp.nombre.localeCompare(y.p.emp.nombre))
  const yaCobro = new Set<string>()
  filas.forEach(({ p, a }, i) => {
    const k = `${a.empleado_id}|${a.fecha_jornada}`
    // La propina es por persona y día: se escribe una sola vez aunque tenga turno partido
    const parte = !a.ausente && !yaCobro.has(k) ? (r.partes.get(k) ?? 0) : 0
    if (!a.ausente) yaCobro.add(k)
    det.getRow(4 + i).values = [
      fecha(a.fecha_jornada),
      dia(a.fecha_jornada),
      p.emp.nombre,
      p.area?.nombre ?? '',
      a.nombre_turno,
      hhmm(a.inicio_plan),
      hhmm(a.fin_plan),
      Number(a.horas_plan),
      horasReales(a),
      a.ausente ? 'Sí' : 'No',
      Math.round(parte * 100) / 100,
      ESTADOS[estadoDe.get(a.fecha_jornada) ?? 'sin'],
    ]
  })
  const finDet = 3 + filas.length
  bordes(det, 4, finDet, colsDet.length)
  filaTotal(det, finDet + 1, [8, 9, 11], finDet, colsDet.length)

  /* ---- Por día ---- */
  const dias = wb.addWorksheet('Días')
  const colsDias = [
    { header: 'Fecha', width: 12, fmt: FMT_FECHA },
    { header: 'Día', width: 11 },
    { header: 'Estado', width: 13 },
    { header: 'Personas', width: 10, fmt: '0' },
    { header: 'Horas planificadas', width: 18, fmt: FMT_HORAS },
    { header: 'Horas reales', width: 14, fmt: FMT_HORAS },
    { header: 'Propina', width: 14, fmt: FMT_PESOS },
    { header: '$ por hora', width: 12, fmt: '"$" #,##0.00' },
  ]
  preparar(dias, `${titulo} · Por día`, colsDias)
  r.dias.forEach((d, i) => {
    dias.getRow(4 + i).values = [
      fecha(d.fecha),
      dia(d.fecha),
      ESTADOS[d.estado],
      d.personas,
      d.plan,
      d.reales,
      d.reparto?.monto ?? 0,
      d.reparto ? Math.round(d.reparto.valorHora * 100) / 100 : null,
    ]
  })
  const finDias = 3 + r.dias.length
  bordes(dias, 4, finDias, colsDias.length)
  filaTotal(dias, finDias + 1, [5, 6, 7], finDias, colsDias.length)

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${local} - ${nombreMes(mes)}.xlsx`.replace(/[\\/:*?"<>|]/g, '')
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
