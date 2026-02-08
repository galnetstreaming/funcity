const API_BASE_URL = 'https://testsite.funcity.com.ar/wp-json/bookly-sync/v1';
const API_KEY = 'fcBk2025!x9kM7pQ2vR8tW3zY5uN1jL4hG6eD9aS0rT';

// ============================================
// CONSULTAS DE DISPONIBILIDAD
// ============================================

/**
 * CONSULTA DE DISPONIBILIDAD usando el endpoint existente
 * 🔧 MEJORA: Manejo mejorado de errores específicos
 */
export const consultarDisponibilidadReal = async (datosConsulta) => {
  try {
    const payload = {
      api_key: API_KEY,
      fecha: datosConsulta.fecha,
      hora_inicio: datosConsulta.hora_inicio,
      personas: parseInt(datosConsulta.personas),
      modo: 'consultar'
    };

    console.log('🔍 Consultando disponibilidad (modo consultar):', payload);

    const response = await fetch(`${API_BASE_URL}/bloquear-pase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('📥 Respuesta de consulta:', data);

    if (!response.ok) {
      // 🔧 MEJORA: Manejo específico de errores comunes
      if (data.code === 'horario_no_valido') {
        return {
          disponible: false,
          ocupado: true,
          error: `Horario no válido: ${data.message || 'El horario no está disponible para este día'}`,
          capacidadRestante: 0,
          slotsValidos: data.slots_validos || [],
          esErrorHorario: true
        };
      }
      
      if (data.code === 'slot_ocupado') {
        return {
          disponible: false,
          ocupado: true,
          error: data.message || 'Este horario ya está reservado',
          capacidadRestante: data.capacidad_restante || 0,
          esSlotOcupado: true
        };
      }
      
      return {
        disponible: false,
        ocupado: data.disponible === false,
        error: data.message || data.mensaje || `Error ${response.status}: ${response.statusText}`,
        capacidadRestante: data.capacidad_restante || 0
      };
    }

    return {
      disponible: data.disponible !== false,
      ocupado: data.disponible === false,
      capacidadRestante: data.capacidad_restante || 0,
      capacidadTotal: data.capacidad_total,
      serviceId: data.service_id,
      staffId: data.staff_id,
      slotsValidos: data.slots_validos || [],
      mensaje: data.mensaje,
      data: data
    };

  } catch (error) {
    console.error('❌ Error consultando disponibilidad:', error);
    return {
      disponible: false,
      ocupado: false,
      error: `Error de conexión: ${error.message}`,
      capacidadRestante: 0
    };
  }
};

/**
 * Función principal que usa el endpoint real
 * 🔧 MEJORA: Validación previa de horarios
 */
export const consultarDisponibilidad = async (fecha, horaInicio, personas) => {
  try {
    // Validar formato de fecha
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return {
        disponible: false,
        ocupado: true,
        error: 'Formato de fecha inválido. Use YYYY-MM-DD',
        capacidadRestante: 0
      };
    }

    // Validar formato de hora
    if (!/^\d{2}:\d{2}$/.test(horaInicio)) {
      return {
        disponible: false,
        ocupado: true,
        error: 'Formato de hora inválido. Use HH:MM',
        capacidadRestante: 0
      };
    }

    // Verificar si es una fecha futura
    const hoy = new Date();
    const fechaConsulta = new Date(fecha);
    hoy.setHours(0, 0, 0, 0);
    
    if (fechaConsulta < hoy) {
      return {
        disponible: false,
        ocupado: true,
        error: 'No se puede consultar disponibilidad para fechas pasadas',
        capacidadRestante: 0
      };
    }

    const resultado = await consultarDisponibilidadReal({
      fecha: fecha,
      hora_inicio: horaInicio,
      personas: personas
    });
    
    return resultado;
    
  } catch (error) {
    console.error('❌ Error en consulta principal:', error);
    
    return {
      disponible: false,
      ocupado: true,
      error: error.message,
      capacidadRestante: 0
    };
  }
};

/**
 * 🔧 NUEVA: Validar horario según tipo de día
 */
export const validarHorarioSegunDia = (fecha, hora) => {
  const date = new Date(fecha);
  const diaSemana = date.getDay();
  const esFinDeSemana = diaSemana === 0 || diaSemana === 6;
  
  const horariosPermitidos = esFinDeSemana 
    ? ['10:30', '12:20', '14:10', '16:00']
    : ['12:30', '14:20', '16:10'];
  
  const esValido = horariosPermitidos.includes(hora);
  
  return {
    valido: esValido,
    horariosPermitidos,
    esFinDeSemana,
    mensaje: esValido ? 'Horario válido' : 
      `Horario no permitido. Para ${esFinDeSemana ? 'fin de semana' : 'día de semana'}: ${horariosPermitidos.join(', ')}`
  };
};

/**
 * Método GET para consultar (compatibilidad)
 */
export const consultarDisponibilidadGET = async (fecha, horaInicio, personas) => {
  try {
    const params = new URLSearchParams({
      api_key: API_KEY,
      fecha: fecha,
      hora_inicio: horaInicio,
      personas: personas.toString()
    });

    console.log('🔍 Consultando disponibilidad (GET):', params.toString());

    const response = await fetch(`${API_BASE_URL}/verificar-disponibilidad?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();
    console.log('📥 Respuesta de verificación:', data);

    return {
      disponible: response.ok && data.disponible !== false,
      ocupado: data.ocupado || data.disponible === false,
      capacidadRestante: data.capacidad_restante || 0,
      mensaje: data.message || data.mensaje,
      data: data
    };

  } catch (error) {
    console.error('❌ Error verificando disponibilidad:', error);
    return {
      disponible: false,
      ocupado: false,
      error: error.message,
      data: null
    };
  }
};

// ============================================
// RESERVAS REALES (CREACIÓN)
// ============================================

/**
 * Crear una reserva REAL
 * 🔧 MEJORA: Validación exhaustiva antes de enviar
 */
export const crearReserva = async (datosReserva) => {
  try {
    // Validar datos básicos
    const validacion = validarDatosReserva(datosReserva);
    if (!validacion.valido) {
      throw new Error(validacion.errores.join(', '));
    }

    // Validar horario según tipo de día
    const validacionHorario = validarHorarioSegunDia(datosReserva.fecha, datosReserva.hora_inicio);
    if (!validacionHorario.valido) {
      throw new Error(validacionHorario.mensaje);
    }

    const payload = {
      api_key: API_KEY,
      fecha: datosReserva.fecha,
      hora_inicio: datosReserva.hora_inicio,
      personas: parseInt(datosReserva.personas),
      modo: 'crear',
      nombre_ninio: datosReserva.nombre_ninio || 'Sin nombre',
      tema: datosReserva.tema || 'Sin tema',
      email: datosReserva.email || 'consulta@funcity.com.ar'
    };

    // Campos opcionales
    if (datosReserva.telefono) payload.telefono = datosReserva.telefono;
    if (datosReserva.notas) payload.notas = datosReserva.notas;

    console.log('🚀 Creando reserva REAL:', payload);

    const response = await fetch(`${API_BASE_URL}/bloquear-pase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      let mensajeError = data.message || data.mensaje || 'Error al crear la reserva';
      
      // Mensajes más amigables para errores comunes
      if (data.code === 'slot_ocupado') {
        mensajeError = '❌ Este horario ya está reservado. Por favor, elige otro horario.';
      } else if (data.code === 'horario_no_valido') {
        mensajeError = '❌ Horario no válido. ' + (data.message || '');
      } else if (data.code === 'capacidad_excedida') {
        mensajeError = `❌ Capacidad excedida. Máximo ${data.capacidad_total || 40} personas.`;
      }
      
      throw new Error(mensajeError);
    }

    console.log('✅ Reserva creada exitosamente:', data);
    
    // 🔧 MEJORA: Enriquecer respuesta con datos útiles
    return {
      ...data,
      fecha_formateada: new Date(data.inicio).toLocaleDateString('es-AR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      hora_formateada: new Date(data.inicio).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      resumen: `Reserva #${data.bloqueo_id} para ${data.nombre_ninio} el ${new Date(data.inicio).toLocaleDateString('es-AR')} a las ${new Date(data.inicio).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}`
    };
    
  } catch (error) {
    console.error('❌ Error creando reserva:', error);
    throw error;
  }
};

// ============================================
// OBTENER CUMPLEAÑOS REGISTRADOS
// ============================================

/**
 * Obtener cumpleaños registrados
 * 🔧 MEJORA: Cache local para mejorar performance
 */
export const obtenerCumpleanosRegistrados = async (fechaInicio, fechaFin) => {
  // Clave para cache
  const cacheKey = `cumpleanos_${fechaInicio}_${fechaFin}`;
  
  try {
    // Verificar cache (válido por 5 minutos)
    const cache = localStorage.getItem(cacheKey);
    if (cache) {
      const cachedData = JSON.parse(cache);
      const ahora = new Date().getTime();
      if (ahora - cachedData.timestamp < 5 * 60 * 1000) {
        console.log('📅 Usando datos cacheados para cumpleaños');
        return cachedData.data;
      }
    }

    const params = new URLSearchParams({
      api_key: API_KEY,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin
    });

    console.log('📅 Obteniendo cumpleaños registrados:', params.toString());

    const response = await fetch(`${API_BASE_URL}/obtener-cumpleanos?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 404) {
        console.warn('⚠️ Endpoint de cumpleaños no disponible (404), usando datos de ejemplo');
        const datosEjemplo = await obtenerCumpleanosEjemploTemporal(fechaInicio, fechaFin);
        
        // Guardar en cache incluso los datos de ejemplo
        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: new Date().getTime(),
          data: datosEjemplo,
          esEjemplo: true
        }));
        
        return datosEjemplo;
      }
      throw new Error(data.message || `Error ${response.status} al obtener cumpleaños`);
    }

    console.log('✅ Cumpleaños obtenidos:', data);

    // Guardar en cache
    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: new Date().getTime(),
      data: data,
      esEjemplo: false
    }));

    return data;

  } catch (error) {
    console.error('❌ Error obteniendo cumpleaños:', error);
    
    // Intentar usar cache aunque sea viejo como fallback
    const cache = localStorage.getItem(cacheKey);
    if (cache) {
      const cachedData = JSON.parse(cache);
      console.warn('⚠️ Usando datos cacheados (aunque sean viejos)');
      return cachedData.data;
    }
    
    return await obtenerCumpleanosEjemploTemporal(fechaInicio, fechaFin);
  }
};

/**
 * Datos de ejemplo temporal
 * 🔧 MEJORA: Datos más realistas y variados
 */
const obtenerCumpleanosEjemploTemporal = async (fechaInicio, fechaFin) => {
  console.log('📅 Usando datos de ejemplo temporal para cumpleaños');
  
  const horariosFinSemana = ['10:30', '12:20', '14:10', '16:00'];
  const horariosSemana = ['12:30', '14:20', '16:10'];
  
  const fechaInicioObj = new Date(fechaInicio);
  const fechaFinObj = new Date(fechaFin);
  
  const nombres = ['Juan Pérez', 'María González', 'Carlos López', 'Ana Martínez', 'Pedro Rodríguez', 
                   'Laura Sánchez', 'Miguel Fernández', 'Isabel Gómez', 'David Díaz', 'Elena Ruiz'];
  const temas = ['Princesas Disney', 'Superhéroes Marvel', 'Dinosaurios', 'Unicornios Mágicos', 
                 'Paw Patrol', 'Frozen', 'Spider-Man', 'Cars', 'Toy Story', 'Harry Potter'];
  
  const cumpleanos = [];
  
  for (let d = new Date(fechaInicioObj); d <= fechaFinObj; d.setDate(d.getDate() + 1)) {
    const fecha = d.toISOString().split('T')[0];
    const diaSemana = d.getDay();
    
    const esFinDeSemana = diaSemana === 0 || diaSemana === 6;
    const horarios = esFinDeSemana ? horariosFinSemana : horariosSemana;
    
    // 40% de probabilidad de tener un cumpleaños en fin de semana, 20% en días de semana
    const probabilidad = esFinDeSemana ? 0.4 : 0.2;
    
    if (Math.random() < probabilidad) {
      const horario = horarios[Math.floor(Math.random() * horarios.length)];
      const nombre = nombres[Math.floor(Math.random() * nombres.length)];
      const tema = temas[Math.floor(Math.random() * temas.length)];
      const personas = Math.floor(Math.random() * 20) + 5; // 5-25 personas
      
      cumpleanos.push({
        fecha: fecha,
        hora: horario,
        nombre_ninio: nombre,
        tema: tema,
        personas: personas,
        email: `${nombre.toLowerCase().replace(' ', '.')}@example.com`,
        telefono: `+54 9 11 ${Math.floor(Math.random() * 9000) + 1000} ${Math.floor(Math.random() * 9000) + 1000}`,
        staff_id: esFinDeSemana ? (horario >= '14:00' ? 11 : 6) : 3,
        service_id: esFinDeSemana ? 17 : 10,
        notas: `Cumple: ${nombre} | Tema: ${tema} | Personas: ${personas}`
      });
    }
  }
  
  return {
    success: true,
    total: cumpleanos.length,
    cumpleanos: cumpleanos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)),
    rango: {
      inicio: fechaInicio,
      fin: fechaFin
    },
    mensaje: `⚠️ Datos de ejemplo (${cumpleanos.length} cumpleaños) - El endpoint real podría devolver información diferente`,
    esEjemplo: true
  };
};

/**
 * Función auxiliar para obtener datos de cumpleaños para calendario
 */
export const obtenerCumpleanosCalendario = async (fechaInicio, fechaFin) => {
  try {
    const data = await obtenerCumpleanosRegistrados(fechaInicio, fechaFin);
    
    if (data.cumpleanos) {
      return data.cumpleanos.map(cumple => ({
        id: cumple.id || Math.random().toString(36).substr(2, 9),
        fecha: cumple.fecha,
        hora_inicio: cumple.hora || '00:00',
        nombre_ninio: cumple.nombre_ninio || 'Sin nombre',
        tema: cumple.tema || 'Sin tema',
        personas: cumple.personas || 1,
        email: cumple.email,
        telefono: cumple.telefono,
        notas: cumple.notas || `Cumple: ${cumple.nombre_ninio}`
      }));
    }
    
    return data;
    
  } catch (error) {
    console.error('❌ Error obteniendo cumpleaños para calendario:', error);
    return [];
  }
};

// ============================================
// CONSULTAS MASIVAS OPTIMIZADAS
// ============================================

/**
 * Consultar disponibilidad para múltiples horarios de una fecha
 * 🔧 MEJORA: Límite de consultas paralelas para no sobrecargar el servidor
 */
export const consultarDisponibilidadDia = async (fecha, horarios, personas) => {
  console.log(`📅 Consultando disponibilidad para ${fecha} en ${horarios.length} horarios`);
  
  try {
    // Limitar a 3 consultas paralelas máximo
    const resultados = [];
    const batchSize = 3;
    
    for (let i = 0; i < horarios.length; i += batchSize) {
      const batch = horarios.slice(i, i + batchSize);
      const consultas = batch.map(hora => 
        consultarDisponibilidad(fecha, hora, personas)
          .then(resultado => ({
            hora,
            disponible: resultado.disponible,
            ocupado: resultado.ocupado,
            capacidadRestante: resultado.capacidadRestante,
            error: resultado.error,
            mensaje: resultado.error || (resultado.disponible ? 'Disponible' : 'No disponible'),
            esErrorHorario: resultado.esErrorHorario
          }))
          .catch(error => ({
            hora,
            disponible: false,
            ocupado: true,
            error: error.message,
            mensaje: 'Error al consultar',
            esErrorHorario: false
          }))
      );

      const batchResultados = await Promise.all(consultas);
      resultados.push(...batchResultados);
      
      // Pequeña pausa entre lotes
      if (i + batchSize < horarios.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log('✅ Consultas completadas para', fecha);
    return resultados;
    
  } catch (error) {
    console.error('❌ Error en consultas masivas:', error);
    throw error;
  }
};

/**
 * Consultar disponibilidad para múltiples fechas con formato corregido
 * 🔧 MEJORA: Mejor manejo de errores y progreso
 */
export const consultarDisponibilidadRango = async (consultas, onProgreso) => {
  console.log(`📆 Consultando disponibilidad para ${consultas.length} fechas`);
  
  const resultadosPorFecha = {};
  let actual = 0;
  const total = consultas.length;
  
  // Notificar inicio
  if (onProgreso) onProgreso(0, total, 'Iniciando consultas...');
  
  for (const consulta of consultas) {
    try {
      const { fecha, horarios } = consulta;
      
      console.log(`🔍 Consultando fecha ${fecha} (${actual + 1}/${total})`);
      
      const consultasHorarios = horarios.map(async (hora) => {
        try {
          const resultado = await consultarDisponibilidad(fecha, hora, 1);
          
          // Manejar específicamente errores de horario no válido
          if (resultado.esErrorHorario) {
            return {
              hora,
              disponible: false,
              ocupado: true,
              error: resultado.error,
              capacidadRestante: 0,
              mensaje: 'Horario no configurado',
              esErrorHorario: true
            };
          }
          
          return {
            hora,
            disponible: resultado.disponible,
            ocupado: resultado.ocupado,
            error: resultado.error,
            capacidadRestante: resultado.capacidadRestante,
            mensaje: resultado.error || (resultado.disponible ? 'Disponible' : 'No disponible'),
            esErrorHorario: false
          };
        } catch (error) {
          return {
            hora,
            disponible: null,
            ocupado: true,
            error: error.message,
            mensaje: 'Error al consultar',
            esErrorHorario: false
          };
        }
      });

      const horariosResultados = await Promise.all(consultasHorarios);
      
      // Calcular resumen
      const totalHorarios = horariosResultados.length;
      const disponibles = horariosResultados.filter(h => h.disponible === true).length;
      const ocupados = horariosResultados.filter(h => h.disponible === false && !h.esErrorHorario).length;
      const erroresHorario = horariosResultados.filter(h => h.esErrorHorario).length;
      const errores = horariosResultados.filter(h => h.disponible === null).length;
      
      resultadosPorFecha[fecha] = {
        fecha,
        horarios: horariosResultados,
        resumen: {
          total: totalHorarios,
          disponibles,
          ocupados,
          erroresHorario,
          errores,
          disponiblesPorcentaje: Math.round((disponibles / totalHorarios) * 100)
        }
      };
      
      actual++;
      const porcentaje = Math.round((actual / total) * 100);
      if (onProgreso) onProgreso(actual, total, `Consultando... ${porcentaje}%`);
      
      // Pausa entre fechas para no saturar el servidor
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.error(`❌ Error consultando fecha ${consulta.fecha}:`, error);
      resultadosPorFecha[consulta.fecha] = {
        fecha: consulta.fecha,
        horarios: consulta.horarios.map(hora => ({
          hora,
          disponible: null,
          ocupado: true,
          error: error.message,
          mensaje: 'Error al consultar',
          esErrorHorario: false
        })),
        resumen: {
          total: consulta.horarios.length,
          disponibles: 0,
          ocupados: 0,
          erroresHorario: 0,
          errores: consulta.horarios.length,
          disponiblesPorcentaje: 0
        }
      };
      
      actual++;
      if (onProgreso) onProgreso(actual, total, `Error en ${consulta.fecha}`);
    }
  }
  
  const resultadosArray = Object.values(resultadosPorFecha);
  
  console.log(`✅ Consultas completadas: ${resultadosArray.length}/${total} fechas`);
  if (onProgreso) onProgreso(total, total, 'Consultas completadas');
  
  return resultadosArray;
};

// ============================================
// CONFIGURACIÓN Y UTILIDADES
// ============================================

export const HORARIOS_DISPONIBLES = {
  semana: ['12:30', '14:20', '16:10'],
  finDeSemana: ['10:30', '12:20', '14:10', '16:00']
};

export const obtenerHorariosParaFecha = (fecha) => {
  const date = new Date(fecha + 'T00:00:00');
  const diaSemana = date.getDay();
  
  return (diaSemana === 0 || diaSemana === 6) 
    ? HORARIOS_DISPONIBLES.finDeSemana 
    : HORARIOS_DISPONIBLES.semana;
};

export const obtenerHorariosDisponibles = (fecha) => {
  const date = new Date(fecha);
  const diaSemana = date.getDay();
  const esFinDeSemana = diaSemana === 0 || diaSemana === 6;
  
  const horarios = esFinDeSemana 
    ? ['10:30', '12:20', '14:10', '16:00']
    : ['12:30', '14:20', '16:10'];

  return {
    horarios,
    esFinDeSemana,
    tipoDia: esFinDeSemana ? 'fin_de_semana' : 'semana',
    precio: esFinDeSemana ? '$28,000' : '$25,000',
    duracion: '1h 50min'
  };
};

export const validarDatosReserva = (datos) => {
  const errores = [];

  if (!datos.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) {
    errores.push('Fecha inválida. Use formato YYYY-MM-DD');
  }

  if (!datos.hora_inicio || !/^\d{2}:\d{2}$/.test(datos.hora_inicio)) {
    errores.push('Hora inválida. Use formato HH:MM');
  }

  if (!datos.personas || datos.personas < 1 || datos.personas > 40) {
    errores.push('Cantidad de personas debe estar entre 1 y 40');
  }

  if (!datos.nombre_ninio || datos.nombre_ninio.trim().length < 2) {
    errores.push('Nombre del niño es requerido (mínimo 2 caracteres)');
  }

  if (datos.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email)) {
    errores.push('Email inválido');
  }

  // Validar que la fecha no sea pasada
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaReserva = new Date(datos.fecha);
  if (fechaReserva < hoy) {
    errores.push('No se pueden hacer reservas para fechas pasadas');
  }

  // Validar que la fecha no sea más de 6 meses en el futuro
  const maxFecha = new Date();
  maxFecha.setMonth(maxFecha.getMonth() + 6);
  if (fechaReserva > maxFecha) {
    errores.push('No se pueden hacer reservas con más de 6 meses de anticipación');
  }

  return {
    valido: errores.length === 0,
    errores
  };
};

// ============================================
// FUNCIONES DE PRUEBA Y DEBUG
// ============================================

/**
 * 🔧 NUEVA: Verificar estado de la API
 */
export const verificarEstadoAPI = async () => {
  console.log('🏥 Verificando estado de la API...');
  
  const endpoints = [
    { nombre: 'bloquear-pase', metodo: 'POST' },
    { nombre: 'obtener-cumpleanos', metodo: 'GET' },
    { nombre: 'verificar-disponibilidad', metodo: 'GET' },
    { nombre: 'eliminar-bloqueo', metodo: 'DELETE' }
  ];
  
  const resultados = [];
  
  for (const endpoint of endpoints) {
    try {
      const inicio = Date.now();
      let response;
      
      if (endpoint.metodo === 'GET') {
        response = await fetch(`${API_BASE_URL}/${endpoint.nombre}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        // Para POST y DELETE, enviar datos mínimos
        response = await fetch(`${API_BASE_URL}/${endpoint.nombre}`, {
          method: endpoint.metodo,
          headers: { 'Content-Type': 'application/json' },
          body: endpoint.metodo !== 'GET' ? JSON.stringify({ api_key: API_KEY }) : undefined
        });
      }
      
      const tiempo = Date.now() - inicio;
      const estado = response.status;
      
      resultados.push({
        endpoint: endpoint.nombre,
        metodo: endpoint.metodo,
        status: estado,
        statusText: response.statusText,
        tiempo: `${tiempo}ms`,
        disponible: estado !== 404,
        salud: estado >= 200 && estado < 400 ? '✅' : 
               estado === 404 ? '⚠️' : '❌'
      });
      
      console.log(`${resultados[resultados.length-1].salud} ${endpoint.nombre}: ${estado} (${tiempo}ms)`);
      
    } catch (error) {
      resultados.push({
        endpoint: endpoint.nombre,
        metodo: endpoint.metodo,
        status: 0,
        statusText: error.message,
        tiempo: 'N/A',
        disponible: false,
        salud: '❌'
      });
      console.log(`❌ ${endpoint.nombre}: ${error.message}`);
    }
    
    // Pequeña pausa entre verificaciones
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const todosDisponibles = resultados.every(r => r.disponible);
  const saludGeneral = todosDisponibles ? '✅' : resultados.some(r => !r.disponible) ? '⚠️' : '❌';
  
  console.log(`${saludGeneral} Estado general de la API: ${todosDisponibles ? 'OK' : 'CON PROBLEMAS'}`);
  
  return {
    timestamp: new Date().toISOString(),
    saludGeneral: todosDisponibles ? 'ok' : 'problemas',
    endpoints: resultados,
    resumen: {
      total: resultados.length,
      disponibles: resultados.filter(r => r.disponible).length,
      conProblemas: resultados.filter(r => !r.disponible).length
    }
  };
};

export const probarEndpoints = verificarEstadoAPI; // Alias para compatibilidad

export const verificarDisponibilidadSimple = async (fecha, hora, personas = 1) => {
  try {
    const resultado = await consultarDisponibilidad(fecha, hora, personas);
    
    if (resultado.error) {
      return {
        disponible: false,
        mensaje: resultado.error,
        detalles: resultado,
        icono: '❌'
      };
    }
    
    return {
      disponible: resultado.disponible,
      mensaje: resultado.disponible ? 
        `✅ Disponible (${resultado.capacidadRestante} lugares libres)` : 
        `❌ No disponible`,
      capacidadRestante: resultado.capacidadRestante,
      detalles: resultado,
      icono: resultado.disponible ? '✅' : '❌'
    };
  } catch (error) {
    return {
      disponible: false,
      mensaje: 'Error al verificar disponibilidad',
      error: error.message,
      icono: '⚠️'
    };
  }
};

// ============================================
// ELIMINAR BLOQUEO (para pruebas)
// ============================================

export const eliminarBloqueo = async (bloqueoId) => {
  try {
    const payload = {
      api_key: API_KEY,
      bloqueo_id: bloqueoId
    };

    console.log('🗑️ Eliminando bloqueo:', payload);

    const response = await fetch(`${API_BASE_URL}/eliminar-bloqueo`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Error ${response.status} al eliminar bloqueo`);
    }

    console.log('✅ Bloqueo eliminado:', data);
    return data;
    
  } catch (error) {
    console.error('❌ Error eliminando bloqueo:', error);
    throw error;
  }
};

/**
 * 🔧 NUEVA: Limpiar bloqueos antiguos (para mantenimiento)
 */
export const limpiarBloqueosAntiguos = async (dias = 30) => {
  try {
    const payload = {
      api_key: API_KEY,
      dias: dias
    };

    console.log('🧹 Limpiando bloqueos antiguos (más de', dias, 'días):', payload);

    const response = await fetch(`${API_BASE_URL}/limpiar-bloqueos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Error al limpiar bloqueos');
    }

    console.log('✅ Bloqueos limpiados:', data);
    return data;
    
  } catch (error) {
    console.error('❌ Error limpiando bloqueos:', error);
    throw error;
  }
};

// ============================================
// EXPORT DEFAULT
// ============================================

export default {
  // Consultas
  consultarDisponibilidad,
  consultarDisponibilidadReal,
  consultarDisponibilidadGET,
  consultarDisponibilidadDia,
  consultarDisponibilidadRango,
  
  // Reservas
  crearReserva,
  
  // Cumpleaños
  obtenerCumpleanosRegistrados,
  obtenerCumpleanosCalendario,
  
  // Utilidades
  obtenerHorariosParaFecha,
  obtenerHorariosDisponibles,
  validarDatosReserva,
  validarHorarioSegunDia,
  verificarDisponibilidadSimple,
  verificarEstadoAPI,
  probarEndpoints,
  
  // Mantenimiento
  eliminarBloqueo,
  limpiarBloqueosAntiguos,
  
  // Configuración
  HORARIOS_DISPONIBLES,
  
  // Constantes
  API_BASE_URL,
  API_KEY
};