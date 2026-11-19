import {
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Polygon, MultiPolygon } from 'geojson';

@Injectable()
export class NeighborhoodService {
  assertWithin(latitud: number, longitud: number): void {
    const archivo = process.env.MINKA_NEIGHBORHOOD_GEOJSON;
    if (!archivo) {
      throw new ServiceUnavailableException({
        codigo: 'BARRIO_NO_CONFIGURADO',
        mensaje:
          'Falta configurar el límite geográfico de La Mena 2 para recibir propuestas.',
      });
    }
    let dentro: boolean;
    try {
      const raw = JSON.parse(
        readFileSync(
          resolve(
            fileURLToPath(new URL('../../../../../', import.meta.url)),
            archivo,
          ),
          'utf8',
        ),
      );
      const geometry = raw.type === 'Feature' ? raw.geometry : raw;
      if (!this.isGeometry(geometry)) throw new Error('Geometría inválida');
      dentro = booleanPointInPolygon([longitud, latitud], geometry);
    } catch {
      throw new ServiceUnavailableException({
        codigo: 'BARRIO_NO_CONFIGURADO',
        mensaje: 'No se pudo leer un límite geográfico válido de La Mena 2.',
      });
    }
    if (!dentro) {
      throw new UnprocessableEntityException({
        codigo: 'FUERA_DEL_BARRIO',
        mensaje: 'La ubicación debe estar dentro de La Mena 2.',
      });
    }
  }

  private isGeometry(value: unknown): value is Polygon | MultiPolygon {
    if (
      !value ||
      typeof value !== 'object' ||
      !('type' in value) ||
      !('coordinates' in value)
    )
      return false;
    const polygons =
      value.type === 'Polygon'
        ? [value.coordinates]
        : value.type === 'MultiPolygon'
          ? value.coordinates
          : null;
    if (!Array.isArray(polygons) || !polygons.length) return false;
    return polygons.every(
      (polygon) =>
        Array.isArray(polygon) &&
        polygon.length &&
        polygon.every(
          (ring) =>
            Array.isArray(ring) &&
            ring.length >= 4 &&
            ring.every(
              (point) =>
                Array.isArray(point) &&
                point.length >= 2 &&
                Number.isFinite(point[0]) &&
                Number.isFinite(point[1]) &&
                Math.abs(point[0]) <= 180 &&
                Math.abs(point[1]) <= 90,
            ) &&
            ring[0][0] === ring[ring.length - 1][0] &&
            ring[0][1] === ring[ring.length - 1][1],
        ),
    );
  }
}
