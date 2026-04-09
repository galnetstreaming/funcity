// ============================================================
//  CajaDelDia — Resumen de ventas del día
//  v2.0: Precios desde API, feriados cobran como FDS, sin localStorage
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Badge, Button, Spinner, Alert, Table,
} from 'react-bootstrap';
import {
  obtenerTodasLasReservas,
  obtenerTodosCobros,
  esPrecioFinDeSemana,
  obtenerFeriadosRango,
  obtenerConfiguracion,
  CONFIG_DEFAULT,
} from '../services/api';
import { useUserRole } from '../hooks/UseUserRole';

// ── Helpers ───────────────────────────────────────────────────
const fmt$ = (n) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n || 0);

const hoy = () => new Date().toISOString().split('T')[0];

const METODOS_PAGO_CONFIG = {
  Efectivo:      { icon: '💵', color: '#16a34a', bg: '#f0fdf4' },
  Transferencia: { icon: '🏦', color: '#1d4ed8', bg: '#eff6ff' },
  Débito:        { icon: '💳', color: '#7c3aed', bg: '#f5f3ff' },
  Crédito:       { icon: '💳', color: '#b45309', bg: '#fffbeb' },
  MercadoPago:   { icon: '📱', color: '#059669', bg: '#ecfdf5' },
  Otro:          { icon: '🔖', color: '#6b7280', bg: '#f3f4f6' },
};

// ── Componente ────────────────────────────────────────────────
const CajaDelDia = ({ fechaSeleccionada }) => {
  const { isAdmin } = useUserRole();

  const [cargando,    setCargando]    = useState(false);
  const [error,       setError]       = useState('');
  const [reservasDia, setReservasDia] = useState([]);
  const [cobros,      setCobros]      = useState({});
  const [feriados,    setFeriados]    = useState({});
  const [config,      setConfig]      = useState(CONFIG_DEFAULT);
  const [fecha,       setFecha]       = useState(fechaSeleccionada || hoy());
  const [ultimaAct,   setUltimaAct]   = useState(null);

  // ── Cargar config y feriados (solo una vez) ───────────────
  useEffect(() => {
    const init = async () => {
      try {
        const [cfg, fer] = await Promise.all([
          obtenerConfiguracion(),
          obtenerFeriadosRango(new Date().getFullYear(), new Date().getFullYear() + 1),
        ]);
        setConfig(cfg);
        setFeriados(fer);
      } catch {}
    };
    init();
  }, []);

  // ── Calcular precio de una reserva (considera feriados) ───
  const calcTotalReserva = useCallback((r) => {
    const esFDS  = esPrecioFinDeSemana(r.fecha, feriados);
    const precio = esFDS ? config.precio_fin_de_semana : config.precio_semana;
    return (parseInt(r.personas) || 0) * precio;
  }, [feriados, config]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const { reservas } = await obtenerTodasLasReservas({
        fechaInicio: fecha,
        fechaFin:    fecha,
        usarCache:   false,
      });
      setReservasDia(reservas);

      const ids = reservas.map(r => r.bloqueo_id).filter(Boolean);
      const cobrosData = ids.length ? await obtenerTodosCobros(ids) : {};
      setCobros(cobrosData);
      setUltimaAct(new Date());
    } catch (err) {
      setError(err.message || 'Error al cargar datos');
    } finally {
      setCargando(false);
    }
  }, [fecha]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Calcular estadísticas del día ─────────────────────────
  const stats = (() => {
    let totalFacturado = 0;
    let totalCobrado   = 0;
    let totalPendiente = 0;
    const porMetodo    = {};
    const pagosLista   = [];

    reservasDia.forEach(r => {
      const totalR = calcTotalReserva(r);
      totalFacturado += totalR;

      const cobro = cobros[String(r.bloqueo_id)] || null;
      if (!cobro || !cobro.pagos?.length) {
        totalPendiente += totalR;
        return;
      }

      cobro.pagos.forEach(p => {
        totalCobrado += p.monto;
        porMetodo[p.metodo] = (porMetodo[p.metodo] || 0) + p.monto;
        pagosLista.push({ ...p, reserva: r, cobro });
      });

      const cobradoR = cobro.pagos.reduce((s, p) => s + p.monto, 0);
      if (cobradoR < totalR) totalPendiente += (totalR - cobradoR);
    });

    const pct = totalFacturado > 0 ? Math.round((totalCobrado / totalFacturado) * 100) : 0;

    return {
      totalFacturado, totalCobrado, totalPendiente, pct, porMetodo, pagosLista,
      cantReservas:  reservasDia.length,
      cantPagadas:   Object.values(cobros).filter(c => c.estado === 'pagado').length,
      cantAdelanto:  Object.values(cobros).filter(c => c.estado === 'adelanto').length,
      cantSinCobrar: reservasDia.length - Object.values(cobros).filter(c => c.pagos?.length).length,
    };
  })();

  const metodosConMonto = Object.entries(stats.porMetodo).sort((a, b) => b[1] - a[1]);
  const esHoy = fecha === hoy();

  return (
    <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: 16 }}>
      {/* Header */}
      <Card.Header className="bg-white border-bottom px-4 py-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: '1.4rem' }}>🏪</span>
            <div>
              <h6 className="mb-0 fw-bold">Caja del Día</h6>
              <small className="text-muted">
                {esHoy ? 'Hoy · ' : ''}
                {new Date(fecha + 'T00:00:00').toLocaleDateString('es-AR', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
                {feriados[fecha] && (
                  <Badge bg="warning" text="dark" className="ms-2" style={{ fontSize: '0.65rem' }}>
                    🎉 {feriados[fecha].nombre}
                  </Badge>
                )}
              </small>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <input
              type="date"
              className="form-control form-control-sm"
              style={{ width: 150 }}
              value={fecha}
              onChange={e => setFecha(e.target.value)}
            />
            <Button size="sm" variant="outline-primary" onClick={cargar} disabled={cargando}>
              {cargando ? <Spinner size="sm" animation="border" /> : '🔄 Actualizar'}
            </Button>
          </div>
        </div>

        {/* Indicador de tipo de día con precio correcto */}
        {fecha && (() => {
          const esFDS   = esPrecioFinDeSemana(fecha, feriados);
          const precio  = esFDS ? config.precio_fin_de_semana : config.precio_semana;
          const esFer   = !!feriados[fecha];
          return (
            <div className="mt-2">
              <Badge bg={esFDS ? 'warning' : 'success'} text={esFDS ? 'dark' : undefined} style={{ fontSize: '0.7rem' }}>
                {esFer ? '🎉 Feriado' : esFDS ? '📅 Fin de semana' : '📅 Día de semana'} · {fmt$(precio)}/persona
              </Badge>
            </div>
          );
        })()}
      </Card.Header>

      <Card.Body className="p-4">
        {error && <Alert variant="danger" className="py-2">{error}</Alert>}

        {cargando && !reservasDia.length ? (
          <div className="text-center py-5 text-muted">
            <Spinner animation="border" variant="primary" className="mb-2" />
            <div>Cargando caja del día...</div>
          </div>
        ) : (
          <>
            {/* ── KPIs principales ── */}
            <Row className="g-3 mb-4">
              <Col xs={12} md={4}>
                <div style={{
                  background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)',
                  borderRadius: 14, padding: '20px 22px', color: '#fff',
                  boxShadow: '0 4px 16px rgba(29,78,216,.22)',
                }}>
                  <div style={{ fontSize: '0.7rem', opacity: .65, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
                    Total Facturado
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, lineHeight: 1 }}>
                    {fmt$(stats.totalFacturado)}
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: .65, marginTop: 4 }}>
                    {stats.cantReservas} reserva{stats.cantReservas !== 1 ? 's' : ''}
                  </div>
                </div>
              </Col>

              <Col xs={12} md={4}>
                <div style={{
                  background: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)',
                  borderRadius: 14, padding: '20px 22px', color: '#fff',
                  boxShadow: '0 4px 16px rgba(5,150,105,.22)',
                }}>
                  <div style={{ fontSize: '0.7rem', opacity: .65, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
                    Total Cobrado
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, lineHeight: 1 }}>
                    {fmt$(stats.totalCobrado)}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.25)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${stats.pct}%`, background: '#4ade80', borderRadius: 3, transition: 'width .5s' }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', opacity: .7, marginTop: 3 }}>{stats.pct}% cobrado</div>
                  </div>
                </div>
              </Col>

              <Col xs={12} md={4}>
                <div style={{
                  background: stats.totalPendiente > 0
                    ? 'linear-gradient(135deg, #78350f 0%, #d97706 100%)'
                    : 'linear-gradient(135deg, #374151 0%, #6b7280 100%)',
                  borderRadius: 14, padding: '20px 22px', color: '#fff',
                  boxShadow: '0 4px 16px rgba(217,119,6,.18)',
                }}>
                  <div style={{ fontSize: '0.7rem', opacity: .65, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
                    Pendiente de Cobro
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, lineHeight: 1 }}>
                    {fmt$(stats.totalPendiente)}
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: .7, marginTop: 4 }}>
                    {stats.cantSinCobrar} sin cobrar · {stats.cantAdelanto} con adelanto
                  </div>
                </div>
              </Col>
            </Row>

            {/* ── Métodos de pago ── */}
            {metodosConMonto.length > 0 && (
              <div className="mb-4">
                <h6 className="fw-bold mb-3" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '.06em', color: '#374151' }}>
                  💳 Métodos de Pago
                </h6>
                <Row className="g-2">
                  {metodosConMonto.map(([metodo, monto]) => {
                    const cfg = METODOS_PAGO_CONFIG[metodo] || METODOS_PAGO_CONFIG.Otro;
                    const pct = stats.totalCobrado > 0 ? Math.round((monto / stats.totalCobrado) * 100) : 0;
                    return (
                      <Col xs={6} md={4} key={metodo}>
                        <div style={{
                          background: cfg.bg, borderRadius: 12,
                          border: `1px solid ${cfg.color}22`, padding: '14px 16px',
                        }}>
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: cfg.color }}>
                              {cfg.icon} {metodo}
                            </span>
                            <Badge style={{ background: cfg.color, fontSize: '0.7rem' }}>{pct}%</Badge>
                          </div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111827' }}>
                            {fmt$(monto)}
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: '#e5e7eb', marginTop: 6, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${pct}%`,
                              background: cfg.color, borderRadius: 2, transition: 'width .4s',
                            }} />
                          </div>
                        </div>
                      </Col>
                    );
                  })}
                </Row>
              </div>
            )}

            {/* ── Reservas del día ── */}
            {reservasDia.length === 0 ? (
              <Alert variant="light" className="text-center border mb-0">
                <span style={{ fontSize: '2rem' }}>📭</span>
                <div className="mt-2 text-muted">No hay reservas para esta fecha.</div>
              </Alert>
            ) : (
              <>
                <h6 className="fw-bold mb-3" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '.06em', color: '#374151' }}>
                  📋 Detalle por Reserva
                </h6>
                <div style={{ overflowX: 'auto' }}>
                  <Table hover size="sm" className="mb-0" style={{ fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th>Festejado/a</th>
                        <th>Horario</th>
                        <th>Personas</th>
                        <th>Tarifa</th>
                        {isAdmin && <th>Vendedor</th>}
                        <th>Total</th>
                        <th>Cobrado</th>
                        <th>Estado</th>
                        <th>Método</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservasDia.map(r => {
                        const cobro    = cobros[String(r.bloqueo_id)];
                        const totalR   = calcTotalReserva(r);
                        const pagados  = cobro?.pagos?.reduce((s, p) => s + p.monto, 0) || 0;
                        const pctR     = totalR > 0 ? Math.round((pagados / totalR) * 100) : 0;
                        const estado   = cobro?.estado || 'sinCobro';
                        const metodos  = [...new Set(cobro?.pagos?.map(p => p.metodo) || [])];
                        const esFDS    = esPrecioFinDeSemana(r.fecha, feriados);
                        const esFer    = !!feriados[r.fecha];

                        const ESTADO_CONFIG = {
                          sinCobro:  { bg: 'secondary', label: '⏳ Sin cobrar' },
                          adelanto:  { bg: 'warning',   label: '💰 Adelanto',   text: 'dark' },
                          pagado:    { bg: 'success',   label: '✅ Pagado'     },
                          cancelado: { bg: 'danger',    label: '🚫 Cancelado'  },
                        };
                        const est = ESTADO_CONFIG[estado] || ESTADO_CONFIG.sinCobro;

                        return (
                          <tr key={r.bloqueo_id}>
                            <td>
                              <strong>{r.nombre_ninio || '—'}</strong>
                              {r.tema && <><br /><small className="text-muted">{r.tema}</small></>}
                            </td>
                            <td>{r.hora_inicio || '—'}</td>
                            <td>{r.personas || '—'}</td>
                            <td>
                              <Badge
                                bg={esFDS ? 'warning' : 'success'}
                                text={esFDS ? 'dark' : undefined}
                                style={{ fontSize: '0.65rem' }}
                              >
                                {esFer ? '🎉 Feriado' : esFDS ? 'FDS' : 'Semana'}
                              </Badge>
                            </td>
                            {isAdmin && (
                              <td style={{ color: '#6b7280', fontSize: '0.78rem' }}>
                                {cobro?.vendedor || r.vendedor || <span className="text-muted">—</span>}
                              </td>
                            )}
                            <td><strong>{fmt$(totalR)}</strong></td>
                            <td>
                              <div style={{ minWidth: 80 }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: pctR === 100 ? '#16a34a' : '#d97706' }}>
                                  {fmt$(pagados)}
                                </div>
                                <div style={{ height: 4, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden', marginTop: 2 }}>
                                  <div style={{
                                    height: '100%', width: `${pctR}%`,
                                    background: pctR === 100 ? '#16a34a' : '#f59e0b',
                                    borderRadius: 2, transition: 'width .3s',
                                  }} />
                                </div>
                              </div>
                            </td>
                            <td>
                              <Badge bg={est.bg} text={est.text} style={{ fontSize: '0.68rem' }}>
                                {est.label}
                              </Badge>
                            </td>
                            <td>
                              {metodos.length ? metodos.map(m => {
                                const c = METODOS_PAGO_CONFIG[m] || METODOS_PAGO_CONFIG.Otro;
                                return <span key={m} className="me-1">{c.icon} <small>{m}</small></span>;
                              }) : <span className="text-muted">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot style={{ background: '#f8fafc', fontWeight: 700 }}>
                      <tr>
                        <td colSpan={isAdmin ? 5 : 4} className="text-end">TOTALES:</td>
                        <td>{fmt$(stats.totalFacturado)}</td>
                        <td style={{ color: '#16a34a' }}>{fmt$(stats.totalCobrado)}</td>
                        <td colSpan={2}>
                          <Badge bg="success">{stats.cantPagadas} pagadas</Badge>
                          {' '}
                          {stats.cantAdelanto > 0 && <Badge bg="warning" text="dark">{stats.cantAdelanto} adelanto</Badge>}
                        </td>
                      </tr>
                    </tfoot>
                  </Table>
                </div>
              </>
            )}

            {ultimaAct && (
              <div className="text-end mt-2">
                <small className="text-muted">
                  Actualizado: {ultimaAct.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </small>
              </div>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
};

export default CajaDelDia;