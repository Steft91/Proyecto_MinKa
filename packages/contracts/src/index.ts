/** Contratos provisionales basados en el diccionario de datos de Minka. */
export type EstadoUsuario = "activo" | "suspendido";
export type NombreRol = "ciudadano" | "organizador" | "administrador";
export type CategoriaCodigo =
  "limpieza" | "recuperacion_espacios" | "reciclaje" | "convivencia";

/** Datos calculados por identidad para una cuenta registrada. */
export interface SesionActual {
  id_usuario: string;
  correo: string;
  correo_verificado: boolean;
  perfil_completo: boolean;
  mayor_edad: boolean;
  estado: EstadoUsuario;
  roles: NombreRol[];
  puntos: number;
  estrellas: number;
}

/** @deprecated Usar SesionActual en las nuevas funcionalidades. */
export interface UsuarioResumen {
  id: string;
  email: string;
  emailVerificado: boolean;
  nombre: string;
  activo: boolean;
  edad?: number;
  reputacion: number;
}

/** Copia de la versión enviada a IA. Fechas ISO 8601 en UTC. */
export interface PropuestaEvaluable {
  id_propuesta: string;
  version_actual: number;
  categoria_codigo: CategoriaCodigo;
  titulo: string;
  descripcion: string;
  finalidad_comunitaria: string;
  direccion_lugar: string;
  latitud_lugar: number;
  longitud_lugar: number;
  inicio_previsto: string;
  fin_previsto: string;
  cupo_maximo: number;
}

/** true indica una alerta detectada. Su ausencia no confirma una evaluación válida. */
export interface IndicadoresEvaluacion {
  finalidad_no_comunitaria: boolean;
  incoherencia: boolean;
  cobro_obligatorio: boolean;
  solicitud_datos_sensibles: boolean;
  fraude: boolean;
  violencia_discriminacion: boolean;
  riesgo_fisico: boolean;
  manipulacion_instrucciones: boolean;
  ambiguedad: boolean;
}

/** Resultado interno del adaptador, incluso ante fallo del proveedor. */
export interface ResultadoEvaluacion {
  id_propuesta: string;
  version_propuesta: number;
  resultado: "favorable" | "requiere_revision" | "error";
  indicadores_json: IndicadoresEvaluacion;
  razones: string | null;
  version_politica: string;
  respuesta_valida: boolean;
}

/** Un evento para un destinatario. La clave es única por evento y destinatario. */
export interface EventoNotificable {
  evento_clave: string;
  tipo_evento: string;
  id_destinatario: string;
  id_actividad?: string;
  id_propuesta?: string;
  id_inscripcion?: string;
  titulo: string;
  mensaje: string;
  ocurrido_en: string;
}

export interface CategoriaPublica {
  id_categoria: string;
  codigo: CategoriaCodigo;
  nombre: string;
}

/** Copia aprobada que se almacena en actividad.contenido_aprobado_json. */
export type ContenidoActividadPublicada = Omit<
  PropuestaEvaluable,
  "id_propuesta" | "version_actual"
>;

export interface ActividadPublica extends ContenidoActividadPublicada {
  id_actividad: string;
  id_propuesta: string;
  id_organizador_actual: string;
  version_publicada: number;
  estado: "publicada";
  cupos_disponibles: number;
}

export interface FiltrosCatalogo {
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  location?: string;
}

export type EstadoPropuesta =
  | "pendiente_evaluacion"
  | "en_revision"
  | "aprobada"
  | "rechazada"
  | "retirada";
export type CrearPropuesta = ContenidoActividadPublicada;

export interface PropuestaPropia extends PropuestaEvaluable {
  id_proponente: string;
  estado: EstadoPropuesta;
  creada_en: string;
}

/** Acuse del servicio de A. La aceptación del envío no equivale a aprobación. */
export interface EvaluacionAceptada {
  id_propuesta: string;
  version_propuesta: number;
  aceptada: true;
}

export interface ElegibilidadPropuesta {
  puede_proponer: boolean;
  motivo: string | null;
}

export interface PropuestaRevision extends PropuestaPropia {
  evaluacion: {
    id_evaluacion: string;
    resultado: ResultadoEvaluacion["resultado"];
    razones: string | null;
    respuesta_valida: boolean;
    version_propuesta: number;
    version_politica: string;
    indicadores_json: unknown;
  } | null;
  motivo_derivacion: string | null;
}

export interface DecisionPropuesta {
  decision: "aprobar" | "rechazar";
  motivo: string;
  version_propuesta: number;
}

export interface RevisionResuelta {
  id_revision: string;
  id_propuesta: string;
  estado: "aprobada" | "rechazada";
  id_actividad: string | null;
}
