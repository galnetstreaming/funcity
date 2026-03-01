// ============================================================
//  Fun City — Bookly Sync API Service
// ============================================================

export const API_BASE_URL = 'https://testsite.funcity.com.ar/wp-json/bookly-sync/v1';
export const API_KEY      = 'fcBk2025!x9kM7pQ2vR8tW3zY5uN1jL4hG6eD9aS0rT';

// ─── Horarios por tipo de día ────────────────────────────────
export const HORARIOS_DISPONIBLES = {
  semana:      ['12:30', '14:20', '16:10'],
  finDeSemana: ['10:30', '12:20', '14:10', '16:00'],
};

export const PRECIO_SEMANA       = '$25.000';
export const PRECIO_FIN_SEMANA   = '$28.000';

// ─── Helpers ─────────────────────────────────────────────────
export const esFinDeSemana = (fechaStr) => {
  const d = new Date(fechaStr + 'T00:00:00');
  return d.getDay() === 0 || d.getDay() === 6;
};

export const obtenerHorariosParaFecha = (fecha) =>
  esFinDeSemana(fecha) ? HORARIOS_DISPONIBLES.finDeSemana : HORARIOS_DISPONIBLES.semana;

export const obtenerHorariosDisponibles = (fecha) => {
  const fin = esFinDeSemana(fecha);
  return {
    horarios:    fin ? HORARIOS_DISPONIBLES.finDeSemana : HORARIOS_DISPONIBLES.semana,
    esFinDeSemana: fin,
    tipoDia:     fin ? 'fin_de_semana' : 'semana',
    precio:      fin ? PRECIO_FIN_SEMANA : PRECIO_SEMANA,
    duracion:    '1h 50min',
  };
};

// ─── Validación de formulario ─────────────────────────────────
export const validarDatosReserva = (datos) => {
  const errores = [];
  if (!datos.nombre_ninio || datos.nombre_ninio.trim().length < 2)
    errores.push('El nombre del festejado/a es requerido (mín. 2 caracteres)');
  if (!datos.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha))
    errores.push('Fecha inválida. Use formato YYYY-MM-DD');
  if (!datos.hora_inicio || !/^\d{2}:\d{2}$/.test(datos.hora_inicio))
    errores.push('Hora inválida. Use formato HH:MM');
  if (!datos.personas || datos.personas < 1 || datos.personas > 40)
    errores.push('Cantidad de personas debe estar entre 1 y 40');
  if (datos.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email))
    errores.push('Email inválido');
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  if (datos.fecha && new Date(datos.fecha) < hoy)
    errores.push('No se pueden hacer reservas para fechas pasadas');
  const max = new Date(); max.setMonth(max.getMonth() + 6);
  if (datos.fecha && new Date(datos.fecha) > max)
    errores.push('No se pueden hacer reservas con más de 6 meses de anticipación');
  return { valido: errores.length === 0, errores };
};

export const validarHorarioSegunDia = (fecha, hora) => {
  const permitidos = obtenerHorariosParaFecha(fecha);
  const valido = permitidos.includes(hora);
  return {
    valido,
    horariosPermitidos: permitidos,
    esFinDeSemana: esFinDeSemana(fecha),
    mensaje: valido ? 'Horario válido'
      : `Horario no permitido. Para ${esFinDeSemana(fecha) ? 'fin de semana' : 'día de semana'}: ${permitidos.join(', ')}`,
  };
};

// ============================================================
//  DISPONIBILIDAD
// ============================================================

export const consultarDisponibilidadReal = async (datosConsulta) => {
  try {
    const res = await fetch(`${API_BASE_URL}/bloquear-pase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: API_KEY,
        fecha: datosConsulta.fecha,
        hora_inicio: datosConsulta.hora_inicio,
        personas: parseInt(datosConsulta.personas),
        modo: 'consultar',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.code === 'horario_no_valido')
        return { disponible: false, ocupado: true, error: data.message || 'Horario no válido', capacidadRestante: 0, esErrorHorario: true };
      if (data.code === 'slot_ocupado')
        return { disponible: false, ocupado: true, error: data.message || 'Slot ocupado', capacidadRestante: data.capacidad_restante || 0, esSlotOcupado: true };
      return { disponible: false, ocupado: data.disponible === false, error: data.message || `Error ${res.status}`, capacidadRestante: data.capacidad_restante || 0 };
    }
    return {
      disponible: data.disponible !== false,
      ocupado: data.disponible === false,
      capacidadRestante: data.capacidad_restante || 0,
      capacidadTotal: data.capacidad_total,
      serviceId: data.service_id,
      staffId: data.staff_id,
      mensaje: data.mensaje,
      data,
    };
  } catch (err) {
    return { disponible: false, ocupado: false, error: `Error de conexión: ${err.message}`, capacidadRestante: 0 };
  }
};

export const consultarDisponibilidad = async (fecha, horaInicio, personas) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha))
    return { disponible: false, ocupado: true, error: 'Formato de fecha inválido', capacidadRestante: 0 };
  if (!/^\d{2}:\d{2}$/.test(horaInicio))
    return { disponible: false, ocupado: true, error: 'Formato de hora inválido', capacidadRestante: 0 };
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  if (new Date(fecha) < hoy)
    return { disponible: false, ocupado: true, error: 'Fecha en el pasado', capacidadRestante: 0 };
  return consultarDisponibilidadReal({ fecha, hora_inicio: horaInicio, personas });
};

export const consultarDisponibilidadDia = async (fecha, horarios, personas) => {
  const resultados = [];
  const batchSize = 3;
  for (let i = 0; i < horarios.length; i += batchSize) {
    const batch = horarios.slice(i, i + batchSize);
    const res = await Promise.all(
      batch.map(hora =>
        consultarDisponibilidad(fecha, hora, personas)
          .then(r => ({ hora, disponible: r.disponible, ocupado: r.ocupado, capacidadRestante: r.capacidadRestante, error: r.error, esErrorHorario: r.esErrorHorario }))
          .catch(err => ({ hora, disponible: false, ocupado: true, error: err.message, esErrorHorario: false }))
      )
    );
    resultados.push(...res);
    if (i + batchSize < horarios.length) await new Promise(r => setTimeout(r, 200));
  }
  return resultados;
};

export const consultarDisponibilidadRango = async (consultas, onProgreso) => {
  const resultadosPorFecha = {};
  let actual = 0;
  if (onProgreso) onProgreso(0, consultas.length, 'Iniciando...');

  for (const { fecha, horarios } of consultas) {
    try {
      const horariosRes = await Promise.all(
        horarios.map(async hora => {
          try {
            const r = await consultarDisponibilidad(fecha, hora, 1);
            return { hora, disponible: r.disponible, ocupado: r.ocupado, error: r.error, capacidadRestante: r.capacidadRestante, esErrorHorario: r.esErrorHorario || false };
          } catch (err) {
            return { hora, disponible: null, ocupado: true, error: err.message, esErrorHorario: false };
          }
        })
      );
      const disp      = horariosRes.filter(h => h.disponible === true).length;
      const ocup      = horariosRes.filter(h => h.disponible === false && !h.esErrorHorario).length;
      const errHor    = horariosRes.filter(h => h.esErrorHorario).length;
      const errCon    = horariosRes.filter(h => h.disponible === null).length;
      resultadosPorFecha[fecha] = {
        fecha,
        horarios: horariosRes,
        resumen: { total: horariosRes.length, disponibles: disp, ocupados: ocup, erroresHorario: errHor, errores: errCon },
      };
    } catch (err) {
      resultadosPorFecha[fecha] = {
        fecha,
        horarios: horarios.map(hora => ({ hora, disponible: null, ocupado: true, error: err.message })),
        resumen: { total: horarios.length, disponibles: 0, ocupados: 0, erroresHorario: 0, errores: horarios.length },
      };
    }
    actual++;
    if (onProgreso) onProgreso(actual, consultas.length, `${Math.round((actual / consultas.length) * 100)}%`);
    await new Promise(r => setTimeout(r, 300));
  }
  if (onProgreso) onProgreso(consultas.length, consultas.length, 'Completado');
  return Object.values(resultadosPorFecha);
};

// ============================================================
//  RESERVAS — CREAR
// ============================================================

export const crearReserva = async (datosReserva) => {
  const validacion = validarDatosReserva(datosReserva);
  if (!validacion.valido) throw new Error(validacion.errores.join(', '));

  const valHorario = validarHorarioSegunDia(datosReserva.fecha, datosReserva.hora_inicio);
  if (!valHorario.valido) throw new Error(valHorario.mensaje);

  // Construir nota incluyendo contacto del cliente
  const parteContacto = [datosReserva.nombre_cliente, datosReserva.apellido_cliente]
    .filter(Boolean).join(' ');
  const notaFinal = [
    parteContacto ? `Contacto: ${parteContacto}` : '',
    datosReserva.notas?.trim() || '',
  ].filter(Boolean).join(' | ') || undefined;

  const payload = {
    api_key:      API_KEY,
    fecha:        datosReserva.fecha,
    hora_inicio:  datosReserva.hora_inicio,
    personas:     parseInt(datosReserva.personas),
    modo:         'crear',
    nombre_ninio: datosReserva.nombre_ninio || 'Sin nombre',
    tema:         datosReserva.tema || 'Sin tema',
    email:        datosReserva.email || 'consulta@funcity.com.ar',
    ...(datosReserva.telefono && { telefono: datosReserva.telefono }),
    ...(notaFinal              && { notas: notaFinal }),
  };

  const res = await fetch(`${API_BASE_URL}/bloquear-pase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    let msg = data.message || 'Error al crear la reserva';
    if (data.code === 'slot_ocupado')       msg = 'Este horario ya está reservado. Elegí otro.';
    if (data.code === 'horario_no_valido')  msg = 'Horario no válido para este día. ' + (data.message || '');
    if (data.code === 'capacidad_excedida') msg = `Capacidad excedida. Máximo ${data.capacidad_total || 40} personas.`;
    throw new Error(msg);
  }
  return {
    ...data,
    // Datos del form enriquecidos para guardar localmente
    nombre_ninio:     datosReserva.nombre_ninio,
    fecha:            datosReserva.fecha,
    hora_inicio:      datosReserva.hora_inicio,
    personas:         parseInt(datosReserva.personas),
    email:            datosReserva.email || 'bloqueo@funcity.com.ar',
    telefono:         datosReserva.telefono || '',
    tema:             datosReserva.tema || '',
    notas:            datosReserva.notas || '',
    // Contacto del cliente (no va a la API de Bookly, se guarda localmente)
    nombre_cliente:   datosReserva.nombre_cliente   || '',
    apellido_cliente: datosReserva.apellido_cliente || '',
  };
};

// ============================================================
//  RESERVAS — ELIMINAR
// ============================================================

export const eliminarBloqueo = async (bloqueoId) => {
  const res = await fetch(`${API_BASE_URL}/eliminar-bloqueo`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: API_KEY, bloqueo_id: bloqueoId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Error ${res.status} al eliminar`);
  return data;
};

// ============================================================
//  RESERVAS — OBTENER (lista de cumpleaños/bloqueos)
// ============================================================

// ─── Caché en memoria (se vacía al recargar la página) ───────
const _memoriaCache = {};

export const obtenerCumpleanosRegistrados = async (fechaInicio, fechaFin) => {
  const cacheKey = `cumpleanos_${fechaInicio}_${fechaFin}`;
  // Caché en memoria: 5 minutos
  if (_memoriaCache[cacheKey]) {
    const c = _memoriaCache[cacheKey];
    if (Date.now() - c.timestamp < 5 * 60 * 1000) return c.data;
  }
  const params = new URLSearchParams({ api_key: API_KEY, fecha_inicio: fechaInicio, fecha_fin: fechaFin });
  const res = await fetch(`${API_BASE_URL}/obtener-cumpleanos?${params}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
  _memoriaCache[cacheKey] = { timestamp: Date.now(), data };
  return data;
};

// ============================================================
//  NORMALIZAR — convierte cualquier formato de la API a objeto
//  uniforme que usan ListaReservas / HistorialReservas
// ============================================================

export const normalizeReserva = (raw) => {
  // Fecha: puede venir como "2026-02-27", "2026-02-27 10:30:00", etc.
  const fechaRaw = raw.fecha || raw.start_date || raw.date || raw.start || '';
  const fecha    = fechaRaw ? fechaRaw.split(' ')[0] : '';

  // Hora: puede venir como "10:30:00" o "10:30"
  const horaRaw    = raw.hora || raw.hora_inicio || raw.time || raw.start_time || '';
  const hora_inicio = horaRaw ? horaRaw.slice(0, 5) : '';   // "10:30"

  return {
    bloqueo_id:       raw.bloqueo_id       || raw.id            || null,
    nombre_ninio:     raw.nombre_ninio     || raw.nombre        || raw.customer_name || 'Sin nombre',
    fecha,
    hora_inicio,
    personas:         parseInt(raw.personas || raw.number_of_persons || raw.capacity || 1),
    email:            raw.email            || raw.customer_email || '',
    telefono:         raw.telefono         || raw.phone         || raw.customer_phone || '',
    tema:             raw.tema             || raw.notes_tema     || '',
    notas:            raw.notas            || raw.notes          || '',
    // Contacto del cliente (campos propios del sistema, no de Bookly)
    nombre_cliente:   raw.nombre_cliente   || '',
    apellido_cliente: raw.apellido_cliente || '',
    // Campos originales por si se necesitan
    _raw: raw,
  };
};

// ============================================================
//  OBTENER TODAS LAS RESERVAS DESDE LA API (rango de fechas)
// ============================================================

export const obtenerTodasLasReservas = async ({
  fechaInicio,
  fechaFin,
  usarCache = true,
} = {}) => {
  // Rango por defecto: 3 meses atrás → 6 meses adelante
  const hoy  = new Date();
  const ini  = fechaInicio || (() => {
    const d = new Date(hoy); d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  })();
  const fin  = fechaFin || (() => {
    const d = new Date(hoy); d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  })();

  const cacheKey = `reservas_${ini}_${fin}`;

  // ── Caché en memoria (1 min) ──
  if (usarCache && _memoriaCache[cacheKey]) {
    const c = _memoriaCache[cacheKey];
    if (Date.now() - c.timestamp < 60 * 1000) {
      return { reservas: c.reservas, fromCache: true, fechaInicio: ini, fechaFin: fin };
    }
  }

  // ── Llamada a la API ──
  const params = new URLSearchParams({
    api_key:      API_KEY,
    fecha_inicio: ini,
    fecha_fin:    fin,
  });

  const res  = await fetch(`${API_BASE_URL}/obtener-cumpleanos?${params}`, {
    method:  'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Error ${res.status} al obtener reservas`);

  // ── Normalizar array (varios formatos posibles) ──
  let arr = [];
  if (Array.isArray(data))              arr = data;
  else if (Array.isArray(data.cumpleanos)) arr = data.cumpleanos;
  else if (Array.isArray(data.data))    arr = data.data;
  else if (Array.isArray(data.reservas)) arr = data.reservas;

  const reservas = arr.map(normalizeReserva).filter(r => r.fecha);

  // ── Guardar en caché en memoria ──
  _memoriaCache[cacheKey] = { timestamp: Date.now(), reservas };

  return { reservas, fromCache: false, fechaInicio: ini, fechaFin: fin, total: reservas.length };
};

// ============================================================
//  ESTADO DE LA API (diagnóstico)
// ============================================================

export const verificarEstadoAPI = async () => {
  const endpoints = [
    { nombre: 'bloquear-pase',           metodo: 'POST'   },
    { nombre: 'obtener-cumpleanos',      metodo: 'GET'    },
    { nombre: 'verificar-disponibilidad',metodo: 'GET'    },
    { nombre: 'eliminar-bloqueo',        metodo: 'DELETE' },
  ];
  const resultados = await Promise.all(endpoints.map(async (ep) => {
    try {
      const inicio = Date.now();
      const res = await fetch(`${API_BASE_URL}/${ep.nombre}`, {
        method: ep.metodo,
        headers: { 'Content-Type': 'application/json' },
        body: ep.metodo !== 'GET' ? JSON.stringify({ api_key: API_KEY }) : undefined,
      });
      return { ...ep, status: res.status, tiempo: `${Date.now() - inicio}ms`, disponible: res.status !== 404 };
    } catch (err) {
      return { ...ep, status: 0, tiempo: 'N/A', disponible: false, error: err.message };
    }
  }));
  return { endpoints: resultados, resumen: { total: resultados.length, disponibles: resultados.filter(r => r.disponible).length } };
};

// ============================================================
//  FERIADOS NACIONALES — API pública ArgentinaDatos
//  Endpoint: GET https://api.argentinadatos.com/v1/feriados/{año}
//  Sin autenticación · Respuesta: [{fecha, nombre, tipo}]
// ============================================================
const FERIADOS_API = 'https://api.argentinadatos.com/v1/feriados';

export const obtenerFeriados = async (año) => {
  const key = `feriados_${año}`;
  if (_memoriaCache[key]) return _memoriaCache[key];
  try {
    const res  = await fetch(`${FERIADOS_API}/${año}`);
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const data = await res.json();
    const mapa = {};
    (Array.isArray(data) ? data : []).forEach(f => {
      if (f.fecha) mapa[f.fecha] = { nombre: f.nombre || 'Feriado', tipo: f.tipo || 'inamovible' };
    });
    _memoriaCache[key] = mapa;
    return mapa;
  } catch (err) {
    console.warn(`No se pudieron cargar feriados ${año}:`, err.message);
    return {};
  }
};

export const obtenerFeriadosRango = async (añoInicio, añoFin) => {
  const años = [];
  for (let a = añoInicio; a <= añoFin; a++) años.push(a);
  const resultados = await Promise.all(años.map(a => obtenerFeriados(a)));
  return Object.assign({}, ...resultados);
};

// ============================================================
//  COBROS — CRUD contra la API de WordPress
//  Endpoint base: /wp-json/bookly-sync/v1/cobros
//
//  El backend almacena un registro de cobro por reserva:
//  {
//    bloqueo_id: string,
//    estado:     'sinCobro' | 'adelanto' | 'pagado' | 'cancelado',
//    total:      number,
//    pagos:      [{ id, monto, metodo, tipo, nota, creadoEn }],
//    notas:      string,
//    actualizadoEn: ISO string
//  }
//
//  Si el endpoint no está disponible (404/500) los métodos
//  devuelven null o [] sin lanzar excepción, para que el
//  componente pueda degradar graciosamente.
// ============================================================

const COBROS_ENDPOINT = `${API_BASE_URL}/cobros`;

// ── Obtener cobro de UNA reserva ──────────────────────────────
export const obtenerCobro = async (bloqueoId) => {
  try {
    const params = new URLSearchParams({ api_key: API_KEY, bloqueo_id: bloqueoId });
    const res = await fetch(`${COBROS_ENDPOINT}?${params}`);
    if (res.status === 404) return null;          // no existe aún → cobroVacio
    if (!res.ok) return null;
    const data = await res.json();
    return data?.cobro ?? data ?? null;
  } catch {
    return null;
  }
};

// ── Obtener cobros de TODAS las reservas de una sesión ────────
// Devuelve { [bloqueo_id]: cobroObj, ... }
export const obtenerTodosCobros = async (bloqueoIds = []) => {
  if (!bloqueoIds.length) return {};
  try {
    const params = new URLSearchParams({ api_key: API_KEY });
    bloqueoIds.forEach(id => params.append('ids[]', id));
    const res = await fetch(`${COBROS_ENDPOINT}/batch?${params}`);
    if (!res.ok) return {};
    const data = await res.json();
    // Normalizar: puede venir como array o como mapa
    if (Array.isArray(data)) {
      return data.reduce((acc, c) => {
        if (c.bloqueo_id) acc[String(c.bloqueo_id)] = c;
        return acc;
      }, {});
    }
    return data?.cobros ?? data ?? {};
  } catch {
    return {};
  }
};

// ── Guardar / actualizar cobro completo ───────────────────────
export const guardarCobro = async (bloqueoId, cobro) => {
  try {
    const res = await fetch(COBROS_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key:   API_KEY,
        bloqueo_id: String(bloqueoId),
        ...cobro,
        actualizadoEn: new Date().toISOString(),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.cobro ?? cobro;
  } catch {
    return null;
  }
};

// ── Eliminar cobro (por si se borra la reserva) ───────────────
export const eliminarCobro = async (bloqueoId) => {
  try {
    const res = await fetch(COBROS_ENDPOINT, {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: API_KEY, bloqueo_id: String(bloqueoId) }),
    });
    return res.ok;
  } catch {
    return false;
  }
};

export default {
  consultarDisponibilidad, consultarDisponibilidadReal, consultarDisponibilidadDia, consultarDisponibilidadRango,
  crearReserva, eliminarBloqueo, obtenerCumpleanosRegistrados,
  obtenerTodasLasReservas, normalizeReserva,
  obtenerHorariosParaFecha, obtenerHorariosDisponibles, esFinDeSemana,
  validarDatosReserva, validarHorarioSegunDia, verificarEstadoAPI,
  obtenerFeriados, obtenerFeriadosRango,
  obtenerCobro, obtenerTodosCobros, guardarCobro, eliminarCobro,
  HORARIOS_DISPONIBLES, PRECIO_SEMANA, PRECIO_FIN_SEMANA,
  API_BASE_URL, API_KEY,
};