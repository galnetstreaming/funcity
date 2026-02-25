import { useState, useEffect } from 'react';
import {
  Card, Alert, Button, Badge, ButtonGroup,
  Spinner, Row, Col, ProgressBar, Modal
} from 'react-bootstrap';
import {
  consultarDisponibilidadRango,
  obtenerCumpleanosRegistrados,
  obtenerHorariosDisponibles,
  esFinDeSemana as esFDS,
} from '../services/api';

// ─────────────────────────────────────────────────────────────
const DIAS   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const fmt = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const esHoy    = (d) => d.toDateString() === new Date().toDateString();
const esPasado = (d) => { const h = new Date(); h.setHours(0,0,0,0); return d < h; };

// ─────────────────────────────────────────────────────────────
const CalendarioDisponibilidad = ({ onIrAReservar }) => {
  const [vista, setVista]                       = useState('mes');
  const [fechaActual, setFechaActual]           = useState(new Date());
  const [consultando, setConsultando]           = useState(false);
  const [progreso, setProgreso]                 = useState({ actual: 0, total: 0 });
  const [disponibilidad, setDisponibilidad]     = useState({});
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [cumpleanos, setCumpleanos]             = useState({});

  // ── Obtener días del mes ──────────────────────────────────────
  const getDiasMes = (fecha) => {
    const y = fecha.getFullYear(), m = fecha.getMonth();
    const primero = new Date(y, m, 1);
    const ultimo  = new Date(y, m + 1, 0);
    const dias    = [];
    for (let i = primero.getDay() - 1; i >= 0; i--)
      dias.push({ fecha: new Date(y, m, -i), mesActual: false });
    for (let d = 1; d <= ultimo.getDate(); d++)
      dias.push({ fecha: new Date(y, m, d), mesActual: true });
    const rest = 7 - (dias.length % 7);
    if (rest < 7) for (let i = 1; i <= rest; i++)
      dias.push({ fecha: new Date(y, m + 1, i), mesActual: false });
    return dias;
  };

  const getDiasSemana = (fecha) => {
    const inicio = new Date(fecha);
    inicio.setDate(fecha.getDate() - fecha.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicio); d.setDate(inicio.getDate() + i); return d;
    });
  };

  // ── Navegar ───────────────────────────────────────────────────
  const navegar = (dir) => {
    const n = new Date(fechaActual);
    if (vista === 'dia')    n.setDate(n.getDate() + dir);
    else if (vista === 'semana') n.setDate(n.getDate() + dir * 7);
    else n.setMonth(n.getMonth() + dir);
    setFechaActual(n);
  };

  // ── Cargar cumpleaños al cambiar rango ────────────────────────
  useEffect(() => {
    let inicio, fin;
    if (vista === 'mes') {
      inicio = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
      fin    = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0);
    } else if (vista === 'semana') {
      const ds = getDiasSemana(fechaActual);
      inicio = ds[0]; fin = ds[6];
    } else {
      inicio = fin = fechaActual;
    }

    obtenerCumpleanosRegistrados(fmt(inicio), fmt(fin))
      .then(data => {
        const arr = Array.isArray(data.cumpleanos) ? data.cumpleanos
          : Array.isArray(data) ? data : [];
        const porFecha = {};
        arr.forEach(c => {
          const f = (c.fecha || c.start_date || '').split(' ')[0];
          if (f) {
            if (!porFecha[f]) porFecha[f] = [];
            porFecha[f].push({
              ...c,
              hora_inicio:  c.hora || c.hora_inicio || '00:00',
              nombre_ninio: c.nombre_ninio || c.nombre || 'Sin nombre',
            });
          }
        });
        setCumpleanos(porFecha);
      })
      .catch(() => setCumpleanos({}));
  }, [fechaActual, vista]);

  // ── Consultar disponibilidad ──────────────────────────────────
  const consultarVistaActual = async () => {
    setConsultando(true);
    setProgreso({ actual: 0, total: 0 });

    try {
      let fechas = [];
      if (vista === 'dia') {
        if (!esPasado(fechaActual)) fechas = [fechaActual];
      } else if (vista === 'semana') {
        fechas = getDiasSemana(fechaActual).filter(f => !esPasado(f));
      } else {
        fechas = getDiasMes(fechaActual).filter(d => d.mesActual && !esPasado(d.fecha)).map(d => d.fecha);
      }

      if (fechas.length === 0) {
        alert('No hay fechas futuras para consultar en este rango.');
        return;
      }

      const consultas = fechas.map(f => ({
        fecha:    fmt(f),
        horarios: obtenerHorariosDisponibles(fmt(f)).horarios,
      }));

      setProgreso({ actual: 0, total: consultas.length });

      const resultados = await consultarDisponibilidadRango(
        consultas,
        (actual, total) => setProgreso({ actual, total })
      );

      const nuevo = {};
      resultados.forEach(r => { if (r?.fecha) nuevo[r.fecha] = r; });
      setDisponibilidad(prev => ({ ...prev, ...nuevo }));
      setUltimaActualizacion(new Date());
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setConsultando(false);
      setProgreso({ actual: 0, total: 0 });
    }
  };

  const refrescar = () => {
    setDisponibilidad({});
    setUltimaActualizacion(null);
  };

  // ── Badge de disponibilidad ───────────────────────────────────
  const badgeDisp = (fecha) => {
    const info = disponibilidad[fmt(fecha)];
    if (!info) return null;
    const { disponibles, ocupados, errores, total } = info.resumen;
    if (errores === total) return <Badge bg="secondary" className="w-100 mt-1 d-block">⚠ Error</Badge>;
    if (disponibles === total) return <Badge bg="success"  className="w-100 mt-1 d-block">✓ {disponibles}/{total}</Badge>;
    if (disponibles > 0) return <Badge bg="warning" text="dark" className="w-100 mt-1 d-block">⚡ {disponibles}/{total}</Badge>;
    return <Badge bg="danger" className="w-100 mt-1 d-block">✗ Lleno</Badge>;
  };

  // ── Cumpleaños del día ────────────────────────────────────────
  const cumpleDia = (fecha) => {
    const arr = cumpleanos[fmt(fecha)];
    if (!arr?.length) return null;
    return arr.map((c, i) => (
      <div key={i} className="small text-primary mt-1" style={{ fontSize: '0.7rem' }}>
        🎂 {c.nombre_ninio} ({c.hora_inicio})
      </div>
    ));
  };

  // ── Título de navegación ──────────────────────────────────────
  const tituloNav = () => {
    if (vista === 'dia')    return `${DIAS[fechaActual.getDay()]}, ${fechaActual.getDate()} de ${MESES[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`;
    if (vista === 'semana') return `Semana del ${fechaActual.getDate()} de ${MESES[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`;
    return `${MESES[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`;
  };

  // ─────────────────────────────────────────────────────────────
  //  Renders de vista
  // ─────────────────────────────────────────────────────────────

  const renderMes = () => {
    const dias = getDiasMes(fechaActual);
    return (
      <>
        <Row className="text-center fw-bold border-bottom mb-2 pb-1 g-1">
          {DIAS.map(d => <Col key={d} style={{ fontSize: '0.8rem', color: '#6c757d' }}>{d}</Col>)}
        </Row>
        {Array.from({ length: Math.ceil(dias.length / 7) }).map((_, si) => (
          <Row key={si} className="g-1 mb-1">
            {dias.slice(si * 7, si * 7 + 7).map(({ fecha, mesActual }, idx) => {
              const pasado = esPasado(fecha), hoy = esHoy(fecha);
              return (
                <Col key={idx}>
                  <div
                    className={[
                      'border rounded p-1 text-center',
                      !mesActual ? 'opacity-25' : '',
                      pasado ? 'bg-light' : '',
                      hoy ? 'border-primary border-2' : '',
                    ].join(' ')}
                    style={{ minHeight: 64, cursor: !pasado && mesActual ? 'pointer' : 'default' }}
                    onClick={() => !pasado && mesActual && setFechaSeleccionada(fecha)}
                  >
                    <div className="fw-bold" style={{ fontSize: '0.85rem' }}>
                      {fecha.getDate()}
                      {hoy && <span className="ms-1" style={{ fontSize: '0.6rem' }}>◉</span>}
                    </div>
                    {!pasado && mesActual && badgeDisp(fecha)}
                    {!pasado && mesActual && cumpleDia(fecha)}
                  </div>
                </Col>
              );
            })}
          </Row>
        ))}
      </>
    );
  };

  const renderSemana = () => {
    const dias = getDiasSemana(fechaActual);
    return (
      <Row className="g-2">
        {dias.map((fecha, idx) => {
          const info = disponibilidad[fmt(fecha)];
          const pasado = esPasado(fecha), hoy = esHoy(fecha);
          return (
            <Col key={idx} xs={12} sm={6} md={4} lg={3}>
              <Card className={`h-100 ${hoy ? 'border-primary border-2' : ''}`}>
                <Card.Header className={`py-2 ${hoy ? 'bg-primary text-white' : ''}`}>
                  <div className="fw-bold" style={{ fontSize: '0.9rem' }}>
                    {DIAS[fecha.getDay()]} {fecha.getDate()} {hoy && '📍'}
                  </div>
                  <small className={hoy ? 'opacity-75' : 'text-muted'}>
                    {esFDS(fmt(fecha)) ? 'Fin de semana' : 'Entre semana'}
                  </small>
                </Card.Header>
                <Card.Body className="p-2">
                  {pasado ? (
                    <small className="text-muted">Pasado</small>
                  ) : info ? (
                    <>
                      <div className="mb-1">
                        <Badge bg="success" className="me-1">✓ {info.resumen.disponibles}</Badge>
                        <Badge bg="danger">✗ {info.resumen.ocupados}</Badge>
                      </div>
                      {info.horarios.map((h, i) => (
                        <div key={i} className="d-flex justify-content-between align-items-center mb-1">
                          <small className="font-monospace">{h.hora}</small>
                          {h.disponible === true  && <Badge bg="success" pill>✓</Badge>}
                          {h.disponible === false && <Badge bg="danger"  pill>✗</Badge>}
                          {h.disponible === null  && <Badge bg="secondary" pill>?</Badge>}
                        </div>
                      ))}
                      {cumpleDia(fecha)}
                    </>
                  ) : (
                    <>
                      <small className="text-muted">Sin consultar</small>
                      {cumpleDia(fecha)}
                    </>
                  )}
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>
    );
  };

  const renderDia = () => {
    const fechaStr = fmt(fechaActual);
    const info = disponibilidad[fechaStr];
    const { horarios } = obtenerHorariosDisponibles(fechaStr);

    return (
      <>
        <Alert variant="light" className="text-center mb-3 border">
          <h5 className="mb-1">
            {DIAS[fechaActual.getDay()]}, {fechaActual.getDate()} de {MESES[fechaActual.getMonth()]} de {fechaActual.getFullYear()}
          </h5>
          <Badge bg={esFDS(fechaStr) ? 'primary' : 'secondary'}>
            {esFDS(fechaStr) ? 'Fin de Semana — $28.000' : 'Entre Semana — $25.000'}
          </Badge>
        </Alert>

        {cumpleanos[fechaStr]?.length > 0 && (
          <Alert variant="info" className="mb-3">
            <strong>🎂 Cumpleaños registrados hoy:</strong>
            {cumpleanos[fechaStr].map((c, i) => (
              <div key={i} className="mt-1">
                <Badge bg="info" className="me-2">{c.hora_inicio}</Badge>
                <strong>{c.nombre_ninio}</strong>
                {c.tema && <small className="text-muted ms-2">— {c.tema}</small>}
              </div>
            ))}
          </Alert>
        )}

        <div className="d-grid gap-2">
          {horarios.map((hora, idx) => {
            const horInfo = info?.horarios.find(h => h.hora === hora);
            let variant = 'light', badgeEl = null;
            if (horInfo?.disponible === true)  { variant = 'success'; badgeEl = <Badge bg="success">✓ Disponible</Badge>; }
            if (horInfo?.disponible === false) { variant = 'danger';  badgeEl = <Badge bg="danger">✗ Ocupado</Badge>; }
            if (horInfo?.disponible === null)  { variant = 'warning'; badgeEl = <Badge bg="warning" text="dark">⚠ Error</Badge>; }
            if (!horInfo) badgeEl = <Badge bg="secondary">Sin consultar</Badge>;

            return (
              <Card key={idx} className={`border-${variant}`}>
                <Card.Body className="p-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h5 className="mb-0 font-monospace">{hora}</h5>
                      <small className="text-muted">Duración: 1h 50min</small>
                    </div>
                    <div className="text-end">
                      {badgeEl}
                      {horInfo?.disponible === true && onIrAReservar && (
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="outline-success"
                            onClick={() => onIrAReservar(fechaStr, hora)}
                          >
                            Reservar →
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card.Body>
              </Card>
            );
          })}
        </div>
      </>
    );
  };

  // ── Modal detalles fecha ──────────────────────────────────────
  const renderModalFecha = () => {
    if (!fechaSeleccionada) return null;
    const fs   = fmt(fechaSeleccionada);
    const info = disponibilidad[fs];
    const { horarios } = obtenerHorariosDisponibles(fs);

    return (
      <Modal show={!!fechaSeleccionada} onHide={() => setFechaSeleccionada(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {DIAS[fechaSeleccionada.getDay()]}, {fechaSeleccionada.getDate()} de {MESES[fechaSeleccionada.getMonth()]}
            {' '}
            <Badge bg={esFDS(fs) ? 'primary' : 'secondary'} style={{ fontSize: '0.7rem' }}>
              {esFDS(fs) ? 'Fin de semana' : 'Entre semana'}
            </Badge>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {cumpleanos[fs]?.length > 0 && (
            <Alert variant="info" className="mb-3">
              <strong>🎂 Cumpleaños:</strong>
              {cumpleanos[fs].map((c, i) => (
                <div key={i}><Badge bg="info" className="me-1">{c.hora_inicio}</Badge>{c.nombre_ninio}</div>
              ))}
            </Alert>
          )}
          {info ? (
            <>
              <div className="d-flex gap-2 mb-3">
                <Badge bg="success">✓ {info.resumen.disponibles} disponibles</Badge>
                <Badge bg="danger">✗ {info.resumen.ocupados} ocupados</Badge>
              </div>
              {info.horarios.map((h, i) => (
                <div key={i} className="d-flex justify-content-between align-items-center border rounded p-2 mb-2">
                  <strong className="font-monospace">{h.hora}</strong>
                  <div className="d-flex align-items-center gap-2">
                    {h.disponible === true  && <Badge bg="success">✓ Disponible</Badge>}
                    {h.disponible === false && <Badge bg="danger">✗ Ocupado</Badge>}
                    {h.disponible === null  && <Badge bg="warning" text="dark">⚠ Error</Badge>}
                    {h.disponible === true && onIrAReservar && (
                      <Button size="sm" variant="outline-success"
                        onClick={() => { setFechaSeleccionada(null); onIrAReservar(fs, h.hora); }}>
                        Reservar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <p className="text-muted mb-3">Consultá la disponibilidad para ver los horarios disponibles.</p>
              {horarios.map((h, i) => (
                <div key={i} className="d-flex justify-content-between align-items-center border rounded p-2 mb-2">
                  <strong className="font-monospace">{h}</strong>
                  <div className="d-flex align-items-center gap-2">
                    <Badge bg="secondary">Sin consultar</Badge>
                    {onIrAReservar && (
                      <Button size="sm" variant="outline-primary"
                        onClick={() => { setFechaSeleccionada(null); onIrAReservar(fs, h); }}>
                        Reservar →
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setFechaSeleccionada(null)}>Cerrar</Button>
        </Modal.Footer>
      </Modal>
    );
  };

  // ─────────────────────────────────────────────────────────────
  //  RENDER PRINCIPAL
  // ─────────────────────────────────────────────────────────────
  return (
    <>
      {renderModalFecha()}

      <Card className="shadow-sm border-info">
        <Card.Header className="bg-info bg-opacity-10">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <h5 className="mb-0 text-info">📅 Consulta de Disponibilidad</h5>
            <ButtonGroup size="sm">
              {['dia', 'semana', 'mes'].map(v => (
                <Button key={v} variant={vista === v ? 'info' : 'outline-info'} onClick={() => setVista(v)}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </Button>
              ))}
            </ButtonGroup>
          </div>
        </Card.Header>

        <Card.Body>
          {/* ── Navegación ── */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <Button variant="outline-primary" size="sm" onClick={() => navegar(-1)}>← Anterior</Button>
            <div className="text-center">
              <h5 className="mb-0">{tituloNav()}</h5>
              <Button variant="link" size="sm" className="p-0" onClick={() => setFechaActual(new Date())}>Hoy</Button>
            </div>
            <Button variant="outline-primary" size="sm" onClick={() => navegar(1)}>Siguiente →</Button>
          </div>

          {/* ── Botones de consulta ── */}
          <div className="d-flex flex-wrap gap-2 justify-content-center mb-3">
            <Button variant="info" onClick={consultarVistaActual} disabled={consultando} size="lg">
              {consultando
                ? <><Spinner animation="border" size="sm" className="me-2" />Consultando...</>
                : '🔍 Consultar Disponibilidad'
              }
            </Button>
            <Button variant="outline-secondary" onClick={refrescar} disabled={consultando}>
              🔄 Limpiar
            </Button>
          </div>

          {/* ── Progreso ── */}
          {consultando && progreso.total > 0 && (
            <div className="mb-3">
              <ProgressBar
                now={(progreso.actual / progreso.total) * 100}
                label={`${progreso.actual}/${progreso.total} fechas`}
                animated striped
              />
            </div>
          )}

          {ultimaActualizacion && (
            <div className="text-center mb-3">
              <small className="text-muted">
                Última actualización: {ultimaActualizacion.toLocaleTimeString('es-AR')}
              </small>
            </div>
          )}

          {/* ── Leyenda ── */}
          <Alert variant="light" className="py-2 mb-3">
            <div className="d-flex justify-content-around flex-wrap gap-2">
              <small><Badge bg="success">✓</Badge> Disponible</small>
              <small><Badge bg="warning" text="dark">⚡</Badge> Parcial</small>
              <small><Badge bg="danger">✗</Badge> Lleno</small>
              <small><Badge bg="secondary">?</Badge> Sin consultar</small>
              <small>🎂 Cumpleaños registrado</small>
            </div>
          </Alert>

          {/* ── Vista ── */}
          {vista === 'mes'    && renderMes()}
          {vista === 'semana' && renderSemana()}
          {vista === 'dia'    && renderDia()}

          {/* ── Info ── */}
          <Alert variant="info" className="mt-4 mb-0">
            <small>
              <strong>ℹ️ Importante:</strong>
              <ul className="mb-0 mt-1">
                <li>Esta consulta <strong>NO crea reservas</strong> — solo verifica disponibilidad en Bookly</li>
                <li><strong>Fin de semana:</strong> 10:30 · 12:20 · 14:10 · 16:00 — $28.000</li>
                <li><strong>Entre semana:</strong> 12:30 · 14:20 · 16:10 — $25.000</li>
                <li>En vista Mes, hacé clic en un día para ver el detalle de horarios</li>
              </ul>
            </small>
          </Alert>
        </Card.Body>
      </Card>
    </>
  );
};

export default CalendarioDisponibilidad;