import { useState } from 'react';
import {
  Table, Button, Badge, Alert, Form, InputGroup,
  Row, Col, Card, Modal, Spinner
} from 'react-bootstrap';
import { eliminarBloqueo } from '../services/api';

const ListaReservas = ({ reservas = [], onEditar, onActualizar }) => {

  const [busqueda, setBusqueda]         = useState('');
  const [filtroFecha, setFiltroFecha]   = useState('');
  const [eliminando, setEliminando]     = useState(null);   // id en proceso
  const [confirmarId, setConfirmarId]   = useState(null);   // modal confirmar
  const [mensajeOk, setMensajeOk]       = useState('');
  const [mensajeErr, setMensajeErr]     = useState('');
  const [ordenCampo, setOrdenCampo]     = useState('fecha');
  const [ordenDir, setOrdenDir]         = useState('asc');

  // ── Filtrado y orden ────────────────────────────────────────
  const reservasFiltradas = reservas
    .filter(r => {
      const q = busqueda.toLowerCase();
      const coincideBusqueda =
        !q ||
        (r.nombre_ninio  || '').toLowerCase().includes(q) ||
        (r.tema          || '').toLowerCase().includes(q) ||
        (r.email         || '').toLowerCase().includes(q) ||
        (r.telefono      || '').includes(q) ||
        String(r.bloqueo_id || '').includes(q);
      const coincideFecha = !filtroFecha || r.fecha === filtroFecha;
      return coincideBusqueda && coincideFecha;
    })
    .sort((a, b) => {
      let va = a[ordenCampo] || '';
      let vb = b[ordenCampo] || '';
      if (ordenCampo === 'personas') { va = parseInt(va) || 0; vb = parseInt(vb) || 0; }
      if (va < vb) return ordenDir === 'asc' ? -1 :  1;
      if (va > vb) return ordenDir === 'asc' ?  1 : -1;
      return 0;
    });

  const cambiarOrden = (campo) => {
    if (ordenCampo === campo) setOrdenDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setOrdenCampo(campo); setOrdenDir('asc'); }
  };

  const flechaOrden = (campo) => {
    if (ordenCampo !== campo) return ' ↕';
    return ordenDir === 'asc' ? ' ↑' : ' ↓';
  };

  // ── Eliminar ────────────────────────────────────────────────
  const handleEliminar = async () => {
    const id = confirmarId;
    setConfirmarId(null);
    setEliminando(id);
    setMensajeErr('');
    try {
      await eliminarBloqueo(id);
      if (onActualizar) onActualizar(prev => prev.filter(r => r.bloqueo_id !== id));
      setMensajeOk(`✅ Reserva #${id} eliminada correctamente`);
      setTimeout(() => setMensajeOk(''), 4000);
    } catch (err) {
      setMensajeErr(`❌ Error al eliminar #${id}: ${err.message}`);
    } finally {
      setEliminando(null);
    }
  };

  // ── Helpers de formato ──────────────────────────────────────
  const formatFecha = (f) => {
    if (!f) return '—';
    return new Date(f + 'T00:00:00').toLocaleDateString('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  const colorPersonas = (p) => {
    if (!p) return 'secondary';
    if (p <= 15) return 'success';
    if (p <= 28) return 'warning';
    return 'danger';
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Modal de confirmación ── */}
      <Modal show={!!confirmarId} onHide={() => setConfirmarId(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>⚠️ Confirmar eliminación</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>¿Estás seguro de que querés eliminar la reserva <strong>#{confirmarId}</strong>?</p>
          <Alert variant="warning" className="mb-0">
            <small>Esta acción elimina el bloqueo de Bookly y <strong>no puede deshacerse</strong>.</small>
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setConfirmarId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleEliminar}>Sí, eliminar</Button>
        </Modal.Footer>
      </Modal>

      {/* ── Alertas globales ── */}
      {mensajeOk  && <Alert variant="success" dismissible onClose={() => setMensajeOk('')}>{mensajeOk}</Alert>}
      {mensajeErr && <Alert variant="danger"  dismissible onClose={() => setMensajeErr('')}>{mensajeErr}</Alert>}

      {/* ── Estadísticas rápidas ── */}
      {reservas.length > 0 && (
        <Row className="mb-3 g-2">
          {[
            { label: 'Total reservas',  value: reservas.length,                                            color: 'primary' },
            { label: 'Total personas',  value: reservas.reduce((s, r) => s + (parseInt(r.personas) || 0), 0), color: 'info'    },
            { label: 'Con email',       value: reservas.filter(r => r.email && r.email !== 'bloqueo@funcity.com.ar').length, color: 'success' },
            { label: 'Mostrando',       value: reservasFiltradas.length,                                   color: 'secondary'},
          ].map(stat => (
            <Col xs={6} md={3} key={stat.label}>
              <Card className={`text-center border-${stat.color} bg-${stat.color} bg-opacity-10`}>
                <Card.Body className="py-2">
                  <div className={`fs-4 fw-bold text-${stat.color}`}>{stat.value}</div>
                  <div className="small text-muted">{stat.label}</div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* ── Filtros ── */}
      <Row className="mb-3 g-2">
        <Col md={6}>
          <InputGroup>
            <InputGroup.Text>🔍</InputGroup.Text>
            <Form.Control
              placeholder="Buscar por nombre, tema, email, teléfono o ID..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <Button variant="outline-secondary" onClick={() => setBusqueda('')}>✕</Button>
            )}
          </InputGroup>
        </Col>
        <Col md={4}>
          <InputGroup>
            <InputGroup.Text>📅</InputGroup.Text>
            <Form.Control
              type="date"
              value={filtroFecha}
              onChange={e => setFiltroFecha(e.target.value)}
            />
            {filtroFecha && (
              <Button variant="outline-secondary" onClick={() => setFiltroFecha('')}>✕</Button>
            )}
          </InputGroup>
        </Col>
        <Col md={2}>
          <Button
            variant="outline-secondary"
            className="w-100"
            onClick={() => { setBusqueda(''); setFiltroFecha(''); }}
          >
            🔄 Limpiar
          </Button>
        </Col>
      </Row>

      {/* ── Tabla / Empty state ── */}
      {reservas.length === 0 ? (
        <Alert variant="info" className="text-center py-5">
          <div style={{ fontSize: '2.5rem' }} className="mb-3">🎈</div>
          <h5>No hay reservas registradas en esta sesión</h5>
          <p className="mb-0 text-muted">Creá una nueva reserva desde la pestaña «Nueva Reserva»</p>
        </Alert>
      ) : reservasFiltradas.length === 0 ? (
        <Alert variant="warning" className="text-center">
          🔍 No se encontraron reservas con los filtros aplicados.
          <Button variant="link" size="sm" onClick={() => { setBusqueda(''); setFiltroFecha(''); }}>
            Limpiar filtros
          </Button>
        </Alert>
      ) : (
        <div className="table-responsive rounded border">
          <Table striped bordered hover className="mb-0" style={{ fontSize: '0.9rem' }}>
            <thead className="table-dark">
              <tr>
                <th
                  style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
                  onClick={() => cambiarOrden('bloqueo_id')}
                >
                  ID{flechaOrden('bloqueo_id')}
                </th>
                <th
                  style={{ cursor: 'pointer' }}
                  onClick={() => cambiarOrden('nombre_ninio')}
                >
                  Festejado/a{flechaOrden('nombre_ninio')}
                </th>
                <th
                  style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
                  onClick={() => cambiarOrden('fecha')}
                >
                  Fecha{flechaOrden('fecha')}
                </th>
                <th>Hora</th>
                <th
                  style={{ cursor: 'pointer' }}
                  onClick={() => cambiarOrden('personas')}
                >
                  Personas{flechaOrden('personas')}
                </th>
                <th
                  style={{ cursor: 'pointer' }}
                  onClick={() => cambiarOrden('tema')}
                >
                  Tema{flechaOrden('tema')}
                </th>
                <th>Email</th>
                <th>Teléfono</th>
                <th style={{ minWidth: 140 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reservasFiltradas.map((reserva, idx) => (
                <tr key={reserva.bloqueo_id || idx}>
                  <td>
                    <Badge bg="secondary" className="font-monospace">#{reserva.bloqueo_id}</Badge>
                  </td>
                  <td>
                    <strong>{reserva.nombre_ninio || <span className="text-muted">—</span>}</strong>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {formatFecha(reserva.fecha)}
                  </td>
                  <td>
                    <Badge bg="info" className="font-monospace">{reserva.hora_inicio || '—'}</Badge>
                  </td>
                  <td className="text-center">
                    <Badge bg={colorPersonas(reserva.personas)}>
                      {reserva.personas || '—'}
                    </Badge>
                  </td>
                  <td>
                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                      {reserva.tema || '—'}
                    </span>
                  </td>
                  <td>
                    <small className="text-muted">
                      {reserva.email && reserva.email !== 'bloqueo@funcity.com.ar'
                        ? reserva.email
                        : <span className="text-muted fst-italic">—</span>
                      }
                    </small>
                  </td>
                  <td>
                    <small>{reserva.telefono || <span className="text-muted">—</span>}</small>
                  </td>
                  <td>
                    <div className="d-flex gap-1">
                      <Button
                        variant="warning"
                        size="sm"
                        onClick={() => onEditar && onEditar(reserva)}
                        disabled={!!eliminando}
                        title="Editar reserva"
                      >
                        ✏️ Editar
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setConfirmarId(reserva.bloqueo_id)}
                        disabled={eliminando === reserva.bloqueo_id}
                        title="Eliminar reserva"
                      >
                        {eliminando === reserva.bloqueo_id
                          ? <Spinner animation="border" size="sm" />
                          : '🗑️'
                        }
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {reservasFiltradas.length > 0 && (
        <div className="text-end mt-2">
          <small className="text-muted">
            Mostrando {reservasFiltradas.length} de {reservas.length} reservas
            {(busqueda || filtroFecha) && ' (filtrado)'}
          </small>
        </div>
      )}
    </>
  );
};

export default ListaReservas;