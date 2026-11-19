import {
  Body,
  ConflictException,
  Controller,
  Get,
  INestApplication,
  Logger,
  Post,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsInt, IsString, Min, MinLength } from 'class-validator';
import request from 'supertest';
import { configureApp } from '../src/configure-app.js';

class SampleDto {
  @IsString()
  @MinLength(3)
  titulo!: string;

  @IsInt()
  @Min(1)
  cupo!: number;
}

// Este controlador solo se registra en las pruebas.
@Controller('validation-test')
class ValidationTestController {
  @Post()
  create(@Body() dto: SampleDto) {
    return {
      titulo: dto.titulo,
      cupo: dto.cupo,
      esDto: dto instanceof SampleDto,
    };
  }

  @Get('conflict')
  conflict(): never {
    throw new ConflictException({
      codigo: 'CUPOS_AGOTADOS',
      mensaje: 'No hay cupos disponibles',
    });
  }

  @Get('unexpected')
  unexpected(): never {
    throw new Error('Detalle interno de prueba');
  }
}

describe('Configuración global de la API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ValidationTestController],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('acepta datos válidos y los transforma a una instancia del DTO', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/validation-test')
      .send({ titulo: 'Reciclaje', cupo: 5 })
      .expect(201)
      .expect({ titulo: 'Reciclaje', cupo: 5, esDto: true });
  });

  it.each([
    {},
    { titulo: 'ab', cupo: 5 },
    { titulo: 'Reciclaje', cupo: 0 },
    { titulo: 'Reciclaje', cupo: '5' },
    { titulo: 'Reciclaje', cupo: 5, aprobado: true },
  ])('rechaza el cuerpo inválido %j', async (body) => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/validation-test')
      .send(body)
      .expect(400);

    expect(response.body).toEqual({
      codigo: 'DATOS_INVALIDOS',
      mensaje: 'Los datos enviados no son válidos.',
      errores: expect.arrayContaining([expect.any(String)]),
    });
  });

  it('conserva el código y mensaje de un error de negocio', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/validation-test/conflict')
      .expect(409)
      .expect({
        codigo: 'CUPOS_AGOTADOS',
        mensaje: 'No hay cupos disponibles',
      });
  });

  it('responde con un error genérico ante una excepción inesperada', async () => {
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    try {
      await request(app.getHttpServer())
        .get('/api/v1/validation-test/unexpected')
        .expect(500)
        .expect({
          codigo: 'ERROR_INTERNO',
          mensaje: 'Ocurrió un error interno.',
        });
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
