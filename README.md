# Minka

Aplicación web para la organización y participación en actividades comunitarias.

## Stack

- Frontend: Angular + TypeScript
- Backend: NestJS + TypeScript
- Base de datos: PostgreSQL
- Entorno local: Docker Compose
- Autenticación: Google OAuth 2.0
- IA: Gemini, consumida desde el backend
- Correo: Gmail API, consumida desde el backend

## Estructura

Monorepo inicial con `apps/web`, `apps/api` y `packages/contracts`. La arquitectura
queda preparada para separar servicios progresivamente, sin duplicar aplicaciones ni
contratos.

La integración entre carriles está documentada en `docs/INTEGRACION.md`.

## Desarrollo

La configuración local se documentará en `.env.example`. Los secretos deben permanecer
en `.env`, que no forma parte del repositorio.
