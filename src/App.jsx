import { useState } from 'react';
import { Container, Card, Alert, Spinner } from 'react-bootstrap';
import FormularioReserva from './components/FormularioReserva';
import HistorialReservas from './components/HistorialReservas';

import { crearReserva } from './services/api';

import 'bootstrap/dist/css/bootstrap.min.css';



function App() {
  const [historialReservas, setHistorialReservas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  const handleGuardarReserva = async (datosReserva) => {
    try {
      setCargando(true);
      setMensaje({ tipo: '', texto: '' });

      const respuesta = await crearReserva(datosReserva);
      
      // Agregar la reserva al historial local
      const nuevaReserva = {
        id: respuesta.bloqueo_id,
        bloqueo_id: respuesta.bloqueo_id,
        service_pase: respuesta.service_pase,
        personas_bloqueadas: respuesta.personas_bloqueadas,
        inicio: respuesta.inicio,
        fecha_creacion: new Date().toISOString(),
        ...datosReserva
      };
      
      setHistorialReservas(prev => [nuevaReserva, ...prev]);

      setMensaje({ 
        tipo: 'success', 
        texto: `🎉 ¡Reserva creada exitosamente! 
                | ID de Bloqueo: ${respuesta.bloqueo_id} 
                | Servicio: ${respuesta.service_pase} 
                | Personas: ${respuesta.personas_bloqueadas} 
                | Inicio: ${respuesta.inicio}` 
      });

      // Limpiar mensaje después de 10 segundos
      setTimeout(() => {
        setMensaje({ tipo: '', texto: '' });
      }, 10000);
      
    } catch (error) {
      // Manejo específico de diferentes tipos de errores
      let tipoAlerta = 'danger';
      let textoError = '';

      // Detectar slot ocupado
      if (error.message && (error.message.includes('ocupado') || error.message.includes('ya está reservado'))) {
        tipoAlerta = 'warning';
        textoError = `⚠️ Este horario ya está reservado.
                      
                      Por favor, selecciona otro horario disponible para la misma fecha.
                      
                      💡 Sugerencia: Usa el Calendario de Disponibilidad para ver horarios libres.`;
      }
      // Detectar horario no válido
      else if (error.message && error.message.includes('horario') && error.message.includes('válido')) {
        tipoAlerta = 'danger';
        textoError = `❌ Horario no válido.
                      
                      ${error.message}
                      
                      Por favor, usa solo los horarios mostrados en el formulario.`;
      }
      // Detectar cantidad inválida
      else if (error.message && error.message.includes('cantidad')) {
        tipoAlerta = 'danger';
        textoError = `❌ Cantidad de personas inválida.
                      
                      Debe estar entre 1 y 40 personas.`;
      }
      // Detectar capacidad excedida
      else if (error.message && error.message.includes('capacidad')) {
        tipoAlerta = 'warning';
        textoError = `⚠️ Capacidad excedida.
                      
                      La cantidad de personas excede la capacidad disponible para este servicio.
                      
                      Por favor, reduce la cantidad o contacta para consultar opciones.`;
      }
      // Error genérico - Usar el mensaje real de la API
      else {
        const mensajeError = error.message || obtenerMensajeError(error);
        textoError = `❌ ${mensajeError}`;
      }

      setMensaje({ 
        tipo: tipoAlerta, 
        texto: textoError
      });

      // Log para debugging
      console.error('Error detallado:', error);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="bg-light min-vh-100 py-4">
      <Container>
   
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="display-4 text-primary mb-2">🎉 Fun City</h1>
          <p className="lead text-muted">Sistema de Gestión de Reservas</p>
        </div>

        {/* Mensajes de feedback */}
        {mensaje.texto && (
          <Alert 
            variant={mensaje.tipo} 
            dismissible 
            onClose={() => setMensaje({ tipo: '', texto: '' })}
            className="shadow-sm"
          >
            <div style={{ whiteSpace: 'pre-line' }}>
              {mensaje.texto}
            </div>
          </Alert>
        )}

        {/* Spinner de carga */}
        {cargando && (
          <div className="text-center my-4">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2">Procesando reserva...</p>
          </div>
        )}

        {/* Formulario de creación */}
        <Card className="mb-4 shadow-sm">
          <Card.Header className="bg-primary text-white">
            <h4 className="mb-0">➕ Nueva Reserva de Cumpleaños</h4>
          </Card.Header>
          <Card.Body>
            <FormularioReserva 
              onGuardar={handleGuardarReserva}
              deshabilitado={cargando}
            />
          </Card.Body>
        </Card>

        {/* Historial de reservas creadas en esta sesión */}
        {historialReservas.length > 0 && (
          <Card className="shadow-sm">
            <Card.Header className="bg-success text-white">
              <h4 className="mb-0">📋 Historial de Reservas (Sesión Actual)</h4>
            </Card.Header>
            <Card.Body>
              <Alert variant="info" className="mb-3">
                <small>
                  <strong>ℹ️ Nota:</strong> Este historial muestra solo las reservas creadas en esta sesión. 
                  Para ver todas las reservas, accede al panel de Bookly en WordPress.
                </small>
              </Alert>
              <HistorialReservas reservas={historialReservas} />
            </Card.Body>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-4 text-muted">
          <small>Fun City - Sistema de Reservas v2.0</small>
        </div>
      </Container>
    </div>
  );
}

export default App;