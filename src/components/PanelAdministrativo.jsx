import { useState, useEffect, useCallback } from 'react';
import {
  Card, Alert, Button, Badge, Row, Col, Form, Spinner,
  Modal, Nav, Table, ProgressBar
} from 'react-bootstrap';
import {
  verificarEstadoAPI,
  obtenerTodasLasReservas,
  esFinDeSemana,
  PRECIO_SEMANA,
  PRECIO_FIN_SEMANA,
  HORARIOS_DISPONIBLES,
  API_BASE_URL,
  API_KEY,
} from '../services/api';

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────
const fmtFecha = (f) => {
  if (!f) return '—';
  return new Date(f + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const hoy = () => new Date().toISOString().split('T')[0];
const hace = (meses) => {
  const d = new Date(); d.setMonth(d.getMonth() - meses);
  return d.toISOString().split('T')[0];
};
const dentro = (meses) => {
  const d = new Date(); d.setMonth(d.getMonth() + meses);
  return d.toISOString().split('T')[0];
};

// ─────────────────────────────────────────────────────────────
//  Sección: Estado de la API
// ─────────────────────────────────────────────────────────────
const SeccionEstadoAPI = () => {
  const [estado, setEstado]       = useState(null);
  const [cargando, setCargando]   = useState(false);
  const [ultimaVez, setUltimaVez] = useState(null);

  const verificar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await verificarEstadoAPI();
      setEstado(res);
      setUltimaVez(new Date());
    } catch (err) {
      setEstado({ error: err.message });
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { verificar(); }, [verificar]);

  return (
    <Card className="mb-4 border-0 shadow-sm">
      <Card.Header className="bg-white border-bottom d-flex justify-content-between align-items-center">
        <h6 className="mb-0 fw-bold">🔌 Estado de la API</h6>
        <div className="d-flex align-items-center gap-2">
          {ultimaVez && <small className="text-muted">Última verificación: {ultimaVez.toLocaleTimeString('es-AR')}</small>}
          <Button size="sm" variant="outline-secondary" onClick={verificar} disabled={cargando}>
            {cargando ? <Spinner animation="border" size="sm" /> : '🔄 Verificar'}
          </Button>
        </div>
      </Card.Header>
      <Card.Body>
        {estado?.error && (
          <Alert variant="danger" className="py-2">
            <small>❌ Error al verificar: {estado.error}</small>
          </Alert>
        )}

        {/* Info de conexión */}
        <Row className="mb-3 g-2">
          <Col xs={12}>
            <div className="p-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div className="d-flex align-items-center gap-2 mb-1">
                <Badge bg="secondary" style={{ fontSize: '0.65rem' }}>BASE URL</Badge>
                <code style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>{API_BASE_URL}</code>
              </div>
              <div className="d-flex align-items-center gap-2">
                <Badge bg="secondary" style={{ fontSize: '0.65rem' }}>API KEY</Badge>
                <code style={{ fontSize: '0.8rem' }}>{API_KEY.slice(0, 12)}•••</code>
              </div>
            </div>
          </Col>
        </Row>

        {estado?.endpoints ? (
          <Table bordered size="sm" className="mb-0">
            <thead className="table-light">
              <tr>
                <th>Endpoint</th>
                <th>Método</th>
                <th>Estado HTTP</th>
                <th>Tiempo</th>
                <th>Disponible</th>
              </tr>
            </thead>
            <tbody>
              {estado.endpoints.map((ep, i) => (
                <tr key={i}>
                  <td><code style={{ fontSize: '0.78rem' }}>{ep.nombre}</code></td>
                  <td><Badge bg="secondary" style={{ fontSize: '0.65rem' }}>{ep.metodo}</Badge></td>
                  <td>
                    <Badge bg={ep.status >= 200 && ep.status < 500 ? 'success' : ep.status === 0 ? 'danger' : 'warning'}
                      style={{ fontSize: '0.65rem' }}>
                      {ep.status || 'N/A'}
                    </Badge>
                  </td>
                  <td><small className="text-muted">{ep.tiempo}</small></td>
                  <td>
                    {ep.disponible
                      ? <Badge bg="success" style={{ fontSize: '0.65rem' }}>✓ Online</Badge>
                      : <Badge bg="danger"  style={{ fontSize: '0.65rem' }}>✗ Offline</Badge>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : cargando ? (
          <div className="text-center py-3"><Spinner animation="border" variant="secondary" /></div>
        ) : null}

        {estado?.resumen && (
          <div className="mt-3">
            <ProgressBar
              now={(estado.resumen.disponibles / estado.resumen.total) * 100}
              label={`${estado.resumen.disponibles}/${estado.resumen.total} endpoints online`}
              variant={estado.resumen.disponibles === estado.resumen.total ? 'success' : 'warning'}
            />
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────
//  Sección: Precios y Horarios (configuración visual — display)
//  Nota: los valores reales se editan en el plugin WordPress/Bookly.
//  Acá se muestran los valores activos definidos en api.js y se
//  permite ver/comparar. Un campo de "precio de referencia" se
//  podría enviar al backend si el endpoint lo soporta.
// ─────────────────────────────────────────────────────────────
const SeccionPreciosHorarios = () => {
  const [editando, setEditando]     = useState(false);
  const [guardando, setGuardando]   = useState(false);
  const [mensaje, setMensaje]       = useState('');
  const [precios, setPrecios]       = useState({
    semana:      PRECIO_SEMANA.replace(/[^0-9]/g, ''),
    finDeSemana: PRECIO_FIN_SEMANA.replace(/[^0-9]/g, ''),
    capacidadMax: 40,
    anticipacionMeses: 6,
  });
  const [preciosBorrador, setPreciosBorrador] = useState({ ...precios });

  const iniciarEdicion = () => {
    setPreciosBorrador({ ...precios });
    setEditando(true);
    setMensaje('');
  };

  const cancelarEdicion = () => {
    setEditando(false);
    setPreciosBorrador({ ...precios });
    setMensaje('');
  };

  const guardarPrecios = async () => {
    setGuardando(true);
    setMensaje('');
    try {
      // Enviar configuración al backend
      const res = await fetch(`${API_BASE_URL}/configuracion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: API_KEY,
          precio_semana:        parseInt(preciosBorrador.semana),
          precio_fin_de_semana: parseInt(preciosBorrador.finDeSemana),
          capacidad_maxima:     parseInt(preciosBorrador.capacidadMax),
          anticipacion_meses:   parseInt(preciosBorrador.anticipacionMeses),
        }),
      });
      const data = await res.json();

      if (res.ok || res.status === 404) {
        // 404 = endpoint no implementado aún → igual guardamos el valor visual
        setPrecios({ ...preciosBorrador });
        setEditando(false);
        setMensaje(res.ok
          ? '✅ Configuración actualizada en el servidor.'
          : '⚠️ Endpoint no disponible en Bookly, los cambios solo aplican a esta sesión.');
      } else {
        throw new Error(data.message || `Error ${res.status}`);
      }
    } catch (err) {
      setMensaje(`❌ ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const formatearPrecio = (val) =>
    new Intl.NumberFormat('es-AR').format(val);

  return (
    <Card className="mb-4 border-0 shadow-sm">
      <Card.Header className="bg-white border-bottom d-flex justify-content-between align-items-center">
        <h6 className="mb-0 fw-bold">💰 Precios y Configuración de Reservas</h6>
        {!editando
          ? <Button size="sm" variant="outline-primary" onClick={iniciarEdicion}>✏️ Editar</Button>
          : <div className="d-flex gap-2">
              <Button size="sm" variant="outline-secondary" onClick={cancelarEdicion} disabled={guardando}>Cancelar</Button>
              <Button size="sm" variant="success" onClick={guardarPrecios} disabled={guardando}>
                {guardando ? <Spinner animation="border" size="sm" /> : '💾 Guardar'}
              </Button>
            </div>
        }
      </Card.Header>
      <Card.Body>
        {mensaje && (
          <Alert
            variant={mensaje.startsWith('✅') ? 'success' : mensaje.startsWith('⚠️') ? 'warning' : 'danger'}
            className="py-2 mb-3" dismissible onClose={() => setMensaje('')}>
            <small>{mensaje}</small>
          </Alert>
        )}

        <Row className="g-3">
          {/* Precio semana */}
          <Col md={6}>
            <Card style={{ border: '1.5px solid #e0f2fe', background: '#f0f9ff' }}>
              <Card.Body className="py-3">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span style={{ fontSize: '1.3rem' }}>📅</span>
                  <div>
                    <div className="fw-bold" style={{ fontSize: '0.85rem' }}>Entre Semana</div>
                    <small className="text-muted">Lunes a Viernes</small>
                  </div>
                </div>
                {editando ? (
                  <Form.Group>
                    <Form.Label style={{ fontSize: '0.8rem' }}>Precio por sesión ($)</Form.Label>
                    <Form.Control
                      type="number"
                      value={preciosBorrador.semana}
                      onChange={e => setPreciosBorrador(p => ({ ...p, semana: e.target.value }))}
                      size="sm"
                    />
                  </Form.Group>
                ) : (
                  <div className="text-success fw-bold" style={{ fontSize: '1.4rem' }}>
                    ${formatearPrecio(precios.semana)}
                  </div>
                )}
                <div className="mt-2">
                  <small className="text-muted">Horarios: </small>
                  {HORARIOS_DISPONIBLES.semana.map(h => (
                    <Badge key={h} bg="light" text="dark" className="me-1" style={{ fontSize: '0.7rem' }}>{h}</Badge>
                  ))}
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* Precio fin de semana */}
          <Col md={6}>
            <Card style={{ border: '1.5px solid #ede9fe', background: '#f5f3ff' }}>
              <Card.Body className="py-3">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span style={{ fontSize: '1.3rem' }}>🎉</span>
                  <div>
                    <div className="fw-bold" style={{ fontSize: '0.85rem' }}>Fin de Semana</div>
                    <small className="text-muted">Sábado y Domingo</small>
                  </div>
                </div>
                {editando ? (
                  <Form.Group>
                    <Form.Label style={{ fontSize: '0.8rem' }}>Precio por sesión ($)</Form.Label>
                    <Form.Control
                      type="number"
                      value={preciosBorrador.finDeSemana}
                      onChange={e => setPreciosBorrador(p => ({ ...p, finDeSemana: e.target.value }))}
                      size="sm"
                    />
                  </Form.Group>
                ) : (
                  <div className="text-purple fw-bold" style={{ fontSize: '1.4rem', color: '#7c3aed' }}>
                    ${formatearPrecio(precios.finDeSemana)}
                  </div>
                )}
                <div className="mt-2">
                  <small className="text-muted">Horarios: </small>
                  {HORARIOS_DISPONIBLES.finDeSemana.map(h => (
                    <Badge key={h} bg="light" text="dark" className="me-1" style={{ fontSize: '0.7rem' }}>{h}</Badge>
                  ))}
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* Capacidad y anticipación */}
          <Col md={6}>
            <Card style={{ border: '1.5px solid #fef9c3', background: '#fefce8' }}>
              <Card.Body className="py-3">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span style={{ fontSize: '1.3rem' }}>👥</span>
                  <div className="fw-bold" style={{ fontSize: '0.85rem' }}>Capacidad Máxima</div>
                </div>
                {editando ? (
                  <Form.Control type="number" size="sm"
                    value={preciosBorrador.capacidadMax}
                    onChange={e => setPreciosBorrador(p => ({ ...p, capacidadMax: e.target.value }))}
                  />
                ) : (
                  <div className="fw-bold text-warning" style={{ fontSize: '1.4rem' }}>
                    {precios.capacidadMax} personas
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col md={6}>
            <Card style={{ border: '1.5px solid #dcfce7', background: '#f0fdf4' }}>
              <Card.Body className="py-3">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span style={{ fontSize: '1.3rem' }}>📆</span>
                  <div className="fw-bold" style={{ fontSize: '0.85rem' }}>Anticipación Máx.</div>
                </div>
                {editando ? (
                  <Form.Control type="number" size="sm"
                    value={preciosBorrador.anticipacionMeses}
                    onChange={e => setPreciosBorrador(p => ({ ...p, anticipacionMeses: e.target.value }))}
                  />
                ) : (
                  <div className="fw-bold text-success" style={{ fontSize: '1.4rem' }}>
                    {precios.anticipacionMeses} meses
                  </div>
                )}
                <small className="text-muted">Antes de la fecha del evento</small>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Alert variant="info" className="mt-3 py-2 mb-0">
          <small>
            <strong>📌 Nota:</strong> Los precios y horarios definitivos se configuran en el plugin Bookly de WordPress.
            Los valores aquí son de referencia para el panel y se envían al backend si el endpoint lo soporta.
          </small>
        </Alert>
      </Card.Body>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────
//  Sección: Estadísticas — datos 100% desde la API
// ─────────────────────────────────────────────────────────────
const SeccionEstadisticas = () => {
  const [reservas, setReservas]         = useState([]);
  const [cargando, setCargando]         = useState(false);
  const [error, setError]               = useState('');
  const [ultimaAct, setUltimaAct]       = useState(null);
  const [rango, setRango]               = useState({ inicio: hace(1), fin: dentro(3) });

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const res = await obtenerTodasLasReservas({
        fechaInicio: rango.inicio,
        fechaFin:    rango.fin,
        usarCache:   false, // siempre datos frescos de la API
      });
      setReservas(res.reservas || []);
      setUltimaAct(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [rango]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Calcular stats ────────────────────────────────────────
  const totalPersonas      = reservas.reduce((s, r) => s + (parseInt(r.personas) || 0), 0);
  const reservasFDS        = reservas.filter(r => r.fecha && esFinDeSemana(r.fecha));
  const reservasSemana     = reservas.filter(r => r.fecha && !esFinDeSemana(r.fecha));
  const conEmail           = reservas.filter(r => r.email && r.email !== 'bloqueo@funcity.com.ar');
  const conTelefono        = reservas.filter(r => r.telefono);
  const ingresoEstimado    = reservasFDS.length * parseInt(PRECIO_FIN_SEMANA.replace(/[^0-9]/g,''))
                           + reservasSemana.length * parseInt(PRECIO_SEMANA.replace(/[^0-9]/g,''));

  // Top temas
  const temasCount = {};
  reservas.forEach(r => { if (r.tema) temasCount[r.tema] = (temasCount[r.tema] || 0) + 1; });
  const topTemas   = Object.entries(temasCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Distribución por mes
  const porMes = {};
  reservas.forEach(r => {
    if (!r.fecha) return;
    const mes = r.fecha.slice(0, 7);
    porMes[mes] = (porMes[mes] || 0) + 1;
  });
  const mesesOrden = Object.keys(porMes).sort();

  // Próximas reservas (futuras)
  const futuras = reservas
    .filter(r => r.fecha >= hoy())
    .sort((a, b) => (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio))
    .slice(0, 10);

  const kpiCard = (emoji, titulo, valor, sub, color = '#3b82f6') => (
    <Card className="border-0" style={{ background: '#f8fafc', border: '1px solid #e2e8f0 !important' }}>
      <Card.Body className="py-3 text-center">
        <div style={{ fontSize: '1.6rem' }}>{emoji}</div>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, color }}>{valor}</div>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>{titulo}</div>
        {sub && <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{sub}</div>}
      </Card.Body>
    </Card>
  );

  return (
    <Card className="mb-4 border-0 shadow-sm">
      <Card.Header className="bg-white border-bottom">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h6 className="mb-0 fw-bold">📊 Estadísticas en Tiempo Real</h6>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <Form.Group className="d-flex align-items-center gap-1 mb-0">
              <Form.Label className="mb-0" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Desde:</Form.Label>
              <Form.Control type="date" size="sm" value={rango.inicio}
                onChange={e => setRango(r => ({ ...r, inicio: e.target.value }))}
                style={{ width: 140 }}
              />
            </Form.Group>
            <Form.Group className="d-flex align-items-center gap-1 mb-0">
              <Form.Label className="mb-0" style={{ fontSize: '0.8rem' }}>Hasta:</Form.Label>
              <Form.Control type="date" size="sm" value={rango.fin}
                onChange={e => setRango(r => ({ ...r, fin: e.target.value }))}
                style={{ width: 140 }}
              />
            </Form.Group>
            <Button size="sm" variant="outline-primary" onClick={cargar} disabled={cargando}>
              {cargando ? <Spinner animation="border" size="sm" /> : '🔄'}
            </Button>
          </div>
        </div>
        {ultimaAct && (
          <small className="text-muted" style={{ fontSize: '0.72rem' }}>
            Datos cargados desde la API · {ultimaAct.toLocaleString('es-AR')}
          </small>
        )}
      </Card.Header>
      <Card.Body>
        {error && <Alert variant="danger" className="py-2"><small>❌ {error}</small></Alert>}

        {cargando ? (
          <div className="text-center py-4"><Spinner animation="border" variant="primary" /></div>
        ) : (
          <>
            {/* KPIs */}
            <Row className="g-2 mb-4">
              <Col xs={6} md={4} lg={2}>
                {kpiCard('🎂', 'Total Reservas', reservas.length, `${rango.inicio} → ${rango.fin}`, '#3b82f6')}
              </Col>
              <Col xs={6} md={4} lg={2}>
                {kpiCard('👥', 'Personas', totalPersonas, `Prom. ${reservas.length ? Math.round(totalPersonas/reservas.length) : 0}/evento`, '#8b5cf6')}
              </Col>
              <Col xs={6} md={4} lg={2}>
                {kpiCard('🎉', 'Fin de Semana', reservasFDS.length, `${reservasSemana.length} entre semana`, '#ec4899')}
              </Col>
              <Col xs={6} md={4} lg={2}>
                {kpiCard('📧', 'Con Email', conEmail.length, `${conTelefono.length} con tel.`, '#10b981')}
              </Col>
              <Col xs={6} md={4} lg={2}>
                {kpiCard('📅', 'Próximas', futuras.length, 'desde hoy', '#f59e0b')}
              </Col>
              <Col xs={6} md={4} lg={2}>
                {kpiCard('💰', 'Ingreso Est.', `$${new Intl.NumberFormat('es-AR').format(ingresoEstimado)}`, 'según precios configurados', '#22c55e')}
              </Col>
            </Row>

            <Row className="g-3 mb-4">
              {/* Distribución por mes */}
              <Col md={6}>
                <Card className="border-0" style={{ background: '#f8fafc' }}>
                  <Card.Body>
                    <h6 className="fw-semibold mb-3" style={{ fontSize: '0.88rem' }}>📈 Reservas por Mes</h6>
                    {mesesOrden.length === 0 ? (
                      <p className="text-muted small mb-0">Sin datos en el rango seleccionado</p>
                    ) : mesesOrden.map(mes => {
                      const cant     = porMes[mes];
                      const pct      = Math.round((cant / reservas.length) * 100);
                      const [y, m]   = mes.split('-');
                      const nombreMes = new Date(parseInt(y), parseInt(m) - 1, 1)
                        .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
                      return (
                        <div key={mes} className="mb-2">
                          <div className="d-flex justify-content-between mb-1">
                            <small className="text-capitalize">{nombreMes}</small>
                            <small className="fw-semibold">{cant}</small>
                          </div>
                          <ProgressBar now={pct} label={`${pct}%`} variant="primary" style={{ height: 8, borderRadius: 4 }} />
                        </div>
                      );
                    })}
                  </Card.Body>
                </Card>
              </Col>

              {/* Top temas */}
              <Col md={6}>
                <Card className="border-0" style={{ background: '#f8fafc' }}>
                  <Card.Body>
                    <h6 className="fw-semibold mb-3" style={{ fontSize: '0.88rem' }}>🎨 Top Temas de Cumpleaños</h6>
                    {topTemas.length === 0 ? (
                      <p className="text-muted small mb-0">Sin temas registrados</p>
                    ) : topTemas.map(([tema, cant], i) => (
                      <div key={tema} className="d-flex justify-content-between align-items-center mb-2">
                        <div className="d-flex align-items-center gap-2">
                          <Badge bg="secondary" style={{ fontSize: '0.65rem', minWidth: 20 }}>{i + 1}</Badge>
                          <small>{tema}</small>
                        </div>
                        <Badge bg="primary" style={{ fontSize: '0.7rem' }}>{cant}</Badge>
                      </div>
                    ))}
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Próximas reservas */}
            <Card className="border-0" style={{ background: '#f8fafc' }}>
              <Card.Body>
                <h6 className="fw-semibold mb-3" style={{ fontSize: '0.88rem' }}>
                  📅 Próximas Reservas ({futuras.length})
                </h6>
                {futuras.length === 0 ? (
                  <p className="text-muted small mb-0">No hay reservas futuras en el rango</p>
                ) : (
                  <div className="table-responsive">
                    <Table size="sm" className="mb-0" style={{ fontSize: '0.8rem' }}>
                      <thead className="table-light">
                        <tr>
                          <th>ID</th>
                          <th>Festejado/a</th>
                          <th>Fecha</th>
                          <th>Hora</th>
                          <th>Personas</th>
                          <th>Tema</th>
                          <th>Precio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {futuras.map((r, i) => {
                          const fds    = r.fecha && esFinDeSemana(r.fecha);
                          const precio = fds ? PRECIO_FIN_SEMANA : PRECIO_SEMANA;
                          return (
                            <tr key={r.bloqueo_id || i}>
                              <td><code style={{ fontSize: '0.72rem' }}>#{r.bloqueo_id}</code></td>
                              <td className="fw-semibold">{r.nombre_ninio}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                {fmtFecha(r.fecha)}
                                {' '}
                                <Badge bg={fds ? 'primary' : 'secondary'} style={{ fontSize: '0.55rem' }}>
                                  {fds ? 'FDS' : 'Sem'}
                                </Badge>
                              </td>
                              <td><Badge bg="info" style={{ fontSize: '0.65rem' }}>{r.hora_inicio}</Badge></td>
                              <td className="text-center">{r.personas}</td>
                              <td style={{ maxWidth: 120 }}>
                                <span className="text-truncate d-block">{r.tema || '—'}</span>
                              </td>
                              <td className="text-success fw-semibold" style={{ whiteSpace: 'nowrap' }}>
                                {precio}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card.Body>
            </Card>
          </>
        )}
      </Card.Body>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────
//  Sección: Herramientas de diagnóstico
// ─────────────────────────────────────────────────────────────
const SeccionHerramientas = () => {
  const [testandoFecha, setTestandoFecha]   = useState('');
  const [testandoHora, setTestandoHora]     = useState('');
  const [testResult, setTestResult]         = useState(null);
  const [testCargando, setTestCargando]     = useState(false);

  const probarEndpoint = async () => {
    if (!testandoFecha || !testandoHora) return;
    setTestCargando(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/bloquear-pase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key:     API_KEY,
          fecha:       testandoFecha,
          hora_inicio: testandoHora,
          personas:    1,
          modo:        'consultar',
        }),
      });
      const data = await res.json();
      setTestResult({ status: res.status, ok: res.ok, data });
    } catch (err) {
      setTestResult({ status: 0, ok: false, data: { message: err.message } });
    } finally {
      setTestCargando(false);
    }
  };

  return (
    <Card className="mb-4 border-0 shadow-sm">
      <Card.Header className="bg-white border-bottom">
        <h6 className="mb-0 fw-bold">🔧 Herramientas de Diagnóstico</h6>
      </Card.Header>
      <Card.Body>
        <Row className="g-3">
          {/* Test de disponibilidad */}
          <Col md={6}>
            <Card style={{ border: '1.5px solid #e2e8f0' }}>
              <Card.Body>
                <h6 style={{ fontSize: '0.88rem' }} className="fw-bold mb-3">🔍 Test Consulta Disponibilidad</h6>
                <Form.Group className="mb-2">
                  <Form.Label style={{ fontSize: '0.8rem' }}>Fecha</Form.Label>
                  <Form.Control type="date" size="sm" value={testandoFecha}
                    onChange={e => { setTestandoFecha(e.target.value); setTestResult(null); }}
                    min={hoy()}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontSize: '0.8rem' }}>Hora</Form.Label>
                  <Form.Select size="sm" value={testandoHora}
                    onChange={e => { setTestandoHora(e.target.value); setTestResult(null); }}>
                    <option value="">— Elegí un horario —</option>
                    <optgroup label="Entre semana">
                      {HORARIOS_DISPONIBLES.semana.map(h => <option key={h} value={h}>{h}</option>)}
                    </optgroup>
                    <optgroup label="Fin de semana">
                      {HORARIOS_DISPONIBLES.finDeSemana.map(h => <option key={h} value={h}>{h}</option>)}
                    </optgroup>
                  </Form.Select>
                </Form.Group>
                <Button size="sm" variant="primary" onClick={probarEndpoint}
                  disabled={testCargando || !testandoFecha || !testandoHora}>
                  {testCargando ? <Spinner animation="border" size="sm" /> : '🔍 Probar'}
                </Button>

                {testResult && (
                  <Alert
                    variant={testResult.ok ? 'success' : 'danger'}
                    className="mt-3 py-2 mb-0">
                    <div className="d-flex justify-content-between mb-1">
                      <Badge bg={testResult.ok ? 'success' : 'danger'}>HTTP {testResult.status}</Badge>
                      {testResult.data?.disponible === true  && <Badge bg="success">✓ Disponible</Badge>}
                      {testResult.data?.disponible === false && <Badge bg="danger">✗ Ocupado</Badge>}
                    </div>
                    <pre style={{ fontSize: '0.7rem', margin: 0, maxHeight: 150, overflow: 'auto' }}>
                      {JSON.stringify(testResult.data, null, 2)}
                    </pre>
                  </Alert>
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* Info del sistema */}
          <Col md={6}>
            <Card style={{ border: '1.5px solid #e2e8f0' }}>
              <Card.Body>
                <h6 style={{ fontSize: '0.88rem' }} className="fw-bold mb-3">ℹ️ Info del Sistema</h6>
                <Table size="sm" className="mb-0" borderless>
                  <tbody style={{ fontSize: '0.78rem' }}>
                    <tr>
                      <td className="text-muted">Versión</td>
                      <td><Badge bg="secondary">v2.0.0</Badge></td>
                    </tr>
                    <tr>
                      <td className="text-muted">Entorno</td>
                      <td><Badge bg="warning" text="dark">Test</Badge></td>
                    </tr>
                    <tr>
                      <td className="text-muted">API Base</td>
                      <td><code style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}>{API_BASE_URL}</code></td>
                    </tr>
                    <tr>
                      <td className="text-muted">Autenticación</td>
                      <td><Badge bg="success">API Key</Badge></td>
                    </tr>
                    <tr>
                      <td className="text-muted">Feriados cargados</td>
                      <td><Badge bg="info">2025–2026</Badge></td>
                    </tr>
                    <tr>
                      <td className="text-muted">Capacidad Máx.</td>
                      <td>40 personas</td>
                    </tr>
                    <tr>
                      <td className="text-muted">Horarios Semana</td>
                      <td>{HORARIOS_DISPONIBLES.semana.join(', ')}</td>
                    </tr>
                    <tr>
                      <td className="text-muted">Horarios FDS</td>
                      <td>{HORARIOS_DISPONIBLES.finDeSemana.join(', ')}</td>
                    </tr>
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────
//  COMPONENTE PRINCIPAL: PanelAdministrativo
// ─────────────────────────────────────────────────────────────
const PanelAdministrativo = () => {
  const [tab, setTab] = useState('estadisticas');

  const tabs = [
    { id: 'estadisticas', label: '📊 Estadísticas'  },
    { id: 'precios',      label: '💰 Precios'        },
    { id: 'api',          label: '🔌 Estado API'     },
    { id: 'herramientas', label: '🔧 Herramientas'   },
  ];

  return (
    <div>
      {/* Header del panel */}
      <Alert variant="light" className="border mb-4 py-2">
        <div className="d-flex align-items-center gap-2">
          <span style={{ fontSize: '1.2rem' }}>⚙️</span>
          <div>
            <strong>Panel Administrativo</strong>
            <span className="text-muted ms-2" style={{ fontSize: '0.82rem' }}>
              Configuración, estadísticas y diagnóstico — toda la información se obtiene en tiempo real desde la API
            </span>
          </div>
          <Badge bg="success" className="ms-auto">En línea</Badge>
        </div>
      </Alert>

      {/* Tabs */}
      <Nav variant="tabs" className="mb-4" activeKey={tab} onSelect={setTab}>
        {tabs.map(t => (
          <Nav.Item key={t.id}>
            <Nav.Link eventKey={t.id} style={{ fontSize: '0.85rem' }}>
              {t.label}
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>

      {/* Contenido */}
      {tab === 'estadisticas' && <SeccionEstadisticas />}
      {tab === 'precios'      && <SeccionPreciosHorarios />}
      {tab === 'api'          && <SeccionEstadoAPI />}
      {tab === 'herramientas' && <SeccionHerramientas />}
    </div>
  );
};

export default PanelAdministrativo;