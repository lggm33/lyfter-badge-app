# Lyfter Badge App

Plataforma mobile-first para convertir la asistencia a eventos en badges, XP y recompensas.

## Estado actual

La fundación está lista: Next.js con App Router, TypeScript, Tailwind CSS y ESLint. La landing inicial usa la identidad visual de Lyfter y no requiere servicios externos.

## Requisitos

- Node.js compatible con Next.js 16
- pnpm 11+
- Docker (Postgres local)

## Desarrollo local

    cp .env.example .env   # completá los secretos
    docker compose up -d   # Postgres 17 en localhost:5433 (pnpm dev también lo levanta)
    pnpm install
    pnpm db:migrate
    pnpm db:seed
    pnpm db:seed:dev       # opcional: empresa, evento y participante de demo
    pnpm dev

Abrí http://localhost:3000.

El contenedor crea dos bases: `lyfter_dev` (la de `.env`, para `pnpm dev`) y
`lyfter_test` (la de `.env.test`, para `pnpm test`). La DB de Railway es
producción: solo la usan Vercel y el deploy de GitHub Actions, nunca el `.env`
local.

`pnpm test` migra `lyfter_test` antes de correr y se niega a arrancar si
`DATABASE_URL` no apunta a `localhost`. Para empezar de cero:
`docker compose down -v && docker compose up -d`.

## Comandos

    pnpm dev          # levanta Postgres (Docker) y el servidor de desarrollo
    pnpm lint         # validación de ESLint
    pnpm test         # tests de integración contra lyfter_test (requiere docker compose up)
    pnpm start        # servidor de producción
    pnpm db:generate  # genera migraciones desde el schema
    pnpm db:migrate   # aplica migraciones pendientes
    pnpm db:seed      # crea/promueve el Super Admin inicial (idempotente)
    pnpm db:seed:dev  # datos de demo en la DB local (idempotente, se niega fuera de localhost)

`pnpm db:seed:dev` crea la empresa **Lyfter Demo** con el evento activo
**Demo Day**, que vuelve a abrirse por 30 días cada vez que corrés el seed, y
cuatro badges. Las dos cuentas usan la contraseña `lyfter-dev-1234`:

- `admin@demo.test`: COMPANY_ADMIN de Lyfter Demo, para ver los QR del evento.
- `participante@demo.test`: con check-in y dos badges canjeados (150 XP, nivel 2).
  Si escanea **Stand de datos** llega a 200 XP y ve el aviso de subida al nivel 3.

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
| Participante | `/home`, `/badges`, `/leaderboard` | Usuario autenticado |
| Check-in y canje | `/scan` | Público. Sin sesión pregunta si ya hay cuenta. El canje abre `/badge/[badgeId]`. |
| Badge obtenido | `/badge/[badgeId]` | Usuario autenticado que canjeó ese badge. |
| Administrador de empresa | `/company/[companyId]` | Usuario autenticado con membresía de esa empresa. Un `SUPER_ADMIN` sin membresía no entra. |
| Login de Super Admin | `/admin/login` | Público; solo permite ingresar a usuarios `SUPER_ADMIN` |
| Super administrador | `/admin`, `/admin/companies`, `/admin/companies/[companyId]`, `/admin/users`, `/admin/audit` | Usuario autenticado con rol `SUPER_ADMIN` |

Actualmente están disponibles `/home` (con acceso a las empresas del usuario si
tiene membresías), `/badges` (historial por evento), `/badge/[badgeId]`,
`/scan` (check-in por QR), `/admin/login`, `/admin/companies`,
`/admin/companies/[companyId]` (asignar y quitar administradores de empresa) y
`/company/[companyId]`. Las demás rutas se agregarán junto con sus slices
funcionales.

## Próximas fases

1. Persistencia con PostgreSQL y Drizzle.
2. Autenticación y autorización por roles.
3. Empresas, eventos, badges y estaciones QR.
4. Check-in, redenciones, XP y leaderboards.

Los requisitos completos están en Requirements.md.
