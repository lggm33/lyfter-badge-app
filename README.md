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

    pnpm dev       # servidor de desarrollo
    pnpm lint      # validación de ESLint
    pnpm start     # servidor de producción

## Estructura actual

    app/
      globals.css  # estilos globales y paleta Lyfter
      layout.tsx   # layout raíz y metadata
      page.tsx     # landing page
    public/        # assets estáticos
    mocks/         # referencias visuales del proyecto

## Próximas fases

1. Persistencia con PostgreSQL y Drizzle.
2. Autenticación y autorización por roles.
3. Empresas, eventos, badges y estaciones QR.
4. Check-in, redenciones, XP y leaderboards.

Los requisitos completos están en Requirements.md.
