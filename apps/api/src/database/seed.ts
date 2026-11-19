import { createPrismaClient } from './prisma-client.js';
import { CATEGORIAS_AUTORIZADAS } from '../modules/catalog/categories.js';

const prisma = createPrismaClient();

try {
  await prisma.$transaction(async (tx) => {
    for (const nombre of ['ciudadano', 'organizador', 'administrador']) {
      await tx.rol.upsert({
        where: { nombre },
        create: { nombre },
        update: {},
      });
    }

    for (const categoria of CATEGORIAS_AUTORIZADAS) {
      await tx.categoriaActividad.upsert({
        where: { codigo: categoria.codigo },
        create: categoria,
        update: {},
      });
    }
  });
  console.log('Semillas de roles y categorías aplicadas.');
} finally {
  await prisma.$disconnect();
}
