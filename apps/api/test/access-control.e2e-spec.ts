import {
  Controller,
  Get,
  INestApplication,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { SesionActual } from '@minka/contracts';
import type { NextFunction, Response } from 'express';
import request from 'supertest';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { AccessControlModule } from '../src/modules/access-control/access-control.module.js';
import {
  ActiveAccountGuard,
  ActivityOwnerGuard,
  AdminGuard,
  ProposalOwnerGuard,
  ProposerGuard,
} from '../src/modules/access-control/access-control.guards.js';
import type { SessionRequest } from '../src/modules/access-control/session-request.js';

const propuestaId = 'd031828e-d459-4af5-b100-e0c21285fe62';
const actividadId = '8f9aebd0-ef67-4776-b29c-28032303baf9';
const inexistenteId = 'd862e14a-e8fe-49af-b088-d3b9c23b145e';
const titular: SesionActual = {
  id_usuario: '9efc8350-15f9-4cae-93a1-c63768999143',
  correo: 'titular@example.com',
  correo_verificado: true,
  perfil_completo: true,
  mayor_edad: true,
  estado: 'activo',
  roles: ['ciudadano'],
  puntos: 0,
  estrellas: 5,
};
const sesiones: Record<string, SesionActual> = {
  titular,
  ajeno: {
    ...titular,
    id_usuario: 'c8d408ee-eb81-4417-a714-d1383f9673b8',
    roles: ['organizador'],
  },
  admin: {
    ...titular,
    id_usuario: 'b034921a-d0a0-47a2-9287-042f3d296fd1',
    roles: ['administrador'],
  },
  suspendido: { ...titular, estado: 'suspendido', roles: ['administrador'] },
  incompleto: { ...titular, perfil_completo: false },
  menor: { ...titular, mayor_edad: false },
  sin_verificar: { ...titular, correo_verificado: false },
  limite: { ...titular, estrellas: 2.5 },
  cero: { ...titular, estrellas: 0 },
};

// Las rutas y la selección de sesiones existen exclusivamente en esta prueba.
@Controller('access-test')
class AccessTestController {
  @Get('active')
  @UseGuards(ActiveAccountGuard)
  active() {
    return { permitido: true };
  }

  @Post('proposals')
  @UseGuards(ProposerGuard)
  propose() {
    return { permitido: true };
  }

  @Post('admin/proposals/:id/decision')
  @UseGuards(AdminGuard)
  decide() {
    return { permitido: true };
  }

  @Post('proposals/:id/edit')
  @UseGuards(ProposalOwnerGuard)
  editProposal() {
    return { permitido: true };
  }

  @Post('activities/:id/manage')
  @UseGuards(ActivityOwnerGuard)
  manageActivity() {
    return { permitido: true };
  }
}

describe('Guards de autorización por HTTP', () => {
  let app: INestApplication;
  let organizadorActualId = titular.id_usuario;
  const findProposal = vi.fn(
    async ({ where }: { where: { id_propuesta: string } }) =>
      where.id_propuesta === propuestaId
        ? { id_proponente: titular.id_usuario }
        : null,
  );
  const findActivity = vi.fn(
    async ({ where }: { where: { id_actividad: string } }) =>
      where.id_actividad === actividadId
        ? { id_organizador_actual: organizadorActualId }
        : null,
  );

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AccessControlModule],
      controllers: [AccessTestController],
    })
      .overrideProvider(PrismaService)
      .useValue({
        client: {
          propuesta: { findUnique: findProposal },
          actividad: { findUnique: findActivity },
        },
      })
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    app.use((req: SessionRequest, _res: Response, next: NextFunction) => {
      req.sesion = sesiones[req.header('x-test-session') ?? ''];
      next();
    });
    await app.init();
  });

  beforeEach(() => {
    organizadorActualId = titular.id_usuario;
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('permite una operación a una cuenta habilitada', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/access-test/active')
      .set('x-test-session', 'titular')
      .expect(200)
      .expect({ permitido: true });
  });

  it.each([
    'proposals',
    `admin/proposals/${propuestaId}/decision`,
    `proposals/${propuestaId}/edit`,
    `activities/${actividadId}/manage`,
  ])('exige sesión para %s', async (ruta) => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/access-test/${ruta}`)
      .expect(401);
    expect(response.body.codigo).toBe('NO_AUTENTICADO');
    expect(findProposal).not.toHaveBeenCalled();
    expect(findActivity).not.toHaveBeenCalled();
  });

  it.each(['suspendido', 'incompleto', 'menor', 'sin_verificar', 'cero'])(
    'bloquea la cuenta %s antes de consultar propiedad',
    async (sesion) => {
      await request(app.getHttpServer())
        .post(`/api/v1/access-test/activities/${actividadId}/manage`)
        .set('x-test-session', sesion)
        .expect(403);
      expect(findActivity).not.toHaveBeenCalled();
    },
  );

  it('permite participar con 2,5 estrellas y bloquea presentar propuestas', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/access-test/active')
      .set('x-test-session', 'limite')
      .expect(200);
    const response = await request(app.getHttpServer())
      .post('/api/v1/access-test/proposals')
      .set('x-test-session', 'limite')
      .expect(403);
    expect(response.body.codigo).toBe('ESTRELLAS_INSUFICIENTES');
  });

  it('permite proponer a una cuenta con cinco estrellas', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/access-test/proposals')
      .set('x-test-session', 'titular')
      .expect(201);
  });

  it('solo el administrador puede resolver propuestas', async () => {
    const ruta = `/api/v1/access-test/admin/proposals/${propuestaId}/decision`;
    await request(app.getHttpServer())
      .post(ruta)
      .set('x-test-session', 'titular')
      .expect(403);
    await request(app.getHttpServer())
      .post(ruta)
      .set('x-test-session', 'ajeno')
      .expect(403);
    await request(app.getHttpServer())
      .post(ruta)
      .set('x-test-session', 'admin')
      .expect(201);
    await request(app.getHttpServer())
      .post(ruta)
      .set('x-test-session', 'suspendido')
      .expect(403);
  });

  it.each([
    { ruta: `proposals/${propuestaId}/edit`, codigo: 'PROPUESTA_AJENA' },
    { ruta: `activities/${actividadId}/manage`, codigo: 'ACTIVIDAD_AJENA' },
  ])('comprueba titularidad para $ruta', async ({ ruta, codigo }) => {
    await request(app.getHttpServer())
      .post(`/api/v1/access-test/${ruta}`)
      .set('x-test-session', 'titular')
      .expect(201);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/access-test/${ruta}`)
      .set('x-test-session', 'ajeno')
      .send({
        id_proponente: sesiones.ajeno.id_usuario,
        id_organizador_actual: sesiones.ajeno.id_usuario,
      })
      .expect(403);
    expect(response.body.codigo).toBe(codigo);
    await request(app.getHttpServer())
      .post(`/api/v1/access-test/${ruta}`)
      .set('x-test-session', 'admin')
      .expect(403);
  });

  it('un cuerpo con roles o sesión inventados no concede administración', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/access-test/admin/proposals/${propuestaId}/decision`)
      .set('x-test-session', 'titular')
      .send({ roles: ['administrador'], sesion: sesiones.admin })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/access-test/proposals')
      .send({ sesion: titular })
      .expect(401);
  });

  it('comprueba el organizador actual en cada solicitud tras una reasignación', async () => {
    organizadorActualId = sesiones.ajeno.id_usuario;
    const ruta = `/api/v1/access-test/activities/${actividadId}/manage`;
    await request(app.getHttpServer())
      .post(ruta)
      .set('x-test-session', 'titular')
      .expect(403);
    await request(app.getHttpServer())
      .post(ruta)
      .set('x-test-session', 'ajeno')
      .expect(201);
  });

  it.each(['proposals', 'activities'])(
    'rechaza UUID inválidos para %s',
    async (tipo) => {
      const accion = tipo === 'proposals' ? 'edit' : 'manage';
      await request(app.getHttpServer())
        .post(`/api/v1/access-test/${tipo}/invalido/${accion}`)
        .set('x-test-session', 'titular')
        .expect(400);
      expect(findProposal).not.toHaveBeenCalled();
      expect(findActivity).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      ruta: `proposals/${inexistenteId}/edit`,
      codigo: 'PROPUESTA_NO_ENCONTRADA',
    },
    {
      ruta: `activities/${inexistenteId}/manage`,
      codigo: 'ACTIVIDAD_NO_ENCONTRADA',
    },
  ])('devuelve 404 para $ruta', async ({ ruta, codigo }) => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/access-test/${ruta}`)
      .set('x-test-session', 'titular')
      .expect(404);
    expect(response.body.codigo).toBe(codigo);
  });
});
