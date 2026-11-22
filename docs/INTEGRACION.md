# Integración entre carriles

## Regla principal

Cada integrante trabaja en una rama corta desde `main` y abre un Pull Request por
unidad verificable. La integración ocurre por contrato y PR, no por copiar carpetas
manualmente.

## Flujo

1. Crear una rama: `a/hu01-oauth` o `b/hu04-propuestas`.
2. Implementar únicamente la tarea acordada y sus pruebas.
3. Ejecutar lint, build y tests del área modificada.
4. Actualizar el contrato compartido si aplica.
5. Abrir PR hacia `main`, indicando archivos, pruebas, riesgos y evidencia.
6. La otra persona revisa permisos, contrato y pruebas.
7. Integrar después de aprobación y checks verdes.
8. Actualizar `PROGRESS.md` local con el estado real.

## Commits semánticos

Usar Conventional Commits con el formato:

```text
tipo(scope): descripción breve
```

Tipos permitidos:

- `feat`: nueva funcionalidad.
- `fix`: corrección de un error.
- `test`: pruebas.
- `docs`: documentación.
- `refactor`: reorganización sin cambiar comportamiento.
- `chore`: configuración, dependencias o mantenimiento.

Ejemplos:

```text
chore(inicializacion): preparar monorepo
feat(identidad): validar correo de Google
feat(ia): validar respuesta de evaluacion Gemini
test(inscripciones): evitar inscripcion duplicada
fix(notificaciones): reintentar envio de correo fallido
docs(api): documentar contrato UsuarioResumen
```

Cada commit debe representar un cambio real y comprobable. No crear commits vacíos,
artificiales o con fechas retroactivas.

## Cuándo probar juntos

- Al cerrar la base inicial: Angular, NestJS y PostgreSQL levantan.
- Al cerrar el contrato `UsuarioResumen`: OAuth crea/recupera un usuario y el frontend
  obtiene un resumen válido.
- Al cerrar el recorrido mínimo del Sprint 2: crear propuesta → validar → evaluar con
  Gemini o derivar a revisión → registrar auditoría → notificar.
- Antes de cada merge importante: ejecutar una prueba de integración contra PostgreSQL.
- Al finalizar cada sprint: probar el recorrido completo de las historias integradas.

## Calendario de integración y reuniones

Las fechas se toman del cronograma vigente. La reunión debe ocurrir antes del cierre del
sprint para detectar conflictos mientras todavía hay tiempo de corregirlos.

| Sprint | Fechas de trabajo | Reunión recomendada | Objetivo |
|---|---|---|---|
| 1 | 26 oct–06 nov 2026 | 04 nov 2026 | Confirmar base Angular/NestJS, PostgreSQL, contratos iniciales y estado real de HU01–HU03. |
| 2 | 09–19 nov 2026 | 16 nov 2026 y 19 nov 2026 | Probar propuesta → evaluación Gemini → revisión/auditoría → notificación. |
| 3 | 23 nov–04 dic 2026 | 30 nov 2026 y 04 dic 2026 | Probar actividades, cupos, inscripciones, cancelaciones, eventos y correo. |
| 4 | 07–18 dic 2026 | 14 dic 2026 y 18 dic 2026 | Probar QR, GPS, incidencias, resolución de participación y reputación. |
| 5 | 21–30 dic 2026 | 28 dic 2026 y 30 dic 2026 | Probar reportes, PDF, autorización, auditoría y documentación. |
| 6 | 04–08 ene 2027 | 06 ene 2027 y 08 ene 2027 | Ejecutar aceptación integral, respaldo/restauración y correcciones finales. |

La fecha de reunión es una puerta de integración, no una fecha para marcar tareas como
terminadas automáticamente. Cada integrante debe llevar pruebas ejecutadas, cambios
pendientes y conflictos conocidos.

## Qué bloquea la integración

- Contrato sin versión o sin ejemplo.
- Secretos en el repositorio.
- Backend sin validación de permisos.
- Tests fallidos o no ejecutados.
- Mock presentado como funcionalidad final.

## Primera integración del carril A

El carril A debe entregar primero el contrato y flujo de `UsuarioResumen`, dejando
OAuth detrás de una configuración local segura. Después puede avanzar con Gemini y
notificaciones usando interfaces/adapters probables, sin acoplar secretos al frontend.
