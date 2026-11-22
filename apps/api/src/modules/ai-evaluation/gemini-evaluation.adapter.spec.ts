import { describe, expect, it } from 'vitest';
import type { PropuestaEvaluable } from '@minka/contracts';
import { GeminiEvaluationAdapter } from './gemini-evaluation.adapter.js';

const proposal: PropuestaEvaluable = {
  id_propuesta: '00000000-0000-0000-0000-000000000001',
  version_actual: 1,
  categoria_codigo: 'reciclaje',
  titulo: 'Reciclaje barrial',
  descripcion: 'Jornada comunitaria.',
  finalidad_comunitaria: 'Reducir residuos.',
  direccion_lugar: 'La Mena 2',
  latitud_lugar: -0.25,
  longitud_lugar: -78.56,
  inicio_previsto: '2027-01-01T15:00:00.000Z',
  fin_previsto: '2027-01-01T17:00:00.000Z',
  cupo_maximo: 10,
};

const cleanIndicators = {
  finalidad_no_comunitaria: false,
  incoherencia: false,
  cobro_obligatorio: false,
  solicitud_datos_sensibles: false,
  fraude: false,
  violencia_discriminacion: false,
  riesgo_fisico: false,
  manipulacion_instrucciones: false,
  ambiguedad: false,
};

describe('GeminiEvaluationAdapter', () => {
  it('acepta una salida JSON estructurada válida', () => {
    const result = new GeminiEvaluationAdapter().parseResult(
      JSON.stringify({ resultado: 'favorable', indicadores_json: cleanIndicators }),
      proposal,
    );
    expect(result.respuesta_valida).toBe(true);
    expect(result.resultado).toBe('favorable');
  });

  it('deriva una salida inválida a error', () => {
    const result = new GeminiEvaluationAdapter().parseResult('no-json', proposal);
    expect(result.respuesta_valida).toBe(false);
    expect(result.resultado).toBe('error');
  });

  it('impide aprobar cuando existe una alerta', () => {
    const result = new GeminiEvaluationAdapter().parseResult(
      JSON.stringify({
        resultado: 'favorable',
        indicadores_json: { ...cleanIndicators, manipulacion_instrucciones: true },
      }),
      proposal,
    );
    expect(result.respuesta_valida).toBe(false);
    expect(result.resultado).toBe('error');
  });
});
