import { HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { SesionActual } from '@minka/contracts';
import { AccessControlModule } from './access-control.module.js';
import { AccessControlService } from './access-control.service.js';
import { PrismaService } from '../../database/prisma.service.js';

const ciudadano: SesionActual = {
  id_usuario: 'cc6f4fbf-eab2-4af4-b792-c56764bd3956',
  correo: 'ciudadano@example.com',
  correo_verificado: true,
  perfil_completo: true,
  mayor_edad: true,
  estado: 'activo',
  roles: ['ciudadano'],
  puntos: 0,
  estrellas: 5,
};

describe('Permisos de una cuenta', () => {
  let service: AccessControlService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AccessControlModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    service = module.get(AccessControlService);
  });

  it('habilita al ciudadano nuevo con cero puntos y cinco estrellas', () => {
    expect(service.getPermissions(ciudadano)).toEqual({
      puede_participar: true,
      puede_proponer: true,
      puede_administrar: false,
    });
    expect(() => service.assertActive(ciudadano)).not.toThrow();
    expect(() => service.assertCanPropose(ciudadano)).not.toThrow();
  });

  it.each([
    { estrellas: 0.5, participa: true, propone: false },
    { estrellas: 1, participa: true, propone: false },
    { estrellas: 2.5, participa: true, propone: false },
    { estrellas: 2.6, participa: true, propone: true },
    { estrellas: 5, participa: true, propone: true },
    { estrellas: 0, participa: false, propone: false },
  ])('aplica el límite estricto con $estrellas estrellas', (caso) => {
    const sesion = { ...ciudadano, estrellas: caso.estrellas };
    expect(service.canParticipate(sesion)).toBe(caso.participa);
    expect(service.canPropose(sesion)).toBe(caso.propone);
  });

  it.each<{
    caso: string;
    sesion: SesionActual | null | undefined;
    codigo: string;
    status: number;
  }>([
    {
      caso: 'sin sesión',
      sesion: undefined,
      codigo: 'NO_AUTENTICADO',
      status: 401,
    },
    {
      caso: 'sesión nula',
      sesion: null,
      codigo: 'NO_AUTENTICADO',
      status: 401,
    },
    {
      caso: 'correo sin verificar',
      sesion: { ...ciudadano, correo_verificado: false },
      codigo: 'CORREO_NO_VERIFICADO',
      status: 403,
    },
    {
      caso: 'perfil incompleto',
      sesion: { ...ciudadano, perfil_completo: false },
      codigo: 'PERFIL_INCOMPLETO',
      status: 403,
    },
    {
      caso: 'menor de edad',
      sesion: { ...ciudadano, mayor_edad: false },
      codigo: 'MAYORIA_EDAD_REQUERIDA',
      status: 403,
    },
    {
      caso: 'cuenta suspendida con cinco estrellas',
      sesion: { ...ciudadano, estado: 'suspendido' },
      codigo: 'CUENTA_NO_HABILITADA',
      status: 403,
    },
    {
      caso: 'cuenta activa con cero estrellas',
      sesion: { ...ciudadano, estrellas: 0 },
      codigo: 'CUENTA_NO_HABILITADA',
      status: 403,
    },
  ])('bloquea operaciones para $caso', ({ sesion, codigo, status }) => {
    expect(service.getPermissions(sesion)).toEqual({
      puede_participar: false,
      puede_proponer: false,
      puede_administrar: false,
    });
    for (const verificar of [
      () => service.assertActive(sesion),
      () => service.assertCanPropose(sesion),
      () => service.assertAdmin(sesion),
    ]) {
      expect(verificar).toThrow(
        expect.objectContaining({
          status,
          response: expect.objectContaining({ codigo }),
        }),
      );
    }
  });

  it.each([-0.5, 5.5, NaN, Infinity])(
    'bloquea una reputación inválida %s',
    (estrellas) => {
      expect(service.canParticipate({ ...ciudadano, estrellas })).toBe(false);
      expect(service.canPropose({ ...ciudadano, estrellas })).toBe(false);
    },
  );

  it('rechaza proponer exactamente con 2,5 estrellas y explica el motivo', () => {
    expect(() =>
      service.assertCanPropose({ ...ciudadano, estrellas: 2.5 }),
    ).toThrow(
      expect.objectContaining({
        status: 403,
        response: {
          codigo: 'ESTRELLAS_INSUFICIENTES',
          mensaje:
            'Necesitas más de 2,5 estrellas para presentar una propuesta.',
        },
      }),
    );
  });

  it('un ciudadano reactivado con una estrella puede participar', () => {
    expect(
      service.getPermissions({ ...ciudadano, estrellas: 1 }),
    ).toMatchObject({
      puede_participar: true,
      puede_proponer: false,
    });
  });

  it('reconoce al administrador entre varios roles', () => {
    const sesion: SesionActual = {
      ...ciudadano,
      roles: ['ciudadano', 'administrador'],
      estrellas: 1,
    };
    expect(service.getPermissions(sesion)).toEqual({
      puede_participar: true,
      puede_proponer: false,
      puede_administrar: true,
    });
    expect(() => service.assertAdmin(sesion)).not.toThrow();
    expect(() => service.assertCanPropose(sesion)).toThrow(HttpException);
  });

  it.each<{ roles: SesionActual['roles'] }>([
    { roles: ['ciudadano'] },
    { roles: ['organizador'] },
    { roles: [] },
  ])('deniega administración a los roles $roles', ({ roles }) => {
    expect(() => service.assertAdmin({ ...ciudadano, roles })).toThrow(
      expect.objectContaining({
        status: 403,
        response: {
          codigo: 'ROL_ADMINISTRADOR_REQUERIDO',
          mensaje: 'Esta operación requiere el rol de administrador.',
        },
      }),
    );
  });

  it('bloquea también al administrador suspendido', () => {
    const sesion: SesionActual = {
      ...ciudadano,
      roles: ['administrador'],
      estado: 'suspendido',
    };
    expect(service.getPermissions(sesion).puede_administrar).toBe(false);
    expect(() => service.assertAdmin(sesion)).toThrow(HttpException);
  });
});
