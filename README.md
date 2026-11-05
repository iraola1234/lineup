# Lineup

Horarios semanales, horas reales y reparto de propinas para el equipo de un restaurante. Web app mobile first, instalable en el celular.

**Stack:** React + TypeScript + Vite + Tailwind · Supabase (Postgres, Auth, RLS) · Vercel.

## Puesta en marcha

### 1. Base de datos (Supabase)

1. Crear un proyecto en [supabase.com](https://supabase.com), región **South America (São Paulo)**.
2. **SQL Editor → New query**: pegar todo el contenido de `supabase/migrations/0001_init.sql` y tocar **Run**.
3. **Authentication → Sign In / Providers → Email**: desactivar **"Allow new users to sign up"**. Así nadie puede crearse una cuenta por su cuenta.
4. **Authentication → Users → Add user → Create new user**: crear el usuario del encargado (email + contraseña), marcando **Auto Confirm User**.
5. **Project Settings → API**: copiar la **Project URL** y la **anon public key**.

> La `service_role` key **nunca** va en este repo, en Vercel ni se comparte.

### 2. Deploy (Vercel)

1. En [vercel.com](https://vercel.com): **Add New → Project** → importar este repo desde GitHub.
2. Framework: **Vite** (se detecta solo).
3. **Environment Variables**: agregar
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon public key
4. **Deploy**. Cada push a `main` vuelve a publicar automáticamente.

### 3. Instalar en el celular

Abrir el link de Vercel en el celular → menú del navegador → **"Agregar a pantalla de inicio"**.

## Desarrollo local

```bash
cp .env.example .env.local   # completar con los datos de Supabase
npm install
npm run dev
```

## Estructura

```
src/
  components/   Layout (navegación inferior), PageHeader, íconos
  lib/          cliente de Supabase y sesión
  pages/        pantallas (Semana, Cierre, Propinas, Mes, Configuración, Login)
supabase/
  migrations/   scripts SQL de la base de datos
```

## Etapas

| Etapa | Estado |
|---|---|
| 0. Setup: repo, base de datos, deploy | ✅ |
| 1. Login, Configuración (empleados, áreas, turnos) | pendiente |
| 2. Semana: vista por horas y lista, asignar, copiar, compartir | pendiente |
| 3. Cierre del día, propinas, resumen mensual | pendiente |
| 4. Prueba real con la plantilla | pendiente |
