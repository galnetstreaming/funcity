import { Table, Badge, Alert } from 'react-bootstrap';

const HistorialReservas = ({ reservas }) => {
  if (!reservas || reservas.length === 0) {
    return (
      <Alert variant="info">
        No hay reservas en el historial de esta sesión.
      </Alert>
    );
  }

  const formatearFecha = (fecha) => {
    const opciones = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    };
    return new Date(fecha).toLocaleDateString('es-AR', opciones);
  };

  const formatearHoraCompleta = (fechaHora) => {
    if (!fechaHora) return '-';
    const opciones = { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    };
    return new Date(fechaHora).toLocaleTimeString('es-AR', opciones);
  };

  return (
    <div className="table-responsive">
      <Table striped bordered hover>
        <thead className="table-success">
          <tr>
            <th>ID Bloqueo</th>
            <th>Servicio</th>
            <th>Niño/a</th>
            <th>Fecha</th>
            <th>Hora Inicio</th>
            <th>Personas</th>
            <th>Tema</th>
            <th>Email</th>
            <th>Teléfono</th>
          </tr>
        </thead>
        <tbody>
          {reservas.map((reserva, index) => (
            <tr key={reserva.bloqueo_id || index}>
              <td>
                <Badge bg="success" className="fs-6">
                  #{reserva.bloqueo_id}
                </Badge>
              </td>
              <td>
                <Badge bg="primary">
                  Servicio {reserva.service_pase}
                </Badge>
              </td>
              <td>
                <strong>{reserva.nombre_ninio || '-'}</strong>
              </td>
              <td>
                <small>{formatearFecha(reserva.fecha)}</small>
              </td>
              <td>
                <Badge bg="info" className="fs-6">
                  {reserva.hora_inicio}
                </Badge>
                <br />
                <small className="text-muted">
                  Sistema: {formatearHoraCompleta(reserva.inicio)}
                </small>
              </td>
              <td className="text-center">
                <Badge bg="warning" text="dark" className="fs-6">
                  {reserva.personas_bloqueadas || reserva.personas}
                </Badge>
              </td>
              <td>{reserva.tema || '-'}</td>
              <td>
                <small>{reserva.email || 'bloqueo@funcity.com.ar'}</small>
              </td>
              <td>{reserva.telefono || '-'}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Alert variant="light" className="mt-3">
        <small>
          <strong>💡 Información:</strong>
          <ul className="mb-0 mt-2">
            <li>El <strong>ID de Bloqueo</strong> es el identificador único en Bookly</li>
            <li>El <strong>Servicio</strong> indica qué tipo de pase se bloqueó</li>
            <li>Las reservas aparecen en el calendario de Bookly como "BLOQUEO - Cumple [nombre]"</li>
          </ul>
        </small>
      </Alert>
    </div>
  );
};

export default HistorialReservas;