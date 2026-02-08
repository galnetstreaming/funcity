import { useState } from 'react';
import { Container, Card, Alert, Spinner } from 'react-bootstrap';
import FormularioReserva from './components/FormularioReserva';
import HistorialReservas from './components/HistorialReservas';
import ListaReservas from './components/ListaReservas';
import CalendarioDisponibilidad from './components/CalendarioDisponibilidad';
import api from './services/api';

import 'bootstrap/dist/css/bootstrap.min.css';
import NavBarMain from './layout/NavBarMain';


function App() {
  const [historialReservas, setHistorialReservas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  const handleGuardarReserva = async (datosReserva) => {
    try {
      setCargando(true);
      setMensaje({ tipo: '', texto: '' });

      // Validar datos antes de enviar
      const validacion = api.validarDatosReserva(datosReserva);
      if (!validacion.valido) {
        throw new Error(validacion.errores.join('\n'));
      }

      // Usar la función crearReserva de la API
      const respuesta = await api.crearReserva(datosReserva);

      // Agregar la reserva al historial local
      const nuevaReserva = {
        id: respuesta.bloqueo_id || respuesta.id,
        bloqueo_id: respuesta.bloqueo_id || respuesta.id,
        service_pase: respuesta.service_pase || respuesta.service_id,
        personas_bloqueadas: respuesta.personas_bloqueadas || respuesta.personas,
        inicio: respuesta.inicio || `${datosReserva.fecha} ${datosReserva.hora_inicio}:00`,
        fecha_creacion: new Date().toISOString(),
        ...datosReserva
      };

      setHistorialReservas(prev => [nuevaReserva, ...prev]);

      setMensaje({
        tipo: 'success',
        texto: `🎉 ¡Reserva creada exitosamente!
                ID: ${respuesta.bloqueo_id || respuesta.id}
                Servicio: ${respuesta.service_pase || respuesta.service_id}
                Personas: ${respuesta.personas_bloqueadas || respuesta.personas}
                Fecha: ${datosReserva.fecha} ${datosReserva.hora_inicio}`
      });

      // Limpiar mensaje después de 10 segundos
      setTimeout(() => {
        setMensaje({ tipo: '', texto: '' });
      }, 10000);

    } catch (error) {
      let tipoAlerta = 'danger';
      let textoError = '';

      if (error.message && (
        error.message.includes('ocupado') ||
        error.message.includes('ya está reservado') ||
        error.message.includes('slot_ocupado')
      )) {
        tipoAlerta = 'warning';
        textoError = `⚠️ Este horario ya está reservado.\n\nPor favor, selecciona otro horario disponible.\n\n💡 Usa el Calendario de Disponibilidad para ver horarios libres.`;
      }
      else if (error.message && error.message.includes('horario') && error.message.includes('válido')) {
        tipoAlerta = 'danger';
        textoError = `❌ Horario no válido.\n\n${error.message}\n\nPor favor, usa solo los horarios mostrados en el formulario.`;
      }
      else if (error.message && error.message.includes('cantidad') || error.message.includes('personas')) {
        tipoAlerta = 'danger';
        textoError = `❌ Cantidad de personas inválida.\n\nDebe estar entre 1 y 40 personas.`;
      }
      else if (error.message && error.message.includes('capacidad') || error.message.includes('excede')) {
        tipoAlerta = 'warning';
        textoError = `⚠️ Capacidad excedida.\n\nLa cantidad de personas excede la capacidad disponible.\n\nPor favor, reduce la cantidad.`;
      }
      else if (error.message && error.message.includes('API') || error.message.includes('api_key')) {
        tipoAlerta = 'danger';
        textoError = `🔑 Error de autenticación.\n\nLa API key es inválida o ha expirado.`;
      }
      else {
        textoError = `❌ Error: ${error.message || 'Error desconocido'}`;
      }

      setMensaje({
        tipo: tipoAlerta,
        texto: textoError
      });

      console.error('Error creando reserva:', error);
    } finally {
      setCargando(false);
    }
  };

  return (
    <NavBarMain>

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
          <Card className="shadow-sm mb-4">
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

        {/* Calendario de Disponibilidad */}
        <CalendarioDisponibilidad />

        {/* Lista de Reservas (puedes activarlo cuando tengas datos reales) */}
        {/* 
        <Card className="shadow-sm mb-4">
          <Card.Header className="bg-warning text-dark">
            <h4 className="mb-0">📋 Lista de Reservas</h4>
          </Card.Header>
          <Card.Body>
            <ListaReservas 
              reservas={[]} // Aquí pasarías las reservas reales
              onEditar={() => console.log('Editar reserva')}
              onEliminar={() => console.log('Eliminar reserva')}
            />
          </Card.Body>
        </Card>
        */}

        {/* Footer */}
        <div className="text-center mt-4 text-muted">
          <small>Fun City - Sistema de Reservas v2.0</small>
        </div>
      </Container>
    </NavBarMain >
  );
}

export default App;