import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { SesionActual } from '@minka/contracts';
import { createPrismaClient } from '../src/database/prisma-client.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { AccessControlModule } from '../src/modules/access-control/access-control.module.js';
import { ResourceOwnershipService } from '../src/modules/access-control/resource-ownership.service.js';

describe('Propiedad de recursos en PostgreSQL', () => {
  const prisma = createPrismaClient();
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('distingue dos usuarios y consulta el organizador actual después de un cambio', async () => {
    const rollback = new Error('Revertir recursos de prueba');
    const transaction = prisma.$transaction(
      async (tx) => {
        const persona = () => ({
          nombres: 'Prueba',
          apellidos: 'Propiedad',
          fecha_nacimiento: new Date('2000-01-01T00:00:00Z'),
          sector_residencia: 'La Mena 2',
        });
        const usuario = () => ({
          google_subject: `prueba-${randomUUID()}`,
          correo: 'propiedad@example.com',
          correo_verificado: true,
          perfil_completo: true,
          persona: { create: persona() },
        });
        const primero = await tx.usuario.create({ data: usuario() });
        const segundo = await tx.usuario.create({ data: usuario() });
        const sesion = (id_usuario: string): SesionActual => ({
          id_usuario,
          correo: 'propiedad@example.com',
          correo_verificado: true,
          perfil_completo: true,
          mayor_edad: true,
          estado: 'activo',
          roles: ['ciudadano'],
          puntos: 0,
          estrellas: 5,
        });
        const categoria = await tx.categoriaActividad.findUniqueOrThrow({
          where: { codigo: 'reciclaje' },
        });
        const propuesta = await tx.propuesta.create({
          data: {
            id_proponente: primero.id_usuario,
            id_categoria: categoria.id_categoria,
            titulo: 'Prueba de propiedad',
            descripcion: 'Contenido de prueba de integración.',
            finalidad_comunitaria: 'Prueba de persistencia.',
            direccion_lugar: 'Ubicación de prueba',
            latitud_lugar: -0.28,
            longitud_lugar: -78.55,
            inicio_previsto: new Date('2026-12-01T14:00:00Z'),
            fin_previsto: new Date('2026-12-01T16:00:00Z'),
            cupo_maximo: 10,
          },
        });
        const actividad = await tx.actividad.create({
          data: {
            id_propuesta: propuesta.id_propuesta,
            id_organizador_actual: primero.id_usuario,
            version_publicada: 1,
            contenido_aprobado_json: { titulo: propuesta.titulo },
          },
        });
        const module = await Test.createTestingModule({
          imports: [AccessControlModule],
        })
          .overrideProvider(PrismaService)
          .useValue({ client: tx })
          .compile();
        try {
          const ownership = module.get(ResourceOwnershipService);
          await expect(
            ownership.assertProposalOwner(
              sesion(primero.id_usuario),
              propuesta.id_propuesta,
            ),
          ).resolves.toBeUndefined();
          await expect(
            ownership.assertProposalOwner(
              sesion(segundo.id_usuario),
              propuesta.id_propuesta,
            ),
          ).rejects.toMatchObject({ status: 403 });
          await expect(
            ownership.assertActivityOwner(
              sesion(primero.id_usuario),
              actividad.id_actividad,
            ),
          ).resolves.toBeUndefined();
          await expect(
            ownership.assertActivityOwner(
              sesion(segundo.id_usuario),
              actividad.id_actividad,
            ),
          ).rejects.toMatchObject({ status: 403 });

          await tx.actividad.update({
            where: { id_actividad: actividad.id_actividad },
            data: { id_organizador_actual: segundo.id_usuario },
          });
          await expect(
            ownership.assertActivityOwner(
              sesion(primero.id_usuario),
              actividad.id_actividad,
            ),
          ).rejects.toMatchObject({ status: 403 });
          await expect(
            ownership.assertActivityOwner(
              sesion(segundo.id_usuario),
              actividad.id_actividad,
            ),
          ).resolves.toBeUndefined();
          // La autoría de la propuesta permanece independiente de la responsabilidad actual.
          await expect(
            ownership.assertProposalOwner(
              sesion(primero.id_usuario),
              propuesta.id_propuesta,
            ),
          ).resolves.toBeUndefined();
        } finally {
          await module.close();
        }
        throw rollback;
      },
      { timeout: 10000 },
    );
    await expect(transaction).rejects.toBe(rollback);
  });
});
