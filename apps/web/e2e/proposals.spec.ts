import { test, expect } from '@playwright/test';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from '../../api/dist/app.module.js';
import { configureApp } from '../../api/dist/configure-app.js';
import { createPrismaClient } from '../../api/dist/database/prisma-client.js';
import { EvaluationDispatchService } from '../../api/dist/modules/proposals/evaluation-dispatch.service.js';

const prisma = createPrismaClient();
const users: string[] = [];
const people: string[] = [];
const dir = mkdtempSync(join(tmpdir(), 'minka-browser-'));
const file = join(dir, 'test-only.geojson');
const previous = process.env.MINKA_NEIGHBORHOOD_GEOJSON;
let app;
let apiUrl: string;
let session;
let adminSession;

test.beforeAll(async () => {
  writeFileSync(
    file,
    JSON.stringify({
      type: 'Polygon',
      coordinates: [
        [
          [-78.56, -0.29],
          [-78.54, -0.29],
          [-78.54, -0.27],
          [-78.56, -0.27],
          [-78.56, -0.29],
        ],
      ],
    }),
  );
  process.env.MINKA_NEIGHBORHOOD_GEOJSON = file;
  const user = await prisma.usuario.create({
    data: {
      google_subject: `prueba-${randomUUID()}`,
      correo: 'browser@example.com',
      correo_verificado: true,
      perfil_completo: true,
      persona: {
        create: {
          nombres: 'Prueba',
          apellidos: 'Formulario',
          fecha_nacimiento: new Date('2000-01-01'),
          sector_residencia: 'La Mena 2',
        },
      },
    },
  });
  users.push(user.id_usuario);
  people.push(user.id_persona);
  session = {
    id_usuario: user.id_usuario,
    correo: user.correo,
    correo_verificado: true,
    perfil_completo: true,
    mayor_edad: true,
    estado: 'activo',
    roles: ['ciudadano'],
    puntos: 0,
    estrellas: 5,
  };
  const admin = await prisma.usuario.create({
    data: {
      google_subject: `prueba-${randomUUID()}`,
      correo: 'admin-browser@example.com',
      correo_verificado: true,
      perfil_completo: true,
      persona: {
        create: {
          nombres: 'Admin',
          apellidos: 'Prueba',
          fecha_nacimiento: new Date('2000-01-01'),
          sector_residencia: 'La Mena 2',
        },
      },
    },
  });
  users.push(admin.id_usuario);
  people.push(admin.id_persona);
  const role = await prisma.rol.findUniqueOrThrow({ where: { nombre: 'administrador' } });
  await prisma.usuarioRol.create({ data: { id_usuario: admin.id_usuario, id_rol: role.id_rol } });
  adminSession = { ...session, id_usuario: admin.id_usuario, roles: ['administrador'] };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EvaluationDispatchService)
    .useValue({})
    .compile();
  app = module.createNestApplication();
  configureApp(app);
  app.use((req, _res, next) => {
    if (req.headers['x-test-session'] === 'owner') req.sesion = session;
    if (req.headers['x-test-session'] === 'admin') req.sesion = adminSession;
    next();
  });
  await app.listen(0, '127.0.0.1');
  apiUrl = await app.getUrl();
});

test.afterAll(async () => {
  const proposals = await prisma.propuesta.findMany({
    where: { id_proponente: { in: users } },
    select: { id_propuesta: true },
  });
  const ids = proposals.map((p) => p.id_propuesta);
  await prisma.eventoNotificacion.deleteMany({ where: { id_destinatario: { in: users } } });
  await prisma.registroAuditoria.deleteMany({
    where: { OR: [{ identificador_afectado: { in: ids } }, { id_actor: { in: users } }] },
  });
  await prisma.revisionAdministrativa.deleteMany({ where: { id_propuesta: { in: ids } } });
  await prisma.evaluacionIa.deleteMany({ where: { id_propuesta: { in: ids } } });
  await prisma.actividad.deleteMany({ where: { id_propuesta: { in: ids } } });
  await prisma.solicitudEvaluacion.deleteMany({ where: { id_propuesta: { in: ids } } });
  await prisma.propuesta.deleteMany({ where: { id_propuesta: { in: ids } } });
  await prisma.usuarioRol.deleteMany({ where: { id_usuario: { in: users } } });
  await prisma.usuario.deleteMany({ where: { id_usuario: { in: users } } });
  await prisma.persona.deleteMany({ where: { id_persona: { in: people } } });
  await app?.close();
  await prisma.$disconnect();
  if (previous === undefined) delete process.env.MINKA_NEIGHBORHOOD_GEOJSON;
  else process.env.MINKA_NEIGHBORHOOD_GEOJSON = previous;
  unlinkSync(file);
  rmdirSync(dir);
});

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: apiUrl + url.pathname + url.search,
      headers: { ...route.request().headers(), 'x-test-session': 'owner' },
    });
    await route.fulfill({ response });
  });
});

async function fillForm(page, title = 'Jornada propuesta por los vecinos') {
  await page.getByLabel('Título', { exact: true }).fill(title);
  await page.getByLabel('Categoría', { exact: true }).selectOption('reciclaje');
  await page
    .getByLabel('Descripción', { exact: true })
    .fill('Recolectaremos papel y cartón limpios entre vecinos.');
  await page
    .getByLabel('Finalidad comunitaria', { exact: true })
    .fill('Reducir los residuos del barrio.');
  await page
    .getByLabel('Dirección del encuentro', { exact: true })
    .fill('Lugar sintético de prueba en La Mena 2');
  await page.getByLabel('Latitud', { exact: true }).fill('-0.28');
  await page.getByLabel('Longitud', { exact: true }).fill('-78.55');
  await page.getByLabel('Inicio', { exact: true }).fill('2027-01-02T09:00');
  await page.getByLabel('Finalización', { exact: true }).fill('2027-01-02T11:00');
  await page.getByLabel('Cupo máximo', { exact: true }).fill('20');
}

test('crea en PostgreSQL, muestra estado pendiente y permite revisar la propuesta propia', async ({
  page,
}) => {
  await page.goto('/propuestas/nueva');
  await expect(page.getByRole('button', { name: 'Enviar propuesta' })).toBeEnabled();
  await fillForm(page);
  await page.getByRole('button', { name: 'Enviar propuesta' }).click();
  await expect(page.getByRole('heading', { name: 'Propuesta registrada' })).toBeVisible();
  await page.getByRole('link', { name: 'Ver mi propuesta' }).click();
  await expect(
    page.getByRole('heading', { name: 'Jornada propuesta por los vecinos' }),
  ).toBeVisible();
  await expect(page.getByText('Pendiente de evaluación', { exact: true })).toBeVisible();
  await expect(page.getByText('2 ene 2027, 09:00', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Mis propuestas', exact: true }).last().click();
  await expect(
    page.getByRole('link', { name: 'Consultar propuesta Jornada propuesta por los vecinos' }),
  ).toBeVisible();
});

test('muestra errores del formulario y de ubicación recibidos del backend', async ({ page }) => {
  await page.goto('/propuestas/nueva');
  await expect(page.getByRole('button', { name: 'Enviar propuesta' })).toBeEnabled();
  await page.getByRole('button', { name: 'Enviar propuesta' }).click();
  await expect(page.getByText('Selecciona una categoría.', { exact: true })).toBeVisible();
  await fillForm(page, 'Ubicación fuera de barrio');
  await page.getByLabel('Latitud', { exact: true }).fill('-0.5');
  await page.getByRole('button', { name: 'Enviar propuesta' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'La ubicación debe estar dentro de La Mena 2',
  );
});

test('formulario y propuestas propias funcionan a 360 píxeles', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/propuestas/nueva');
  await expect(page.getByRole('button', { name: 'Enviar propuesta' })).toBeEnabled();
  await fillForm(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('formulario-360.png'), fullPage: true });
  await page.getByRole('link', { name: 'Mis propuestas', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Mis propuestas', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('administración revisa, justifica y publica desde una pantalla móvil', async ({
  page,
}, testInfo) => {
  const response = await page.request.post(`${apiUrl}/api/v1/proposals`, {
    headers: { 'x-test-session': 'owner' },
    data: {
      categoria_codigo: 'reciclaje',
      titulo: 'Propuesta para revisión administrativa',
      descripcion: 'Recolección de papel limpio entre vecinos.',
      finalidad_comunitaria: 'Reducir residuos.',
      direccion_lugar: 'Punto sintético de prueba',
      latitud_lugar: -0.28,
      longitud_lugar: -78.55,
      inicio_previsto: '2027-01-03T14:00:00Z',
      fin_previsto: '2027-01-03T16:00:00Z',
      cupo_maximo: 20,
    },
  });
  expect(response.status()).toBe(201);
  const proposal = await response.json();
  await prisma.propuesta.update({
    where: { id_propuesta: proposal.id_propuesta },
    data: { estado: 'en_revision' },
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const result = await route.fetch({
      url: apiUrl + url.pathname + url.search,
      headers: { ...route.request().headers(), 'x-test-session': 'admin' },
    });
    await route.fulfill({ response: result });
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/administracion/propuestas');
  await page
    .getByRole('link', { name: 'Revisar Propuesta para revisión administrativa', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Propuesta para revisión administrativa' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar decisión' })).toBeDisabled();
  await page.getByLabel('Decisión', { exact: true }).selectOption('aprobar');
  await page
    .getByLabel('Motivo de la decisión', { exact: true })
    .fill('Actividad segura y coherente con el beneficio comunitario.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('revision-360.png'), fullPage: true });
  await page.getByRole('button', { name: 'Confirmar decisión' }).click();
  await expect(page.getByRole('heading', { name: 'Decisión registrada' })).toBeVisible();
  await page.getByRole('link', { name: 'Ver actividad publicada' }).click();
  await expect(
    page.getByRole('heading', { name: 'Propuesta para revisión administrativa' }),
  ).toBeVisible();
  await expect(page.getByText('20 cupos disponibles', { exact: true })).toBeVisible();
});

test('un ciudadano no accede a la revisión administrativa', async ({ page }) => {
  await page.goto('/administracion/propuestas');
  await expect(page.getByRole('alert')).toContainText('requiere una cuenta administradora');
});
