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

## 2026-11-21 — Fuentes del frontend sin dependencia de red

### Decisión

El build no descargará fuentes desde Google Fonts. Se usará una pila local del sistema.

### Motivo

El empaquetado debe ser reproducible aunque el entorno no tenga acceso a internet.

### Impacto

- Se eliminó la importación remota de `src/styles.scss`.
- No cambia el contrato ni la lógica de negocio.
- Si se desea una fuente propia, deberá incorporarse como asset versionado.

## 2026-11-22 — Cola independiente de correo

### Decisión

La notificación interna y el envío por Gmail se persisten en canales separados. Cada
evento crea como máximo un registro `envio_correo`, identificado por `id_evento`.

### Motivo

Un fallo de Gmail no debe revertir la operación de negocio ni impedir que el usuario
vea su aviso dentro de Minka.

### Impacto

- `envio_correo` tiene estado, intentos, reclamo y próximo reintento.
- Gmail se procesa con OAuth mediante `GmailApiEmailSender`.
- La entrega interna mantiene su propio dispatcher e idempotencia.

## 2026-11-21 — Perfil OAuth inicialmente incompleto

### Decisión

El login de Google puede crear una cuenta con perfil incompleto. Los datos de perfil
obligatorios, incluida la fecha de nacimiento, se completan después mediante HU01.

### Motivo

Google autentica la identidad, pero no proporciona todos los datos funcionales que Minka
necesita para validar mayoría de edad y habilitar propuestas.

### Impacto

- Los campos de perfil pendientes son anulables en `persona`.
- Una sesión con perfil incompleto no puede proponer.
- Los servicios que calculan mayoría de edad deben tratar una fecha nula como `false`.
- La migración `20261121120000_perfil_pendiente` acompaña el cambio.
