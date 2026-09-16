# Lyfter Badge App

Plataforma mobile-first para convertir la asistencia a eventos en badges, XP y recompensas.

## Estado actual

La fundación está lista: Next.js con App Router, TypeScript, Tailwind CSS y ESLint. La landing inicial usa la identidad visual de Lyfter y no requiere servicios externos.

## Requisitos

- Node.js compatible con Next.js 16
- pnpm 11+

## Desarrollo local

    pnpm install
    pnpm dev

Abrí http://localhost:3000.

## Comandos

    pnpm dev          # servidor de desarrollo
    pnpm lint         # validación de ESLint
    pnpm test         # tests de integración (requiere DATABASE_URL)
    pnpm start        # servidor de producción
    pnpm db:generate  # genera migraciones desde el schema
    pnpm db:migrate   # aplica migraciones pendientes
    pnpm db:seed      # crea/promueve el Super Admin inicial (idempotente)

`pnpm db:seed` lee `SUPER_ADMIN_EMAIL` y `SUPER_ADMIN_PASSWORD` de `.env`. Si el
email ya existe solo garantiza el rol `SUPER_ADMIN`; nunca pisa la contraseña.

## Estructura actual

    app/
      globals.css  # estilos globales y paleta Lyfter
      layout.tsx   # layout raíz y metadata
      page.tsx     # landing page
    public/        # assets estáticos
    mocks/         # referencias visuales del proyecto

## Rutas por experiencia

Cada experiencia tiene su propio espacio. La autorización se valida siempre en
el servidor; los grupos de rutas solo organizan la navegación.

| Experiencia | Ruta base | Acceso |
| --- | --- | --- |
| Participante | `/home`, `/scan`, `/badges`, `/leaderboard` | Usuario autenticado |
| Administrador de empresa | `/company/[companyId]` | Usuario autenticado con membresía de esa empresa. Un `SUPER_ADMIN` sin membresía no entra. |
| Login de Super Admin | `/admin/login` | Público; solo permite ingresar a usuarios `SUPER_ADMIN` |
| Super administrador | `/admin`, `/admin/companies`, `/admin/companies/[companyId]`, `/admin/users`, `/admin/audit` | Usuario autenticado con rol `SUPER_ADMIN` |

Actualmente están disponibles `/home` (con acceso a las empresas del usuario si
tiene membresías), `/admin/login`, `/admin/companies`,
`/admin/companies/[companyId]` (asignar y quitar administradores de empresa) y
`/company/[companyId]`. Las demás rutas se agregarán junto con sus slices
funcionales.

## Próximas fases

1. Persistencia con PostgreSQL y Drizzle.
2. Autenticación y autorización por roles.
3. Empresas, eventos, badges y estaciones QR.
4. Check-in, redenciones, XP y leaderboards.

Los requisitos completos están en Requirements.md.
