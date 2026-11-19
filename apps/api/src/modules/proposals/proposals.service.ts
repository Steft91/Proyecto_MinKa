import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { isUUID, validateSync } from 'class-validator';
import type {
  CrearPropuesta,
  ElegibilidadPropuesta,
  PropuestaEvaluable,
  PropuestaPropia,
  SesionActual,
} from '@minka/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import { AccessControlService } from '../access-control/access-control.service.js';
import { CreateProposalDto } from './create-proposal.dto.js';
import { NeighborhoodService } from './neighborhood.service.js';
import { AuditService } from '../audit/audit.service.js';

type ProposalRow = Prisma.PropuestaGetPayload<{ include: { categoria: true } }>;

@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly neighborhood: NeighborhoodService,
    private readonly audit: AuditService,
  ) {}

  async eligibility(sesion?: SesionActual): Promise<ElegibilidadPropuesta> {
    const actual = await this.loadCurrentSession(
      this.prisma.client,
      this.requireSession(sesion),
    );
    try {
      this.access.assertCanPropose(actual);
      return { puede_proponer: true, motivo: null };
    } catch (error) {
      if (!(error instanceof ForbiddenException)) throw error;
      const body = error.getResponse() as { mensaje: string };
      return { puede_proponer: false, motivo: body.mensaje };
    }
  }

  async create(
    sesion: SesionActual | undefined,
    body: CreateProposalDto,
    clave?: string,
  ): Promise<PropuestaPropia> {
    const identity = this.requireSession(sesion);
    if (clave && !isUUID(clave))
      throw new BadRequestException({
        codigo: 'CLAVE_INVALIDA',
        mensaje: 'La clave de creación debe ser un UUID.',
      });
    const input = plainToInstance(CreateProposalDto, body);
    if (
      validateSync(input, { whitelist: true, forbidNonWhitelisted: true })
        .length
    ) {
      throw new BadRequestException({
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'Revisa los campos de tu propuesta.',
      });
    }
    const normalized: CrearPropuesta = {
      titulo: input.titulo,
      descripcion: input.descripcion,
      finalidad_comunitaria: input.finalidad_comunitaria,
      categoria_codigo: input.categoria_codigo,
      direccion_lugar: input.direccion_lugar,
      latitud_lugar: input.latitud_lugar,
      longitud_lugar: input.longitud_lugar,
      cupo_maximo: input.cupo_maximo,
      inicio_previsto: new Date(input.inicio_previsto).toISOString(),
      fin_previsto: new Date(input.fin_previsto).toISOString(),
    };
    return this.prisma.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id_usuario FROM usuario WHERE id_usuario = ${identity.id_usuario}::uuid FOR UPDATE`;
      const actual = await this.loadCurrentSession(tx, identity);
      this.access.assertCanPropose(actual);
      if (clave) {
        const previous = await tx.propuesta.findUnique({
          where: {
            id_proponente_clave_creacion: {
              id_proponente: actual.id_usuario,
              clave_creacion: clave,
            },
          },
          include: {
            categoria: true,
            solicitudes_evaluacion: { where: { version_propuesta: 1 } },
          },
        });
        if (previous) {
          const original =
            previous.solicitudes_evaluacion[0]?.contenido_json ??
            this.toEvaluable(previous);
          if (
            !Object.entries(normalized).every(
              ([key, value]) =>
                (original as Record<string, unknown>)[key] === value,
            )
          ) {
            throw new ConflictException({
              codigo: 'CLAVE_REUTILIZADA',
              mensaje: 'Esta clave ya fue usada para otra propuesta.',
            });
          }
          return this.toOwnProposal(previous);
        }
      }
      this.validateObjectiveFields(normalized);
      const categoria = await tx.categoriaActividad.findUnique({
        where: { codigo: normalized.categoria_codigo },
      });
      if (!categoria?.habilitada)
        throw new UnprocessableEntityException({
          codigo: 'CATEGORIA_NO_DISPONIBLE',
          mensaje: 'La categoría seleccionada no está habilitada.',
        });
      const {
        categoria_codigo: _codigo,
        inicio_previsto,
        fin_previsto,
        ...fields
      } = normalized;
      const propuesta = await tx.propuesta.create({
        data: {
          ...fields,
          inicio_previsto: new Date(inicio_previsto),
          fin_previsto: new Date(fin_previsto),
          id_categoria: categoria.id_categoria,
          id_proponente: actual.id_usuario,
          clave_creacion: clave,
          estado: 'pendiente_evaluacion',
          version_actual: 1,
        },
        include: { categoria: true },
      });
      await this.enqueueEvaluation(tx, propuesta);
      await this.audit.record(
        {
          id_actor: actual.id_usuario,
          entidad_afectada: 'propuesta',
          identificador_afectado: propuesta.id_propuesta,
          accion: 'propuesta_creada',
          estado_nuevo: 'pendiente_evaluacion',
          evento_clave: `propuesta:${propuesta.id_propuesta}:v1:creada`,
        },
        tx,
      );
      return this.toOwnProposal(propuesta);
    });
  }

  validateObjectiveFields(input: CrearPropuesta): void {
    if (Date.parse(input.inicio_previsto) <= Date.now()) {
      throw new UnprocessableEntityException({
        codigo: 'INICIO_PASADO',
        mensaje: 'El inicio de la actividad debe estar en el futuro.',
      });
    }
    if (Date.parse(input.fin_previsto) <= Date.parse(input.inicio_previsto)) {
      throw new UnprocessableEntityException({
        codigo: 'FECHAS_INVALIDAS',
        mensaje: 'La finalización debe ser posterior al inicio.',
      });
    }
    this.neighborhood.assertWithin(input.latitud_lugar, input.longitud_lugar);
  }

  async getMine(sesion?: SesionActual): Promise<PropuestaPropia[]> {
    const actual = this.requireSession(sesion);
    const rows = await this.prisma.client.propuesta.findMany({
      where: { id_proponente: actual.id_usuario },
      include: { categoria: true },
      orderBy: [{ creada_en: 'desc' }, { id_propuesta: 'asc' }],
    });
    return rows.map((row) => this.toOwnProposal(row));
  }

  async getByIdAuthorized(
    sesion: SesionActual | undefined,
    id: string,
  ): Promise<PropuestaPropia> {
    const actual = this.requireSession(sesion);
    const row = await this.prisma.client.propuesta.findUnique({
      where: { id_propuesta: id },
      include: { categoria: true },
    });
    if (!row)
      throw new NotFoundException({
        codigo: 'PROPUESTA_NO_ENCONTRADA',
        mensaje: 'La propuesta no existe.',
      });
    if (row.id_proponente !== actual.id_usuario)
      throw new ForbiddenException({
        codigo: 'PROPUESTA_AJENA',
        mensaje: 'Solo puedes consultar tus propias propuestas.',
      });
    return this.toOwnProposal(row);
  }

  async submitForEvaluation(
    sesion: SesionActual | undefined,
    id: string,
  ): Promise<void> {
    const identity = this.requireSession(sesion);
    await this.prisma.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id_usuario FROM usuario WHERE id_usuario = ${identity.id_usuario}::uuid FOR UPDATE`;
      this.access.assertCanPropose(await this.loadCurrentSession(tx, identity));
      const row = await tx.propuesta.findUnique({
        where: { id_propuesta: id },
        include: { categoria: true },
      });
      if (!row)
        throw new NotFoundException({
          codigo: 'PROPUESTA_NO_ENCONTRADA',
          mensaje: 'La propuesta no existe.',
        });
      if (row.id_proponente !== identity.id_usuario)
        throw new ForbiddenException({
          codigo: 'PROPUESTA_AJENA',
          mensaje: 'Solo puedes enviar tus propias propuestas.',
        });
      if (row.estado !== 'pendiente_evaluacion')
        throw new ConflictException({
          codigo: 'ESTADO_PROPUESTA_INVALIDO',
          mensaje: 'La propuesta ya salió de la espera de evaluación.',
        });
      await this.enqueueEvaluation(tx, row);
    });
  }

  private requireSession(sesion?: SesionActual): SesionActual {
    if (!sesion)
      throw new UnauthorizedException({
        codigo: 'NO_AUTENTICADO',
        mensaje: 'Necesitas iniciar sesión para consultar o crear propuestas.',
      });
    return sesion;
  }

  private async loadCurrentSession(
    client: Prisma.TransactionClient,
    sesion: Pick<SesionActual, 'id_usuario'>,
  ): Promise<SesionActual> {
    const usuario = await client.usuario.findUnique({
      where: { id_usuario: sesion.id_usuario },
      include: { persona: true, roles: { include: { rol: true } } },
    });
    if (!usuario)
      throw new UnauthorizedException({
        codigo: 'NO_AUTENTICADO',
        mensaje: 'La cuenta de la sesión ya no está disponible.',
      });
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const cutoff = `${Number(today.slice(0, 4)) - 18}${today.slice(4)}`;
    return {
      id_usuario: usuario.id_usuario,
      correo: usuario.correo,
      correo_verificado: usuario.correo_verificado,
      perfil_completo: usuario.perfil_completo,
      mayor_edad:
        usuario.persona.fecha_nacimiento.toISOString().slice(0, 10) <= cutoff,
      estado: usuario.estado,
      puntos: usuario.puntos,
      estrellas: usuario.estrellas.toNumber(),
      roles: usuario.roles.map(
        ({ rol }) => rol.nombre as SesionActual['roles'][number],
      ),
    };
  }

  private async enqueueEvaluation(
    tx: Prisma.TransactionClient,
    row: ProposalRow,
  ): Promise<void> {
    await tx.solicitudEvaluacion.upsert({
      where: {
        id_propuesta_version_propuesta: {
          id_propuesta: row.id_propuesta,
          version_propuesta: row.version_actual,
        },
      },
      update: {},
      create: {
        id_propuesta: row.id_propuesta,
        version_propuesta: row.version_actual,
        evento_clave: `propuesta:${row.id_propuesta}:v${row.version_actual}`,
        contenido_json: { ...this.toEvaluable(row) },
      },
    });
  }

  toEvaluable(row: ProposalRow): PropuestaEvaluable {
    return {
      id_propuesta: row.id_propuesta,
      version_actual: row.version_actual,
      categoria_codigo: row.categoria
        .codigo as PropuestaEvaluable['categoria_codigo'],
      titulo: row.titulo,
      descripcion: row.descripcion,
      finalidad_comunitaria: row.finalidad_comunitaria,
      direccion_lugar: row.direccion_lugar,
      latitud_lugar: row.latitud_lugar.toNumber(),
      longitud_lugar: row.longitud_lugar.toNumber(),
      inicio_previsto: row.inicio_previsto.toISOString(),
      fin_previsto: row.fin_previsto.toISOString(),
      cupo_maximo: row.cupo_maximo,
    };
  }

  toOwnProposal(row: ProposalRow): PropuestaPropia {
    return {
      ...this.toEvaluable(row),
      id_proponente: row.id_proponente,
      estado: row.estado,
      creada_en: row.creada_en.toISOString(),
    };
  }

  getCurrentSession(
    sesion: SesionActual | undefined,
    tx: Prisma.TransactionClient = this.prisma.client,
  ): Promise<SesionActual> {
    return this.loadCurrentSession(tx, this.requireSession(sesion));
  }

  getAccountSession(
    id_usuario: string,
    tx: Prisma.TransactionClient,
  ): Promise<SesionActual> {
    return this.loadCurrentSession(tx, { id_usuario });
  }
}
