import { randomUUID } from 'node:crypto';
import { createPrismaClient } from '../src/database/prisma-client.js';

describe('Prisma y PostgreSQL reales', () => {
  const prisma = createPrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('consulta los roles y las cuatro categorías iniciales', async () => {
    const roles = await prisma.rol.findMany({ orderBy: { nombre: 'asc' } });
    expect(roles.map((rol) => rol.nombre)).toEqual([
      'administrador',
      'ciudadano',
      'organizador',
    ]);
    expect(await prisma.categoriaActividad.count()).toBe(4);
  });

  it('guarda y recupera una persona con su usuario y varios roles', async () => {
    const rollback = new Error('Revertir datos de prueba');
    const transaction = prisma.$transaction(async (tx) => {
      const roles = await tx.rol.findMany({
        where: { nombre: { in: ['ciudadano', 'organizador'] } },
      });
      const usuario = await tx.usuario.create({
        data: {
          google_subject: `prueba-${randomUUID()}`,
          correo: 'prueba@example.com',
          correo_verificado: true,
          perfil_completo: true,
          persona: {
            create: {
              nombres: 'Persona de prueba',
              apellidos: 'Integración',
              fecha_nacimiento: new Date('2000-01-01T00:00:00Z'),
              sector_residencia: 'La Mena 2',
            },
          },
          roles: {
            create: roles.map((rol) => ({ id_rol: rol.id_rol })),
          },
        },
      });
      const almacenado = await tx.usuario.findUniqueOrThrow({
        where: { id_usuario: usuario.id_usuario },
        include: { persona: true, roles: true },
      });
      expect(almacenado.puntos).toBe(0);
      expect(almacenado.estrellas.toNumber()).toBe(5);
      expect(almacenado.persona.id_persona).toBe(almacenado.id_persona);
      expect(almacenado.roles).toHaveLength(2);
      throw rollback;
    });
    await expect(transaction).rejects.toBe(rollback);
  });

  it.each([
    { puntos: -1, estrellas: 5 },
    { puntos: 0, estrellas: -0.5 },
    { puntos: 0, estrellas: 5.5 },
  ])('PostgreSQL rechaza reputación fuera de rango %j', async (saldos) => {
    // El INSERT se revierte junto con la persona si falla una restricción.
    await expect(
      prisma.usuario.create({
        data: {
          ...saldos,
          google_subject: `prueba-${randomUUID()}`,
          correo: 'prueba@example.com',
          correo_verificado: true,
          perfil_completo: true,
          persona: {
            create: {
              nombres: 'Persona de prueba',
              apellidos: 'Restricción',
              fecha_nacimiento: new Date('2000-01-01T00:00:00Z'),
              sector_residencia: 'La Mena 2',
            },
          },
        },
      }),
    ).rejects.toThrow(/usuario_(puntos_no_negativos|estrellas_rango)/);
  });
});
