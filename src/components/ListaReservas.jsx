import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Badge, Alert, Form, InputGroup,
  Row, Col, Card, Modal, Spinner, Nav, OverlayTrigger, Tooltip,
  Pagination
} from 'react-bootstrap';
import {
  eliminarBloqueo,
  obtenerTodasLasReservas,
  esFinDeSemana,
  PRECIO_SEMANA,
  PRECIO_FIN_SEMANA
} from '../services/api';
import { useUserRole } from '../hooks/UseUserRole';

// ─────────────────────────────────────────────────────────────
//  ListaReservas con PAGINACIÓN
// ─────────────────────────────────────────────────────────────
const ListaReservas = ({ reservas = [], onEditar, onActualizar, onIrAHistorial }) => {
  const [fuente, setFuente]             = useState('api');
  const [reservasAPI, setReservasAPI]   = useState([]);
  const [cargando, setCargando]         = useState(false);
  const [errorAPI, setErrorAPI]         = useState('');
  const [ultimaAct, setUltimaAct]       = useState(null);
  const [fromCache, setFromCache]       = useState(false);

  const [busqueda, setBusqueda]         = useState('');
  const [filtroFecha, setFiltroFecha]   = useState('');
  const [filtroMes, setFiltroMes]       = useState('');

  const [ordenCampo, setOrdenCampo]     = useState('fecha');
  const [ordenDir, setOrdenDir]         = useState('asc');

  // --- Paginación ---
  const [paginaActual, setPaginaActual] = useState(1);
  const [porPagina, setPorPagina]       = useState(20); // opciones: 10, 25, 50

  const [confirmarId, setConfirmarId]   = useState(null);
  const [eliminando, setEliminando]     = useState(null);
  const [mensajeOk, setMensajeOk]       = useState('');
  const [mensajeErr, setMensajeErr]     = useState('');
  const [expandido, setExpandido]       = useState(null);

  // Ticket
  const [ticketReserva, setTicketReserva] = useState(null);
  const [mostrarTicket, setMostrarTicket] = useState(false);

// Roles
  const { canDelete, isAdmin } = useUserRole();
  
  // ─── Cargar desde API ───────────────────────────────────────
  const cargarDesdeAPI = useCallback(async (forzar = false) => {
    setCargando(true);
    setErrorAPI('');
    try {
      const res = await obtenerTodasLasReservas({ usarCache: !forzar });
      setReservasAPI(res.reservas || []);
      setFromCache(res.fromCache || false);
      setUltimaAct(new Date());
    } catch (err) {
      setErrorAPI(err.message || 'Error al conectar con Bookly');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (fuente === 'api') cargarDesdeAPI(false);
  }, [fuente, cargarDesdeAPI]);

  // ─── Dataset activo ─────────────────────────────────────────
  const data = fuente === 'api' ? reservasAPI : reservas;

  // ─── Filtrado + orden ────────────────────────────────────────
  const filtradas = data
    .filter(r => {
      const q = busqueda.toLowerCase().trim();
      const ok =
        !q ||
        (r.nombre_ninio || '').toLowerCase().includes(q) ||
        (r.tema         || '').toLowerCase().includes(q) ||
        (r.email        || '').toLowerCase().includes(q) ||
        (r.telefono     || '').includes(q) ||
        String(r.bloqueo_id || '').includes(q);
      const okFecha = !filtroFecha || r.fecha === filtroFecha;
      const okMes   = !filtroMes   || (r.fecha || '').startsWith(filtroMes);
      return ok && okFecha && okMes;
    })
    .sort((a, b) => {
      let va = a[ordenCampo] || '';
      let vb = b[ordenCampo] || '';
      if (ordenCampo === 'personas') { va = parseInt(va)||0; vb = parseInt(vb)||0; }
      if (va < vb) return ordenDir === 'asc' ? -1 :  1;
      if (va > vb) return ordenDir === 'asc' ?  1 : -1;
      return 0;
    });

  // Resetear página cuando cambian filtros o dataset
  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, filtroFecha, filtroMes, fuente, data.length]);

  // ─── Paginación ─────────────────────────────────────────────
  const totalPaginas = Math.ceil(filtradas.length / porPagina);
  const inicio = (paginaActual - 1) * porPagina;
  const fin = inicio + porPagina;
  const paginadas = filtradas.slice(inicio, fin);

  // ─── Orden ──────────────────────────────────────────────────
  const orden = (campo) => {
    if (ordenCampo === campo) setOrdenDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setOrdenCampo(campo); setOrdenDir('asc'); }
  };

  const iconOrden = (campo) =>
    ordenCampo !== campo
      ? <span style={{ opacity: 0.25, fontSize: '0.75rem' }}> ↕</span>
      : <span style={{ color: '#3b82f6', fontSize: '0.75rem' }}>{ordenDir === 'asc' ? ' ↑' : ' ↓'}</span>;

  // ─── Eliminar ────────────────────────────────────────────────
  const handleEliminar = async () => {
    const id = confirmarId;
    setConfirmarId(null);
    setEliminando(id);
    setMensajeErr('');
    try {
      await eliminarBloqueo(id);
      if (onActualizar) onActualizar(prev => prev.filter(r => r.bloqueo_id !== id));
      setReservasAPI(prev => prev.filter(r => r.bloqueo_id !== id));
      setMensajeOk(`✅ Reserva #${id} eliminada correctamente de Bookly`);
      setTimeout(() => setMensajeOk(''), 5000);
    } catch (err) {
      setMensajeErr(`❌ Error al eliminar #${id}: ${err.message}`);
    } finally {
      setEliminando(null);
    }
  };

  // ─── Ticket ─────────────────────────────────────────────────
  const abrirTicket = (reserva) => {
    setTicketReserva(reserva);
    setMostrarTicket(true);
  };

  const imprimirTicket = () => {
    if (!ticketReserva) return;
    const ventana = window.open('', '_blank');
    if (!ventana) {
      alert('Por favor permite ventanas emergentes para imprimir el ticket.');
      return;
    }
    const esFinDeSemanaReserva = esFinDeSemana(ticketReserva.fecha);
    const precioPorPersona = esFinDeSemanaReserva ? PRECIO_FIN_SEMANA : PRECIO_SEMANA;
    const total = parseInt(ticketReserva.personas || 0) *
      parseInt(precioPorPersona.replace(/[^0-9]/g, ''));

    ventana.document.write(`
      <html>
        <head>
          <title>Ticket #${ticketReserva.bloqueo_id || 'Nuevo'}</title>
          <style>
            body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 5px; }
            h2 { text-align: center; font-size: 16px; margin: 5px 0; }
            hr { border: 1px dashed #000; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 2px 0; }
            .total { font-weight: bold; font-size: 14px; }
            .centrado { text-align: center; }
          </style>
        </head>
        <body>
          <h2>TICKET DE CUMPLEAÑOS</h2>
          <p class="centrado">Fun City — Ticket de reserva</p>
          <hr>
          <table>
            <tr><td>N° Reserva:</td><td>${ticketReserva.bloqueo_id || '—'}</td></tr>
            <tr><td>Festejado/a:</td><td>${ticketReserva.nombre_ninio || '—'}</td></tr>
            ${(ticketReserva.nombre_cliente || ticketReserva.apellido_cliente)
              ? `<tr><td>Contacto:</td><td>${[ticketReserva.nombre_cliente, ticketReserva.apellido_cliente].filter(Boolean).join(' ')}</td></tr>`
              : ''}
            ${ticketReserva.telefono ? `<tr><td>Teléfono:</td><td>${ticketReserva.telefono}</td></tr>` : ''}
            <tr><td>Fecha:</td><td>${new Date(ticketReserva.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td></tr>
            <tr><td>Hora:</td><td>${ticketReserva.hora_inicio || '—'}</td></tr>
            <tr><td>Personas:</td><td>${ticketReserva.personas || '—'}</td></tr>
            <tr><td>Tema:</td><td>${ticketReserva.tema || '—'}</td></tr>
            <tr><td>Precio x persona:</td><td>${precioPorPersona}</td></tr>
            <tr><td class="total">TOTAL:</td><td class="total">$${total.toLocaleString()}</td></tr>
          </table>
          <hr>
          <p>Notas: ${ticketReserva.notas || '—'}</p>
          <p class="centrado">¡Gracias por elegirnos! 🎉</p>
          <script>window.print();window.close();</script>
        </body>
      </html>
    `);
    ventana.document.close();
  };

  // ─── Helpers ─────────────────────────────────────────────────
  const fmtFecha = (f) => {
    if (!f) return '—';
    try {
      return new Date(f + 'T00:00:00').toLocaleDateString('es-AR', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch { return f; }
  };

  const colorP = (p) => !p ? 'secondary' : p <= 15 ? 'success' : p <= 28 ? 'warning' : 'danger';

  const limpiarTelefono = (tel) => tel?.replace(/\D/g, '') || '';

  const limpiar = () => { setBusqueda(''); setFiltroFecha(''); setFiltroMes(''); };
  const hayFiltros = !!(busqueda || filtroFecha || filtroMes);

  const meses = [...new Set(data.map(r => (r.fecha||'').slice(0,7)).filter(Boolean))].sort();

  const totalP = filtradas.reduce((s,r) => s + (parseInt(r.personas)||0), 0);

  const reservaConfirmar = data.find(x => x.bloqueo_id === confirmarId);

  // ─── Renderizar paginación ───────────────────────────────────
  const renderPagination = () => {
    if (totalPaginas <= 1) return null;

    let items = [];
    const maxBotones = 20; // mostrar hasta 20 números
    let inicioPag = Math.max(1, paginaActual - Math.floor(maxBotones / 2));
    let finPag = Math.min(totalPaginas, inicioPag + maxBotones - 1);
    if (finPag - inicioPag + 1 < maxBotones) {
      inicioPag = Math.max(1, finPag - maxBotones + 1);
    }

    // Primera y anterior
    items.push(
      <Pagination.First key="first" onClick={() => setPaginaActual(1)} disabled={paginaActual === 1} />,
      <Pagination.Prev key="prev" onClick={() => setPaginaActual(p => Math.max(1, p-1))} disabled={paginaActual === 1} />
    );

    // Páginas
    for (let i = inicioPag; i <= finPag; i++) {
      items.push(
        <Pagination.Item key={i} active={i === paginaActual} onClick={() => setPaginaActual(i)}>
          {i}
        </Pagination.Item>
      );
    }

    // Siguiente y última
    items.push(
      <Pagination.Next key="next" onClick={() => setPaginaActual(p => Math.min(totalPaginas, p+1))} disabled={paginaActual === totalPaginas} />,
      <Pagination.Last key="last" onClick={() => setPaginaActual(totalPaginas)} disabled={paginaActual === totalPaginas} />
    );

    return <Pagination size="sm">{items}</Pagination>;
  };

  // ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Modales: eliminar y ticket (igual que antes) */}
      <Modal show={!!confirmarId} onHide={() => setConfirmarId(null)} centered size="sm">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title style={{ fontSize: '1rem' }}>⚠️ Confirmar eliminación</Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-2">
          {reservaConfirmar && (
            <p className="mb-3" style={{ fontSize: '0.9rem' }}>
              Vas a eliminar la reserva de <strong>{reservaConfirmar.nombre_ninio}</strong>{' '}
              — {fmtFecha(reservaConfirmar.fecha)} {reservaConfirmar.hora_inicio}.
            </p>
          )}
          <Alert variant="danger" className="py-2 mb-0" style={{ fontSize: '0.8rem' }}>
            Esta acción <strong>elimina el bloqueo en Bookly</strong> y no se puede deshacer.
          </Alert>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <Button variant="secondary" size="sm" onClick={() => setConfirmarId(null)}>Cancelar</Button>
          <Button variant="danger" size="sm" onClick={handleEliminar}>Sí, eliminar</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={mostrarTicket} onHide={() => setMostrarTicket(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>🧾 Ticket de reserva</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {ticketReserva && (
            <div className="ticket-preview p-3" style={{ fontFamily: 'monospace', background: '#f8f9fa' }}>
              <Row>
                <Col xs={6}><strong>N° Reserva:</strong> {ticketReserva.bloqueo_id || '—'}</Col>
                <Col xs={6}><strong>Festejado/a:</strong> {ticketReserva.nombre_ninio}</Col>
              </Row>
              {(ticketReserva.nombre_cliente || ticketReserva.apellido_cliente) && (
                <Row className="mt-2">
                  <Col xs={12}>
                    <strong>Contacto:</strong>{' '}
                    {[ticketReserva.nombre_cliente, ticketReserva.apellido_cliente].filter(Boolean).join(' ')}
                    {ticketReserva.telefono && <> · 📱 {ticketReserva.telefono}</>}
                  </Col>
                </Row>
              )}
              <Row className="mt-2">
                <Col xs={4}><strong>Fecha:</strong> {fmtFecha(ticketReserva.fecha)}</Col>
                <Col xs={4}><strong>Hora:</strong> {ticketReserva.hora_inicio}</Col>
                <Col xs={4}><strong>Personas:</strong> {ticketReserva.personas}</Col>
              </Row>
              <Row className="mt-2">
                <Col xs={6}><strong>Tema:</strong> {ticketReserva.tema || '—'}</Col>
                <Col xs={6}>
                  <strong>Precio x persona:</strong>{' '}
                  {esFinDeSemana(ticketReserva.fecha) ? PRECIO_FIN_SEMANA : PRECIO_SEMANA}
                </Col>
              </Row>
              <Row className="mt-2">
                <Col xs={12}>
                  <strong>Total:</strong> $
                  {(parseInt(ticketReserva.personas || 0) *
                    parseInt((esFinDeSemana(ticketReserva.fecha) ? PRECIO_FIN_SEMANA : PRECIO_SEMANA).replace(/[^0-9]/g, ''))
                   ).toLocaleString()}
                </Col>
              </Row>
              {ticketReserva.notas && (
                <Row className="mt-2">
                  <Col xs={12}><strong>Notas:</strong> {ticketReserva.notas}</Col>
                </Row>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setMostrarTicket(false)}>Cerrar</Button>
          <Button variant="primary" onClick={imprimirTicket}>🖨️ Imprimir</Button>
        </Modal.Footer>
      </Modal>

      {/* Alertas */}
      {mensajeOk  && <Alert variant="success" dismissible onClose={() => setMensajeOk('')} className="py-2">{mensajeOk}</Alert>}
      {mensajeErr && <Alert variant="danger"  dismissible onClose={() => setMensajeErr('')} className="py-2">{mensajeErr}</Alert>}

      {/* Tabs de fuente */}
      <div className="lr-tabs-bar">
        <div className="lr-tabs">
          {[
            { id: 'api',   label: 'Bookly (API)',  count: reservasAPI.length, dot: 'green'  },
            { id: 'local', label: 'Esta sesión',   count: reservas.length,    dot: 'blue'   },
          ].map(t => (
            <button
              key={t.id}
              className={`lr-tab ${fuente === t.id ? 'lr-tab--active' : ''}`}
              onClick={() => setFuente(t.id)}
            >
              <span className={`lr-tab-dot lr-tab-dot--${t.dot}`} />
              {t.label}
              {t.count > 0 && (
                <Badge
                  bg={fuente === t.id ? 'primary' : 'secondary'}
                  pill
                  style={{ fontSize: '0.62rem', marginLeft: 6 }}
                >
                  {t.count}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* Estado API */}
        {fuente === 'api' && (
          <div className="lr-api-status">
            {cargando ? (
              <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                <Spinner animation="border" size="sm" className="me-1" />Consultando Bookly...
              </span>
            ) : ultimaAct ? (
              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                Actualizado {ultimaAct.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                {fromCache && <Badge bg="light" text="dark" className="ms-1 border" style={{ fontSize: '0.6rem' }}>caché</Badge>}
              </span>
            ) : null}
            <OverlayTrigger placement="left" overlay={<Tooltip>Recargar desde Bookly</Tooltip>}>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => cargarDesdeAPI(true)}
                disabled={cargando}
                style={{ padding: '3px 10px', fontSize: '0.8rem' }}
              >
                {cargando ? <Spinner animation="border" size="sm" /> : '🔄 Actualizar'}
              </Button>
            </OverlayTrigger>
          </div>
        )}
      </div>

      {/* Info sesión local */}
      {fuente === 'local' && (
        <Alert variant="info" className="py-2 mb-3" style={{ fontSize: '0.82rem' }}>
          ℹ️ Solo se muestran reservas creadas <strong>en esta sesión</strong>.
          Cambiá a <strong>Bookly (API)</strong> para ver todas las reservas registradas.
        </Alert>
      )}

      {/* Cargando primera vez */}
      {cargando && reservasAPI.length === 0 && fuente === 'api' && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="text-muted mt-3 mb-0">Cargando reservas desde Bookly...</p>
        </div>
      )}

      {/* Error */}
      {!cargando && errorAPI && data.length === 0 && (
        <Alert variant="danger" className="text-center py-4">
          <div style={{ fontSize: '2rem' }}>⚠️</div>
          <p className="mb-2 mt-1" style={{ fontSize: '0.9rem' }}>{errorAPI}</p>
          <Button variant="outline-danger" size="sm" onClick={() => cargarDesdeAPI(true)}>
            Reintentar
          </Button>
        </Alert>
      )}

      {/* Contenido principal */}
      {(!cargando || data.length > 0) && !errorAPI && (
        <>
          {/* Stats (igual que antes) */}
          {data.length > 0 && (
            <Row className="mb-3 g-2">
              {[
                { label: fuente === 'api' ? 'En Bookly' : 'En sesión', value: data.length,        color: 'primary'   },
                { label: 'Mostrando',                                   value: filtradas.length,   color: 'secondary' },
                { label: 'Total personas',                              value: totalP,             color: 'info'      },
                { label: 'Con contacto', value: filtradas.filter(r =>
                  (r.email && r.email !== 'bloqueo@funcity.com.ar') || r.telefono).length,         color: 'success'   },
              ].map(s => (
                <Col xs={6} md={3} key={s.label}>
                  <Card className={`text-center border-${s.color} bg-${s.color} bg-opacity-10`}>
                    <Card.Body className="py-2 px-1">
                      <div className={`fs-4 fw-bold text-${s.color}`}>{s.value}</div>
                      <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{s.label}</div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )}

          {/* Filtros (igual) */}
          <Row className="g-2 mb-3">
            <Col md={4}>
              <InputGroup size="sm">
                <InputGroup.Text className="bg-white border-end-0">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                </InputGroup.Text>
                <Form.Control
                  className="border-start-0"
                  placeholder="Nombre, tema, email o ID..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                />
                {busqueda && <Button variant="outline-secondary" onClick={() => setBusqueda('')} tabIndex={-1}>✕</Button>}
              </InputGroup>
            </Col>
            <Col md={3}>
              <InputGroup size="sm">
                <InputGroup.Text className="bg-white">📅</InputGroup.Text>
                <Form.Control
                  type="date"
                  value={filtroFecha}
                  onChange={e => { setFiltroFecha(e.target.value); setFiltroMes(''); }}
                />
                {filtroFecha && <Button variant="outline-secondary" onClick={() => setFiltroFecha('')} tabIndex={-1}>✕</Button>}
              </InputGroup>
            </Col>
            <Col md={3}>
              <Form.Select
                size="sm"
                value={filtroMes}
                onChange={e => { setFiltroMes(e.target.value); setFiltroFecha(''); }}
              >
                <option value="">Todos los meses</option>
                {meses.map(m => {
                  const [y, mo] = m.split('-');
                  const lbl = new Date(+y, +mo-1, 1)
                    .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
                  return <option key={m} value={m}>{lbl.charAt(0).toUpperCase()+lbl.slice(1)}</option>;
                })}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Button
                variant={hayFiltros ? 'warning' : 'outline-secondary'}
                size="sm"
                className="w-100"
                onClick={limpiar}
              >
                {hayFiltros ? '✕ Limpiar' : '⟳ Reset'}
              </Button>
            </Col>
          </Row>

          {/* Sin datos */}
          {data.length === 0 ? (
            <div className="text-center py-5">
              <div style={{ fontSize: '2.5rem' }}>🎈</div>
              <h6 className="mt-3 mb-1">
                {fuente === 'api' ? 'No hay reservas en Bookly para este período' : 'No hay reservas en esta sesión'}
              </h6>
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                {fuente === 'api' ? 'Intentá ampliar el rango o crear nuevas reservas.' : 'Creá una desde «Nueva Reserva».'}
              </p>
              {fuente === 'api' && <Button size="sm" variant="primary" onClick={() => cargarDesdeAPI(true)}>🔄 Consultar ahora</Button>}
            </div>
          ) : filtradas.length === 0 ? (
            <Alert variant="warning" className="text-center py-3">
              🔍 Sin resultados con los filtros aplicados.{' '}
              <Button variant="link" size="sm" className="p-0" onClick={limpiar}>Limpiar</Button>
            </Alert>
          ) : (
            <>
              {/* Tabla con datos paginados */}
              <div className="tabla-reservas-wrapper">
                <Table className="tabla-reservas mb-0" hover>
                  <thead>
                    <tr>
                      <th style={{ cursor:'pointer', width: 80 }} onClick={() => orden('bloqueo_id')}>ID{iconOrden('bloqueo_id')}</th>
                      <th style={{ cursor:'pointer' }}            onClick={() => orden('nombre_ninio')}>Festejado/a{iconOrden('nombre_ninio')}</th>
                      <th style={{ cursor:'pointer', width: 140 }}onClick={() => orden('fecha')}>Fecha{iconOrden('fecha')}</th>
                      <th style={{ width: 80 }}>Hora</th>
                      <th style={{ cursor:'pointer', width: 90, textAlign:'center' }} onClick={() => orden('personas')}>Personas{iconOrden('personas')}</th>
                      <th style={{ cursor:'pointer' }}            onClick={() => orden('tema')}>Tema{iconOrden('tema')}</th>
                      <th>Contacto</th>
                      <th style={{ width: 120 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginadas.map((r, idx) => {
                      const key   = r.bloqueo_id || idx;
                      const isExp = expandido === key;
                      const fds   = r.fecha ? esFinDeSemana(r.fecha) : false;
                      const telefonoLimpio = limpiarTelefono(r.telefono);
                      return (
                        <>
                          <tr
                            key={key}
                            className={isExp ? 'row-expanded' : ''}
                            onClick={() => setExpandido(isExp ? null : key)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td><span className="badge-id">#{r.bloqueo_id || '—'}</span></td>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <div className={`festejado-av ${fds ? 'av-fds' : 'av-sem'}`}>
                                  {(r.nombre_ninio || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="fw-semibold" style={{ fontSize: '0.87rem', lineHeight: 1.2 }}>
                                    {r.nombre_ninio || <span className="text-muted">Sin nombre</span>}
                                  </div>
                                  {r.tema && <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{r.tema}</div>}
                                </div>
                              </div>
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <div style={{ fontSize: '0.84rem' }}>{fmtFecha(r.fecha)}</div>
                              <Badge bg={fds ? 'primary' : 'secondary'} style={{ fontSize: '0.58rem' }}>
                                {fds ? 'Fin de semana' : 'Entre semana'}
                              </Badge>
                            </td>
                            <td><span className="badge-hora">{r.hora_inicio || '—'}</span></td>
                            <td className="text-center">
                              <Badge bg={colorP(r.personas)} style={{ fontSize: '0.78rem' }}>
                                {r.personas || '—'}
                              </Badge>
                            </td>
                            <td style={{ fontSize: '0.82rem', color: '#6b7280', maxWidth: 140 }}>
                              <span className="text-truncate d-block">{r.tema || <span className="text-muted">—</span>}</span>
                            </td>
                            <td>
                              <div style={{ fontSize: '0.77rem', lineHeight: 1.5 }}>
                                {r.email && r.email !== 'bloqueo@funcity.com.ar' && (
                                  <div className="text-truncate" style={{ maxWidth: 160 }} title={r.email}>
                                    📧 {r.email}
                                  </div>
                                )}
                                {r.telefono && (
                                  <div>
                                    📱{' '}
                                    <a
                                      href={`https://wa.me/${telefonoLimpio}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ textDecoration: 'none', color: '#25D366' }}
                                      onClick={e => e.stopPropagation()}
                                    >
                                      {r.telefono}
                                    </a>
                                  </div>
                                )}
                                {!r.email && !r.telefono && <span className="text-muted">—</span>}
                              </div>
                            </td>
                            <td onClick={e => e.stopPropagation()}>
                              <div className="d-flex gap-1">
                                <OverlayTrigger placement="top" overlay={<Tooltip>Editar</Tooltip>}>
                                  <Button variant="outline-warning" size="sm" className="btn-acc"
                                    onClick={() => onEditar && onEditar(r)} disabled={!!eliminando}>
                                    ✏️
                                  </Button>
                                </OverlayTrigger>
                                <OverlayTrigger placement="top" overlay={<Tooltip>Eliminar de Bookly</Tooltip>}>
                                  <Button variant="outline-danger" size="sm" className="btn-acc"
                                    onClick={() => setConfirmarId(r.bloqueo_id)}
                                    disabled={eliminando === r.bloqueo_id}>
                                    {eliminando === r.bloqueo_id ? <Spinner animation="border" size="sm" /> : '🗑️'}
                                  </Button>
                                </OverlayTrigger>
                                <OverlayTrigger placement="top" overlay={<Tooltip>Gestionar cobro</Tooltip>}>
                                  <Button variant="outline-success" size="sm" className="btn-acc"
                                    onClick={() => onIrAHistorial && onIrAHistorial(r)}>
                                    💳
                                  </Button>
                                </OverlayTrigger>
                                <OverlayTrigger placement="top" overlay={<Tooltip>Imprimir ticket</Tooltip>}>
                                  <Button variant="outline-info" size="sm" className="btn-acc"
                                    onClick={() => abrirTicket(r)}>
                                    🖨️
                                  </Button>
                                </OverlayTrigger>
                              </div>
                            </td>
                          </tr>

                          {isExp && (
                            <tr key={`d-${key}`} className="row-detail">
                              <td colSpan={8}>
                                <div className="detail-box">
                                  <Row className="g-3">
                                    {[
                                      { label: '🆔 ID Bookly',     value: <code>#{r.bloqueo_id}</code>      },
                                      { label: '🎂 Festejado/a',   value: r.nombre_ninio || '—'             },
                                      { label: '👤 Contacto',      value: [r.nombre_cliente, r.apellido_cliente].filter(Boolean).join(' ') || '—' },
                                      { label: '📅 Fecha',          value: fmtFecha(r.fecha)                },
                                      { label: '🕐 Hora',           value: r.hora_inicio                    },
                                      { label: '👥 Personas',       value: r.personas                      },
                                      { label: '🎨 Tema',           value: r.tema || '—'                   },
                                      { label: '📧 Email',          value: (r.email && r.email !== 'bloqueo@funcity.com.ar') ? r.email : '—' },
                                      {
                                        label: '📱 Teléfono',
                                        value: r.telefono ? (
                                          <a
                                            href={`https://wa.me/${limpiarTelefono(r.telefono)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ textDecoration: 'none', color: '#25D366' }}
                                          >
                                            {r.telefono}
                                          </a>
                                        ) : '—'
                                      },
                                      { label: '📝 Notas',          value: r.notas || '—'                  },
                                    ].map(d => (
                                      <Col xs={6} md={3} key={d.label}>
                                        <div className="detail-item">
                                          <span className="detail-lbl">{d.label}</span>
                                          <span className="detail-val">{d.value}</span>
                                        </div>
                                      </Col>
                                    ))}
                                  </Row>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

              {/* Controles de paginación */}
              <div className="d-flex justify-content-between align-items-center mt-3">
                <div className="d-flex align-items-center gap-2">
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    Mostrando {inicio + 1} a {Math.min(fin, filtradas.length)} de {filtradas.length} reservas
                  </span>
                  <Form.Select
                    size="sm"
                    style={{ width: 'auto' }}
                    value={porPagina}
                    onChange={(e) => {
                      setPorPagina(Number(e.target.value));
                      setPaginaActual(1);
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </Form.Select>
                </div>
                {renderPagination()}
              </div>

              {/* Pie con totales y actualización */}
              <div className="d-flex justify-content-between align-items-center mt-2 px-1">
                <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                  {hayFiltros ? `${filtradas.length} de ${data.length}` : filtradas.length} reservas · {totalP} personas
                </span>
                {fuente === 'api' && (
                  <Button variant="link" size="sm" style={{ fontSize: '0.78rem', padding: 0 }}
                    onClick={() => cargarDesdeAPI(true)} disabled={cargando}>
                    Actualizar lista
                  </Button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
};

export default ListaReservas;