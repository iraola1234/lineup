// Función de servidor para administrar usuarios del backoffice.
// Solo la puede usar un administrador del local. La clave de servicio
// la pone Supabase como variable de entorno: nunca sale del servidor.
//
// Acciones:
//   crear      { local_id, email, password, nombre, rol, divisiones, empleado_id }
//   contrasena { local_id, usuario_id, password }   (restablecer la de otro usuario)
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

function claveServicio(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  try {
    const nuevas = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
    const primera = Object.values(nuevas)[0]
    if (primera) return primera
  } catch {
    // sin claves nuevas
  }
  throw new Error('Falta la clave de servicio')
}

type Division = { area_id: string; momento: 'dia' | 'noche' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, claveServicio(), { auth: { persistSession: false, autoRefreshToken: false } })

    // 1) Quién llama
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'Hay que iniciar sesión' }, 401)
    const { data: quien, error: errQuien } = await admin.auth.getUser(token)
    if (errQuien || !quien.user) return json({ error: 'Sesión vencida: volvé a entrar' }, 401)

    const body = await req.json()
    const localId = String(body.local_id ?? '')
    if (!localId) return json({ error: 'Falta el local' }, 400)

    // 2) Tiene que ser administrador de ese local
    const { data: yo } = await admin.from('miembros').select('rol').eq('local_id', localId).eq('usuario_id', quien.user.id).maybeSingle()
    if (yo?.rol !== 'admin') return json({ error: 'Solo un administrador puede hacer esto' }, 403)

    const password = String(body.password ?? '')
    if (password.length < 8) return json({ error: 'La contraseña tiene que tener al menos 8 caracteres' }, 400)

    if (body.accion === 'contrasena') {
      const usuarioId = String(body.usuario_id ?? '')
      const { data: m } = await admin.from('miembros').select('usuario_id').eq('local_id', localId).eq('usuario_id', usuarioId).maybeSingle()
      if (!m) return json({ error: 'Ese usuario no es de este local' }, 404)
      const { error } = await admin.auth.admin.updateUserById(usuarioId, { password })
      if (error) return json({ error: 'No se pudo cambiar la contraseña' }, 400)
      return json({ ok: true })
    }

    if (body.accion !== 'crear') return json({ error: 'Acción desconocida' }, 400)

    const email = String(body.email ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'El email no es válido' }, 400)
    const rol = body.rol === 'admin' ? 'admin' : 'encargado'
    const nombre = String(body.nombre ?? '').trim()
    const empleadoId = body.empleado_id ? String(body.empleado_id) : null
    const divisiones: Division[] = rol === 'admin' ? [] : Array.isArray(body.divisiones) ? body.divisiones : []
    if (rol === 'encargado' && divisiones.length === 0) return json({ error: 'Elegí al menos una división' }, 400)

    // 3) Cuenta ya confirmada (sin mail de confirmación)
    const { data: creado, error: errCrear } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre },
    })
    if (errCrear || !creado.user) {
      const existe = /already|registered|exists/i.test(errCrear?.message ?? '')
      return json({ error: existe ? 'Ya hay una cuenta con ese email' : 'No se pudo crear la cuenta' }, existe ? 409 : 400)
    }
    const usuarioId = creado.user.id

    // 4) Acceso al local
    const { error: errMiembro } = await admin.from('miembros').insert({ usuario_id: usuarioId, local_id: localId, rol, email, nombre, empleado_id: empleadoId })
    if (errMiembro) {
      await admin.auth.admin.deleteUser(usuarioId) // no dejar cuentas sueltas
      return json({ error: errMiembro.code === '23505' ? 'Esa ficha de empleado ya está vinculada a otro usuario' : 'No se pudo dar acceso al local' }, 400)
    }
    if (divisiones.length) {
      const { data: areas } = await admin.from('areas').select('id').eq('local_id', localId).is('cierra_con', null)
      const validas = new Set((areas ?? []).map((a) => a.id))
      const filas = divisiones
        .filter((d) => validas.has(d.area_id) && (d.momento === 'dia' || d.momento === 'noche'))
        .map((d) => ({ usuario_id: usuarioId, local_id: localId, area_id: d.area_id, momento: d.momento }))
      if (filas.length) await admin.from('miembro_divisiones').insert(filas)
    }
    await admin.from('invitaciones').delete().eq('local_id', localId).eq('email', email)

    return json({ ok: true, usuario_id: usuarioId })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Error inesperado' }, 500)
  }
})
