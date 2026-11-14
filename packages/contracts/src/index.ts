/** Contratos compartidos entre web, API y futuros microservicios. */
export interface UsuarioResumen {
  id: string;
  email: string;
  emailVerificado: boolean;
  nombre: string;
  activo: boolean;
  edad?: number;
  reputacion: number;
}

export interface ResultadoEvaluacion {
  decision: 'apta' | 'revision' | 'no_apta';
  justificacion: string;
  confianza: number;
}
