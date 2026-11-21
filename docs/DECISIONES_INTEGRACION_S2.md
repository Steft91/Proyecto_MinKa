# Decisiones de integración — Sprint 2

Documento público de coordinación técnica. No contiene el reparto privado de tareas.

## 2026-11-21 — Base de trabajo del Sprint 2

### Decisión

El trabajo del carril A parte de `b/sprint2-integracion`, que contiene la base
preintegrada del carril B. Esta base no se fusionará todavía a `main`.

### Motivo

Permite desarrollar ambos carriles en paralelo y probar el recorrido combinado antes
de convertirlo en la base oficial de Sprint 3.

### Flujo acordado

1. Crear ramas A desde `sprint2-base`, espejo local de `origin/b/sprint2-integracion`.
2. Integrar las funcionalidades A en `a/sprint2-integracion`.
3. Probar el recorrido B + A y resolver cambios de contrato.
4. Abrir un PR de `a/sprint2-integracion` hacia `main`.
5. Después del merge, ambos deben actualizar `main` con `git pull --ff-only origin main`.

### Decisiones heredadas de la base B

- Persistencia con PostgreSQL y Prisma.
- API REST versionada bajo `/api/v1`.
- Contratos compartidos en `packages/contracts`.
- Migraciones versionadas y pruebas contra base de datos.

### Regla para cambios posteriores

Todo cambio que afecte API, DTO, migraciones, eventos o contratos se registra aquí con
fecha, motivo, impacto y pruebas requeridas antes de integrar.
