import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Response } from 'express';
import request from 'supertest';
import { createServer, type Server } from 'node:http';
import type { ResultadoEvaluacion, SesionActual } from '@minka/contracts';
import { configureApp } from '../src/configure-app.js';
import { createPrismaClient } from '../src/database/prisma-client.js';
import { ProposalsModule } from '../src/modules/proposals/proposals.module.js';
import { EvaluationDispatchService } from '../src/modules/proposals/evaluation-dispatch.service.js';
import { EvaluationGateway } from '../src/modules/proposals/evaluation.gateway.js';
import { ProposalsService } from '../src/modules/proposals/proposals.service.js';
import { AuditService } from '../src/modules/audit/audit.service.js';
import { AdminReviewModule } from '../src/modules/admin-review/admin-review.module.js';
import { CatalogModule } from '../src/modules/catalog/catalog.module.js';
import { EvaluationResultsModule } from '../src/modules/evaluation-results/evaluation-results.module.js';
import { EvaluationResultsService } from '../src/modules/evaluation-results/evaluation-results.service.js';
import { NotificationEventsService } from '../src/modules/notification-events/notification-events.service.js';
import { GoogleSessionGuard } from '../src/modules/identity/google-session.guard.js';
import type { SessionRequest } from '../src/modules/access-control/session-request.js';

describe('Propuestas y entrega a evaluación con PostgreSQL', () => {
  const prisma = createPrismaClient();
  const personas: string[] = [];
  const usuarios: string[] = [];
  const sesiones: Record<string, SesionActual> = {};
  const originalBoundary = process.env.MINKA_NEIGHBORHOOD_GEOJSON;
  const originalUrl = process.env.MINKA_EVALUATION_URL;
  const originalToken = process.env.MINKA_EVALUATION_TOKEN;
  const originalIntegration = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    MINKA_EVALUATION_CALLBACK_TOKEN:
      process.env.MINKA_EVALUATION_CALLBACK_TOKEN,
    MINKA_NOTIFICATIONS_URL: process.env.MINKA_NOTIFICATIONS_URL,
    MINKA_NOTIFICATIONS_TOKEN: process.env.MINKA_NOTIFICATIONS_TOKEN,
  };
  const dir = mkdtempSync(join(tmpdir(), 'minka-proposals-'));
  const geometryPath = join(dir, 'test-only.geojson');
  let app: INestApplication;
  let dispatcher: EvaluationDispatchService;
  let gateway: EvaluationGateway;
  let proposalsService: ProposalsService;
  let audit: AuditService;
  let notifications: NotificationEventsService;
  let results: EvaluationResultsService;
  let failNotifications = false;
  const notificationKeys: string[] = [];
  let provider: Server;
  let providerUrl: string;
  let failProvider = false;
  const entregas: {
    body: Record<string, unknown>;
    key: string;
    token: string;
  }[] = [];
  const start = new Date(Date.now() + 7 * 86400000).toISOString();
  const end = new Date(Date.now() + 7 * 86400000 + 7200000).toISOString();
  const valid = {
    categoria_codigo: 'reciclaje',
    titulo: 'Reciclaje de prueba',
    descripcion: 'Actividad comunitaria de prueba.',
    finalidad_comunitaria: 'Cuidar el barrio.',
    direccion_lugar: 'Encuentro de prueba',
    latitud_lugar: -0.28,
    longitud_lugar: -78.55,
    inicio_previsto: start,
    fin_previsto: end,
    cupo_maximo: 10,
  };

  beforeAll(async () => {
    // Rectángulo sintético exclusivo de pruebas. No representa el límite real del barrio.
    writeFileSync(
      geometryPath,
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
    process.env.MINKA_NEIGHBORHOOD_GEOJSON = geometryPath;
    delete process.env.MINKA_EVALUATION_URL;
    delete process.env.MINKA_EVALUATION_TOKEN;
    for (const name of ['owner', 'other']) {
      const usuario = await prisma.usuario.create({
        data: {
          google_subject: `prueba-${randomUUID()}`,
          correo: 'propuestas@example.com',
          correo_verificado: true,
          perfil_completo: true,
          persona: {
            create: {
              nombres: 'Prueba',
              apellidos: 'Propuestas',
              fecha_nacimiento: new Date('2000-01-01'),
              sector_residencia: 'La Mena 2',
            },
          },
        },
      });
      personas.push(usuario.id_persona);
      usuarios.push(usuario.id_usuario);
      sesiones[name] = {
        id_usuario: usuario.id_usuario,
        correo: usuario.correo,
        correo_verificado: true,
        perfil_completo: true,
        mayor_edad: true,
        estado: 'activo',
        roles: ['ciudadano'],
        puntos: 0,
        estrellas: 5,
      };
    }
    const module = await Test.createTestingModule({
      imports: [
        ProposalsModule,
        AdminReviewModule,
        CatalogModule,
        EvaluationResultsModule,
      ],
    })
      .overrideGuard(GoogleSessionGuard)
      .useValue({ canActivate: () => true })
      .compile();
    dispatcher = module.get(EvaluationDispatchService);
    gateway = module.get(EvaluationGateway);
    sesiones.admin = { ...sesiones.other, roles: ['administrador'] };
    const adminRole = await prisma.rol.findUniqueOrThrow({
      where: { nombre: 'administrador' },
    });
    await prisma.usuarioRol.create({
      data: { id_usuario: usuarios[1], id_rol: adminRole.id_rol },
    });
    audit = module.get(AuditService);
    notifications = module.get(NotificationEventsService);
    results = module.get(EvaluationResultsService);
    proposalsService = module.get(ProposalsService);
    app = module.createNestApplication();
    configureApp(app);
    app.use((req: SessionRequest, _res: Response, next: NextFunction) => {
      req.sesion = sesiones[req.header('x-test-user') ?? ''];
      next();
    });
    await app.init();
    provider = createServer((req, res) => {
      let data = '';
      req.on('data', (chunk) => {
        data += String(chunk);
      });
      req.on('end', () => {
        const body = JSON.parse(data);
        if (req.url === '/notifications') {
          notificationKeys.push(String(req.headers['idempotency-key']));
          res.writeHead(failNotifications ? 503 : 202, {
            'Content-Type': 'application/json',
          });
          res.end(
            JSON.stringify({ aceptada: true, evento_clave: body.evento_clave }),
          );
          return;
        }
        entregas.push({
          body,
          key: String(req.headers['idempotency-key']),
          token: String(req.headers.authorization),
        });
        res.writeHead(failProvider ? 503 : 202, {
          'Content-Type': 'application/json',
        });
        res.end(
          JSON.stringify({
            aceptada: true,
            id_propuesta: body.id_propuesta,
            version_propuesta: body.version_actual,
          }),
        );
      });
    });
    await new Promise<void>((resolve) => {
      provider.listen(0, '127.0.0.1', resolve);
    });
    const address = provider.address();
    if (!address || typeof address === 'string')
      throw new Error('Sin puerto de prueba');
    providerUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(async () => {
    delete process.env.GEMINI_API_KEY;
    failNotifications = false;
    notificationKeys.length = 0;
    process.env.MINKA_EVALUATION_CALLBACK_TOKEN = 'callback-de-prueba';
    delete process.env.MINKA_NOTIFICATIONS_URL;
    delete process.env.MINKA_NOTIFICATIONS_TOKEN;
    failProvider = false;
    entregas.length = 0;
    delete process.env.MINKA_EVALUATION_URL;
    delete process.env.MINKA_EVALUATION_TOKEN;
    process.env.MINKA_NEIGHBORHOOD_GEOJSON = geometryPath;
    await prisma.usuario.update({
      where: { id_usuario: usuarios[0] },
      data: {
        estado: 'activo',
        estrellas: 5,
        correo_verificado: true,
        perfil_completo: true,
      },
    });
    await prisma.persona.update({
      where: { id_persona: personas[0] },
      data: { fecha_nacimiento: new Date('2000-01-01') },
    });
    const ids = (
      await prisma.propuesta.findMany({
        where: { id_proponente: { in: usuarios } },
        select: { id_propuesta: true },
      })
    ).map((p) => p.id_propuesta);
    const activityIds = (
      await prisma.actividad.findMany({
        where: { id_propuesta: { in: ids } },
        select: { id_actividad: true },
      })
    ).map((a) => a.id_actividad);
    await prisma.eventoNotificacion.deleteMany({
      where: { id_destinatario: { in: usuarios } },
    });
    await prisma.registroAuditoria.deleteMany({
      where: {
        OR: [
          { identificador_afectado: { in: [...ids, ...activityIds] } },
          { id_actor: { in: usuarios } },
        ],
      },
    });
    await prisma.revisionAdministrativa.deleteMany({
      where: { id_propuesta: { in: ids } },
    });
    await prisma.evaluacionIa.deleteMany({
      where: { id_propuesta: { in: ids } },
    });
    await prisma.actividad.deleteMany({ where: { id_propuesta: { in: ids } } });
    await prisma.solicitudEvaluacion.deleteMany({
      where: { id_propuesta: { in: ids } },
    });
    await prisma.propuesta.deleteMany({ where: { id_propuesta: { in: ids } } });
  });

  afterAll(async () => {
    const ids = (
      await prisma.propuesta.findMany({
        where: { id_proponente: { in: usuarios } },
        select: { id_propuesta: true },
      })
    ).map((p) => p.id_propuesta);
    const activityIds = (
      await prisma.actividad.findMany({
        where: { id_propuesta: { in: ids } },
        select: { id_actividad: true },
      })
    ).map((a) => a.id_actividad);
    await prisma.eventoNotificacion.deleteMany({
      where: { id_destinatario: { in: usuarios } },
    });
    await prisma.registroAuditoria.deleteMany({
      where: {
        OR: [
          { identificador_afectado: { in: [...ids, ...activityIds] } },
          { id_actor: { in: usuarios } },
        ],
      },
    });
    await prisma.revisionAdministrativa.deleteMany({
      where: { id_propuesta: { in: ids } },
    });
    await prisma.evaluacionIa.deleteMany({
      where: { id_propuesta: { in: ids } },
    });
    await prisma.actividad.deleteMany({ where: { id_propuesta: { in: ids } } });
    await prisma.solicitudEvaluacion.deleteMany({
      where: { id_propuesta: { in: ids } },
    });
    await prisma.propuesta.deleteMany({ where: { id_propuesta: { in: ids } } });
    await prisma.usuarioRol.deleteMany({
      where: { id_usuario: { in: usuarios } },
    });
    await prisma.usuario.deleteMany({
      where: { id_usuario: { in: usuarios } },
    });
    await prisma.persona.deleteMany({
      where: { id_persona: { in: personas } },
    });
    await app?.close();
    await prisma.$disconnect();
    if (provider)
      await new Promise<void>((resolve, reject) =>
        provider.close((error) => (error ? reject(error) : resolve())),
      );
    for (const [key, value] of Object.entries({
      ...originalIntegration,
      MINKA_NEIGHBORHOOD_GEOJSON: originalBoundary,
      MINKA_EVALUATION_URL: originalUrl,
      MINKA_EVALUATION_TOKEN: originalToken,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    unlinkSync(geometryPath);
    rmdirSync(dir);
  });

  const crear = (body: object = valid, key?: string) => {
    const call = request(app.getHttpServer())
      .post('/api/v1/proposals')
      .set('x-test-user', 'owner');
    if (key) call.set('Idempotency-Key', key);
    return call.send(body);
  };

  it('crea una propuesta pendiente y un envío duradero en la misma operación', async () => {
    const { body } = await crear().expect(201);
    expect(body).toMatchObject({
      titulo: valid.titulo,
      estado: 'pendiente_evaluacion',
      version_actual: 1,
      id_proponente: usuarios[0],
    });
    const job = await prisma.solicitudEvaluacion.findUniqueOrThrow({
      where: {
        id_propuesta_version_propuesta: {
          id_propuesta: body.id_propuesta,
          version_propuesta: 1,
        },
      },
    });
    expect(job.estado).toBe('pendiente');
    expect(job.contenido_json).toMatchObject({
      id_propuesta: body.id_propuesta,
      version_actual: 1,
      categoria_codigo: 'reciclaje',
    });
    expect(
      await prisma.actividad.count({
        where: { id_propuesta: body.id_propuesta },
      }),
    ).toBe(0);
  });

  it('reintentos concurrentes conservan una propuesta y una solicitud', async () => {
    const key = randomUUID();
    const responses = await Promise.all([crear(valid, key), crear(valid, key)]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    expect(responses[0].body.id_propuesta).toBe(responses[1].body.id_propuesta);
    expect(
      await prisma.propuesta.count({ where: { id_proponente: usuarios[0] } }),
    ).toBe(1);
    expect(
      await prisma.solicitudEvaluacion.count({
        where: { id_propuesta: responses[0].body.id_propuesta },
      }),
    ).toBe(1);
    await crear({ ...valid, titulo: 'Otro contenido' }, key).expect(409);
  });

  it('solo permite listar y consultar propuestas propias', async () => {
    const { body } = await crear().expect(201);
    const mine = await request(app.getHttpServer())
      .get('/api/v1/proposals/me')
      .set('x-test-user', 'owner')
      .expect(200);
    expect(
      mine.body.map((p: { id_propuesta: string }) => p.id_propuesta),
    ).toEqual([body.id_propuesta]);
    await request(app.getHttpServer())
      .get('/api/v1/proposals/me')
      .set('x-test-user', 'other')
      .expect(200)
      .expect([]);
    await request(app.getHttpServer())
      .get(`/api/v1/proposals/${body.id_propuesta}`)
      .set('x-test-user', 'other')
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/proposals/${randomUUID()}`)
      .set('x-test-user', 'owner')
      .expect(404);
    await request(app.getHttpServer()).get('/api/v1/proposals/me').expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/proposals')
      .send(valid)
      .expect(401);
  });

  it.each(Object.keys(valid))(
    'exige el campo obligatorio %s',
    async (campo) => {
      const body = { ...valid } as Record<string, unknown>;
      delete body[campo];
      await crear(body).expect(400);
      expect(
        await prisma.propuesta.count({ where: { id_proponente: usuarios[0] } }),
      ).toBe(0);
    },
  );

  it.each([
    { titulo: '   ' },
    { direccion_lugar: ' ' },
    { descripcion: ' ' },
    { finalidad_comunitaria: ' ' },
    { categoria_codigo: 'donaciones' },
    { cupo_maximo: 0 },
    { cupo_maximo: 1.5 },
    { cupo_maximo: '5' },
    { cupo_maximo: 2147483648 },
    { latitud_lugar: -91 },
    { latitud_lugar: -0.12345678 },
    { latitud_lugar: 1e-8 },
    { longitud_lugar: -78.55000001 },
    { inicio_previsto: '2026-02-31T12:00:00Z' },
    { inicio_previsto: '2030-01-01T12:00:00' },
    { estado: 'aprobada' },
    { id_proponente: randomUUID() },
  ])('rechaza campos inválidos o alteraciones %j', async (changes) => {
    await crear({ ...valid, ...changes }).expect(400);
  });

  it.each([
    { inicio_previsto: '2000-01-01T12:00:00Z' },
    { fin_previsto: start },
    { latitud_lugar: -0.5, longitud_lugar: -78.55 },
    { latitud_lugar: 1e-7, longitud_lugar: -78.55 },
  ])(
    'rechaza reglas objetivas antes de crear o evaluar %j',
    async (changes) => {
      await crear({ ...valid, ...changes }).expect(422);
      expect(
        await prisma.propuesta.count({ where: { id_proponente: usuarios[0] } }),
      ).toBe(0);
      expect(entregas).toHaveLength(0);
    },
  );

  it.each([
    { estado: 'suspendido' as const },
    { estrellas: 2.5 },
    { estrellas: 0 },
    { correo_verificado: false },
    { perfil_completo: false },
  ])(
    'rechaza la cuenta actual aunque la sesión anterior sea favorable %j',
    async (changes) => {
      await prisma.usuario.update({
        where: { id_usuario: usuarios[0] },
        data: changes,
      });
      await crear().expect(403);
    },
  );

  it('calcula mayoría de edad con la fecha real guardada', async () => {
    await prisma.persona.update({
      where: { id_persona: personas[0] },
      data: { fecha_nacimiento: new Date('2020-01-01') },
    });
    await crear().expect(403);
    const { body } = await request(app.getHttpServer())
      .get('/api/v1/proposals/eligibility')
      .set('x-test-user', 'owner')
      .expect(200);
    expect(body.puede_proponer).toBe(false);
  });

  it('informa la falta de un límite geográfico y no guarda la propuesta', async () => {
    delete process.env.MINKA_NEIGHBORHOOD_GEOJSON;
    const response = await crear().expect(503);
    expect(response.body.codigo).toBe('BARRIO_NO_CONFIGURADO');
    expect(
      await prisma.propuesta.count({ where: { id_proponente: usuarios[0] } }),
    ).toBe(0);
  });

  it('mantiene el envío pendiente cuando la integración A no está configurada', async () => {
    const { body } = await crear().expect(201);
    expect(await dispatcher.dispatchOne()).toBe(false);
    expect(
      (
        await prisma.propuesta.findUniqueOrThrow({
          where: { id_propuesta: body.id_propuesta },
        })
      ).estado,
    ).toBe('pendiente_evaluacion');
  });

  it('entrega el contrato a un servicio HTTP autenticado una sola vez', async () => {
    const { body } = await crear().expect(201);
    process.env.MINKA_EVALUATION_URL = providerUrl;
    process.env.MINKA_EVALUATION_TOKEN = 'token-exclusivo-de-prueba';
    await Promise.all([dispatcher.dispatchOne(), dispatcher.dispatchOne()]);
    expect(entregas).toHaveLength(1);
    expect(entregas[0]).toMatchObject({
      body: { id_propuesta: body.id_propuesta, version_actual: 1 },
      token: 'Bearer token-exclusivo-de-prueba',
      key: `propuesta:${body.id_propuesta}:v1`,
    });
    expect(await dispatcher.dispatchOne()).toBe(false);
    expect(
      (
        await prisma.solicitudEvaluacion.findFirstOrThrow({
          where: { id_propuesta: body.id_propuesta },
        })
      ).estado,
    ).toBe('entregada');
  });

  it('deriva a revisión ante fallo de la entrega y conserva la propuesta', async () => {
    const { body } = await crear().expect(201);
    failProvider = true;
    process.env.MINKA_EVALUATION_URL = providerUrl;
    process.env.MINKA_EVALUATION_TOKEN = 'token-exclusivo-de-prueba';
    await dispatcher.dispatchOne();
    expect(
      (
        await prisma.propuesta.findUniqueOrThrow({
          where: { id_propuesta: body.id_propuesta },
        })
      ).estado,
    ).toBe('en_revision');
    expect(
      (
        await prisma.solicitudEvaluacion.findFirstOrThrow({
          where: { id_propuesta: body.id_propuesta },
        })
      ).estado,
    ).toBe('requiere_revision');
  });

  it('repetir el envío interno no duplica la solicitud de evaluación', async () => {
    const { body } = await crear().expect(201);
    await proposalsService.submitForEvaluation(
      sesiones.owner,
      body.id_propuesta,
    );
    expect(
      await prisma.solicitudEvaluacion.count({
        where: { id_propuesta: body.id_propuesta },
      }),
    ).toBe(1);
  });

  it('conserva autor e historial y restringe la consulta de auditoría al administrador', async () => {
    const { body } = await crear(valid, randomUUID()).expect(201);
    const original = await prisma.registroAuditoria.findFirstOrThrow({
      where: { identificador_afectado: body.id_propuesta },
    });
    expect(original).toMatchObject({
      id_actor: usuarios[0],
      accion: 'propuesta_creada',
      estado_nuevo: 'pendiente_evaluacion',
    });
    await audit.record({
      entidad_afectada: 'propuesta',
      identificador_afectado: body.id_propuesta,
      accion: 'nota_de_revision',
      motivo: 'Registro adicional',
      evento_clave: `${body.id_propuesta}:nota`,
    });
    await audit.record({
      entidad_afectada: 'propuesta',
      identificador_afectado: body.id_propuesta,
      accion: 'nota_de_revision',
      motivo: 'Intento de sustituir el original',
      evento_clave: `${body.id_propuesta}:nota`,
    });
    const url = `/api/v1/admin/audit?entity=propuesta&id=${body.id_propuesta}`;
    await request(app.getHttpServer())
      .get(url)
      .set('x-test-user', 'owner')
      .expect(403);
    const result = await request(app.getHttpServer())
      .get(url)
      .set('x-test-user', 'admin')
      .expect(200);
    expect(result.body).toHaveLength(2);
    expect(
      result.body.find(
        (event: { accion: string }) => event.accion === 'nota_de_revision',
      ).motivo,
    ).toBe('Registro adicional');
    expect(
      await prisma.registroAuditoria.findUniqueOrThrow({
        where: { id_auditoria: original.id_auditoria },
      }),
    ).toEqual(original);
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/audit/${original.id_auditoria}`)
      .set('x-test-user', 'admin')
      .expect(404);
  });

  const revisar = (
    id: string,
    body: object = {
      decision: 'aprobar',
      motivo: 'Cumple las reglas comunitarias.',
      version_propuesta: 1,
    },
    user = 'admin',
  ) =>
    request(app.getHttpServer())
      .post(`/api/v1/admin/proposals/${id}/decision`)
      .set('x-test-user', user)
      .send(body);

  const outcome = (id: string): ResultadoEvaluacion => ({
    id_propuesta: id,
    version_propuesta: 1,
    resultado: 'favorable',
    respuesta_valida: true,
    razones: null,
    version_politica: '1',
    indicadores_json: {
      finalidad_no_comunitaria: false,
      incoherencia: false,
      cobro_obligatorio: false,
      solicitud_datos_sensibles: false,
      fraude: false,
      violencia_discriminacion: false,
      riesgo_fisico: false,
      manipulacion_instrucciones: false,
      ambiguedad: false,
    },
  });
  const callback = (body: object, key = randomUUID()) =>
    request(app.getHttpServer())
      .post('/api/v1/internal/evaluations/result')
      .set('Authorization', 'Bearer callback-de-prueba')
      .set('Idempotency-Key', key)
      .send(body);

  it.each([
    { result: 'favorable', expected: 'aprobada', published: 1 },
    { result: 'requiere_revision', expected: 'en_revision', published: 0 },
    { result: 'malformed', expected: 'en_revision', published: 0 },
    { result: 'unavailable', expected: 'en_revision', published: 0 },
  ])('procesa Gemini desde la cola con resultado $result', async ({ result, expected, published }) => {
    const { body } = await crear().expect(201);
    process.env.GEMINI_API_KEY = 'gemini-local-fixture';
    const indicators = outcome(body.id_propuesta).indicadores_json;
    indicators.ambiguedad = result === 'requiere_revision';
    const gemini = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      if (result === 'unavailable') return new Response(null, { status: 503 });
      const text = result === 'malformed' ? 'no-json' : JSON.stringify({
        resultado: result,
        indicadores_json: indicators,
        razones: result === 'requiere_revision' ? 'La propuesta es ambigua.' : null,
      });
      return Response.json({ candidates: [{ content: { parts: [{ text }] } }] });
    });
    try {
      const dispatches = await Promise.all([dispatcher.dispatchOne(), dispatcher.dispatchOne()]);
      expect(dispatches.sort()).toEqual([false, true]);
      expect(gemini).toHaveBeenCalledTimes(1);
      expect(await prisma.propuesta.findUniqueOrThrow({
        where: { id_propuesta: body.id_propuesta },
        select: { estado: true },
      })).toEqual({ estado: expected });
      expect(await prisma.actividad.count({
        where: { id_propuesta: body.id_propuesta },
      })).toBe(published);
      const submission = await prisma.solicitudEvaluacion.findFirstOrThrow({
        where: { id_propuesta: body.id_propuesta },
      });
      expect(submission.estado).toBe(result === 'unavailable' ? 'requiere_revision' : 'entregada');
      expect(await prisma.evaluacionIa.count({
        where: { id_propuesta: body.id_propuesta },
      })).toBe(result === 'unavailable' ? 0 : 1);
      expect(await dispatcher.dispatchOne()).toBe(false);
    } finally {
      gemini.mockRestore();
    }
  });

  it('aplica una evaluación favorable, publica, audita y genera un único aviso', async () => {
    const { body } = await crear().expect(201);
    const key = randomUUID();
    const data = outcome(body.id_propuesta);
    const received = await Promise.all([
      callback(data, key),
      callback(data, key),
    ]);
    expect(received.map((r) => r.status)).toEqual([201, 201]);
    expect(received[0].body.estado).toBe('aprobada');
    expect(
      await prisma.actividad.count({
        where: { id_propuesta: body.id_propuesta },
      }),
    ).toBe(1);
    expect(
      await prisma.evaluacionIa.count({
        where: { id_propuesta: body.id_propuesta },
      }),
    ).toBe(1);
    expect(
      await prisma.eventoNotificacion.count({
        where: { id_destinatario: usuarios[0] },
      }),
    ).toBe(1);
    await callback({ ...data, razones: 'Contenido cambiado' }, key).expect(409);
  });

  it.each([
    'riesgo_fisico',
    'manipulacion_instrucciones',
    'ambiguedad',
  ] as const)('deriva a administración ante el indicador %s', async (flag) => {
    const { body } = await crear().expect(201);
    const data = outcome(body.id_propuesta);
    data.indicadores_json[flag] = true;
    const response = await callback(data).expect(201);
    expect(response.body.estado).toBe('en_revision');
    expect(
      await prisma.actividad.count({
        where: { id_propuesta: body.id_propuesta },
      }),
    ).toBe(0);
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/proposals/${body.id_propuesta}`)
      .set('x-test-user', 'admin')
      .expect(200);
    expect(detail.body.evaluacion.indicadores_json[flag]).toBe(true);
  });

  it('autentica el callback y rechaza versión o esquema inválidos', async () => {
    const { body } = await crear().expect(201);
    const data = outcome(body.id_propuesta);
    await request(app.getHttpServer())
      .post('/api/v1/internal/evaluations/result')
      .send(data)
      .expect(401);
    await callback({ ...data, version_propuesta: 2 }).expect(409);
    await callback({ ...data, indicadores_json: undefined }).expect(400);
    await callback({
      ...data,
      indicadores_json: { ...data.indicadores_json, riesgo_fisico: 'false' },
    }).expect(400);
    await callback({ ...data, roles: ['administrador'] }).expect(400);
    expect(
      await prisma.evaluacionIa.count({
        where: { id_propuesta: body.id_propuesta },
      }),
    ).toBe(0);
  });

  it('una respuesta inválida o controles objetivos fallidos nunca publican', async () => {
    const { body } = await crear().expect(201);
    const data = outcome(body.id_propuesta);
    data.respuesta_valida = false;
    expect((await callback(data).expect(201)).body.estado).toBe('en_revision');
    await prisma.propuesta.update({
      where: { id_propuesta: body.id_propuesta },
      data: { estado: 'pendiente_evaluacion' },
    });
    delete process.env.MINKA_NEIGHBORHOOD_GEOJSON;
    expect(
      (await callback(outcome(body.id_propuesta)).expect(201)).body.estado,
    ).toBe('en_revision');
    expect(
      await prisma.actividad.count({
        where: { id_propuesta: body.id_propuesta },
      }),
    ).toBe(0);
  });

  it('el fallo de notificaciones conserva la publicación y reintenta con la misma clave', async () => {
    const { body } = await crear().expect(201);
    await callback(outcome(body.id_propuesta)).expect(201);
    process.env.MINKA_NOTIFICATIONS_URL = `${providerUrl}/notifications`;
    process.env.MINKA_NOTIFICATIONS_TOKEN = 'notificaciones-de-prueba';
    failNotifications = true;
    await notifications.dispatchOne();
    const pending = await prisma.eventoNotificacion.findFirstOrThrow({
      where: { id_destinatario: usuarios[0] },
    });
    expect(pending.estado).toBe('pendiente');
    expect(
      (
        await prisma.propuesta.findUniqueOrThrow({
          where: { id_propuesta: body.id_propuesta },
        })
      ).estado,
    ).toBe('aprobada');
    expect(
      await prisma.actividad.count({
        where: { id_propuesta: body.id_propuesta },
      }),
    ).toBe(1);
    failNotifications = false;
    await prisma.eventoNotificacion.update({
      where: { id_evento: pending.id_evento },
      data: { proximo_intento: new Date(0) },
    });
    await notifications.dispatchOne();
    expect(
      (
        await prisma.eventoNotificacion.findUniqueOrThrow({
          where: { id_evento: pending.id_evento },
        })
      ).estado,
    ).toBe('entregada');
    expect(notificationKeys).toEqual([
      pending.evento_clave,
      pending.evento_clave,
    ]);
    expect(await notifications.dispatchOne()).toBe(false);
  });

  it('revierte evaluación y publicación si no puede guardar su evento transaccional', async () => {
    const { body } = await crear().expect(201);
    const failure = vi
      .spyOn(notifications, 'enqueue')
      .mockRejectedValueOnce(new Error('Fallo de persistencia de prueba'));
    try {
      await expect(
        results.apply(outcome(body.id_propuesta), randomUUID()),
      ).rejects.toThrow('Fallo de persistencia de prueba');
    } finally {
      failure.mockRestore();
    }
    expect(
      (
        await prisma.propuesta.findUniqueOrThrow({
          where: { id_propuesta: body.id_propuesta },
        })
      ).estado,
    ).toBe('pendiente_evaluacion');
    expect(
      await prisma.actividad.count({
        where: { id_propuesta: body.id_propuesta },
      }),
    ).toBe(0);
    expect(
      await prisma.evaluacionIa.count({
        where: { id_propuesta: body.id_propuesta },
      }),
    ).toBe(0);
  });

  it('un acuse perdido no anuncia revisión si el resultado ya publicó la actividad', async () => {
    const { body } = await crear().expect(201);
    process.env.MINKA_EVALUATION_URL = providerUrl;
    process.env.MINKA_EVALUATION_TOKEN = 'token-de-prueba';
    const delivery = vi
      .spyOn(gateway, 'submit')
      .mockImplementationOnce(async () => {
        await results.apply(outcome(body.id_propuesta), randomUUID());
        throw new Error('Acuse perdido después de recibir el resultado');
      });
    try {
      await dispatcher.dispatchOne();
    } finally {
      delivery.mockRestore();
    }
    expect(
      (
        await prisma.propuesta.findUniqueOrThrow({
          where: { id_propuesta: body.id_propuesta },
        })
      ).estado,
    ).toBe('aprobada');
    const events = await prisma.eventoNotificacion.findMany({
      where: { id_destinatario: usuarios[0] },
    });
    expect(events).toHaveLength(1);
    expect(events[0].payload_json).toMatchObject({
      tipo_evento: 'propuesta_aprobada',
    });
    expect(
      await prisma.registroAuditoria.count({
        where: {
          identificador_afectado: body.id_propuesta,
          estado_nuevo: 'en_revision',
        },
      }),
    ).toBe(0);
  });

  it('no entrega solicitudes de una versión que ya fue modificada', async () => {
    const { body } = await crear().expect(201);
    await prisma.propuesta.update({
      where: { id_propuesta: body.id_propuesta },
      data: { version_actual: 2 },
    });
    process.env.MINKA_EVALUATION_URL = providerUrl;
    process.env.MINKA_EVALUATION_TOKEN = 'token-de-prueba';
    expect(await dispatcher.dispatchOne()).toBe(false);
    expect(entregas).toHaveLength(0);
  });

  it('la cola administrativa solo muestra casos derivados y exige administrador', async () => {
    const { body } = await crear().expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/admin/proposals/review')
      .set('x-test-user', 'owner')
      .expect(403);
    const pendiente = await request(app.getHttpServer())
      .get('/api/v1/admin/proposals/review')
      .set('x-test-user', 'admin')
      .expect(200);
    expect(
      pendiente.body.some(
        (p: { id_propuesta: string }) => p.id_propuesta === body.id_propuesta,
      ),
    ).toBe(false);
    await prisma.propuesta.update({
      where: { id_propuesta: body.id_propuesta },
      data: { estado: 'en_revision' },
    });
    const cola = await request(app.getHttpServer())
      .get('/api/v1/admin/proposals/review')
      .set('x-test-user', 'admin')
      .expect(200);
    expect(
      cola.body.find(
        (p: { id_propuesta: string }) => p.id_propuesta === body.id_propuesta,
      ),
    ).toMatchObject({ titulo: valid.titulo, version_actual: 1 });
  });

  it('aprueba transaccionalmente y evita decisiones o publicaciones duplicadas', async () => {
    const { body } = await crear().expect(201);
    await prisma.propuesta.update({
      where: { id_propuesta: body.id_propuesta },
      data: { estado: 'en_revision' },
    });
    await revisar(body.id_propuesta, undefined, 'owner').expect(403);
    const results = await Promise.all([
      revisar(body.id_propuesta),
      revisar(body.id_propuesta),
    ]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect(results[0].body).toEqual(results[1].body);
    expect(
      await prisma.revisionAdministrativa.count({
        where: { id_propuesta: body.id_propuesta },
      }),
    ).toBe(1);
    expect(
      await prisma.actividad.count({
        where: { id_propuesta: body.id_propuesta },
      }),
    ).toBe(1);
    const published = await request(app.getHttpServer())
      .get(`/api/v1/activities/${results[0].body.id_actividad}`)
      .expect(200);
    expect(published.body).toMatchObject({
      titulo: valid.titulo,
      cupos_disponibles: 10,
    });
    expect(
      await prisma.registroAuditoria.count({
        where: {
          identificador_afectado: body.id_propuesta,
          accion: 'revision_administrativa',
        },
      }),
    ).toBe(1);
  });

  it('rechaza con motivo, conserva la decisión y no publica actividad', async () => {
    const { body } = await crear().expect(201);
    await prisma.propuesta.update({
      where: { id_propuesta: body.id_propuesta },
      data: { estado: 'en_revision' },
    });
    await revisar(body.id_propuesta, {
      decision: 'rechazar',
      motivo: 'Requiere corregir el plan de seguridad.',
      version_propuesta: 1,
    }).expect(201);
    expect(
      (
        await prisma.propuesta.findUniqueOrThrow({
          where: { id_propuesta: body.id_propuesta },
        })
      ).estado,
    ).toBe('rechazada');
    expect(
      await prisma.actividad.count({
        where: { id_propuesta: body.id_propuesta },
      }),
    ).toBe(0);
    await revisar(body.id_propuesta).expect(409);
  });

  it('impide decidir una versión antigua y aprobar fechas vencidas', async () => {
    const { body } = await crear().expect(201);
    await prisma.propuesta.update({
      where: { id_propuesta: body.id_propuesta },
      data: { estado: 'en_revision', version_actual: 2 },
    });
    await revisar(body.id_propuesta).expect(409);
    await prisma.propuesta.update({
      where: { id_propuesta: body.id_propuesta },
      data: {
        version_actual: 1,
        inicio_previsto: new Date('2000-01-01T12:00:00Z'),
        fin_previsto: new Date('2000-01-01T14:00:00Z'),
      },
    });
    await revisar(body.id_propuesta).expect(422);
    expect(
      await prisma.revisionAdministrativa.count({
        where: { id_propuesta: body.id_propuesta },
      }),
    ).toBe(0);
  });

  it.each([
    { motivo: ' ' },
    { decision: 'publicar' },
    { version_propuesta: 0 },
  ])('valida los datos de decisión %j', async (change) => {
    const { body } = await crear().expect(201);
    await revisar(body.id_propuesta, {
      decision: 'aprobar',
      motivo: 'Revisión completa',
      version_propuesta: 1,
      ...change,
    }).expect(400);
  });
});
