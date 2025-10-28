const API_BASE_URL = 'https://testsite.funcity.com.ar/wp-json/bookly-sync/v1';
const API_KEY = 'fcBk2025!x9kM7pQ2vR8tW3zY5uN1jL4hG6eD9aS0rT';

// ============================================
// SOLUCIÓN AL PROBLEMA: CONSULTA vs CREACIÓN
// ============================================

/**
 * OPCIÓN 1: Si la API tiene un endpoint de CONSULTA separado (IDEAL)
 * Necesitarías que el backend implemente algo como:
 * POST /wp-json/bookly-sync/v1/consultar-disponibilidad
 * 
 * Este endpoint SOLO debe verificar disponibilidad sin crear registros
 */
export const consultarDisponibilidadReal = async (datosConsulta) => {
  try {
    const payload = {
      api_key: API_KEY,
      fecha: datosConsulta.fecha,
      hora_inicio: datosConsulta.hora_inicio,
      personas: parseInt(datosConsulta.personas),
      solo_consulta: true // Parámetro que le indica a la API que NO debe crear registros
    };

    console.log('🔍 Consultando disponibilidad (sin crear registro):', payload);

    // Endpoint NUEVO que deberías solicitar al backend
    const response = await fetch(`${API_BASE_URL}/consultar-disponibilidad`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('📥 Respuesta de consulta:', data);

    if (!response.ok) {
      return {
        disponible: false,
        ocupado: data.code === 'slot_ocupado',
        error: data.message || 'Error al consultar disponibilidad'
      };
    }

    return {
      disponible: true,
      ocupado: false,
      data: data
    };

  } catch (error) {
    console.error('❌ Error consultando disponibilidad:', error);
    throw error;
  }
};

/**
 * OPCIÓN 2: Método GET para consultar sin modificar datos (RECOMENDADO)
 * Consultar disponibilidad mediante GET es REST-compliant y no debería crear registros
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

    // Endpoint GET que NO debe crear registros
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
      ocupado: data.code === 'slot_ocupado' || data.disponible === false,
      capacidadRestante: data.capacidad_restante || 0,
      mensaje: data.message || data.mensaje
    };

  } catch (error) {
    console.error('❌ Error verificando disponibilidad:', error);
    return {
      disponible: false,
      ocupado: false,
      error: error.message
    };
  }
};

/**
 * OPCIÓN 3: Usar el endpoint actual pero con rollback
 * ADVERTENCIA: Esta es una MALA PRÁCTICA pero funciona si no podés modificar el backend
 * Crea el registro y luego lo elimina inmediatamente
 */
export const consultarDisponibilidadConRollback = async (datosConsulta) => {
  let bloqueoId = null;
  
  try {
    // Crear el registro temporal
    const payload = {
      api_key: API_KEY,
      fecha: datosConsulta.fecha,
      hora_inicio: datosConsulta.hora_inicio,
      personas: 1, // Mínimo para consulta
      nombre_ninio: 'CONSULTA_TEMP',
      email: 'consulta@sistema.temp'
    };

    console.log('🔍 Consultando disponibilidad (con rollback):', payload);

    const response = await fetch(`${API_BASE_URL}/bloquear-pase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      // Si falla, el slot está ocupado o hay error
      return {
        disponible: false,
        ocupado: data.code === 'slot_ocupado',
        error: data.message
      };
    }

    // Si tuvo éxito, el slot está disponible
    bloqueoId = data.bloqueo_id;
    
    // IMPORTANTE: Eliminar el registro inmediatamente
    if (bloqueoId) {
      await eliminarBloqueo(bloqueoId);
    }

    return {
      disponible: true,
      ocupado: false,
      data: data
    };

  } catch (error) {
    console.error('❌ Error en consulta con rollback:', error);
    
    // Intentar limpiar si se creó algo
    if (bloqueoId) {
      try {
        await eliminarBloqueo(bloqueoId);
      } catch (cleanupError) {
        console.error('❌ Error limpiando registro temporal:', cleanupError);
      }
    }
    
    throw error;
  }
};

/**
 * Eliminar un bloqueo temporal creado durante consultas
 */
const eliminarBloqueo = async (bloqueoId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/eliminar-bloqueo`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: API_KEY,
        bloqueo_id: bloqueoId
      })
    });

    if (!response.ok) {
      console.warn('⚠️ No se pudo eliminar el bloqueo temporal:', bloqueoId);
    } else {
      console.log('✅ Bloqueo temporal eliminado:', bloqueoId);
    }
  } catch (error) {
    console.error('❌ Error eliminando bloqueo:', error);
  }
};

// ============================================
// FUNCIÓN PRINCIPAL DE CONSULTA
// ============================================

/**
 * Función principal que usa la mejor opción disponible
 * Prioridad: GET > Consulta dedicada > Rollback
 */
export const consultarDisponibilidad = async (fecha, horaInicio, personas) => {
  // Intentar primero con GET (más limpio)
  try {
    const resultado = await consultarDisponibilidadGET(fecha, horaInicio, personas);
    
    // Si el endpoint GET no existe (404), intentar otras opciones
    if (resultado.error && resultado.error.includes('404')) {
      console.warn('⚠️ Endpoint GET no disponible, intentando método alternativo');
      // Aquí podrías intentar con consultarDisponibilidadReal o consultarDisponibilidadConRollback
      return await consultarDisponibilidadReal({ fecha, hora_inicio: horaInicio, personas });
    }
    
    return resultado;
  } catch (error) {
    console.error('❌ Error en consulta principal:', error);
    throw error;
  }
};

// ============================================
// FUNCIÓN DE CREACIÓN REAL (cuando el usuario confirma)
// ============================================

/**
 * Crear una reserva REAL (solo cuando el usuario confirma)
 */
export const crearReserva = async (datosReserva) => {
  try {
    const payload = {
      api_key: API_KEY,
      fecha: datosReserva.fecha,
      hora_inicio: datosReserva.hora_inicio,
      personas: parseInt(datosReserva.personas)
    };

    // Agregar campos opcionales
    if (datosReserva.nombre_ninio) payload.nombre_ninio = datosReserva.nombre_ninio;
    if (datosReserva.tema) payload.tema = datosReserva.tema;
    if (datosReserva.email) payload.email = datosReserva.email;
    if (datosReserva.telefono) payload.telefono = datosReserva.telefono;

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
      throw new Error(data.message || data.mensaje || 'Error al crear la reserva');
    }

    console.log('✅ Reserva creada exitosamente:', data);
    return data;
    
  } catch (error) {
    console.error('❌ Error creando reserva:', error);
    throw error;
  }
};

// ============================================
// CONSULTAS MASIVAS OPTIMIZADAS
// ============================================

/**
 * Consultar disponibilidad para múltiples horarios de una fecha
 * Usa Promise.all para consultas paralelas
 */
export const consultarDisponibilidadDia = async (fecha, horarios, personas) => {
  console.log(`📅 Consultando disponibilidad para ${fecha} en ${horarios.length} horarios`);
  
  try {
    const consultas = horarios.map(hora => 
      consultarDisponibilidad(fecha, hora, personas)
        .then(resultado => ({
          hora,
          ...resultado
        }))
        .catch(error => ({
          hora,
          disponible: false,
          error: error.message
        }))
    );

    const resultados = await Promise.all(consultas);
    
    console.log('✅ Consultas completadas para', fecha);
    return resultados;
    
  } catch (error) {
    console.error('❌ Error en consultas masivas:', error);
    throw error;
  }
};

/**
 * Consultar disponibilidad para múltiples fechas
 */
export const consultarDisponibilidadRango = async (fechas, horarios, personas) => {
  console.log(`📆 Consultando disponibilidad para ${fechas.length} fechas`);
  
  const resultadosPorFecha = {};
  
  // Procesar fecha por fecha para no saturar el servidor
  for (const fecha of fechas) {
    try {
      resultadosPorFecha[fecha] = await consultarDisponibilidadDia(fecha, horarios, personas);
      
      // Pequeña pausa entre fechas para no saturar el servidor
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Error consultando fecha ${fecha}:`, error);
      resultadosPorFecha[fecha] = horarios.map(hora => ({
        hora,
        disponible: false,
        error: error.message
      }));
    }
  }
  
  return resultadosPorFecha;
};

// ============================================
// CONFIGURACIÓN Y UTILIDADES
// ============================================

/**
 * Horarios predefinidos por día de la semana
 */
export const HORARIOS_DISPONIBLES = {
  // Lunes a Viernes
  semana: ['12:30', '14:20', '16:10'],
  // Sábados y Domingos
  finDeSemana: ['10:30', '12:20', '14:10', '16:00']
};

/**
 * Obtener horarios disponibles para una fecha específica
 */
export const obtenerHorariosParaFecha = (fecha) => {
  const date = new Date(fecha + 'T00:00:00');
  const diaSemana = date.getDay(); // 0 = Domingo, 6 = Sábado
  
  return (diaSemana === 0 || diaSemana === 6) 
    ? HORARIOS_DISPONIBLES.finDeSemana 
    : HORARIOS_DISPONIBLES.semana;
};

/**
 * Validar datos de reserva antes de enviar
 */
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

  if (datos.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email)) {
    errores.push('Email inválido');
  }

  return {
    valido: errores.length === 0,
    errores
  };
};

export default {
  consultarDisponibilidad,
  crearReserva,
  consultarDisponibilidadDia,
  consultarDisponibilidadRango,
  obtenerHorariosParaFecha,
  validarDatosReserva,
  HORARIOS_DISPONIBLES
};