import { useState } from 'react';
import { Table, Badge, Alert, Button, Row, Col, Card } from 'react-bootstrap';

const HistorialReservas = ({ reservas = [] }) => {

  const [expandido, setExpandido] = useState(null);

  if (!reservas || reservas.length === 0) {
    return (
      <Alert variant="info" className="text-center py-4">
        <div style={{ fontSize: '2.5rem' }} className="mb-2">📋</div>
        <h5>No hay reservas en el historial de esta sesión</h5>
        <p className="mb-0 text-muted">Las reservas creadas aparecerán aquí con todos sus detalles</p>
      </Alert>
    );
  }

  const formatFecha = (f) => {
    if (!f) return '—';
    return new Date(f + 'T00:00:00').toLocaleDateString('es-AR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  // ── Exportar CSV ──────────────────────────────────────────────
  const exportarCSV = () => {
    const headers = ['ID','Festejado/a','Fecha','Hora','Personas','Tema','Email','Teléfono'];
    const filas = reservas.map(r => [
      r.bloqueo_id, r.nombre_ninio, r.fecha, r.hora_inicio,
      r.personas, r.tema, r.email, r.telefono,
    ].map(v => `"${v || ''}"`).join(','));
    const csv = [headers.join(','), ...filas].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reservas_funcity_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── Estadísticas ──────────────────────────────────────────────
  const totalPersonas = reservas.reduce((s, r) => s + (parseInt(r.personas) || 0), 0);
  const conEmail      = reservas.filter(r => r.email && r.email !== 'bloqueo@funcity.com.ar').length;
  const conTema       = reservas.filter(r => r.tema).length;
  const finDeSemana   = reservas.filter(r => {
    if (!r.fecha) return false;
    const d = new Date(r.fecha + 'T00:00:00').getDay();
    return d === 0 || d === 6;
  }).length;

  return (
    <div>
      {/* ── Stats ── */}
      <Row className="mb-3 g-2">
        {[
          { label: 'Reservas',       value: reservas.length,    color: 'primary' },
          { label: 'Total personas', value: totalPersonas,      color: 'info'    },
          { label: 'Fin de semana',  value: finDeSemana,        color: 'purple'  },
          { label: 'Con email',      value: conEmail,           color: 'success' },
        ].map(s => (
          <Col xs={6} md={3} key={s.label}>
            <Card className={`text-center border-${s.color === 'purple' ? 'secondary' : s.color} bg-${s.color === 'purple' ? 'secondary' : s.color} bg-opacity-10`}>
              <Card.Body className="py-2">
                <div className={`fs-4 fw-bold text-${s.color === 'purple' ? 'secondary' : s.color}`}>{s.value}</div>
                <div className="small text-muted">{s.label}</div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Acciones ── */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="text-muted small">
          {reservas.length} reservas · {conTema} con tema · Promedio {Math.round(totalPersonas / reservas.length)} personas
        </span>
        <Button variant="outline-success" size="sm" onClick={exportarCSV}>
          📥 Exportar CSV
        </Button>
      </div>

      {/* ── Tabla ── */}
      <div className="table-responsive rounded border">
        <Table striped hover className="mb-0" style={{ fontSize: '0.88rem' }}>
          <thead className="table-success">
            <tr>
              <th>ID Bloqueo</th>
              <th>Festejado/a</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Personas</th>
              <th>Tema</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {reservas.map((r, idx) => (
              <>
                <tr key={r.bloqueo_id || idx}>
                  <td>
                    <Badge bg="success" className="font-monospace fs-6">#{r.bloqueo_id}</Badge>
                  </td>
                  <td><strong>{r.nombre_ninio || '—'}</strong></td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                    {r.fecha
                      ? new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'
                    }
                  </td>
                  <td>
                    <Badge bg="info" className="font-monospace fs-6">{r.hora_inicio || '—'}</Badge>
                  </td>
                  <td className="text-center">
                    <Badge bg="warning" text="dark" className="fs-6">
                      {r.personas_bloqueadas || r.personas || '—'}
                    </Badge>
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>{r.tema || <span className="text-muted">—</span>}</td>
                  <td>
                    <small className="text-muted">
                      {r.email && r.email !== 'bloqueo@funcity.com.ar' ? r.email : <span className="fst-italic">—</span>}
                    </small>
                  </td>
                  <td><small>{r.telefono || '—'}</small></td>
                  <td>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => setExpandido(expandido === idx ? null : idx)}
                    >
                      {expandido === idx ? '▲' : '▼'}
                    </Button>
                  </td>
                </tr>

                {expandido === idx && (
                  <tr key={`detalle-${idx}`} className="table-light">
                    <td colSpan={9}>
                      <Alert variant="light" className="mb-0 border">
                        <Row>
                          <Col md={6}>
                            <strong>📅 Fecha completa:</strong> {formatFecha(r.fecha)}<br />
                            <strong>🆔 ID Sistema:</strong> {r.bloqueo_id}<br />
                            {r.service_pase && <><strong>🎟️ Servicio:</strong> Pase {r.service_pase}<br /></>}
                            {r.inicio && <><strong>⏰ Inicio sistema:</strong> {new Date(r.inicio).toLocaleString('es-AR')}<br /></>}
                          </Col>
                          <Col md={6}>
                            {r.notas && <><strong>📝 Notas:</strong> {r.notas}<br /></>}
                            {r.email && r.email !== 'bloqueo@funcity.com.ar' && (
                              <><strong>📧 Email:</strong> {r.email}<br /></>
                            )}
                            {r.telefono && <><strong>📱 Teléfono:</strong> {r.telefono}<br /></>}
                            <strong>🔖 Bookly:</strong> <code>BLOQUEO - Cumple {r.nombre_ninio}</code>
                          </Col>
                        </Row>
                      </Alert>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </Table>
      </div>

      <Alert variant="light" className="mt-3 border mb-0">
        <small>
          <strong>💡 Info:</strong>
          <ul className="mb-0 mt-1">
            <li>El <strong>ID de Bloqueo</strong> es el identificador único en Bookly</li>
            <li>Las reservas aparecen en Bookly como <code>BLOQUEO - Cumple [nombre]</code></li>
            <li>Hacé clic en ▼ para ver los detalles completos de cada reserva</li>
          </ul>
        </small>
      </Alert>
    </div>
  );
};

export default HistorialReservas;