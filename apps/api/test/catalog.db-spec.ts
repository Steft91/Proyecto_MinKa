import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createPrismaClient } from '../src/database/prisma-client.js';
import { CatalogModule } from '../src/modules/catalog/catalog.module.js';
import { configureApp } from '../src/configure-app.js';
import type {
  ActividadPublica,
  ContenidoActividadPublicada,
} from '@minka/contracts';

describe('Catálogo HTTP con PostgreSQL real', () => {
  const prisma = createPrismaClient();
  const etiqueta = `catalogo-${randomUUID()}`;
  const personas: string[] = [];
  const usuarios: string[] = [];
  const propuestas: string[] = [];
  const actividades: string[] = [];
  let app: INestApplication;
  let inscripcionActiva: string;
  let contenido: ContenidoActividadPublicada;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [CatalogModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    for (let i = 0; i < 4; i++) {
      const usuario = await prisma.usuario.create({
        data: {
          google_subject: `${etiqueta}-${i}`,
          correo: 'catalogo@example.com',
          correo_verificado: true,
          perfil_completo: true,
          persona: {
            create: {
              nombres: 'Prueba',
              apellidos: 'Catálogo',
              fecha_nacimiento: new Date('2000-01-01'),
              sector_residencia: 'La Mena 2',
            },
          },
        },
      });
      usuarios.push(usuario.id_usuario);
      personas.push(usuario.id_persona);
    }
    const categorias = await prisma.categoriaActividad.findMany();
    const crear = async (
      codigo: string,
      inicio: string,
      estado: 'publicada' | 'cancelada' | 'finalizada',
      parcial = false,
    ) => {
      const categoria = categorias.find((c) => c.codigo === codigo)!;
      const propuesta = await prisma.propuesta.create({
        data: {
          id_proponente: usuarios[0],
          id_categoria: categoria.id_categoria,
          titulo: `Jornada ${codigo}`,
          descripcion: 'Descripción aprobada.',
          finalidad_comunitaria: 'Mejorar nuestro barrio.',
          direccion_lugar: `${etiqueta} Parque Central`,
          latitud_lugar: -0.28,
          longitud_lugar: -78.55,
          inicio_previsto: new Date(inicio),
          fin_previsto: new Date(Date.parse(inicio) + 7200000),
          cupo_maximo: 3,
          estado: 'aprobada',
        },
      });
      propuestas.push(propuesta.id_propuesta);
      const snapshot: ContenidoActividadPublicada = {
        categoria_codigo:
          codigo as ContenidoActividadPublicada['categoria_codigo'],
        titulo: propuesta.titulo,
        descripcion: propuesta.descripcion,
        finalidad_comunitaria: propuesta.finalidad_comunitaria,
        direccion_lugar: propuesta.direccion_lugar,
        latitud_lugar: -0.28,
        longitud_lugar: -78.55,
        inicio_previsto: propuesta.inicio_previsto.toISOString(),
        fin_previsto: propuesta.fin_previsto.toISOString(),
        cupo_maximo: 3,
      };
      const actividad = await prisma.actividad.create({
        data: {
          id_propuesta: propuesta.id_propuesta,
          id_organizador_actual: usuarios[0],
          version_publicada: 1,
          estado,
          contenido_aprobado_json: parcial
            ? { titulo: snapshot.titulo }
            : { ...snapshot, correo_privado: 'no-publicar@example.com' },
        },
      });
      actividades.push(actividad.id_actividad);
      return snapshot;
    };
    contenido = await crear('reciclaje', '2026-11-28T04:30:00Z', 'publicada');
    await crear('limpieza', '2026-11-28T05:00:00Z', 'publicada');
    await crear('reciclaje', '2026-11-29T04:59:59.999Z', 'publicada', true);
    await crear('convivencia', '2026-11-29T14:00:00Z', 'cancelada');
    await crear('reciclaje', '2026-11-29T14:00:00Z', 'finalizada');
    for (const estado of ['pendiente_evaluacion', 'rechazada'] as const) {
      const propuesta = await prisma.propuesta.create({
        data: {
          id_proponente: usuarios[0],
          id_categoria: categorias[0].id_categoria,
          titulo: 'Propuesta oculta',
          descripcion: 'Sin publicación',
          finalidad_comunitaria: 'Comunitaria',
          direccion_lugar: etiqueta,
          latitud_lugar: -0.28,
          longitud_lugar: -78.55,
          inicio_previsto: new Date('2026-12-01T14:00:00Z'),
          fin_previsto: new Date('2026-12-01T16:00:00Z'),
          cupo_maximo: 10,
          estado,
        },
      });
      propuestas.push(propuesta.id_propuesta);
    }
    await prisma.propuesta.update({
      where: { id_propuesta: propuestas[0] },
      data: {
        titulo: 'Borrador privado',
        direccion_lugar: 'Otro lugar',
        version_actual: 2,
      },
    });
    const activa = await prisma.inscripcion.create({
      data: { id_usuario: usuarios[1], id_actividad: actividades[0] },
    });
    inscripcionActiva = activa.id_inscripcion;
    await prisma.inscripcion.create({
      data: {
        id_usuario: usuarios[2],
        id_actividad: actividades[0],
        estado: 'pendiente_suspension',
      },
    });
    await prisma.inscripcion.create({
      data: {
        id_usuario: usuarios[3],
        id_actividad: actividades[0],
        estado: 'cancelada_ciudadano',
      },
    });
  });

  afterAll(async () => {
    await prisma.inscripcion.deleteMany({
      where: { id_actividad: { in: actividades } },
    });
    await prisma.actividad.deleteMany({
      where: { id_actividad: { in: actividades } },
    });
    await prisma.propuesta.deleteMany({
      where: { id_propuesta: { in: propuestas } },
    });
    await prisma.usuario.deleteMany({
      where: { id_usuario: { in: usuarios } },
    });
    await prisma.persona.deleteMany({
      where: { id_persona: { in: personas } },
    });
    await app?.close();
    await prisma.$disconnect();
  });

  const listar = (filtros = {}) =>
    request(app.getHttpServer())
      .get('/api/v1/activities')
      .query({ location: etiqueta, ...filtros });

  it('devuelve exactamente las cuatro categorías autorizadas', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/categories')
      .expect(200);
    expect(
      response.body.map((c: { codigo: string }) => c.codigo).sort(),
    ).toEqual([
      'convivencia',
      'limpieza',
      'reciclaje',
      'recuperacion_espacios',
    ]);
  });

  it('lista solo actividades publicadas y mantiene orden cronológico', async () => {
    const response = await listar().expect(200);
    expect(response.body.map((a: ActividadPublica) => a.id_actividad)).toEqual(
      actividades.slice(0, 3),
    );
  });

  it('filtra por categoría exacta y lugar sin distinguir mayúsculas', async () => {
    const response = await listar({
      category: 'reciclaje',
      location: etiqueta.toUpperCase(),
    }).expect(200);
    expect(response.body.map((a: ActividadPublica) => a.id_actividad)).toEqual([
      actividades[0],
      actividades[2],
    ]);
  });

  it('usa días de Guayaquil e incluye ambos extremos del rango', async () => {
    const response = await listar({
      dateFrom: '2026-11-28',
      dateTo: '2026-11-28',
    }).expect(200);
    expect(response.body.map((a: ActividadPublica) => a.id_actividad)).toEqual([
      actividades[1],
      actividades[2],
    ]);
    const anterior = await listar({ dateTo: '2026-11-27' }).expect(200);
    expect(anterior.body).toHaveLength(1);
  });

  it('devuelve una lista vacía para filtros sin coincidencias', async () => {
    await listar({ category: 'recuperacion_espacios' }).expect(200).expect([]);
  });

  it('cuenta reservas activas y pendientes, y libera cupo al cancelar', async () => {
    const ruta = `/api/v1/activities/${actividades[0]}`;
    expect(
      (await request(app.getHttpServer()).get(ruta).expect(200)).body
        .cupos_disponibles,
    ).toBe(1);
    try {
      await prisma.inscripcion.update({
        where: { id_inscripcion: inscripcionActiva },
        data: { estado: 'cancelada_ciudadano' },
      });
      expect(
        (await request(app.getHttpServer()).get(ruta).expect(200)).body
          .cupos_disponibles,
      ).toBe(2);
    } finally {
      await prisma.inscripcion.update({
        where: { id_inscripcion: inscripcionActiva },
        data: { estado: 'activa' },
      });
    }
  });

  it('conserva el contenido aprobado y excluye los metadatos privados', async () => {
    const { body } = await request(app.getHttpServer())
      .get(`/api/v1/activities/${actividades[0]}`)
      .expect(200);
    expect(body).toMatchObject({
      ...contenido,
      version_publicada: 1,
      cupos_disponibles: 1,
    });
    expect(body.correo_privado).toBeUndefined();
    expect(body.titulo).not.toBe('Borrador privado');
  });

  it('recupera una copia parcial antigua solo cuando coincide la versión', async () => {
    const { body } = await request(app.getHttpServer())
      .get(`/api/v1/activities/${actividades[2]}`)
      .expect(200);
    expect(body.cupo_maximo).toBe(3);
    expect(body.cupos_disponibles).toBe(3);
  });

  it('impide completar una versión publicada con datos de un borrador posterior', async () => {
    try {
      await prisma.actividad.update({
        where: { id_actividad: actividades[0] },
        data: { contenido_aprobado_json: { titulo: contenido.titulo } },
      });
      const response = await request(app.getHttpServer())
        .get(`/api/v1/activities/${actividades[0]}`)
        .expect(500);
      expect(response.body.codigo).toBe('CONTENIDO_PUBLICADO_INVALIDO');
      expect(JSON.stringify(response.body)).not.toContain('Borrador privado');
    } finally {
      await prisma.actividad.update({
        where: { id_actividad: actividades[0] },
        data: {
          contenido_aprobado_json: {
            ...contenido,
            correo_privado: 'no-publicar@example.com',
          },
        },
      });
    }
  });

  it('muestra cero cupos cuando se llena la actividad', async () => {
    try {
      await prisma.inscripcion.updateMany({
        where: { id_actividad: actividades[0], id_usuario: usuarios[3] },
        data: { estado: 'activa' },
      });
      const { body } = await request(app.getHttpServer())
        .get(`/api/v1/activities/${actividades[0]}`)
        .expect(200);
      expect(body.cupos_disponibles).toBe(0);
    } finally {
      await prisma.inscripcion.updateMany({
        where: { id_actividad: actividades[0], id_usuario: usuarios[3] },
        data: { estado: 'cancelada_ciudadano' },
      });
    }
  });

  it.each([
    { category: 'donaciones' },
    { dateFrom: '2026-02-31' },
    { dateFrom: 'ayer' },
    { dateFrom: '2026-11-30', dateTo: '2026-11-20' },
    { location: 'x'.repeat(121) },
    { category: ['reciclaje', 'limpieza'] },
    { extra: 'campo' },
  ])('rechaza filtros inválidos %j', async (filtros) => {
    await listar(filtros).expect(400);
  });

  it('oculta detalles de actividades canceladas, finalizadas o ausentes', async () => {
    for (const id of [actividades[3], actividades[4], randomUUID()]) {
      await request(app.getHttpServer())
        .get(`/api/v1/activities/${id}`)
        .expect(404);
    }
    await request(app.getHttpServer())
      .get('/api/v1/activities/invalido')
      .expect(400);
  });
});
