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

## Cuándo probar juntos

- Al cerrar la base inicial: Angular, NestJS y PostgreSQL levantan.
- Al cerrar el contrato `UsuarioResumen`: OAuth crea/recupera un usuario y el frontend
  obtiene un resumen válido.
- Al cerrar el recorrido mínimo del Sprint 2: crear propuesta → validar → evaluar con
  Gemini o derivar a revisión → registrar auditoría → notificar.
- Antes de cada merge importante: ejecutar una prueba de integración contra PostgreSQL.
- Al finalizar cada sprint: probar el recorrido completo de las historias integradas.

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
