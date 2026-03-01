import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card, Alert, Button, Badge, ButtonGroup,
  Spinner, Row, Col, ProgressBar, Modal, OverlayTrigger, Tooltip,
} from 'react-bootstrap';
import {
  consultarDisponibilidadRango,
  obtenerCumpleanosRegistrados,
  obtenerHorariosDisponibles,
  obtenerFeriadosRango,
  esFinDeSemana as esFDS,
} from '../services/api';

// ─────────────────────────────────────────────────────────────
const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const fmt = (d) => {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const esHoy    = (d) => d.toDateString() === new Date().toDateString();
const esPasado = (d) => { const h = new Date(); h.setHours(0,0,0,0); return d < h; };

// ─────────────────────────────────────────────────────────────
const CalendarioDisponibilidad = ({ onIrAReservar }) => {
  const [vista, setVista]                           = useState('mes');
  const [fechaActual, setFechaActual]               = useState(new Date());
  const [consultando, setConsultando]               = useState(false);
  const [progreso, setProgreso]                     = useState({ actual: 0, total: 0 });
  const [disponibilidad, setDisponibilidad]         = useState({});
  const [fechaSeleccionada, setFechaSeleccionada]   = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [cumpleanos, setCumpleanos]                 = useState({});
  const [feriados, setFeriados]                     = useState({}); // { "2026-01-01": { nombre, tipo } }
  const [cargandoFeriados, setCargandoFeriados]     = useState(false);
  const [autoRefresh, setAutoRefresh]               = useState(true);
  const [errorConsulta, setErrorConsulta]           = useState('');
  const consultaRef = useRef(null);

  // ── Calcular días ────────────────────────────────────────
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

  // ── Navegar ──────────────────────────────────────────────
  const navegar = (dir) => {
    const n = new Date(fechaActual);
    if (vista === 'dia')         n.setDate(n.getDate() + dir);
    else if (vista === 'semana') n.setDate(n.getDate() + dir * 7);
    else                         n.setMonth(n.getMonth() + dir);
    setFechaActual(n);
  };

  // ── Cargar feriados para los años visibles ────────────────
  const cargarFeriados = useCallback(async (fecha) => {
    const añoActual = fecha.getFullYear();
    // Cargar año actual y siguiente (por si el mes es diciembre)
    const añoFin = fecha.getMonth() === 11 ? añoActual + 1 : añoActual;
    // Solo cargar si no los tenemos ya
    const necesita = [];
    for (let a = añoActual; a <= añoFin; a++) {
      const tieneAlgunoDeEseAño = Object.keys(feriados).some(f => f.startsWith(`${a}-`));
      if (!tieneAlgunoDeEseAño) necesita.push(a);
    }
    if (necesita.length === 0) return;

    setCargandoFeriados(true);
    const nuevosMapa = await obtenerFeriadosRango(necesita[0], necesita[necesita.length - 1]);
    setFeriados(prev => ({ ...prev, ...nuevosMapa }));
    setCargandoFeriados(false);
  }, [feriados]);

  // ── Cargar cumpleaños ────────────────────────────────────
  const cargarCumpleanos = useCallback(async (inicio, fin) => {
    try {
      const data = await obtenerCumpleanosRegistrados(fmt(inicio), fmt(fin));
      const arr  = Array.isArray(data.cumpleanos) ? data.cumpleanos
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
    } catch {
      setCumpleanos({});
    }
  }, []);

  // ── Consultar disponibilidad ─────────────────────────────
  const consultarRango = useCallback(async (fechas, forceRefresh = false) => {
    const fechasFiltradas = forceRefresh
      ? fechas
      : fechas.filter(f => !disponibilidad[fmt(f)]);
    if (fechasFiltradas.length === 0) return;

    if (consultaRef.current) consultaRef.current = false;
    const token = {};
    consultaRef.current = token;

    setConsultando(true);
    setErrorConsulta('');
    setProgreso({ actual: 0, total: fechasFiltradas.length });

    const consultas = fechasFiltradas.map(f => ({
      fecha:    fmt(f),
      horarios: obtenerHorariosDisponibles(fmt(f)).horarios,
    }));

    try {
      const resultados = await consultarDisponibilidadRango(
        consultas,
        (actual, total) => {
          if (token !== consultaRef.current) return;
          setProgreso({ actual, total });
        }
      );
      if (token !== consultaRef.current) return;
      const nuevo = {};
      resultados.forEach(r => { if (r?.fecha) nuevo[r.fecha] = r; });
      setDisponibilidad(prev => ({ ...prev, ...nuevo }));
      setUltimaActualizacion(new Date());
    } catch (err) {
      if (token === consultaRef.current) setErrorConsulta(`Error: ${err.message}`);
    } finally {
      if (token === consultaRef.current) {
        setConsultando(false);
        setProgreso({ actual: 0, total: 0 });
      }
    }
  }, [disponibilidad]);

  // ── Efecto principal: al cambiar vista o fecha ───────────
  useEffect(() => {
    let inicio, fin, fechas = [];

    if (vista === 'mes') {
      inicio = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
      fin    = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0);
      fechas = getDiasMes(fechaActual)
        .filter(d => d.mesActual && !esPasado(d.fecha))
        .map(d => d.fecha);
    } else if (vista === 'semana') {
      const ds = getDiasSemana(fechaActual);
      inicio = ds[0]; fin = ds[6];
      fechas = ds.filter(f => !esPasado(f));
    } else {
      inicio = fin = fechaActual;
      if (!esPasado(fechaActual)) fechas = [fechaActual];
    }

    if (inicio && fin) cargarCumpleanos(inicio, fin);
    cargarFeriados(fechaActual);
    if (fechas.length > 0) consultarRango(fechas);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, fechaActual]);

  // ── Auto-refresh cada 5 minutos ──────────────────────────
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      let fechas = [];
      if (vista === 'mes') {
        fechas = getDiasMes(fechaActual)
          .filter(d => d.mesActual && !esPasado(d.fecha)).map(d => d.fecha);
      } else if (vista === 'semana') {
        fechas = getDiasSemana(fechaActual).filter(f => !esPasado(f));
      } else {
        if (!esPasado(fechaActual)) fechas = [fechaActual];
      }
      if (fechas.length > 0) consultarRango(fechas, true);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, vista, fechaActual]);

  // ── Refrescar todo ───────────────────────────────────────
  const refrescarTodo = () => {
    setDisponibilidad({});
    setUltimaActualizacion(null);
    setErrorConsulta('');
    let fechas = [];
    if (vista === 'mes') {
      fechas = getDiasMes(fechaActual).filter(d => d.mesActual && !esPasado(d.fecha)).map(d => d.fecha);
    } else if (vista === 'semana') {
      fechas = getDiasSemana(fechaActual).filter(f => !esPasado(f));
    } else {
      if (!esPasado(fechaActual)) fechas = [fechaActual];
    }
    if (fechas.length === 0) return;

    const token = {};
    consultaRef.current = token;
    setConsultando(true);
    setProgreso({ actual: 0, total: fechas.length });

    const consultas = fechas.map(f => ({
      fecha:    fmt(f),
      horarios: obtenerHorariosDisponibles(fmt(f)).horarios,
    }));

    consultarDisponibilidadRango(consultas, (a, t) => {
      if (token !== consultaRef.current) return;
      setProgreso({ actual: a, total: t });
    }).then(resultados => {
      if (token !== consultaRef.current) return;
      const nuevo = {};
      resultados.forEach(r => { if (r?.fecha) nuevo[r.fecha] = r; });
      setDisponibilidad(nuevo);
      setUltimaActualizacion(new Date());
    }).catch(err => {
      if (token === consultaRef.current) setErrorConsulta(err.message);
    }).finally(() => {
      if (token === consultaRef.current) {
        setConsultando(false);
        setProgreso({ actual: 0, total: 0 });
      }
    });
  };

  // ── Helpers feriados ─────────────────────────────────────
  const esFeriado      = (fechaStr) => !!feriados[fechaStr];
  const nombreFeriado  = (fechaStr) => feriados[fechaStr]?.nombre || '';
  const tipoFeriado    = (fechaStr) => feriados[fechaStr]?.tipo   || '';

  // ── Badge disponibilidad ─────────────────────────────────
  const badgeDisp = (fecha) => {
    const info = disponibilidad[fmt(fecha)];
    if (!info) return consultando
      ? <Badge bg="secondary" className="w-100 mt-1 d-block" style={{ opacity: 0.6, fontSize: '0.6rem' }}>⏳</Badge>
      : null;
    const { disponibles, total } = info.resumen;
    if (disponibles === total) return <Badge bg="success"  className="w-100 mt-1 d-block" style={{ fontSize: '0.62rem' }}>✓ {disponibles}/{total}</Badge>;
    if (disponibles > 0)       return <Badge bg="warning" text="dark" className="w-100 mt-1 d-block" style={{ fontSize: '0.62rem' }}>⚡ {disponibles}/{total}</Badge>;
    return <Badge bg="danger" className="w-100 mt-1 d-block" style={{ fontSize: '0.62rem' }}>✗ Lleno</Badge>;
  };

  // ── Cumpleaños del día ───────────────────────────────────
  const cumpleDia = (fecha) => {
    const arr = cumpleanos[fmt(fecha)];
    if (!arr?.length) return null;
    return arr.map((c, i) => (
      <div key={i} style={{ fontSize: '0.62rem', color: '#1d4ed8', lineHeight: 1.1, marginTop: 2 }}>
        🎂 {c.nombre_ninio}
      </div>
    ));
  };

  // ── Título de navegación ─────────────────────────────────
  const tituloNav = () => {
    if (vista === 'dia')    return `${DIAS[fechaActual.getDay()]}, ${fechaActual.getDate()} de ${MESES[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`;
    if (vista === 'semana') return `Semana del ${fechaActual.getDate()} de ${MESES[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`;
    return `${MESES[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`;
  };

  // ── Color de fondo según tipo de feriado ─────────────────
  const colorFeriado = (tipo) => {
    if (tipo === 'puente') return { bg: '#fef3c7', border: '#f59e0b' };
    if (tipo === 'trasladable') return { bg: '#fce7f3', border: '#ec4899' };
    return { bg: '#fef9c3', border: '#eab308' }; // inamovible
  };

  // ─────────────────────────────────────────────────────────
  //  Vista Mes
  // ─────────────────────────────────────────────────────────
  const renderMes = () => {
    const dias = getDiasMes(fechaActual);
    return (
      <>
        <Row className="text-center fw-bold border-bottom mb-2 pb-1 g-1">
          {DIAS.map(d => (
            <Col key={d} style={{ fontSize: '0.75rem', color: '#6c757d' }}>{d}</Col>
          ))}
        </Row>
        {Array.from({ length: Math.ceil(dias.length / 7) }).map((_, si) => (
          <Row key={si} className="g-1 mb-1">
            {dias.slice(si * 7, si * 7 + 7).map(({ fecha, mesActual }, idx) => {
              const pasado   = esPasado(fecha);
              const hoy      = esHoy(fecha);
              const fechaS   = fmt(fecha);
              const feriado  = esFeriado(fechaS);
              const tipo     = tipoFeriado(fechaS);
              const fds      = esFDS(fechaS);
              const colores  = feriado ? colorFeriado(tipo) : null;

              return (
                <Col key={idx}>
                  <OverlayTrigger
                    placement="top"
                    overlay={
                      feriado
                        ? <Tooltip>{nombreFeriado(fechaS)}{tipo ? ` (${tipo})` : ''}</Tooltip>
                        : <Tooltip>{fds ? 'Fin de semana' : 'Día de semana'}</Tooltip>
                    }
                  >
                    <div
                      onClick={() => mesActual && !pasado && setFechaSeleccionada(fecha)}
                      className={mesActual && !pasado ? 'dia-cell-hover' : ''}
                      style={{
                        minHeight: 72,
                        cursor: !mesActual || pasado ? 'default' : 'pointer',
                        borderRadius: 8,
                        border: hoy
                          ? '2px solid #3b82f6'
                          : feriado
                          ? `1.5px solid ${colores.border}`
                          : '1px solid #e5e7eb',
                        background: !mesActual
                          ? '#f9fafb'
                          : feriado
                          ? colores.bg
                          : fds
                          ? 'linear-gradient(135deg,#eff6ff,#dbeafe)'
                          : '#fff',
                        opacity: pasado || !mesActual ? 0.45 : 1,
                        padding: '5px 4px 3px',
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{
                          fontSize: '0.82rem',
                          fontWeight: hoy ? 700 : 500,
                          color: hoy ? '#3b82f6' : feriado ? '#92400e' : '#111827',
                        }}>
                          {fecha.getDate()}
                        </span>
                        {feriado && (
                          <span style={{ fontSize: '0.58rem', lineHeight: 1 }}>
                            {tipo === 'puente' ? '🌉' : '🏖️'}
                          </span>
                        )}
                      </div>
                      {mesActual && !pasado && badgeDisp(fecha)}
                      {mesActual && cumpleDia(fecha)}
                    </div>
                  </OverlayTrigger>
                </Col>
              );
            })}
          </Row>
        ))}
      </>
    );
  };

  // ─────────────────────────────────────────────────────────
  //  Vista Semana
  // ─────────────────────────────────────────────────────────
  const renderSemana = () => {
    const dias = getDiasSemana(fechaActual);
    return (
      <Row className="g-2">
        {dias.map((fecha, idx) => {
          const pasado   = esPasado(fecha);
          const hoy      = esHoy(fecha);
          const fechaS   = fmt(fecha);
          const info     = disponibilidad[fechaS];
          const feriado  = esFeriado(fechaS);
          const tipo     = tipoFeriado(fechaS);
          const fds      = esFDS(fechaS);
          const colores  = feriado ? colorFeriado(tipo) : null;
          const { horarios } = obtenerHorariosDisponibles(fechaS);

          return (
            <Col key={idx} xs={12} sm={6} md>
              <Card
                style={{
                  cursor:     pasado ? 'not-allowed' : 'pointer',
                  opacity:    pasado ? 0.5 : 1,
                  border:     hoy
                    ? '2px solid #3b82f6'
                    : feriado
                    ? `2px solid ${colores.border}`
                    : '1px solid #dee2e6',
                  background: feriado ? colores.bg : fds ? '#eff6ff' : '#fff',
                }}
                onClick={() => !pasado && setFechaSeleccionada(fecha)}
                className="h-100"
              >
                <Card.Header className={`text-center py-2 ${hoy ? 'bg-primary text-white' : 'bg-transparent border-bottom'}`}
                  style={{ fontSize: '0.82rem' }}>
                  <small className="d-block" style={{ opacity: 0.7 }}>{DIAS[fecha.getDay()]}</small>
                  <strong style={{ fontSize: '1.05rem' }}>{fecha.getDate()}</strong>
                  {feriado && (
                    <div style={{ fontSize: '0.58rem', color: '#92400e', marginTop: 1 }}>
                      {tipo === 'puente' ? '🌉' : '🏖️'} {nombreFeriado(fechaS).slice(0, 20)}
                    </div>
                  )}
                </Card.Header>
                <Card.Body className="p-2">
                  {!pasado && (
                    <>
                      {info ? (
                        <div className="text-center mb-1">
                          {info.resumen.disponibles === info.resumen.total
                            ? <Badge bg="success"  className="mb-1 w-100" style={{ fontSize: '0.65rem' }}>✓ Todo libre</Badge>
                            : info.resumen.disponibles > 0
                            ? <Badge bg="warning" text="dark" className="mb-1 w-100" style={{ fontSize: '0.65rem' }}>⚡ Parcial</Badge>
                            : <Badge bg="danger"  className="mb-1 w-100" style={{ fontSize: '0.65rem' }}>✗ Completo</Badge>
                          }
                        </div>
                      ) : consultando ? (
                        <div className="text-center py-1">
                          <Spinner animation="border" size="sm" variant="secondary" />
                        </div>
                      ) : null}
                      {horarios.map((h, i) => {
                        const hInfo = info?.horarios?.find(x => x.hora === h);
                        return (
                          <div key={i} className="d-flex justify-content-between align-items-center mb-1"
                            style={{ fontSize: '0.72rem' }}>
                            <span className="font-monospace fw-semibold">{h}</span>
                            {hInfo?.disponible === true  && <Badge bg="success"  style={{ fontSize: '0.55rem' }}>✓</Badge>}
                            {hInfo?.disponible === false && <Badge bg="danger"   style={{ fontSize: '0.55rem' }}>✗</Badge>}
                            {hInfo?.disponible === null  && <Badge bg="secondary" style={{ fontSize: '0.55rem' }}>?</Badge>}
                            {!hInfo && <Badge bg="light" text="muted" style={{ fontSize: '0.55rem' }}>…</Badge>}
                          </div>
                        );
                      })}
                      {cumpleanos[fechaS]?.map((c, i) => (
                        <div key={i} style={{ fontSize: '0.62rem', color: '#1d4ed8', marginTop: 3 }}>
                          🎂 {c.nombre_ninio}
                        </div>
                      ))}
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

  // ─────────────────────────────────────────────────────────
  //  Vista Día
  // ─────────────────────────────────────────────────────────
  const renderDia = () => {
    const fechaS   = fmt(fechaActual);
    const info     = disponibilidad[fechaS];
    const feriado  = esFeriado(fechaS);
    const tipo     = tipoFeriado(fechaS);
    const { horarios, precio } = obtenerHorariosDisponibles(fechaS);

    return (
      <>
        {feriado && (
          <Alert variant="warning" className="mb-3 py-2">
            {tipo === 'puente' ? '🌉' : '🏖️'} <strong>Feriado{tipo ? ` (${tipo})` : ''}:</strong> {nombreFeriado(fechaS)}
          </Alert>
        )}
        {cumpleanos[fechaS]?.length > 0 && (
          <Alert variant="info" className="mb-3 py-2">
            <strong>🎂 Cumpleaños del día:</strong>
            {cumpleanos[fechaS].map((c, i) => (
              <div key={i}>
                <Badge bg="info" className="me-1">{c.hora_inicio}</Badge> {c.nombre_ninio}
              </div>
            ))}
          </Alert>
        )}
        <div className="d-grid gap-3">
          {horarios.map((hora, idx) => {
            const hInfo = info?.horarios?.find(x => x.hora === hora);
            const disp  = hInfo?.disponible;
            return (
              <Card key={idx} style={{
                border: disp === true ? '2px solid #22c55e' : disp === false ? '2px solid #ef4444' : '2px solid #d1d5db',
                background: disp === true ? '#f0fdf4' : disp === false ? '#fef2f2' : '#fff',
              }}>
                <Card.Body className="p-3">
                  <Row className="align-items-center">
                    <Col xs={3} className="text-center">
                      <div style={{ fontSize: '1.6rem' }}>🕐</div>
                      <strong style={{ fontSize: '1.1rem' }}>{hora}</strong>
                    </Col>
                    <Col xs={5}>
                      <div className="fw-semibold">Turno {hora}</div>
                      <small className="text-muted">1h 50min · {precio}</small>
                      {hInfo?.capacidadRestante != null && hInfo.disponible && (
                        <div><small className="text-success">{hInfo.capacidadRestante} lugares libres</small></div>
                      )}
                    </Col>
                    <Col xs={4} className="text-end">
                      {consultando && !hInfo ? (
                        <Spinner animation="border" size="sm" />
                      ) : disp === true ? (
                        <div className="d-flex flex-column gap-1 align-items-end">
                          <Badge bg="success">✓ Disponible</Badge>
                          {onIrAReservar && (
                            <Button size="sm" variant="outline-success"
                              onClick={() => onIrAReservar(fechaS, hora)}>
                              Reservar →
                            </Button>
                          )}
                        </div>
                      ) : disp === false ? (
                        <Badge bg="danger">✗ Ocupado</Badge>
                      ) : (
                        <Badge bg="secondary">Sin datos</Badge>
                      )}
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            );
          })}
        </div>
      </>
    );
  };

  // ── Modal detalle de fecha ───────────────────────────────
  const renderModalFecha = () => {
    if (!fechaSeleccionada) return null;
    const fs      = fmt(fechaSeleccionada);
    const info    = disponibilidad[fs];
    const feriado = esFeriado(fs);
    const tipo    = tipoFeriado(fs);
    const { horarios, precio } = obtenerHorariosDisponibles(fs);

    return (
      <Modal show={!!fechaSeleccionada} onHide={() => setFechaSeleccionada(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: '1rem' }}>
            {DIAS[fechaSeleccionada.getDay()]}, {fechaSeleccionada.getDate()} de {MESES[fechaSeleccionada.getMonth()]}
            {' '}
            <Badge bg={esFDS(fs) ? 'primary' : 'secondary'} style={{ fontSize: '0.68rem' }}>
              {esFDS(fs) ? 'Fin de semana' : 'Entre semana'}
            </Badge>
            {feriado && (
              <Badge bg="warning" text="dark" className="ms-1" style={{ fontSize: '0.68rem' }}>
                {tipo === 'puente' ? '🌉' : '🏖️'} {tipo || 'feriado'}
              </Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {feriado && (
            <Alert variant="warning" className="py-2 mb-3">
              <small>
                {tipo === 'puente' ? '🌉' : '🏖️'} <strong>{nombreFeriado(fs)}</strong>
                {tipo && <span className="text-muted ms-1">({tipo})</span>}
              </small>
            </Alert>
          )}
          {cumpleanos[fs]?.length > 0 && (
            <Alert variant="info" className="mb-3 py-2">
              <strong>🎂 Cumpleaños:</strong>
              {cumpleanos[fs].map((c, i) => (
                <div key={i}><Badge bg="info" className="me-1">{c.hora_inicio}</Badge>{c.nombre_ninio}</div>
              ))}
            </Alert>
          )}
          <p className="text-muted mb-3" style={{ fontSize: '0.82rem' }}>
            💰 <strong>{precio}</strong> · Duración: 1h 50min
          </p>
          {info ? (
            <>
              <div className="d-flex gap-2 mb-3">
                <Badge bg="success">✓ {info.resumen.disponibles} disponibles</Badge>
                <Badge bg="danger">✗ {info.resumen.ocupados} ocupados</Badge>
              </div>
              {info.horarios.map((h, i) => (
                <div key={i} className="d-flex justify-content-between align-items-center border rounded p-2 mb-2"
                  style={{
                    background: h.disponible === true ? '#f0fdf4' : h.disponible === false ? '#fef2f2' : '#f9fafb',
                  }}>
                  <div>
                    <strong className="font-monospace">{h.hora}</strong>
                    {h.disponible && h.capacidadRestante != null && (
                      <small className="text-success ms-2">{h.capacidadRestante} libres</small>
                    )}
                  </div>
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
          ) : consultando ? (
            <div className="text-center py-3">
              <Spinner animation="border" variant="info" />
              <p className="mt-2 text-muted small">Consultando disponibilidad...</p>
            </div>
          ) : (
            <>
              <p className="text-muted mb-3 small">Sin datos de disponibilidad aún.</p>
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
        <Modal.Footer className="justify-content-between">
          <small className="text-muted">
            {info ? `Actualizado: ${ultimaActualizacion?.toLocaleTimeString('es-AR')}` : ''}
          </small>
          <Button variant="secondary" size="sm" onClick={() => setFechaSeleccionada(null)}>Cerrar</Button>
        </Modal.Footer>
      </Modal>
    );
  };

  // ─────────────────────────────────────────────────────────
  //  RENDER PRINCIPAL
  // ─────────────────────────────────────────────────────────
  return (
    <>
      {renderModalFecha()}

      <style>{`
        .dia-cell-hover:hover {
          box-shadow: 0 2px 10px rgba(59,130,246,.25);
          transform: translateY(-1px);
          transition: all .15s ease;
        }
      `}</style>

      <Card className="shadow-sm border-info">
        <Card.Header className="bg-info bg-opacity-10">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <h5 className="mb-0 text-info">📅 Consulta de Disponibilidad</h5>
              {(consultando || cargandoFeriados) && (
                <span style={{ fontSize: '0.75rem', color: '#0891b2', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Spinner animation="grow" size="sm" variant="info" />
                  {cargandoFeriados ? 'Cargando feriados...' : 'Actualizando...'}
                </span>
              )}
              {!consultando && !cargandoFeriados && ultimaActualizacion && (
                <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                  ✓ {ultimaActualizacion.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <OverlayTrigger
                placement="bottom"
                overlay={<Tooltip>Auto-refresh cada 5 min: {autoRefresh ? 'ON' : 'OFF'}</Tooltip>}
              >
                <Button size="sm"
                  variant={autoRefresh ? 'success' : 'outline-secondary'}
                  onClick={() => setAutoRefresh(a => !a)}
                  style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                >
                  {autoRefresh ? '🔄 Auto' : '⏸ Pausa'}
                </Button>
              </OverlayTrigger>
              <Button size="sm" variant="outline-secondary" onClick={refrescarTodo}
                disabled={consultando} style={{ fontSize: '0.72rem', padding: '3px 8px' }}>
                🔃 Refrescar
              </Button>
              <ButtonGroup size="sm">
                {['dia','semana','mes'].map(v => (
                  <Button key={v} variant={vista === v ? 'info' : 'outline-info'}
                    onClick={() => setVista(v)} style={{ fontSize: '0.78rem' }}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </Button>
                ))}
              </ButtonGroup>
            </div>
          </div>
        </Card.Header>

        <Card.Body>
          {errorConsulta && (
            <Alert variant="danger" dismissible onClose={() => setErrorConsulta('')} className="py-2 mb-3">
              <small>⚠️ {errorConsulta}</small>
            </Alert>
          )}

          {/* Navegación */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <Button variant="outline-primary" size="sm" onClick={() => navegar(-1)}>← Anterior</Button>
            <div className="text-center">
              <h5 className="mb-0">{tituloNav()}</h5>
              <Button variant="link" size="sm" className="p-0"
                onClick={() => setFechaActual(new Date())}>Hoy</Button>
            </div>
            <Button variant="outline-primary" size="sm" onClick={() => navegar(1)}>Siguiente →</Button>
          </div>

          {/* Barra de progreso */}
          {consultando && progreso.total > 0 && (
            <div className="mb-3">
              <ProgressBar
                now={(progreso.actual / progreso.total) * 100}
                label={`${progreso.actual}/${progreso.total} fechas`}
                animated striped variant="info"
                style={{ height: 8, borderRadius: 4 }}
              />
            </div>
          )}

          {/* Leyenda */}
          <div className="d-flex flex-wrap gap-3 mb-3 px-1"
            style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            <span><Badge bg="success"  style={{ fontSize: '0.6rem' }}>✓</Badge> Disponible</span>
            <span><Badge bg="warning" text="dark" style={{ fontSize: '0.6rem' }}>⚡</Badge> Parcial</span>
            <span><Badge bg="danger"  style={{ fontSize: '0.6rem' }}>✗</Badge> Lleno</span>
            <span><Badge bg="secondary" style={{ fontSize: '0.6rem' }}>⏳</Badge> Consultando</span>
            <span>🏖️ Feriado inamovible</span>
            <span>🌉 Feriado puente</span>
            <span>🎂 Cumpleaños</span>
          </div>

          {/* Vista activa */}
          {vista === 'mes'    && renderMes()}
          {vista === 'semana' && renderSemana()}
          {vista === 'dia'    && renderDia()}

          {/* Footer info */}
          <Alert variant="info" className="mt-4 mb-0 py-2">
            <small>
              <strong>ℹ️</strong> Disponibilidad y feriados se cargan automáticamente desde la API al navegar.
              Feriados obtenidos de <strong>ArgentinaDatos</strong> (argentinadatos.com) · Fuente oficial PEN.
              <strong className="d-block mt-1">
                Fin de semana: 10:30 · 12:20 · 14:10 · 16:00 ($28.000) &nbsp;|&nbsp;
                Semana: 12:30 · 14:20 · 16:10 ($25.000)
              </strong>
            </small>
          </Alert>
        </Card.Body>
      </Card>
    </>
  );
};

export default CalendarioDisponibilidad;