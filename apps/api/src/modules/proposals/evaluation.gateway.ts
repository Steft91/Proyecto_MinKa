import { Injectable } from '@nestjs/common';
import type { PropuestaEvaluable } from '@minka/contracts';

/** A puede sustituir este proveedor por una llamada a su servicio del monorepo. */
@Injectable()
export class EvaluationGateway {
  isConfigured(): boolean {
    return Boolean(
      process.env.MINKA_EVALUATION_URL && process.env.MINKA_EVALUATION_TOKEN,
    );
  }

  async submit(payload: PropuestaEvaluable, clave: string): Promise<void> {
    if (!this.isConfigured()) throw new Error('Evaluación sin configurar');
    const response = await fetch(process.env.MINKA_EVALUATION_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MINKA_EVALUATION_TOKEN}`,
        'Idempotency-Key': clave,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    });
    if (!response.ok)
      throw new Error('El servicio de evaluación rechazó la entrega');
    const ack: unknown = await response.json();
    if (
      !ack ||
      typeof ack !== 'object' ||
      !('aceptada' in ack) ||
      ack.aceptada !== true ||
      !('id_propuesta' in ack) ||
      ack.id_propuesta !== payload.id_propuesta ||
      !('version_propuesta' in ack) ||
      ack.version_propuesta !== payload.version_actual
    ) {
      throw new Error('Acuse de evaluación inválido');
    }
  }
}
