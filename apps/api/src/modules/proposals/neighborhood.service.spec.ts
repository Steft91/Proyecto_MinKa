import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NeighborhoodService } from './neighborhood.service.js';

describe('Validación geográfica con geometrías sintéticas', () => {
  const dir = mkdtempSync(join(tmpdir(), 'minka-geo-'));
  const file = join(dir, 'test-only.geojson');
  const service = new NeighborhoodService();
  const exterior = [
    [-78.56, -0.29],
    [-78.54, -0.29],
    [-78.54, -0.27],
    [-78.56, -0.27],
    [-78.56, -0.29],
  ];

  beforeEach(() => {
    vi.stubEnv('MINKA_NEIGHBORHOOD_GEOJSON', file);
    writeFileSync(
      file,
      JSON.stringify({ type: 'Polygon', coordinates: [exterior] }),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  afterAll(() => {
    unlinkSync(file);
    rmdirSync(dir);
  });

  it('acepta interior y borde, y rechaza el exterior', () => {
    expect(() => service.assertWithin(-0.28, -78.55)).not.toThrow();
    expect(() => service.assertWithin(-0.29, -78.55)).not.toThrow();
    expect(() => service.assertWithin(-0.5, -78.55)).toThrow(
      expect.objectContaining({ status: 422 }),
    );
  });

  it('respeta los huecos del polígono', () => {
    const hueco = [
      [-78.555, -0.285],
      [-78.545, -0.285],
      [-78.545, -0.275],
      [-78.555, -0.275],
      [-78.555, -0.285],
    ];
    writeFileSync(
      file,
      JSON.stringify({ type: 'Polygon', coordinates: [exterior, hueco] }),
    );
    expect(() => service.assertWithin(-0.28, -78.55)).toThrow(
      expect.objectContaining({ status: 422 }),
    );
  });

  it('admite Feature y MultiPolygon', () => {
    writeFileSync(
      file,
      JSON.stringify({
        type: 'Feature',
        properties: {},
        geometry: { type: 'MultiPolygon', coordinates: [[exterior]] },
      }),
    );
    expect(() => service.assertWithin(-0.28, -78.55)).not.toThrow();
  });

  it.each(['{}', 'no es JSON', '{"type":"Polygon","coordinates":[]}'])(
    'rechaza configuración inválida %s',
    (raw) => {
      writeFileSync(file, raw);
      expect(() => service.assertWithin(-0.28, -78.55)).toThrow(
        expect.objectContaining({ status: 503 }),
      );
    },
  );
});
