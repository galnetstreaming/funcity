import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Badge, Alert, Form, InputGroup,
  Row, Col, Card, Modal, Spinner, Nav, OverlayTrigger, Tooltip
} from 'react-bootstrap';
import { eliminarBloqueo, obtenerTodasLasReservas, esFinDeSemana } from '../services/api';

// ─────────────────────────────────────────────────────────────
//  ListaReservas
//
//  Fuente de datos:
//   - Tab "Bookly (API)": consulta /obtener-cumpleanos en tiempo real
//   - Tab "Esta sesión": reservas creadas en la sesión actual (prop)
// ─────────────────────────────────────────────────────────────
const ListaReservas = ({ reservas = [], onEditar, onActualizar }) => {

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

  const [confirmarId, setConfirmarId]   = useState(null);
  const [eliminando, setEliminando]     = useState(null);
  const [mensajeOk, setMensajeOk]       = useState('');
  const [mensajeErr, setMensajeErr]     = useState('');
  const [expandido, setExpandido]       = useState(null);

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

  const limpiar = () => { setBusqueda(''); setFiltroFecha(''); setFiltroMes(''); };
  const hayFiltros = !!(busqueda || filtroFecha || filtroMes);

  const meses = [...new Set(data.map(r => (r.fecha||'').slice(0,7)).filter(Boolean))].sort();

  const totalP = filtradas.reduce((s,r) => s + (parseInt(r.personas)||0), 0);

  const reservaConfirmar = data.find(x => x.bloqueo_id === confirmarId);

  // ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Modal eliminar ── */}
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

      {/* ── Alertas ── */}
      {mensajeOk  && <Alert variant="success" dismissible onClose={() => setMensajeOk('')} className="py-2">{mensajeOk}</Alert>}
      {mensajeErr && <Alert variant="danger"  dismissible onClose={() => setMensajeErr('')} className="py-2">{mensajeErr}</Alert>}

      {/* ── Source tabs ── */}
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

        {/* Barra de estado API */}
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

      {/* ── Cargando (primera carga) ── */}
      {cargando && reservasAPI.length === 0 && fuente === 'api' && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="text-muted mt-3 mb-0">Cargando reservas desde Bookly...</p>
        </div>
      )}

      {/* ── Error ── */}
      {!cargando && errorAPI && data.length === 0 && (
        <Alert variant="danger" className="text-center py-4">
          <div style={{ fontSize: '2rem' }}>⚠️</div>
          <p className="mb-2 mt-1" style={{ fontSize: '0.9rem' }}>{errorAPI}</p>
          <Button variant="outline-danger" size="sm" onClick={() => cargarDesdeAPI(true)}>
            Reintentar
          </Button>
        </Alert>
      )}

      {/* ── Contenido ── */}
      {(!cargando || data.length > 0) && !errorAPI && (
        <>
          {/* Stats */}
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

          {/* Filtros */}
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

          {/* Empty */}
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
                      <th style={{ width: 90 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((r, idx) => {
                      const key   = r.bloqueo_id || idx;
                      const isExp = expandido === key;
                      const fds   = r.fecha ? esFinDeSemana(r.fecha) : false;
                      return (
                        <>
                          <tr
                            key={key}
                            className={isExp ? 'row-expanded' : ''}
                            onClick={() => setExpandido(isExp ? null : key)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td>
                              <span className="badge-id">#{r.bloqueo_id || '—'}</span>
                            </td>
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
                            <td>
                              <span className="badge-hora">{r.hora_inicio || '—'}</span>
                            </td>
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
                                  <div className="text-truncate" style={{ maxWidth: 160 }} title={r.email}>📧 {r.email}</div>
                                )}
                                {r.telefono && <div>📱 {r.telefono}</div>}
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
                                      { label: '📅 Fecha',          value: fmtFecha(r.fecha)                },
                                      { label: '🕐 Hora',           value: r.hora_inicio                    },
                                      { label: '👥 Personas',       value: r.personas                      },
                                      { label: '🎨 Tema',           value: r.tema || '—'                   },
                                      { label: '📧 Email',          value: (r.email && r.email !== 'bloqueo@funcity.com.ar') ? r.email : '—' },
                                      { label: '📱 Teléfono',       value: r.telefono || '—'               },
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