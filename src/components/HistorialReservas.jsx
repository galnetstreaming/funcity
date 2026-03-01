// ============================================================
//  HistorialReservas — Historial de reservas + gestión de cobros
//  Todos los cobros se leen y escriben contra la API REST.
//  No se usa localStorage en ningún punto de este componente.
// ============================================================

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Table, Badge, Alert, Button, Row, Col, Card,
  Modal, Form, InputGroup, ProgressBar,
  OverlayTrigger, Tooltip, Spinner,
} from 'react-bootstrap';
import {
  esFinDeSemana,
  PRECIO_SEMANA,
  PRECIO_FIN_SEMANA,
  obtenerCobro,
  obtenerTodosCobros,
  guardarCobro,
} from '../services/api';

// ─────────────────────────────────────────────────────────────
//  CONSTANTES
// ─────────────────────────────────────────────────────────────
const PRECIO_NUM_SEMANA = parseInt(PRECIO_SEMANA.replace(/\D/g, ''));      // 25000
const PRECIO_NUM_FDS    = parseInt(PRECIO_FIN_SEMANA.replace(/\D/g, '')); // 28000

const METODOS_PAGO = [
  { value: 'Efectivo',      icon: '💵' },
  { value: 'Transferencia', icon: '🏦' },
  { value: 'Débito',        icon: '💳' },
  { value: 'Crédito',       icon: '💳' },
  { value: 'MercadoPago',   icon: '📱' },
  { value: 'Otro',          icon: '🔖' },
];

const ESTADOS = {
  sinCobro:  { label: 'Sin cobrar',   color: '#6b7280', bg: '#f3f4f6', border: '#d1d5db', icon: '⏳', badgeBg: 'secondary' },
  adelanto:  { label: 'Con adelanto', color: '#92400e', bg: '#fffbeb', border: '#fcd34d', icon: '💰', badgeBg: 'warning'   },
  pagado:    { label: 'Pagado',       color: '#14532d', bg: '#f0fdf4', border: '#86efac', icon: '✅', badgeBg: 'success'   },
  cancelado: { label: 'Cancelado',    color: '#7f1d1d', bg: '#fef2f2', border: '#fca5a5', icon: '🚫', badgeBg: 'danger'    },
};

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────
const precioPorPersona = (fecha) =>
  fecha && esFinDeSemana(fecha) ? PRECIO_NUM_FDS : PRECIO_NUM_SEMANA;

const calcTotal = (r) =>
  (parseInt(r.personas) || 0) * precioPorPersona(r.fecha);

const fmt$ = (n) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n || 0);

const fmtFecha = (f, opts) =>
  f ? new Date(f + 'T00:00:00').toLocaleDateString('es-AR', opts || {
    day: '2-digit', month: 'short', year: 'numeric',
  }) : '—';

const fmtFechaLarga = (f) =>
  f ? new Date(f + 'T00:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }) : '—';

const fmtHora = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';

// ID canónico de una reserva para indexar en el mapa de cobros
const rid = (r, idx) => String(r.bloqueo_id ?? `__idx${idx}`);

// Cobro vacío cuando no existe en la API todavía
const cobroVacio = (total) => ({
  estado: 'sinCobro',
  total,
  pagos:  [],
  notas:  '',
});

const calcSaldo = (cobro) => {
  const pagado = (cobro.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
  return {
    pagado,
    falta: Math.max(0, (cobro.total || 0) - pagado),
    total: cobro.total || 0,
    pct:   cobro.total > 0 ? Math.min(100, Math.round((pagado / cobro.total) * 100)) : 0,
  };
};

// ─────────────────────────────────────────────────────────────
//  HOOK — useCobros
//  Carga todos los cobros desde la API al montar y provee
//  una función para persistir cambios puntuales.
// ─────────────────────────────────────────────────────────────
const useCobros = (reservas) => {
  // Mapa en memoria: { [rid]: cobroObj }
  const [mapa,        setMapa]        = useState({});
  const [cargando,    setCargando]    = useState(false);
  const [errorCarga,  setErrorCarga]  = useState('');
  // Mapa de ids que están siendo guardados: { [rid]: true }
  const [guardando,   setGuardando]   = useState({});
  // Mapa de errores de guardado por id: { [rid]: msg }
  const [errGuardado, setErrGuardado] = useState({});

  // IDs de las reservas actuales
  const ids = useMemo(
    () => reservas.map((r, i) => rid(r, i)).filter(id => !id.startsWith('__idx')),
    [reservas]
  );

  // ── Carga inicial: batch GET de todos los cobros ───────────
  const cargarTodos = useCallback(async () => {
    if (!ids.length) return;
    setCargando(true);
    setErrorCarga('');
    try {
      const resultado = await obtenerTodosCobros(ids);
      setMapa(prev => ({ ...prev, ...resultado }));
    } catch (err) {
      setErrorCarga('No se pudieron cargar los cobros desde la API.');
    } finally {
      setCargando(false);
    }
  }, [ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { cargarTodos(); }, [cargarTodos]);

  // ── Obtener cobro de una reserva (usa mapa local) ──────────
  const getCobro = useCallback((r, idx) => {
    const id   = rid(r, idx);
    const tot  = calcTotal(r);
    const raw  = mapa[id];
    if (!raw) return cobroVacio(tot);
    // Recalcular total en caso de que haya cambiado la cantidad de personas
    return { ...raw, total: tot };
  }, [mapa]);

  // ── Guardar cobro en la API y actualizar mapa local ────────
  const persistirCobro = useCallback(async (r, idx, nuevoCobro) => {
    const id = rid(r, idx);
    // Actualizar optimistamente en el mapa local
    setMapa(prev => ({ ...prev, [id]: nuevoCobro }));
    setGuardando(prev => ({ ...prev, [id]: true }));
    setErrGuardado(prev => { const n = { ...prev }; delete n[id]; return n; });

    try {
      const guardado = await guardarCobro(id, nuevoCobro);
      if (!guardado) {
        // La API falló → mostrar error pero conservar el estado local
        setErrGuardado(prev => ({
          ...prev,
          [id]: 'No se pudo guardar en la API. Cambio guardado localmente.',
        }));
      } else {
        // Actualizar con la respuesta oficial de la API
        setMapa(prev => ({ ...prev, [id]: guardado }));
      }
    } catch (err) {
      setErrGuardado(prev => ({
        ...prev,
        [id]: `Error al guardar: ${err.message}`,
      }));
    } finally {
      setGuardando(prev => { const n = { ...prev }; delete n[id]; return n; });
    }
  }, []);

  return { getCobro, persistirCobro, cargando, errorCarga, guardando, errGuardado, recargar: cargarTodos };
};

// ─────────────────────────────────────────────────────────────
//  SUBCOMPONENTE — Barra de progreso de cobro (inline en tabla)
// ─────────────────────────────────────────────────────────────
const BarraCobro = ({ cobro, guardando, error, onClick }) => {
  const s    = calcSaldo(cobro);
  const barColor =
    cobro.estado === 'cancelado' ? '#ef4444' :
    s.pct === 100               ? '#22c55e' :
    s.pct > 0                   ? '#f59e0b' : '#d1d5db';

  return (
    <div style={{ cursor: 'pointer', minWidth: 130 }} onClick={onClick} title="Clic para gestionar cobro">
      <div className="d-flex justify-content-between mb-1" style={{ lineHeight: 1 }}>
        <small style={{ fontSize: '0.68rem', color: '#6b7280' }}>
          {s.pagado > 0 ? fmt$(s.pagado) : 'Sin pagos'}
        </small>
        <small style={{ fontSize: '0.68rem', fontWeight: 700, color: barColor }}>
          {guardando ? <Spinner animation="border" size="sm" style={{ width: 10, height: 10 }} /> : `${s.pct}%`}
        </small>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: '#e5e7eb', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${s.pct}%`,
          background: barColor, borderRadius: 3, transition: 'width .35s ease',
        }} />
      </div>
      {s.falta > 0 && cobro.estado !== 'cancelado' && (
        <small style={{ fontSize: '0.65rem', color: '#dc2626' }}>Falta {fmt$(s.falta)}</small>
      )}
      {error && (
        <small style={{ fontSize: '0.62rem', color: '#f59e0b' }} title={error}>⚠️ Sin sync</small>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
//  SUBCOMPONENTE — Modal de gestión de cobro
// ─────────────────────────────────────────────────────────────
const ModalCobro = ({ reserva, cobro, guardandoRemoto, errorRemoto, onGuardar, onClose }) => {
  const [pagoMonto,  setPagoMonto]  = useState('');
  const [pagoMetodo, setPagoMetodo] = useState('Efectivo');
  const [pagoTipo,   setPagoTipo]   = useState('final');
  const [pagoNota,   setPagoNota]   = useState('');
  const [errorForm,  setErrorForm]  = useState('');

  const s        = calcSaldo(cobro);
  const info     = ESTADOS[cobro.estado] || ESTADOS.sinCobro;
  const contacto = [reserva.nombre_cliente, reserva.apellido_cliente].filter(Boolean).join(' ');

  const registrarPago = () => {
    const monto = parseInt(pagoMonto);
    if (!monto || monto <= 0) { setErrorForm('Ingresá un monto válido'); return; }
    if (monto > s.falta + 1)  { setErrorForm(`Máximo permitido: ${fmt$(s.falta)}`); return; }
    setErrorForm('');

    const nuevoPago = {
      id:       Date.now(),
      monto,
      metodo:   pagoMetodo,
      tipo:     pagoTipo,
      nota:     pagoNota.trim(),
      creadoEn: new Date().toISOString(),
    };
    const pagos  = [...cobro.pagos, nuevoPago];
    const pagado = pagos.reduce((s, p) => s + p.monto, 0);
    const estado = pagado >= cobro.total ? 'pagado' : pagado > 0 ? 'adelanto' : 'sinCobro';
    onGuardar({ ...cobro, pagos, estado });
    setPagoMonto(''); setPagoNota('');
    if (estado === 'pagado') setTimeout(onClose, 900);
  };

  const eliminarPago = (id) => {
    const pagos  = cobro.pagos.filter(p => p.id !== id);
    const pagado = pagos.reduce((s, p) => s + p.monto, 0);
    const estado = pagado >= cobro.total ? 'pagado' : pagado > 0 ? 'adelanto' : 'sinCobro';
    onGuardar({ ...cobro, pagos, estado });
  };

  return (
    <Modal show onHide={onClose} centered size="lg">
      <Modal.Header closeButton style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <Modal.Title style={{ fontSize: '1rem' }}>
          💳 Gestión de cobro
          <span className="text-muted ms-2" style={{ fontSize: '0.8rem', fontWeight: 400 }}>
            #{reserva.bloqueo_id} — {reserva.nombre_ninio}
          </span>
          {guardandoRemoto && (
            <Spinner animation="border" size="sm" className="ms-2 text-primary" title="Guardando en la API..." />
          )}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ padding: '1.2rem' }}>

        {/* Aviso de error de sincronización con la API */}
        {errorRemoto && (
          <Alert variant="warning" className="py-2 mb-3" style={{ fontSize: '0.82rem' }}>
            ⚠️ <strong>Advertencia:</strong> {errorRemoto}
          </Alert>
        )}

        {/* Info de la reserva */}
        <div style={{
          background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0',
          padding: '10px 14px', marginBottom: 16, fontSize: '0.83rem',
        }}>
          <Row className="g-2">
            <Col xs={6} md={3}><strong>🎂 Festejado/a:</strong><br />{reserva.nombre_ninio}</Col>
            <Col xs={6} md={3}><strong>📅 Fecha:</strong><br />{fmtFecha(reserva.fecha)}</Col>
            <Col xs={6} md={3}><strong>👥 Personas:</strong><br />{reserva.personas}</Col>
            <Col xs={6} md={3}>
              <strong>💰 Precio/persona:</strong><br />
              {reserva.fecha && esFinDeSemana(reserva.fecha) ? PRECIO_FIN_SEMANA : PRECIO_SEMANA}
            </Col>
            {contacto && (
              <Col xs={12}>
                <strong>👤 Contacto:</strong> {contacto}
                {reserva.telefono && <> · 📱 {reserva.telefono}</>}
              </Col>
            )}
          </Row>
        </div>

        {/* Resumen financiero */}
        <div style={{
          background: info.bg, border: `1px solid ${info.border}`,
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
        }}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div>
              <span style={{ fontSize: '1.6rem', fontWeight: 800 }}>{fmt$(s.total)}</span>
              <small className="text-muted ms-2">({reserva.personas} personas)</small>
            </div>
            <Badge bg={info.badgeBg} text={info.badgeBg === 'warning' ? 'dark' : undefined}
              style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
              {info.icon} {info.label}
            </Badge>
          </div>
          <ProgressBar
            now={s.pct}
            variant={s.pct === 100 ? 'success' : s.pct > 0 ? 'warning' : 'secondary'}
            style={{ height: 10, borderRadius: 5 }}
            animated={cobro.estado !== 'pagado' && cobro.estado !== 'cancelado'}
            label={s.pct > 12 ? `${s.pct}%` : ''}
          />
          <div className="d-flex justify-content-between mt-1" style={{ fontSize: '0.8rem' }}>
            <span style={{ color: '#16a34a' }}>✅ Cobrado: <strong>{fmt$(s.pagado)}</strong></span>
            {s.falta > 0
              ? <span style={{ color: '#dc2626' }}>⏳ Falta: <strong>{fmt$(s.falta)}</strong></span>
              : <span style={{ color: '#16a34a' }}>🎉 Pago completo</span>
            }
          </div>
        </div>

        {/* Historial de pagos */}
        {cobro.pagos.length > 0 && (
          <div className="mb-3">
            <p className="mb-2" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
              Pagos registrados
            </p>
            {cobro.pagos.map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 8, marginBottom: 6, fontSize: '0.84rem',
                background: p.tipo === 'adelanto' ? '#fffbeb' : '#f0fdf4',
                border: `1px solid ${p.tipo === 'adelanto' ? '#fde68a' : '#bbf7d0'}`,
              }}>
                <span style={{ fontSize: '1.1rem' }}>{p.tipo === 'adelanto' ? '💰' : '✅'}</span>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: '#16a34a' }}>{fmt$(p.monto)}</strong>
                  <Badge bg={p.tipo === 'adelanto' ? 'warning' : 'success'}
                    text={p.tipo === 'adelanto' ? 'dark' : undefined}
                    className="ms-2" style={{ fontSize: '0.62rem' }}>
                    {p.tipo === 'adelanto' ? 'Adelanto' : 'Pago final'}
                  </Badge>
                  <span className="ms-2 text-muted">
                    {METODOS_PAGO.find(m => m.value === p.metodo)?.icon} {p.metodo}
                  </span>
                  {p.nota && <span className="ms-1 fst-italic text-muted">— {p.nota}</span>}
                </div>
                <small className="text-muted">{fmtHora(p.creadoEn)}</small>
                <button
                  onClick={() => eliminarPago(p.id)}
                  title="Eliminar pago"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#ef4444', fontSize: '1rem', lineHeight: 1, padding: 2,
                  }}
                >🗑️</button>
              </div>
            ))}
          </div>
        )}

        {/* Formulario nuevo pago */}
        {s.falta > 0 && cobro.estado !== 'cancelado' && (
          <div style={{
            background: '#f8fafc', borderRadius: 10,
            border: '1px solid #e2e8f0', padding: '14px 16px',
          }}>
            <p className="mb-3" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
              ➕ Registrar nuevo pago
            </p>
            {errorForm && <Alert variant="danger" className="py-2 mb-3" style={{ fontSize: '0.82rem' }}>⚠️ {errorForm}</Alert>}

            {/* Tipo de pago */}
            <div className="d-flex gap-2 mb-3">
              {[
                { val: 'adelanto', label: '💰 Adelanto',   bg: '#fffbeb', border: '#f59e0b' },
                { val: 'final',    label: '✅ Pago final', bg: '#f0fdf4', border: '#22c55e' },
              ].map(opt => (
                <button key={opt.val} type="button"
                  onClick={() => setPagoTipo(opt.val)}
                  style={{
                    flex: 1, padding: '9px 8px', borderRadius: 8, cursor: 'pointer',
                    border: `2px solid ${pagoTipo === opt.val ? opt.border : '#e5e7eb'}`,
                    background: pagoTipo === opt.val ? opt.bg : '#fff',
                    fontWeight: pagoTipo === opt.val ? 700 : 400,
                    fontSize: '0.875rem', transition: 'all .15s', fontFamily: 'inherit',
                  }}
                >{opt.label}</button>
              ))}
            </div>

            <Row className="g-2 mb-2">
              {/* Monto */}
              <Col xs={12} md={5}>
                <Form.Label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Monto *</Form.Label>
                <InputGroup>
                  <InputGroup.Text>$</InputGroup.Text>
                  <Form.Control
                    type="number" min="1" max={s.falta}
                    placeholder={s.falta.toLocaleString('es-AR')}
                    value={pagoMonto}
                    onChange={e => { setPagoMonto(e.target.value); setErrorForm(''); }}
                    style={{ fontWeight: 700, fontSize: '1rem' }}
                    size="lg"
                  />
                </InputGroup>
                {/* Accesos rápidos */}
                <div className="d-flex gap-1 mt-1 flex-wrap">
                  {[
                    { label: 'Total', val: s.falta },
                    { label: '50%',   val: Math.round(s.falta * .5) },
                    { label: '25%',   val: Math.round(s.falta * .25) },
                  ].filter(x => x.val > 0).map(opt => (
                    <button key={opt.label} type="button"
                      onClick={() => setPagoMonto(String(opt.val))}
                      style={{
                        fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4,
                        border: '1px solid #d1d5db', background: '#fff',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >{opt.label} ({fmt$(opt.val)})</button>
                  ))}
                </div>
              </Col>

              {/* Método */}
              <Col xs={12} md={4}>
                <Form.Label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Método</Form.Label>
                <Form.Select size="lg" value={pagoMetodo} onChange={e => setPagoMetodo(e.target.value)}>
                  {METODOS_PAGO.map(m => (
                    <option key={m.value} value={m.value}>{m.icon} {m.value}</option>
                  ))}
                </Form.Select>
              </Col>

              {/* Nota */}
              <Col xs={12} md={3}>
                <Form.Label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Nota (opcional)</Form.Label>
                <Form.Control
                  size="lg" type="text" maxLength={60}
                  placeholder="Ej: transf. #123"
                  value={pagoNota}
                  onChange={e => setPagoNota(e.target.value)}
                />
              </Col>
            </Row>

            <Button variant="primary" size="lg" className="w-100 mt-1 fw-bold" onClick={registrarPago}>
              Registrar {pagoTipo === 'adelanto' ? 'adelanto' : 'pago'} de{' '}
              {pagoMonto ? fmt$(parseInt(pagoMonto)) : '...'}
            </Button>
          </div>
        )}

        {cobro.estado === 'pagado' && (
          <Alert variant="success" className="text-center mb-0 mt-2">
            <div style={{ fontSize: '2rem' }}>🎉</div>
            <strong>¡Cobro completo!</strong> — {fmt$(s.total)} recibido.
          </Alert>
        )}

        {/* Cambio manual de estado */}
        <div className="mt-3 pt-3 border-top">
          <small className="text-muted d-block mb-2">Cambiar estado manualmente:</small>
          <div className="d-flex gap-2 flex-wrap">
            {Object.entries(ESTADOS).map(([key, info]) => (
              <Button key={key} size="sm"
                variant={cobro.estado === key ? info.badgeBg : `outline-${info.badgeBg}`}
                onClick={() => onGuardar({ ...cobro, estado: key })}
                style={{ fontSize: '0.75rem' }}
              >
                {info.icon} {info.label}
              </Button>
            ))}
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────
//  SUBCOMPONENTE — Modal comprobante / impresión
// ─────────────────────────────────────────────────────────────
const ModalComprobante = ({ reserva, cobro, onClose }) => {
  const s        = calcSaldo(cobro);
  const info     = ESTADOS[cobro.estado] || ESTADOS.sinCobro;
  const contacto = [reserva.nombre_cliente, reserva.apellido_cliente].filter(Boolean).join(' ');

  const imprimir = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const lineasPagos = cobro.pagos.map((p, i) =>
      `<tr><td>${i + 1}. ${p.tipo === 'adelanto' ? 'Adelanto' : 'Pago final'} — ${p.metodo}</td>` +
      `<td style="text-align:right"><b>${fmt$(p.monto)}</b></td></tr>`
    ).join('');
    win.document.write(`
      <html><head><title>Comprobante #${reserva.bloqueo_id}</title>
      <style>
        body{font-family:'Courier New',monospace;font-size:12px;width:82mm;margin:0 auto;padding:8px}
        h2{text-align:center;font-size:15px;margin:4px 0}p{margin:2px 0;text-align:center;color:#555}
        hr{border:none;border-top:1px dashed #000;margin:8px 0}table{width:100%;border-collapse:collapse}
        td{padding:2px 0;vertical-align:top}.total{font-weight:bold;font-size:14px}
        .estado{text-align:center;padding:4px;border:1px solid #000;margin:6px 0;font-weight:bold}
        .footer{text-align:center;margin-top:8px;font-size:11px;color:#666}
      </style></head><body>
      <h2>FUN CITY</h2><p>Comprobante de Reserva y Cobro</p><hr>
      <table>
        <tr><td>ID Bookly:</td><td><b>#${reserva.bloqueo_id}</b></td></tr>
        <tr><td>Festejado/a:</td><td><b>${reserva.nombre_ninio}</b></td></tr>
        ${reserva.tema ? `<tr><td>Tema:</td><td>${reserva.tema}</td></tr>` : ''}
        <tr><td>Fecha:</td><td>${fmtFechaLarga(reserva.fecha)}</td></tr>
        <tr><td>Hora:</td><td>${reserva.hora_inicio}</td></tr>
        <tr><td>Personas:</td><td>${reserva.personas}</td></tr>
        ${contacto ? `<tr><td>Contacto:</td><td>${contacto}</td></tr>` : ''}
        ${reserva.telefono ? `<tr><td>Teléfono:</td><td>${reserva.telefono}</td></tr>` : ''}
      </table><hr>
      <table>
        <tr><td>Precio/persona:</td><td style="text-align:right">
          ${reserva.fecha && esFinDeSemana(reserva.fecha) ? PRECIO_FIN_SEMANA : PRECIO_SEMANA}
        </td></tr>
        <tr><td class="total">TOTAL:</td><td style="text-align:right" class="total">${fmt$(s.total)}</td></tr>
        <tr><td>Cobrado:</td><td style="text-align:right"><b>${fmt$(s.pagado)}</b></td></tr>
        <tr><td>Saldo:</td><td style="text-align:right"><b>${s.falta > 0 ? fmt$(s.falta) : 'SALDADO'}</b></td></tr>
      </table>
      ${cobro.pagos.length ? `<hr><p style="text-align:left;font-weight:bold">Detalle de pagos:</p><table>${lineasPagos}</table>` : ''}
      <div class="estado">${info.icon} ${info.label.toUpperCase()}</div>
      <div class="footer">¡Gracias por elegirnos! 🎉<br>Fun City — ${new Date().toLocaleDateString('es-AR')}</div>
      <script>window.print();setTimeout(()=>window.close(),800)</script></body></html>
    `);
    win.document.close();
  };

  return (
    <Modal show onHide={onClose} centered size="sm">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: '1rem' }}>🧾 Comprobante #{reserva.bloqueo_id}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div style={{ fontFamily: "'Courier New', monospace", background: '#f9fafb', borderRadius: 8, padding: 16, fontSize: '0.85rem' }}>
          <div className="text-center mb-2">
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>FUN CITY</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Comprobante de reserva</div>
          </div>
          <hr style={{ borderTop: '1px dashed #aaa' }} />
          <Row style={{ lineHeight: 1.9, fontSize: '0.8rem' }}>
            <Col xs={5} className="text-muted">ID:</Col>           <Col xs={7}><strong>#{reserva.bloqueo_id}</strong></Col>
            <Col xs={5} className="text-muted">Festejado/a:</Col>  <Col xs={7}><strong>{reserva.nombre_ninio}</strong></Col>
            {reserva.tema && <><Col xs={5} className="text-muted">Tema:</Col><Col xs={7}>{reserva.tema}</Col></>}
            <Col xs={5} className="text-muted">Fecha:</Col>        <Col xs={7}>{fmtFechaLarga(reserva.fecha)}</Col>
            <Col xs={5} className="text-muted">Hora:</Col>         <Col xs={7}>{reserva.hora_inicio}</Col>
            <Col xs={5} className="text-muted">Personas:</Col>     <Col xs={7}>{reserva.personas}</Col>
            {contacto && <><Col xs={5} className="text-muted">Contacto:</Col><Col xs={7}>{contacto}</Col></>}
            {reserva.telefono && <><Col xs={5} className="text-muted">Tel:</Col><Col xs={7}>{reserva.telefono}</Col></>}
          </Row>
          <hr style={{ borderTop: '1px dashed #aaa' }} />
          <Row style={{ lineHeight: 1.9, fontSize: '0.82rem' }}>
            <Col xs={6}><strong>TOTAL</strong></Col>              <Col xs={6} className="text-end"><strong>{fmt$(s.total)}</strong></Col>
            <Col xs={6} style={{ color: '#16a34a' }}>Cobrado</Col><Col xs={6} className="text-end" style={{ color: '#16a34a' }}><strong>{fmt$(s.pagado)}</strong></Col>
            <Col xs={6} style={{ color: s.falta > 0 ? '#dc2626' : '#16a34a' }}>Saldo</Col>
            <Col xs={6} className="text-end" style={{ color: s.falta > 0 ? '#dc2626' : '#16a34a' }}>
              <strong>{s.falta > 0 ? fmt$(s.falta) : '✅ Saldado'}</strong>
            </Col>
            <Col xs={12} className="mt-1">
              <Badge bg={info.badgeBg} text={info.badgeBg === 'warning' ? 'dark' : undefined}
                style={{ display: 'block', textAlign: 'center', padding: '6px', fontSize: '0.78rem' }}>
                {info.icon} {info.label}
              </Badge>
            </Col>
          </Row>
          {cobro.pagos.length > 0 && (
            <>
              <hr style={{ borderTop: '1px dashed #aaa' }} />
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>DETALLE DE PAGOS</div>
              {cobro.pagos.map((p, i) => (
                <div key={p.id} className="d-flex justify-content-between" style={{ fontSize: '0.78rem', lineHeight: 1.9 }}>
                  <span>{i + 1}. {p.tipo === 'adelanto' ? 'Adelanto' : 'Final'} · {p.metodo}</span>
                  <strong style={{ color: '#16a34a' }}>{fmt$(p.monto)}</strong>
                </div>
              ))}
            </>
          )}
          <hr style={{ borderTop: '1px dashed #aaa' }} />
          <div className="text-center" style={{ fontSize: '0.75rem', color: '#9ca3af' }}>¡Gracias por elegirnos! 🎉</div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>Cerrar</Button>
        <Button variant="primary" size="sm" onClick={imprimir}>🖨️ Imprimir</Button>
      </Modal.Footer>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────
//  COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────
const HistorialReservas = ({ reservas = [] }) => {
  const {
    getCobro, persistirCobro,
    cargando: cargandoCobros, errorCarga,
    guardando, errGuardado,
    recargar,
  } = useCobros(reservas);

  const [expandido,   setExpandido]   = useState(null);
  const [modalCobroR, setModalCobroR] = useState(null);  // { r, idx }
  const [modalCompR,  setModalCompR]  = useState(null);  // { r, idx }

  const [busqueda,     setBusqueda]     = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [orden,        setOrden]        = useState({ campo: 'fecha', dir: 'desc' });

  // ── Estadísticas globales ───────────────────────────────────
  const stats = useMemo(() => {
    return reservas.reduce((acc, r, idx) => {
      const c = getCobro(r, idx);
      const s = calcSaldo(c);
      acc.total++;
      acc.personas     += parseInt(r.personas) || 0;
      acc.montoTotal   += s.total;
      acc.montoCobrado += s.pagado;
      acc.montoFalta   += s.falta;
      acc[c.estado]     = (acc[c.estado] || 0) + 1;
      return acc;
    }, { total: 0, personas: 0, montoTotal: 0, montoCobrado: 0, montoFalta: 0 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservas, getCobro]);

  // ── Filtrado + orden ────────────────────────────────────────
  const reservasFiltradas = useMemo(() => {
    return reservas
      .map((r, idx) => ({ ...r, _idx: idx }))
      .filter(r => {
        const c = getCobro(r, r._idx);
        if (filtroEstado !== 'todos' && c.estado !== filtroEstado) return false;
        if (busqueda.trim()) {
          const q = busqueda.toLowerCase();
          return (
            (r.nombre_ninio     || '').toLowerCase().includes(q) ||
            (r.nombre_cliente   || '').toLowerCase().includes(q) ||
            (r.apellido_cliente || '').toLowerCase().includes(q) ||
            (r.tema || '').toLowerCase().includes(q) ||
            String(r.bloqueo_id || '').includes(q) ||
            (r.telefono || '').includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const { campo, dir } = orden;
        let va, vb;
        if (campo === 'fecha')    { va = a.fecha || ''; vb = b.fecha || ''; }
        else if (campo === 'personas') { va = parseInt(a.personas) || 0; vb = parseInt(b.personas) || 0; }
        else if (campo === 'total') { va = getCobro(a, a._idx).total; vb = getCobro(b, b._idx).total; }
        else if (campo === 'cobrado') {
          va = calcSaldo(getCobro(a, a._idx)).pagado;
          vb = calcSaldo(getCobro(b, b._idx)).pagado;
        } else if (campo === 'estado') { va = getCobro(a, a._idx).estado; vb = getCobro(b, b._idx).estado; }
        else { va = String(a[campo] || '').toLowerCase(); vb = String(b[campo] || '').toLowerCase(); }
        return dir === 'asc'
          ? (va < vb ? -1 : va > vb ? 1 : 0)
          : (va > vb ? -1 : va < vb ? 1 : 0);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservas, getCobro, filtroEstado, busqueda, orden]);

  const toggleOrden = (campo) => setOrden(prev => ({
    campo,
    dir: prev.campo === campo && prev.dir === 'asc' ? 'desc' : 'asc',
  }));

  const icoOrden = (campo) => orden.campo !== campo
    ? <span style={{ opacity: .25 }}> ↕</span>
    : <span style={{ color: '#3b82f6' }}>{orden.dir === 'asc' ? ' ↑' : ' ↓'}</span>;

  // ── Exportar CSV ────────────────────────────────────────────
  const exportarCSV = () => {
    const headers = ['ID','Festejado/a','Contacto','Fecha','Hora','Personas','Tema','Email','Teléfono','Total','Cobrado','Saldo','Estado'];
    const filas = reservasFiltradas.map(r => {
      const c = getCobro(r, r._idx);
      const s = calcSaldo(c);
      const contacto = [r.nombre_cliente, r.apellido_cliente].filter(Boolean).join(' ');
      return [
        r.bloqueo_id, r.nombre_ninio, contacto, r.fecha, r.hora_inicio,
        r.personas, r.tema,
        r.email !== 'bloqueo@funcity.com.ar' ? (r.email || '') : '',
        r.telefono, s.total, s.pagado, s.falta, ESTADOS[c.estado]?.label || c.estado,
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
    });
    const csv  = [headers.join(','), ...filas].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `funcity_cobros_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const pctCobrado = stats.montoTotal > 0
    ? Math.round((stats.montoCobrado / stats.montoTotal) * 100) : 0;

  // ─────────────────────────────────────────────────────────
  //  EMPTY STATE
  // ─────────────────────────────────────────────────────────
  if (!reservas.length) {
    return (
      <Alert variant="info" className="text-center py-5">
        <div style={{ fontSize: '3rem' }} className="mb-2">📊</div>
        <h5 className="mb-1">No hay reservas en el historial</h5>
        <p className="mb-0 text-muted">Las reservas creadas aparecerán aquí con gestión de cobros</p>
      </Alert>
    );
  }

  // ─────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Alerta de error de carga de cobros ── */}
      {errorCarga && (
        <Alert variant="warning" className="mb-3 py-2 d-flex align-items-center justify-content-between">
          <span>⚠️ {errorCarga}</span>
          <Button size="sm" variant="outline-warning" onClick={recargar}>Reintentar</Button>
        </Alert>
      )}

      {/* ── Spinner de carga inicial ── */}
      {cargandoCobros && (
        <div className="d-flex align-items-center gap-2 mb-3" style={{ fontSize: '0.82rem', color: '#6b7280' }}>
          <Spinner animation="border" size="sm" />
          Cargando cobros desde la API...
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          PANEL FINANCIERO SUPERIOR
      ════════════════════════════════════════════════════ */}
      <Row className="mb-4 g-3">

        {/* Tarjeta resumen financiero */}
        <Col xs={12} md={5}>
          <Card className="h-100 border-0" style={{
            background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)',
            borderRadius: 14, boxShadow: '0 4px 20px rgba(29,78,216,.25)',
          }}>
            <Card.Body className="p-4 text-white">
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <div style={{ fontSize: '0.72rem', opacity: .65, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Total cobrado · {reservas.length} reservas
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.1 }}>
                    {fmt$(stats.montoCobrado)}
                  </div>
                  <div style={{ fontSize: '0.78rem', opacity: .65 }}>
                    de {fmt$(stats.montoTotal)} facturado
                  </div>
                </div>
                <span style={{ fontSize: '2.5rem', opacity: .2 }}>💵</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,.18)', overflow: 'hidden', marginBottom: 8 }}>
                <div style={{
                  height: '100%', width: `${pctCobrado}%`,
                  background: '#4ade80', borderRadius: 4, transition: 'width .5s ease',
                }} />
              </div>
              <div className="d-flex justify-content-between" style={{ fontSize: '0.72rem', opacity: .72 }}>
                <span>✅ Cobrado: {fmt$(stats.montoCobrado)}</span>
                <span>⏳ Pendiente: {fmt$(stats.montoFalta)}</span>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Contadores por estado — clickeables para filtrar */}
        <Col xs={12} md={7}>
          <Row className="g-2 h-100">
            {Object.entries(ESTADOS).map(([key, info]) => {
              const count  = stats[key] || 0;
              const activo = filtroEstado === key;
              return (
                <Col xs={6} key={key}>
                  <Card className="h-100" style={{
                    cursor: 'pointer', borderRadius: 12, transition: 'all .18s',
                    border: `2px solid ${activo ? info.border : '#e5e7eb'}`,
                    background: activo ? info.bg : '#fff',
                    boxShadow: activo ? '0 2px 12px rgba(0,0,0,.1)' : 'none',
                    transform: activo ? 'translateY(-1px)' : 'none',
                  }}
                    onClick={() => setFiltroEstado(filtroEstado === key ? 'todos' : key)}
                  >
                    <Card.Body className="py-2 px-3 d-flex align-items-center justify-content-between">
                      <div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: info.color, lineHeight: 1 }}>{count}</div>
                        <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{info.label}</div>
                      </div>
                      <span style={{ fontSize: '1.6rem', opacity: .5 }}>{info.icon}</span>
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Col>
      </Row>

      {/* ════════════════════════════════════════════════════
          BARRA DE FILTROS
      ════════════════════════════════════════════════════ */}
      <div className="d-flex gap-2 mb-3 flex-wrap align-items-center">
        <InputGroup size="sm" style={{ maxWidth: 260 }}>
          <InputGroup.Text className="bg-white border-end-0">🔍</InputGroup.Text>
          <Form.Control
            className="border-start-0"
            placeholder="Nombre, tema, ID, teléfono..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {busqueda && <Button variant="outline-secondary" size="sm" onClick={() => setBusqueda('')}>✕</Button>}
        </InputGroup>

        <Form.Select size="sm" style={{ maxWidth: 190 }}
          value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="todos">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </Form.Select>

        <div className="ms-auto d-flex gap-2 align-items-center">
          <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
            {reservasFiltradas.length} de {reservas.length}
          </span>
          <Button variant="outline-secondary" size="sm" onClick={recargar} disabled={cargandoCobros}
            title="Recargar cobros desde la API">
            {cargandoCobros ? <Spinner animation="border" size="sm" /> : '🔄'}
          </Button>
          <Button variant="outline-success" size="sm" onClick={exportarCSV}>
            📥 CSV
          </Button>
        </div>
      </div>

      {reservasFiltradas.length === 0 && (
        <Alert variant="warning" className="text-center py-3">
          🔍 Sin resultados.{' '}
          <Button variant="link" size="sm" className="p-0"
            onClick={() => { setBusqueda(''); setFiltroEstado('todos'); }}>
            Limpiar filtros
          </Button>
        </Alert>
      )}

      {/* ════════════════════════════════════════════════════
          TABLA PRINCIPAL
      ════════════════════════════════════════════════════ */}
      {reservasFiltradas.length > 0 && (
        <div className="tabla-reservas-wrapper">
          <Table className="tabla-reservas mb-0 align-middle" hover>
            <thead>
              <tr>
                <th style={{ width: 80, cursor: 'pointer' }} onClick={() => toggleOrden('bloqueo_id')}>
                  ID{icoOrden('bloqueo_id')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleOrden('nombre_ninio')}>
                  Festejado/a{icoOrden('nombre_ninio')}
                </th>
                <th>Contacto</th>
                <th style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => toggleOrden('fecha')}>
                  Fecha{icoOrden('fecha')}
                </th>
                <th style={{ width: 70 }}>Hora</th>
                <th style={{ width: 70, cursor: 'pointer', textAlign: 'center' }} onClick={() => toggleOrden('personas')}>
                  Pers.{icoOrden('personas')}
                </th>
                <th style={{ width: 105, cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleOrden('total')}>
                  Total{icoOrden('total')}
                </th>
                <th style={{ width: 175 }}>
                  Cobro{' '}
                  <small style={{ opacity: .45, fontSize: '0.65rem', fontWeight: 400 }}>(clic → gestionar)</small>
                </th>
                <th style={{ width: 115, cursor: 'pointer' }} onClick={() => toggleOrden('estado')}>
                  Estado{icoOrden('estado')}
                </th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {reservasFiltradas.map(r => {
                const idx      = r._idx;
                const keyId    = rid(r, idx);
                const cobro    = getCobro(r, idx);
                const s        = calcSaldo(cobro);
                const info     = ESTADOS[cobro.estado] || ESTADOS.sinCobro;
                const fds      = r.fecha && esFinDeSemana(r.fecha);
                const isOpen   = expandido === keyId;
                const contacto = [r.nombre_cliente, r.apellido_cliente].filter(Boolean).join(' ');
                const esGuard  = guardando[keyId];
                const errG     = errGuardado[keyId];

                return (
                  <>
                    {/* ── Fila principal ── */}
                    <tr key={keyId}
                      style={{
                        cursor: 'pointer',
                        background: isOpen ? '#f0f9ff' : undefined,
                        borderLeft: `3px solid ${isOpen ? '#3b82f6' : 'transparent'}`,
                      }}
                      onClick={() => setExpandido(isOpen ? null : keyId)}
                    >
                      <td><span className="badge-id">#{r.bloqueo_id ?? idx + 1}</span></td>

                      <td>
                        <div className="fw-semibold" style={{ fontSize: '0.87rem' }}>{r.nombre_ninio || '—'}</div>
                        {r.tema && <small style={{ color: '#9ca3af', fontSize: '0.7rem' }}>{r.tema}</small>}
                      </td>

                      <td>
                        {contacto
                          ? <div style={{ fontSize: '0.8rem' }}>{contacto}</div>
                          : <span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span>
                        }
                        {r.telefono && <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>📱 {r.telefono}</div>}
                      </td>

                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '0.83rem' }}>{fmtFecha(r.fecha)}</div>
                        <Badge bg={fds ? 'primary' : 'secondary'} style={{ fontSize: '0.58rem' }}>
                          {fds ? 'FDS' : 'SEM'}
                        </Badge>
                      </td>

                      <td><span className="badge-hora">{r.hora_inicio || '—'}</span></td>

                      <td className="text-center">
                        <Badge
                          bg={parseInt(r.personas) <= 20 ? 'success' : parseInt(r.personas) <= 30 ? 'warning' : 'danger'}
                          style={{ fontSize: '0.78rem' }}
                        >{r.personas || '—'}</Badge>
                      </td>

                      <td className="text-end fw-semibold" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        {fmt$(s.total)}
                      </td>

                      {/* Barra de cobro — clic abre modal */}
                      <td onClick={e => { e.stopPropagation(); setModalCobroR({ r, idx }); }}>
                        <BarraCobro
                          cobro={cobro}
                          guardando={esGuard}
                          error={errG}
                          onClick={() => {}}
                        />
                      </td>

                      <td>
                        <Badge bg={info.badgeBg} text={info.badgeBg === 'warning' ? 'dark' : undefined}
                          style={{ fontSize: '0.72rem', padding: '5px 8px' }}>
                          {info.icon} {info.label}
                        </Badge>
                      </td>

                      <td onClick={e => e.stopPropagation()}>
                        <div className="d-flex gap-1">
                          <OverlayTrigger placement="top" overlay={<Tooltip>Gestionar cobro</Tooltip>}>
                            <Button size="sm" className="btn-acc"
                              variant={cobro.estado === 'pagado' ? 'outline-success' : 'outline-warning'}
                              onClick={() => setModalCobroR({ r, idx })}>
                              💳
                            </Button>
                          </OverlayTrigger>
                          <OverlayTrigger placement="top" overlay={<Tooltip>Comprobante</Tooltip>}>
                            <Button size="sm" className="btn-acc" variant="outline-secondary"
                              onClick={() => setModalCompR({ r, idx })}>
                              🧾
                            </Button>
                          </OverlayTrigger>
                        </div>
                      </td>
                    </tr>

                    {/* ── Fila expandida ── */}
                    {isOpen && (
                      <tr key={`exp-${keyId}`} className="row-detail">
                        <td colSpan={10}>
                          <div className="detail-box">
                            <Row className="g-3">
                              {/* Datos de la reserva */}
                              <Col md={4}>
                                <div className="detail-lbl mb-2">📋 Reserva</div>
                                <div style={{ fontSize: '0.82rem', lineHeight: 1.9 }}>
                                  <div><strong>🎂 Festejado/a:</strong> {r.nombre_ninio}</div>
                                  {contacto && <div><strong>👤 Contacto:</strong> {contacto}</div>}
                                  {r.telefono && <div><strong>📱:</strong> {r.telefono}</div>}
                                  {r.email && r.email !== 'bloqueo@funcity.com.ar' && <div><strong>📧:</strong> {r.email}</div>}
                                  <div><strong>📅 Fecha:</strong> {fmtFechaLarga(r.fecha)}</div>
                                  <div><strong>🕐 Hora:</strong> {r.hora_inicio} · {r.personas} personas</div>
                                  {r.tema && <div><strong>🎨 Tema:</strong> {r.tema}</div>}
                                  {r.notas && <div><strong>📝 Notas:</strong> {r.notas}</div>}
                                </div>
                              </Col>

                              {/* Historial de pagos */}
                              <Col md={5}>
                                <div className="detail-lbl mb-2">
                                  💰 Pagos registrados
                                  {esGuard && <Spinner animation="border" size="sm" className="ms-2" style={{ width: 12, height: 12 }} />}
                                </div>
                                {errG && (
                                  <Alert variant="warning" className="py-1 mb-2" style={{ fontSize: '0.75rem' }}>
                                    ⚠️ {errG}
                                  </Alert>
                                )}
                                {cobro.pagos.length === 0 ? (
                                  <p className="text-muted fst-italic mb-0" style={{ fontSize: '0.82rem' }}>Sin pagos registrados</p>
                                ) : (
                                  <div className="d-flex flex-column gap-1">
                                    {cobro.pagos.map(p => (
                                      <div key={p.id} style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '5px 8px', borderRadius: 6, fontSize: '0.78rem',
                                        background: p.tipo === 'adelanto' ? '#fffbeb' : '#f0fdf4',
                                        border: `1px solid ${p.tipo === 'adelanto' ? '#fde68a' : '#bbf7d0'}`,
                                      }}>
                                        <span>{p.tipo === 'adelanto' ? '💰' : '✅'}</span>
                                        <strong style={{ color: '#16a34a' }}>{fmt$(p.monto)}</strong>
                                        <Badge bg={p.tipo === 'adelanto' ? 'warning' : 'success'}
                                          text={p.tipo === 'adelanto' ? 'dark' : undefined}
                                          style={{ fontSize: '0.6rem' }}>
                                          {p.tipo === 'adelanto' ? 'Adelanto' : 'Final'}
                                        </Badge>
                                        <span style={{ color: '#6b7280' }}>{p.metodo}</span>
                                        {p.nota && <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>{p.nota}</span>}
                                        <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: '0.68rem' }}>
                                          {fmtHora(p.creadoEn)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </Col>

                              {/* Resumen + acciones */}
                              <Col md={3}>
                                <div className="detail-lbl mb-2">📊 Resumen</div>
                                <div style={{ fontSize: '0.85rem', lineHeight: 2.1 }}>
                                  <div className="d-flex justify-content-between border-bottom pb-1 mb-1">
                                    <span>Total</span><strong>{fmt$(s.total)}</strong>
                                  </div>
                                  <div className="d-flex justify-content-between">
                                    <span style={{ color: '#16a34a' }}>Cobrado</span>
                                    <strong style={{ color: '#16a34a' }}>{fmt$(s.pagado)}</strong>
                                  </div>
                                  <div className="d-flex justify-content-between border-top pt-1">
                                    <span style={{ color: s.falta > 0 ? '#dc2626' : '#16a34a' }}>Saldo</span>
                                    <strong style={{ color: s.falta > 0 ? '#dc2626' : '#16a34a' }}>
                                      {s.falta > 0 ? fmt$(s.falta) : '✅ Saldado'}
                                    </strong>
                                  </div>
                                </div>
                                <Button size="sm"
                                  variant={cobro.estado === 'pagado' ? 'outline-success' : 'warning'}
                                  className="w-100 mt-2 fw-bold"
                                  onClick={() => setModalCobroR({ r, idx })}>
                                  {cobro.estado === 'pagado' ? '✅ Ver cobro' : '💳 Gestionar cobro'}
                                </Button>
                                <Button size="sm" variant="outline-secondary" className="w-100 mt-1"
                                  onClick={() => setModalCompR({ r, idx })}>
                                  🧾 Comprobante
                                </Button>
                              </Col>
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
      )}

      {/* Totales del pie */}
      {reservasFiltradas.length > 0 && (
        <div className="d-flex justify-content-between align-items-center mt-2 px-1">
          <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
            {reservasFiltradas.length} reservas · {stats.personas} personas
          </span>
          <span style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 600 }}>
            Facturado: {fmt$(stats.montoTotal)} · Cobrado: {fmt$(stats.montoCobrado)} · Pendiente: {fmt$(stats.montoFalta)}
          </span>
        </div>
      )}

      {/* Nota informativa */}
      <Alert variant="light" className="mt-3 mb-0 border py-2">
        <small>
          <strong>💡 Cobros:</strong> Todos los registros se guardan automáticamente en la API en tiempo real.
          Hacé clic en 💳 o en la barra de progreso para registrar pagos · 🧾 para imprimir el comprobante.
        </small>
      </Alert>

      {/* ════════════════════════════════════════════════════
          MODALES
      ════════════════════════════════════════════════════ */}
      {modalCobroR && (
        <ModalCobro
          reserva={modalCobroR.r}
          cobro={getCobro(modalCobroR.r, modalCobroR.idx)}
          guardandoRemoto={!!guardando[rid(modalCobroR.r, modalCobroR.idx)]}
          errorRemoto={errGuardado[rid(modalCobroR.r, modalCobroR.idx)]}
          onGuardar={(nuevoCobro) => persistirCobro(modalCobroR.r, modalCobroR.idx, nuevoCobro)}
          onClose={() => setModalCobroR(null)}
        />
      )}

      {modalCompR && (
        <ModalComprobante
          reserva={modalCompR.r}
          cobro={getCobro(modalCompR.r, modalCompR.idx)}
          onClose={() => setModalCompR(null)}
        />
      )}
    </div>
  );
};

export default HistorialReservas;