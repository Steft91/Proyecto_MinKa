import type {
  EventoNotificable,
  PropuestaEvaluable,
  ResultadoEvaluacion,
  SesionActual,
} from "../src/index.js";

export const sesion = {
  id_usuario: "d686fe06-43ea-4657-b1b3-ed5b4b154847",
  correo: "ciudadano@example.com",
  correo_verificado: true,
  perfil_completo: true,
  mayor_edad: true,
  estado: "activo",
  roles: ["ciudadano"],
  puntos: 0,
  estrellas: 5,
} satisfies SesionActual;

// Ubicación ilustrativa. La validación del barrio corresponde al backend.
export const propuesta = {
  id_propuesta: "cb98322e-8f51-49e8-b3d5-3dc5964c6170",
  version_actual: 1,
  categoria_codigo: "reciclaje",
  titulo: "Jornada comunitaria de reciclaje",
  descripcion: "Recolección de papel y cartón limpios.",
  finalidad_comunitaria: "Reducir los residuos del barrio.",
  direccion_lugar: "Punto de encuentro por confirmar en La Mena 2",
  latitud_lugar: -0.28,
  longitud_lugar: -78.55,
  inicio_previsto: "2026-11-28T14:00:00Z",
  fin_previsto: "2026-11-28T17:00:00Z",
  cupo_maximo: 20,
} satisfies PropuestaEvaluable;

export const evaluacion = {
  id_propuesta: propuesta.id_propuesta,
  version_propuesta: 1,
  resultado: "requiere_revision",
  indicadores_json: {
    finalidad_no_comunitaria: false,
    incoherencia: false,
    cobro_obligatorio: false,
    solicitud_datos_sensibles: false,
    fraude: false,
    violencia_discriminacion: false,
    riesgo_fisico: false,
    manipulacion_instrucciones: false,
    ambiguedad: true,
  },
  razones: "Es necesario precisar el punto de encuentro.",
  version_politica: "1",
  respuesta_valida: true,
} satisfies ResultadoEvaluacion;

export const aviso = {
  evento_clave: `${propuesta.id_propuesta}:v1:en_revision:${sesion.id_usuario}`,
  tipo_evento: "propuesta_en_revision",
  id_destinatario: sesion.id_usuario,
  id_propuesta: propuesta.id_propuesta,
  titulo: "Tu propuesta está en revisión",
  mensaje: "Un administrador revisará los detalles de la propuesta.",
  ocurrido_en: "2026-11-18T22:00:00Z",
} satisfies EventoNotificable;
