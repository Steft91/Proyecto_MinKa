import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type {
  ActividadPublica,
  CategoriaPublica,
  ContenidoActividadPublicada,
} from '@minka/contracts';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { CODIGOS_CATEGORIA } from './categories.js';
import { CatalogFiltersDto, PublishedContentDto } from './catalog.dto.js';

const publishedInclude = {
  propuesta: { include: { categoria: true } },
  _count: {
    select: {
      inscripciones: {
        where: { estado: { in: ['activa', 'pendiente_suspension'] } },
      },
    },
  },
} satisfies Prisma.ActividadInclude;
type PublishedRow = Prisma.ActividadGetPayload<{
  include: typeof publishedInclude;
}>;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategories(): Promise<CategoriaPublica[]> {
    const categorias = await this.prisma.client.categoriaActividad.findMany({
      where: { habilitada: true, codigo: { in: CODIGOS_CATEGORIA } },
      select: { id_categoria: true, codigo: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
    return categorias.map((categoria) => ({
      ...categoria,
      codigo: categoria.codigo as CategoriaPublica['codigo'],
    }));
  }

  async listPublished(filters: CatalogFiltersDto): Promise<ActividadPublica[]> {
    if (
      filters.dateFrom &&
      filters.dateTo &&
      filters.dateFrom > filters.dateTo
    ) {
      throw new BadRequestException({
        codigo: 'RANGO_FECHAS_INVALIDO',
        mensaje: 'La fecha inicial debe ser anterior o igual a la final.',
      });
    }
    const rows = await this.prisma.client.actividad.findMany({
      where: { estado: 'publicada' },
      include: publishedInclude,
    });
    const desde = filters.dateFrom
      ? Date.parse(`${filters.dateFrom}T00:00:00-05:00`)
      : -Infinity;
    const hasta = filters.dateTo
      ? Date.parse(`${filters.dateTo}T23:59:59.999-05:00`)
      : Infinity;
    const lugar = filters.location?.toLocaleLowerCase('es') ?? '';

    return rows
      .map((row) => this.toPublicActivity(row))
      .filter(
        (actividad) =>
          (!filters.category ||
            actividad.categoria_codigo === filters.category) &&
          Date.parse(actividad.inicio_previsto) >= desde &&
          Date.parse(actividad.inicio_previsto) <= hasta &&
          actividad.direccion_lugar.toLocaleLowerCase('es').includes(lugar),
      )
      .sort(
        (a, b) =>
          Date.parse(a.inicio_previsto) - Date.parse(b.inicio_previsto) ||
          a.id_actividad.localeCompare(b.id_actividad),
      );
  }

  async getActivityDetail(id: string): Promise<ActividadPublica> {
    const row = await this.prisma.client.actividad.findFirst({
      where: { id_actividad: id, estado: 'publicada' },
      include: publishedInclude,
    });
    if (!row) {
      throw new NotFoundException({
        codigo: 'ACTIVIDAD_NO_ENCONTRADA',
        mensaje: 'La actividad no está disponible en el catálogo.',
      });
    }
    return this.toPublicActivity(row);
  }

  async calculateAvailability(id: string): Promise<number> {
    return (await this.getActivityDetail(id)).cupos_disponibles;
  }

  private toPublicActivity(row: PublishedRow): ActividadPublica {
    const { propuesta } = row;
    // Compatibilidad con copias parciales anteriores, solo si la versión coincide.
    const original: Partial<ContenidoActividadPublicada> =
      row.version_publicada === propuesta.version_actual
        ? {
            categoria_codigo: propuesta.categoria
              .codigo as CategoriaPublica['codigo'],
            titulo: propuesta.titulo,
            descripcion: propuesta.descripcion,
            finalidad_comunitaria: propuesta.finalidad_comunitaria,
            direccion_lugar: propuesta.direccion_lugar,
            latitud_lugar: propuesta.latitud_lugar.toNumber(),
            longitud_lugar: propuesta.longitud_lugar.toNumber(),
            inicio_previsto: propuesta.inicio_previsto.toISOString(),
            fin_previsto: propuesta.fin_previsto.toISOString(),
            cupo_maximo: propuesta.cupo_maximo,
          }
        : {};
    const snapshot = row.contenido_aprobado_json;
    const contenido = plainToInstance(PublishedContentDto, {
      ...original,
      ...(typeof snapshot === 'object' &&
      snapshot !== null &&
      !Array.isArray(snapshot)
        ? snapshot
        : {}),
    });
    if (
      validateSync(contenido).length ||
      Date.parse(contenido.fin_previsto) <=
        Date.parse(contenido.inicio_previsto)
    ) {
      throw new InternalServerErrorException({
        codigo: 'CONTENIDO_PUBLICADO_INVALIDO',
        mensaje:
          'No se pudo recuperar la información aprobada de una actividad.',
      });
    }
    // Proyección explícita para excluir metadatos privados presentes en el JSON.
    return {
      id_actividad: row.id_actividad,
      id_propuesta: row.id_propuesta,
      id_organizador_actual: row.id_organizador_actual,
      version_publicada: row.version_publicada,
      estado: 'publicada',
      categoria_codigo: contenido.categoria_codigo,
      titulo: contenido.titulo,
      descripcion: contenido.descripcion,
      finalidad_comunitaria: contenido.finalidad_comunitaria,
      direccion_lugar: contenido.direccion_lugar,
      latitud_lugar: contenido.latitud_lugar,
      longitud_lugar: contenido.longitud_lugar,
      inicio_previsto: new Date(contenido.inicio_previsto).toISOString(),
      fin_previsto: new Date(contenido.fin_previsto).toISOString(),
      cupo_maximo: contenido.cupo_maximo,
      cupos_disponibles: Math.max(
        0,
        contenido.cupo_maximo - row._count.inscripciones,
      ),
    };
  }
}
