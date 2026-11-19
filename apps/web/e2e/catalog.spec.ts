import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createPrismaClient } from '../../api/dist/database/prisma-client.js';

const prisma = createPrismaClient();
const etiqueta = `QA-${randomUUID().slice(0, 8)}`;
const usuarios: string[] = [];
const personas: string[] = [];
const propuestas: string[] = [];
const actividades: string[] = [];
let inscripcionId: string;

test.beforeAll(async () => {
  for (let i = 0; i < 2; i++) {
    const usuario = await prisma.usuario.create({
      data: {
        google_subject: `${etiqueta}-${i}`,
        correo: 'browser@example.com',
        correo_verificado: true,
        perfil_completo: true,
        persona: {
          create: {
            nombres: 'Prueba',
            apellidos: 'Navegador',
            fecha_nacimiento: new Date('2000-01-01'),
            sector_residencia: 'La Mena 2',
          },
        },
      },
    });
    usuarios.push(usuario.id_usuario);
    personas.push(usuario.id_persona);
  }
  for (const [codigo, titulo, fecha, cupo] of [
    ['reciclaje', 'Jornada de reciclaje en el parque', '2026-11-28T14:00:00Z', 1],
    ['limpieza', 'Cuidemos juntos nuestro parque', '2026-11-29T14:00:00Z', 12],
  ] as const) {
    const categoria = await prisma.categoriaActividad.findUniqueOrThrow({ where: { codigo } });
    const contenido = {
      categoria_codigo: codigo,
      titulo,
      descripcion:
        'Nos reuniremos para recuperar un espacio compartido. Trae agua, ropa cómoda y ganas de colaborar.',
      finalidad_comunitaria:
        'Mantener un barrio limpio y fortalecer la colaboración entre vecinos.',
      direccion_lugar: `Parque comunitario de La Mena 2 · ${etiqueta}`,
      latitud_lugar: -0.28,
      longitud_lugar: -78.55,
      inicio_previsto: fecha,
      fin_previsto: new Date(Date.parse(fecha) + 7200000).toISOString(),
      cupo_maximo: cupo,
    };
    const propuesta = await prisma.propuesta.create({
      data: {
        id_proponente: usuarios[0],
        id_categoria: categoria.id_categoria,
        titulo,
        descripcion: contenido.descripcion,
        finalidad_comunitaria: contenido.finalidad_comunitaria,
        direccion_lugar: contenido.direccion_lugar,
        latitud_lugar: contenido.latitud_lugar,
        longitud_lugar: contenido.longitud_lugar,
        inicio_previsto: new Date(fecha),
        fin_previsto: new Date(contenido.fin_previsto),
        cupo_maximo: cupo,
        estado: 'aprobada',
      },
    });
    propuestas.push(propuesta.id_propuesta);
    const actividad = await prisma.actividad.create({
      data: {
        id_propuesta: propuesta.id_propuesta,
        id_organizador_actual: usuarios[0],
        version_publicada: 1,
        contenido_aprobado_json: contenido,
      },
    });
    actividades.push(actividad.id_actividad);
  }
  const inscripcion = await prisma.inscripcion.create({
    data: { id_usuario: usuarios[1], id_actividad: actividades[0] },
  });
  inscripcionId = inscripcion.id_inscripcion;
});

test.afterAll(async () => {
  await prisma.inscripcion.deleteMany({ where: { id_actividad: { in: actividades } } });
  await prisma.actividad.deleteMany({ where: { id_actividad: { in: actividades } } });
  await prisma.propuesta.deleteMany({ where: { id_propuesta: { in: propuestas } } });
  await prisma.usuario.deleteMany({ where: { id_usuario: { in: usuarios } } });
  await prisma.persona.deleteMany({ where: { id_persona: { in: personas } } });
  await prisma.$disconnect();
});

test('filtra, abre un detalle real y conserva la búsqueda al volver', async ({
  page,
}, testInfo) => {
  await page.goto(`/actividades?location=${etiqueta}`);
  await expect(page.locator('app-activity-card')).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath('catalogo-escritorio.png'), fullPage: true });
  await expect(page.locator('#category option')).toHaveCount(5);
  await page.getByLabel('Categoría', { exact: true }).selectOption('reciclaje');
  await page.getByLabel('Desde', { exact: true }).fill('2026-11-28');
  await page.getByLabel('Hasta', { exact: true }).fill('2026-11-28');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.locator('app-activity-card')).toHaveCount(1);
  await expect(page.getByText('Cupos agotados', { exact: true })).toBeVisible();
  await page
    .getByRole('link', { name: 'Ver detalles de Jornada de reciclaje en el parque' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Jornada de reciclaje en el parque' }),
  ).toBeVisible();
  await expect(page.getByText('sábado 28 noviembre 2026, 09:00')).toBeVisible();
  await page.getByRole('link', { name: 'Volver al catálogo' }).click();
  await expect(page.locator('#category')).toHaveValue('reciclaje');
  await expect(page.locator('#dateFrom')).toHaveValue('2026-11-28');
  await expect(page.locator('app-activity-card')).toHaveCount(1);
});

test('muestra cero resultados y permite limpiar filtros', async ({ page }) => {
  await page.goto(`/actividades?location=${etiqueta}&category=recuperacion_espacios`);
  await expect(
    page.getByRole('heading', { name: 'No encontramos actividades con esos filtros' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.locator('#location')).toHaveValue('');
  await expect(page.getByRole('link', { name: 'Ver detalles de Jornada de reciclaje en el parque' })).toBeVisible();
});

test('rechaza un rango invertido antes de consultar la API', async ({ page }) => {
  await page.goto(`/actividades?location=${etiqueta}`);
  await page.locator('#dateFrom').fill('2026-11-30');
  await page.locator('#dateTo').fill('2026-11-20');
  await expect(page.getByRole('button', { name: 'Buscar', exact: true })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('La fecha final debe ser igual o posterior');
});

test('actualiza la disponibilidad tras cancelar una inscripción', async ({ page }) => {
  await page.goto(`/actividades?location=${etiqueta}&category=reciclaje`);
  await expect(page.getByText('Cupos agotados', { exact: true })).toBeVisible();
  try {
    await prisma.inscripcion.update({
      where: { id_inscripcion: inscripcionId },
      data: { estado: 'cancelada_ciudadano' },
    });
    await page.reload();
    await expect(page.getByText('1 de 1 cupos libres', { exact: true })).toBeVisible();
  } finally {
    await prisma.inscripcion.update({
      where: { id_inscripcion: inscripcionId },
      data: { estado: 'activa' },
    });
  }
});

test('permite reintentar después de un fallo de red', async ({ page }) => {
  await page.route(
    '**/api/v1/activities?*',
    (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
    { times: 1 },
  );
  await page.goto(`/actividades?location=${etiqueta}`);
  await expect(page.getByRole('alert')).toContainText('No pudimos cargar las actividades');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.locator('app-activity-card')).toHaveCount(2);
});

test('muestra un mensaje al abrir una actividad inexistente', async ({ page }) => {
  await page.goto(`/actividades/${randomUUID()}`);
  await expect(page.getByRole('alert')).toContainText('Esta actividad no está disponible');
});

test('listado y detalle se adaptan a 360 píxeles y permiten acceso por teclado', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`/actividades?location=${etiqueta}`);
  await expect(page.locator('app-activity-card')).toHaveCount(2);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  await page.getByRole('heading', { name: 'Actividades comunitarias', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('catalogo-360.png'), fullPage: true });
  const desbordes = await page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
      .map((el) => ({
        tag: el.tagName,
        clase: el.className,
        ancho: el.getBoundingClientRect().width,
      })),
  );
  expect(desbordes).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .getByRole('link', { name: 'Ver detalles de Jornada de reciclaje en el parque' })
    .click();
  await expect(page.getByRole('heading', { name: 'Sobre la actividad' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('detalle-360.png'), fullPage: true });
});
