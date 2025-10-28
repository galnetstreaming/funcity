import { Table, Button, Badge } from 'react-bootstrap';

const ListaReservas = ({ reservas, onEditar, onEliminar }) => {
  if (!reservas || reservas.length === 0) {
    return (
      <div className="alert alert-info">
        No hay reservas registradas. Crea una nueva reserva usando el formulario.
      </div>
    );
  }

  const formatearFecha = (fecha) => {
    const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(fecha).toLocaleDateString('es-AR', opciones);
  };

  return (
    <div className="table-responsive">
      <Table striped bordered hover>
        <thead className="table-dark">
          <tr>
            <th>ID</th>
            <th>Niño/a</th>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Personas</th>
            <th>Tema</th>
            <th>Email</th>
            <th>Teléfono</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {reservas.map((reserva) => (
            <tr key={reserva.bloqueo_id}>
              <td>
                <Badge bg="secondary">{reserva.bloqueo_id}</Badge>
              </td>
              <td>{reserva.nombre_ninio || '-'}</td>
              <td>{formatearFecha(reserva.fecha)}</td>
              <td>
                <Badge bg="info">{reserva.hora_inicio}</Badge>
              </td>
              <td>
                <Badge bg="primary">{reserva.personas}</Badge>
              </td>
              <td>{reserva.tema || '-'}</td>
              <td>
                <small>{reserva.email || 'bloqueo@funcity.com.ar'}</small>
              </td>
              <td>{reserva.telefono || '-'}</td>
              <td>
                <div className="d-flex gap-2">
                  <Button 
                    variant="warning" 
                    size="sm"
                    onClick={() => onEditar(reserva)}
                  >
                    Editar
                  </Button>
                  <Button 
                    variant="danger" 
                    size="sm"
                    onClick={() => onEliminar(reserva.bloqueo_id)}
                  >
                    Eliminar
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default ListaReservas;