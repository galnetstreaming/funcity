// ============================================================
//  Fun City — Bookly Sync API Service
//  v2.0: Sin localStorage — todo desde la API.
//  Feriados en semana se cobran como fin de semana.
// ============================================================

export const API_BASE_URL = 'https://testsite.funcity.com.ar/wp-json/bookly-sync/v1';
export const API_KEY      = 'fcBk2025!x9kM7pQ2vR8tW3zY5uN1jL4hG6eD9aS0rT';

// ─── Configuración por defecto (se sobreescribe desde API) ────
export const CONFIG_DEFAULT = {
  precio_semana:        25000,
  precio_fin_de_semana: 28000,
  capacidad_maxima:     40,
  anticipacion_meses:   6,
  horarios_semana:      ['12:30', '14:20', '16:10'],
  horarios_fin_semana:  ['10:30', '12:20', '14:10', '16:00'],
  admin_emails:         ['acmleonardy@gmail.com', 'mexico@funcity.com.ar', 'info@apixelmarketing.com'],
};

// ─── Caché en memoria (se vacía al recargar la página) ───────
const _cache = {};

// ============================================================
//  CONFIGURACIÓN — Leer y guardar desde la API
// ============================================================

/**
 * Obtiene la configuración desde la API.
 * Usa caché en memoria por 5 minutos.
 */
export const obtenerConfiguracion = async () => {
  if (_cache.config && Date.now() - _cache.config.ts < 5 * 60 * 1000) {
    return _cache.config.data;
  }
  try {
    const res = await fetch(
      `${API_BASE_URL}/configuracion?api_key=${encodeURIComponent(API_KEY)}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
    if (!res.ok) return { ...CONFIG_DEFAULT };
    const data = await res.json();
    const config = {
      precio_semana:        data.precio_semana        ?? CONFIG_DEFAULT.precio_semana,
      precio_fin_de_semana: data.precio_fin_de_semana ?? CONFIG_DEFAULT.precio_fin_de_semana,
      capacidad_maxima:     data.capacidad_maxima     ?? CONFIG_DEFAULT.capacidad_maxima,
      anticipacion_meses:   data.anticipacion_meses   ?? CONFIG_DEFAULT.anticipacion_meses,
      horarios_semana:      data.horarios_semana       ?? CONFIG_DEFAULT.horarios_semana,
      horarios_fin_semana:  data.horarios_fin_semana   ?? CONFIG_DEFAULT.horarios_fin_semana,
      admin_emails:         data.admin_emails          ?? CONFIG_DEFAULT.admin_emails,
    };
    _cache.config = { ts: Date.now(), data: config };
    return config;
  } catch {
    return { ...CONFIG_DEFAULT };
  }
};

/**
 * Guarda la configuración en la API e invalida el caché.
 */
export const guardarConfiguracion = async (config) => {
  delete _cache.config; // invalidar caché
  try {
    const res = await fetch(`${API_BASE_URL}/configuracion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: API_KEY, ...config }),
    });
    const data = await res.json();
    return { ok: res.ok, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

// ─── Horarios disponibles (consulta la config) ────────────────
export const HORARIOS_DISPONIBLES = {
  semana:      CONFIG_DEFAULT.horarios_semana,
  finDeSemana: CONFIG_DEFAULT.horarios_fin_semana,
};

export const PRECIO_SEMANA     = `$${CONFIG_DEFAULT.precio_semana.toLocaleString('es-AR')}`;
export const PRECIO_FIN_SEMANA = `$${CONFIG_DEFAULT.precio_fin_de_semana.toLocaleString('es-AR')}`;

// ============================================================
//  FERIADOS NACIONALES — API pública ArgentinaDatos
//  Los feriados en día de semana se cobran como fin de semana.
// ============================================================

const FERIADOS_API = 'https://api.argentinadatos.com/v1/feriados';

export const obtenerFeriados = async (año) => {
  const key = `feriados_${año}`;
  if (_cache[key]) return _cache[key];
  try {
    const res  = await fetch(`${FERIADOS_API}/${año}`);
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const data = await res.json();
    const mapa = {};
    (Array.isArray(data) ? data : []).forEach(f => {
      if (f.fecha) mapa[f.fecha] = { nombre: f.nombre || 'Feriado', tipo: f.tipo || 'inamovible' };
    });
    _cache[key] = mapa;
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

// ─── Helpers de fecha ─────────────────────────────────────────
export const esFinDeSemana = (fechaStr) => {
  const d = new Date(fechaStr + 'T00:00:00');
  return d.getDay() === 0 || d.getDay() === 6;
};

/**
 * Determina si una fecha es "precio fin de semana":
 * sábado, domingo, O feriado (aunque caiga en semana).
 */
export const esPrecioFinDeSemana = (fechaStr, feriadosMapa = {}) => {
  if (esFinDeSemana(fechaStr)) return true;
  if (feriadosMapa[fechaStr])  return true;
  return false;
};

export const obtenerHorariosParaFecha = (fechaStr, configOverride = null) => {
  const config = configOverride || CONFIG_DEFAULT;
  if (esFinDeSemana(fechaStr)) return config.horarios_fin_semana;
  return config.horarios_semana;
};

export const obtenerHorariosDisponibles = (fechaStr, feriadosMapa = {}, configOverride = null) => {
  const config = configOverride || CONFIG_DEFAULT;
  const esFDS  = esPrecioFinDeSemana(fechaStr, feriadosMapa);
  const horarios = esFDS ? config.horarios_fin_semana : config.horarios_semana;
  return {
    horarios,
    esFinDeSemana: esFDS,
    esFeriado:     !!feriadosMapa[fechaStr],
    tipoDia:       esFDS ? 'fin_de_semana' : 'semana',
    precio:        esFDS ? config.precio_fin_de_semana : config.precio_semana,
    duracion:      '1h 50min',
  };
};

// ─── Validación de formulario ─────────────────────────────────
export const validarDatosReserva = (datos, config = CONFIG_DEFAULT) => {
  const errores = [];
  if (!datos.nombre_ninio || datos.nombre_ninio.trim().length < 2)
    errores.push('El nombre del festejado/a es requerido (mín. 2 caracteres)');
  if (!datos.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha))
    errores.push('Fecha inválida. Use formato YYYY-MM-DD');
  if (!datos.hora_inicio || !/^\d{2}:\d{2}$/.test(datos.hora_inicio))
    errores.push('Hora inválida. Use formato HH:MM');
  if (!datos.personas || datos.personas < 1 || datos.personas > config.capacidad_maxima)
    errores.push(`Cantidad de personas debe estar entre 1 y ${config.capacidad_maxima}`);
  if (datos.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email))
    errores.push('Email inválido');
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  if (datos.fecha && new Date(datos.fecha) < hoy)
    errores.push('No se pueden hacer reservas para fechas pasadas');
  const max = new Date(); max.setMonth(max.getMonth() + config.anticipacion_meses);
  if (datos.fecha && new Date(datos.fecha) > max)
    errores.push(`No se pueden hacer reservas con más de ${config.anticipacion_meses} meses de anticipación`);
  return { valido: errores.length === 0, errores };
};

export const validarHorarioSegunDia = (fecha, hora, feriadosMapa = {}, config = CONFIG_DEFAULT) => {
  const permitidos = obtenerHorariosParaFecha(fecha, config);
  const valido = permitidos.includes(hora);
  return {
    valido,
    horariosPermitidos: permitidos,
    esFinDeSemana: esPrecioFinDeSemana(fecha, feriadosMapa),
    mensaje: valido ? 'Horario válido'
      : `Horario no permitido para este día. Opciones: ${permitidos.join(', ')}`,
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
        api_key:     API_KEY,
        fecha:       datosConsulta.fecha,
        hora_inicio: datosConsulta.hora_inicio,
        personas:    parseInt(datosConsulta.personas),
        modo:        'consultar',
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
      disponible:        data.disponible !== false,
      ocupado:           data.disponible === false,
      capacidadRestante: data.capacidad_restante || 0,
      capacidadTotal:    data.capacidad_total,
      serviceId:         data.service_id,
      staffId:           data.staff_id,
      mensaje:           data.mensaje,
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
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
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
      const disp   = horariosRes.filter(h => h.disponible === true).length;
      const ocup   = horariosRes.filter(h => h.disponible === false && !h.esErrorHorario).length;
      const errHor = horariosRes.filter(h => h.esErrorHorario).length;
      const errCon = horariosRes.filter(h => h.disponible === null).length;
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

export const crearReserva = async (datosReserva, feriadosMapa = {}, config = CONFIG_DEFAULT) => {
  const validacion = validarDatosReserva(datosReserva, config);
  if (!validacion.valido) throw new Error(validacion.errores.join(', '));

  const valHorario = validarHorarioSegunDia(datosReserva.fecha, datosReserva.hora_inicio, feriadosMapa, config);
  if (!valHorario.valido) throw new Error(valHorario.mensaje);

  const parteContacto = [datosReserva.nombre_cliente, datosReserva.apellido_cliente]
    .filter(Boolean).join(' ');
  const parteVendedor = datosReserva.vendedor?.trim()
    ? `Vendedor: ${datosReserva.vendedor.trim()}`
    : '';
  const notaFinal = [
    parteContacto ? `Contacto: ${parteContacto}` : '',
    parteVendedor,
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
    ...(datosReserva.telefono            && { telefono: datosReserva.telefono }),
    ...(notaFinal                        && { notas: notaFinal }),
    ...(datosReserva.vendedor?.trim()    && { vendedor: datosReserva.vendedor.trim() }),
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
    if (data.code === 'capacidad_excedida') msg = `Capacidad excedida. Máximo ${data.capacidad_total || config.capacidad_maxima} personas.`;
    throw new Error(msg);
  }

  // Calcular precio correcto según feriado
  const esFDS = esPrecioFinDeSemana(datosReserva.fecha, feriadosMapa);

  return {
    ...data,
    nombre_ninio:     datosReserva.nombre_ninio,
    fecha:            datosReserva.fecha,
    hora_inicio:      datosReserva.hora_inicio,
    personas:         parseInt(datosReserva.personas),
    email:            datosReserva.email || 'bloqueo@funcity.com.ar',
    telefono:         datosReserva.telefono         || '',
    tema:             datosReserva.tema             || '',
    notas:            datosReserva.notas            || '',
    nombre_cliente:   datosReserva.nombre_cliente   || '',
    apellido_cliente: datosReserva.apellido_cliente || '',
    vendedor:         datosReserva.vendedor?.trim() || '',
    precio_unitario:  esFDS ? config.precio_fin_de_semana : config.precio_semana,
    es_fds:           esFDS,
    esFeriado:        !!feriadosMapa[datosReserva.fecha],
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
//  RESERVAS — OBTENER
// ============================================================

export const obtenerCumpleanosRegistrados = async (fechaInicio, fechaFin) => {
  const cacheKey = `cumpleanos_${fechaInicio}_${fechaFin}`;
  if (_cache[cacheKey] && Date.now() - _cache[cacheKey].ts < 5 * 60 * 1000) {
    return _cache[cacheKey].data;
  }
  const params = new URLSearchParams({ api_key: API_KEY, fecha_inicio: fechaInicio, fecha_fin: fechaFin });
  const res = await fetch(`${API_BASE_URL}/obtener-cumpleanos?${params}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
  _cache[cacheKey] = { ts: Date.now(), data };
  return data;
};

export const normalizeReserva = (raw) => {
  const fechaRaw    = raw.fecha || raw.start_date || raw.date || raw.start || '';
  const fecha       = fechaRaw ? fechaRaw.split(' ')[0] : '';
  const horaRaw     = raw.hora || raw.hora_inicio || raw.time || raw.start_time || '';
  const hora_inicio = horaRaw ? horaRaw.slice(0, 5) : '';

  return {
    bloqueo_id:       raw.bloqueo_id       || raw.id            || null,
    nombre_ninio:     raw.nombre_ninio     || raw.nombre        || raw.customer_name || 'Sin nombre',
    fecha,
    hora_inicio,
    personas:         parseInt(raw.personas || raw.number_of_persons || raw.capacity || 1),
    email:            raw.email            || raw.customer_email || '',
    telefono:         raw.telefono         || raw.phone         || raw.customer_phone || '',
    tema:             raw.tema             || raw.notes_tema     || '',
    notas:            raw.notas            || raw.notes         || '',
    nombre_cliente:   raw.nombre_cliente   || '',
    apellido_cliente: raw.apellido_cliente || '',
    vendedor:         raw.vendedor         || '',
    precio_unitario:  raw.precio_unitario  || null,
    es_fds:           raw.es_fds           ?? null,
    _raw: raw,
  };
};

export const obtenerTodasLasReservas = async ({
  fechaInicio,
  fechaFin,
  usarCache = true,
} = {}) => {
  const hoy = new Date();
  const ini = fechaInicio || (() => {
    const d = new Date(hoy); d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  })();
  const fin = fechaFin || (() => {
    const d = new Date(hoy); d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  })();

  const cacheKey = `reservas_${ini}_${fin}`;

  if (usarCache && _cache[cacheKey] && Date.now() - _cache[cacheKey].ts < 60 * 1000) {
    return { reservas: _cache[cacheKey].reservas, fromCache: true, fechaInicio: ini, fechaFin: fin };
  }

  const params = new URLSearchParams({ api_key: API_KEY, fecha_inicio: ini, fecha_fin: fin });
  const res  = await fetch(`${API_BASE_URL}/obtener-cumpleanos?${params}`, {
    method:  'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Error ${res.status} al obtener reservas`);

  let arr = [];
  if (Array.isArray(data))               arr = data;
  else if (Array.isArray(data.cumpleanos)) arr = data.cumpleanos;
  else if (Array.isArray(data.data))     arr = data.data;
  else if (Array.isArray(data.reservas)) arr = data.reservas;

  const reservas = arr.map(normalizeReserva).filter(r => r.fecha);
  _cache[cacheKey] = { ts: Date.now(), reservas };

  return { reservas, fromCache: false, fechaInicio: ini, fechaFin: fin, total: reservas.length };
};

// ============================================================
//  COBROS — Guardados en la API (endpoint /cobros)
//  Estructura: { bloqueo_id, estado, total, pagos, notas, vendedor, actualizadoEn }
// ============================================================

export const obtenerCobro = async (bloqueoId) => {
  try {
    const res = await fetch(
      `${API_BASE_URL}/cobros?api_key=${encodeURIComponent(API_KEY)}&bloqueo_id=${bloqueoId}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.cobro || data || null;
  } catch {
    return null;
  }
};

export const obtenerTodosCobros = async (bloqueoIds = []) => {
  if (!bloqueoIds.length) return {};
  try {
    const ids = bloqueoIds.join(',');
    const res = await fetch(
      `${API_BASE_URL}/cobros?api_key=${encodeURIComponent(API_KEY)}&bloqueo_ids=${ids}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
    if (!res.ok) return {};
    const data = await res.json();
    // Aceptar formato { cobros: { "123": {...}, ... } } o { "123": {...}, ... }
    if (data.cobros && typeof data.cobros === 'object') return data.cobros;
    if (typeof data === 'object' && !Array.isArray(data)) return data;
    return {};
  } catch {
    return {};
  }
};

export const guardarCobro = async (bloqueoId, cobro) => {
  try {
    const payload = { api_key: API_KEY, bloqueo_id: bloqueoId, ...cobro };
    const res = await fetch(`${API_BASE_URL}/cobros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al guardar cobro');
    return data.cobro || data;
  } catch (err) {
    throw new Error(err.message || 'Error al guardar cobro');
  }
};

export const eliminarCobro = async (bloqueoId) => {
  try {
    const res = await fetch(`${API_BASE_URL}/cobros`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: API_KEY, bloqueo_id: bloqueoId }),
    });
    return res.ok;
  } catch {
    return false;
  }
};

// ============================================================
//  ESTADO DE LA API
// ============================================================

export const verificarEstadoAPI = async () => {
  const endpoints = [
    { nombre: 'bloquear-pase',            metodo: 'POST'   },
    { nombre: 'obtener-cumpleanos',       metodo: 'GET'    },
    { nombre: 'verificar-disponibilidad', metodo: 'GET'    },
    { nombre: 'eliminar-bloqueo',         metodo: 'DELETE' },
    { nombre: 'cobros',                   metodo: 'GET'    },
    { nombre: 'configuracion',            metodo: 'GET'    },
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
  return {
    endpoints: resultados,
    resumen: {
      total:       resultados.length,
      disponibles: resultados.filter(r => r.disponible).length,
    },
  };
};

// ============================================================
//  EXPORTS
// ============================================================

export default {
  // Disponibilidad
  consultarDisponibilidad,
  consultarDisponibilidadReal,
  consultarDisponibilidadDia,
  consultarDisponibilidadRango,
  // Reservas
  crearReserva,
  eliminarBloqueo,
  obtenerCumpleanosRegistrados,
  obtenerTodasLasReservas,
  normalizeReserva,
  // Helpers
  obtenerHorariosParaFecha,
  obtenerHorariosDisponibles,
  esFinDeSemana,
  esPrecioFinDeSemana,
  validarDatosReserva,
  validarHorarioSegunDia,
  // Diagnóstico
  verificarEstadoAPI,
  // Feriados
  obtenerFeriados,
  obtenerFeriadosRango,
  // Cobros
  obtenerCobro,
  obtenerTodosCobros,
  guardarCobro,
  eliminarCobro,
  // Configuración
  obtenerConfiguracion,
  guardarConfiguracion,
  // Constantes / defaults
  HORARIOS_DISPONIBLES,
  PRECIO_SEMANA,
  PRECIO_FIN_SEMANA,
  CONFIG_DEFAULT,
  API_BASE_URL,
  API_KEY,
};