// ============================================================
//  FormularioReserva — Nueva reserva / Edición
//  v2.1: Corrección de legibilidad (textos oscuros sobre fondos claros)
// ============================================================

import { useState, useEffect, useRef } from 'react';
import {
  Form, Button, Row, Col, Alert, Card, Badge, ButtonGroup, Spinner,
} from 'react-bootstrap';
import {
  crearReserva,
  eliminarBloqueo,
  consultarDisponibilidadReal,
  obtenerHorariosParaFecha,
  obtenerFeriadosRango,
  esPrecioFinDeSemana,
  obtenerConfiguracion,
  CONFIG_DEFAULT,
} from '../services/api';
import { useAuth }     from '../AuthContext';

import './FormularioReserva.css';
import { useUserRole } from '../hooks/useUserRole';

// ─── Temas populares ──────────────────────────────────────────
const TEMAS_POPULARES = [
  '🦸 Superhéroes', '👸 Princesas',    '🦖 Dinosaurios',  '🎮 Videojuegos',
  '⚽ Deportes',    '🎨 Arte',          '🚀 Espacio',      '🧚 Hadas',
  '🦄 Unicornios',  '🏴‍☠️ Piratas',    '❄️ Frozen',       '🕷️ Spider-Man',
  '🚗 Cars',        '🧱 Minecraft',    '🪄 Harry Potter', '🐾 Paw Patrol',
];



const FORM_VACIO = {
  nombre_ninio:     '',
  tema:             '',
  fecha:            '',
  hora_inicio:      '',
  personas:         '',
  nombre_cliente:   '',
  apellido_cliente: '',
  email:            '',
  telefono:         '',
  notas:            '',
  vendedor:         '',
};

// ─────────────────────────────────────────────────────────────
const FormularioReserva = ({
  onReservaCreada,
  modoEdicion     = false,
  reservaEditar   = null,
  onCancelarEdicion,
}) => {
  const { currentUser }  = useAuth();
  const { isCajero }     = useUserRole();

  const [formData,    setFormData]    = useState(FORM_VACIO);
  const [errores,     setErrores]     = useState({});
  const [enviando,    setEnviando]    = useState(false);
  const [exito,       setExito]       = useState(null);
  const [errorGlobal, setErrorGlobal] = useState('');

  // Configuración desde API
  const [config,        setConfig]        = useState(CONFIG_DEFAULT);
  const [cargandoConf,  setCargandoConf]  = useState(true);

  // Disponibilidad
  const [dispEstado,  setDispEstado]  = useState(null);
  const [dispMensaje, setDispMensaje] = useState('');
  const dispTimerRef = useRef(null);

  // Feriados
  const [feriados,    setFeriados]    = useState({});
  const [infoFeriado, setInfoFeriado] = useState(null);

  // Horarios del día seleccionado
  const [horariosDisp, setHorariosDisp] = useState([]);

  // ── Cargar config y feriados al montar ───────────────────
  useEffect(() => {
    const init = async () => {
      setCargandoConf(true);
      try {
        const [cfg, fer] = await Promise.all([
          obtenerConfiguracion(),
          obtenerFeriadosRango(new Date().getFullYear(), new Date().getFullYear() + 1),
        ]);
        setConfig(cfg);
        setFeriados(fer);
      } catch {
        setFeriados({});
      } finally {
        setCargandoConf(false);
      }
    };
    init();
  }, []);

  // ── Detectar feriado al elegir fecha ─────────────────────
  useEffect(() => {
    setInfoFeriado(formData.fecha ? feriados[formData.fecha] || null : null);
  }, [formData.fecha, feriados]);

  // ── Pre-cargar datos en modo edición ─────────────────────
  useEffect(() => {
    if (modoEdicion && reservaEditar) {
      setFormData({
        nombre_ninio:     reservaEditar.nombre_ninio     || '',
        tema:             reservaEditar.tema             || '',
        fecha:            reservaEditar.fecha            || '',
        hora_inicio:      reservaEditar.hora_inicio      || '',
        personas:         String(reservaEditar.personas  || ''),
        nombre_cliente:   reservaEditar.nombre_cliente   || '',
        apellido_cliente: reservaEditar.apellido_cliente || '',
        email:            reservaEditar.email            || '',
        telefono:         reservaEditar.telefono         || '',
        notas:            reservaEditar.notas            || '',
        vendedor:         reservaEditar.vendedor         || '',
      });
    } else if (!modoEdicion && reservaEditar?.fecha) {
      setFormData(prev => ({
        ...prev,
        fecha:       reservaEditar.fecha       || '',
        hora_inicio: reservaEditar.hora_inicio || '',
      }));
    }
  }, [modoEdicion, reservaEditar]);

  // ── Horarios según fecha (usa config de API) ──────────────
  useEffect(() => {
    if (!formData.fecha) { setHorariosDisp([]); return; }
    const lista = obtenerHorariosParaFecha(formData.fecha, config).map(h => ({ hora: h }));
    setHorariosDisp(lista);
    // Si el horario seleccionado no es válido para este día, limpiarlo
    if (formData.hora_inicio && !lista.find(h => h.hora === formData.hora_inicio)) {
      setFormData(p => ({ ...p, hora_inicio: '' }));
    }
  }, [formData.fecha, config]);

  // ── Verificar disponibilidad en tiempo real ───────────────
  useEffect(() => {
    if (!formData.fecha || !formData.hora_inicio) {
      setDispEstado(null); setDispMensaje(''); return;
    }
    clearTimeout(dispTimerRef.current);
    setDispEstado('checking');
    dispTimerRef.current = setTimeout(async () => {
      try {
        const res = await consultarDisponibilidadReal({
          fecha:       formData.fecha,
          hora_inicio: formData.hora_inicio,
          personas:    formData.personas || 1,
        });
        if (res.disponible) {
          setDispEstado('ok');
          setDispMensaje(`✅ Disponible · ${res.capacidadRestante ?? '?'} lugares libres`);
        } else {
          setDispEstado('ocupado');
          setDispMensaje('❌ No disponible para este horario');
        }
      } catch {
        setDispEstado('error');
        setDispMensaje('⚠️ No se pudo verificar disponibilidad');
      }
    }, 700);
    return () => clearTimeout(dispTimerRef.current);
  }, [formData.fecha, formData.hora_inicio]);

  const setField = (key, val) => {
    setFormData(p => ({ ...p, [key]: val }));
    if (errores[key]) setErrores(p => ({ ...p, [key]: '' }));
  };

  const validar = () => {
    const e = {};
    if (!formData.nombre_ninio.trim())                          e.nombre_ninio = 'Requerido';
    if (!formData.fecha)                                        e.fecha        = 'Requerido';
    if (!formData.hora_inicio)                                  e.hora_inicio  = 'Requerido';
    if (!formData.personas || parseInt(formData.personas) < 1) e.personas     = 'Mínimo 1 persona';
    if (parseInt(formData.personas) > config.capacidad_maxima) e.personas     = `Máximo ${config.capacidad_maxima} personas`;
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validar();
    if (Object.keys(errs).length) { setErrores(errs); return; }

    setEnviando(true);
    setErrorGlobal('');

    try {
      if (modoEdicion && reservaEditar?.bloqueo_id) {
        try { await eliminarBloqueo(reservaEditar.bloqueo_id); } catch {}
      }

      const datos = {
        ...formData,
        personas: parseInt(formData.personas),
        email:    formData.email || 'bloqueo@funcity.com.ar',
        vendedor: formData.vendedor.trim() ||
                  (currentUser?.displayName || currentUser?.email?.split('@')[0] || ''),
      };

      const resultado = await crearReserva(datos, feriados, config);
      setExito(resultado);
      onReservaCreada?.(resultado);
    } catch (err) {
      setErrorGlobal(err.message || 'Error al crear la reserva. Intentá nuevamente.');
    } finally {
      setEnviando(false);
    }
  };

  // ── Precio estimado (considera feriados) ─────────────────
  const esFDS         = formData.fecha && esPrecioFinDeSemana(formData.fecha, feriados);
  const precioNum     = esFDS ? config.precio_fin_de_semana : config.precio_semana;
  const totalEstimado = formData.personas ? parseInt(formData.personas) * precioNum : 0;
  const fmt$          = (n) => new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n);

  const tipoDiaLabel = () => {
    if (!formData.fecha) return '';
    if (infoFeriado)     return `🎉 Feriado: ${infoFeriado.nombre} — precio fin de semana`;
    if (esFDS)           return '📅 Fin de semana';
    return '📅 Día de semana';
  };

  // ── Pantalla de éxito ─────────────────────────────────────
  if (exito) {
    const totalExito = exito.personas * (exito.precio_unitario || precioNum);
    return (
      <Alert variant="success" className="text-center p-4">
        <div style={{ fontSize: '2.5rem' }}>🎉</div>
        <Alert.Heading className="justify-content-center mt-2">
          ¡Reserva creada exitosamente!
        </Alert.Heading>
        <hr />
        <p className="mb-1"><strong>{exito.nombre_ninio}</strong></p>
        <p className="mb-1">
          📅 {exito.fecha} · 🕐 {exito.hora_inicio} · 👥 {exito.personas} personas
        </p>
        {exito.tema && <p className="mb-1">🎨 {exito.tema}</p>}
        {exito.esFeriado && (
          <Badge bg="warning" text="dark" className="mb-2">🎉 Feriado — precio especial</Badge>
        )}
        <p className="mb-1">
          💰 <strong>Total estimado: {fmt$(totalExito)}</strong>
          {' '}<small className="text-muted">({exito.es_fds ? 'tarifa fin de semana' : 'tarifa semana'})</small>
        </p>
        {exito.vendedor && (
          <p className="mb-1" style={{ fontSize: '0.85rem', color: '#155724' }}>
            🏷️ Vendedor: {exito.vendedor}
          </p>
        )}
        <p className="mb-3 text-muted" style={{ fontSize: '0.85rem' }}>
          ID: #{exito.bloqueo_id}
        </p>
        <Button
          variant="outline-success"
          onClick={() => { setExito(null); setFormData(FORM_VACIO); }}
        >
          ➕ Nueva Reserva
        </Button>
      </Alert>
    );
  }

  // ── Formulario principal ──────────────────────────────────
  return (
    <>
      {/* Banner cajero */}
      {isCajero && (
        <Alert variant="info" className="py-2 mb-3">
          <small>
            🧾 <strong>Modo Cajero</strong> — Podés crear reservas y registrar pagos.
            Para modificar precios o eliminar reservas, contactá a un administrador.
          </small>
        </Alert>
      )}

      {cargandoConf && (
        <Alert variant="light" className="py-2 mb-3">
          <Spinner size="sm" animation="border" className="me-2" />
          <small>Cargando configuración de precios y horarios...</small>
        </Alert>
      )}

      {errorGlobal && (
        <Alert variant="danger" className="mb-3">⚠️ {errorGlobal}</Alert>
      )}

      <Form onSubmit={handleSubmit} noValidate>

        {/* ════════════════════════════════════════════════
            SECCIÓN 1 — Festejado/a (fondo claro, texto oscuro)
        ════════════════════════════════════════════════ */}
        <Card className="mb-4 shadow-sm ">
          <Card.Header className="bg-secondary text-black">
            <h5 className="mb-0">🎂 Datos del Festejado/a</h5>
          </Card.Header>
          <Card.Body className="bg-white text-dark">
            <Row className="g-3">

              <Col xs={12} md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark">
                    Nombre del festejado/a <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    size="lg"
                    type="text"
                    placeholder="Nombre del niño/a"
                    value={formData.nombre_ninio}
                    onChange={e => setField('nombre_ninio', e.target.value)}
                    isInvalid={!!errores.nombre_ninio}
                    className="bg-light text-dark"
                  />
                  <Form.Control.Feedback type="invalid">
                    {errores.nombre_ninio}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>

              <Col xs={12} md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark">Tema del cumpleaños</Form.Label>
                  <Form.Control
                    size="lg"
                    type="text"
                    placeholder="Ej: Unicornios, Spider-Man..."
                    value={formData.tema}
                    onChange={e => setField('tema', e.target.value)}
                    list="temas-sugeridos"
                    className="bg-light text-dark"
                  />
                  <datalist id="temas-sugeridos">
                    {TEMAS_POPULARES.map(t => <option key={t} value={t} />)}
                  </datalist>
                  <Form.Text className="text-muted">
                    Escribí o elegí un tema popular abajo
                  </Form.Text>
                </Form.Group>
              </Col>

              {/* Temas rápidos */}
              <Col xs={12}>
                <div className="d-flex flex-wrap gap-2">
                  {TEMAS_POPULARES.map(t => (
                    <Badge
                      key={t}
                      pill
                      bg={formData.tema === t ? 'primary' : 'light'}
                      text={formData.tema === t ? 'white' : 'dark'}
                      className={formData.tema === t ? 'badge-animated' : ''}
                      style={{
                        cursor: 'pointer',
                        border: '1px solid #dee2e6',
                        fontSize: '0.8rem',
                        padding: '0.5rem 0.75rem',
                        transition: 'all .2s',
                      }}
                      onClick={() => setField('tema', formData.tema === t ? '' : t)}
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              </Col>

            </Row>
          </Card.Body>
        </Card>

        {/* ════════════════════════════════════════════════
            SECCIÓN 2 — Fecha y Horario
        ════════════════════════════════════════════════ */}
        <Card className="mb-4 shadow-sm bg-primary">
          <Card.Header className="bg-success text-black">
            <h5 className="mb-0">📅 Fecha y Horario</h5>
          </Card.Header>
          <Card.Body className="bg-white text-dark">
            <Row className="g-3">

              {/* Fecha */}
              <Col xs={12} md={4}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark">
                    Fecha <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    size="lg"
                    type="date"
                    value={formData.fecha}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => {
                      setField('fecha', e.target.value);
                      setField('hora_inicio', '');
                    }}
                    isInvalid={!!errores.fecha}
                    className="bg-light text-dark"
                  />
                  <Form.Control.Feedback type="invalid">{errores.fecha}</Form.Control.Feedback>

                  {formData.fecha && (
                    <Alert
                      variant={esFDS ? (infoFeriado ? 'warning' : 'info') : 'success'}
                      className="py-1 mt-2 mb-0"
                      style={{ fontSize: '0.8rem' }}
                    >
                      {tipoDiaLabel()} · <strong>{fmt$(precioNum)}</strong>/persona
                    </Alert>
                  )}
                </Form.Group>
              </Col>

              {/* Horario */}
              <Col xs={12} md={5}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark">
                    Horario <span className="text-danger">*</span>
                  </Form.Label>

                  {!formData.fecha ? (
                    <Alert variant="light" className="py-2 text-center mb-0">
                      <small className="text-muted">Primero elegí una fecha</small>
                    </Alert>
                  ) : (
                    <>
                      <div className="d-flex flex-wrap gap-2">
                        {horariosDisp.map(({ hora }) => (
                          <Button
                            key={hora}
                            type="button"
                            variant={formData.hora_inicio === hora ? 'success' : 'outline-secondary'}
                            className="btn-horario"
                            onClick={() => setField('hora_inicio', hora)}
                          >
                            🕐 {hora}
                          </Button>
                        ))}
                      </div>
                      {errores.hora_inicio && (
                        <div className="text-danger mt-1" style={{ fontSize: '0.875rem' }}>
                          {errores.hora_inicio}
                        </div>
                      )}
                    </>
                  )}

                  {/* Badge de disponibilidad */}
                  {formData.hora_inicio && (
                    <div className="mt-2">
                      {dispEstado === 'checking' && (
                        <Badge bg="secondary">
                          <Spinner size="sm" animation="border" className="me-1" />
                          Verificando...
                        </Badge>
                      )}
                      {dispEstado === 'ok' && (
                        <Badge bg="success" className="badge-animated">{dispMensaje}</Badge>
                      )}
                      {dispEstado === 'ocupado' && (
                        <Badge bg="danger">{dispMensaje}</Badge>
                      )}
                      {dispEstado === 'error' && (
                        <Badge bg="warning" text="dark">{dispMensaje}</Badge>
                      )}
                    </div>
                  )}
                </Form.Group>
              </Col>

              {/* Personas */}
              <Col xs={12} md={3}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark">
                    Personas <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    size="lg"
                    type="number"
                    min={1}
                    max={config.capacidad_maxima}
                    placeholder="20"
                    value={formData.personas}
                    onChange={e => setField('personas', e.target.value)}
                    isInvalid={!!errores.personas}
                    className="bg-light text-dark"
                  />
                  <Form.Control.Feedback type="invalid">{errores.personas}</Form.Control.Feedback>

                  {/* Sugerencias rápidas */}
                  <ButtonGroup size="sm" className="w-100 mt-2">
                    {[10, 20, 30, config.capacidad_maxima].map(n => (
                      <Button
                        key={n}
                        type="button"
                        variant={parseInt(formData.personas) === n ? 'primary' : 'outline-primary'}
                        onClick={() => setField('personas', String(n))}
                      >
                        {n}
                      </Button>
                    ))}
                  </ButtonGroup>

                  {totalEstimado > 0 && (
                    <Alert variant="success" className="py-1 mt-2 mb-0 text-center">
                      <small>💰 <strong>Total: {fmt$(totalEstimado)}</strong></small>
                    </Alert>
                  )}
                </Form.Group>
              </Col>

            </Row>
          </Card.Body>
        </Card>

        {/* ════════════════════════════════════════════════
            SECCIÓN 3 — Datos del cliente + Vendedor
        ════════════════════════════════════════════════ */}
        <Card className="mb-4 shadow-sm ">
          <Card.Header className="bg-info black">
            <h5 className="mb-0">👤 Datos del Cliente</h5>
          </Card.Header>
          <Card.Body className="bg-white text-dark">
            <Row className="g-3">

              <Col xs={12} md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark">Nombre del cliente</Form.Label>
                  <Form.Control
                    size="lg"
                    type="text"
                    placeholder="Nombre"
                    value={formData.nombre_cliente}
                    onChange={e => setField('nombre_cliente', e.target.value)}
                    className="bg-light text-dark"
                  />
                </Form.Group>
              </Col>

              <Col xs={12} md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark">Apellido</Form.Label>
                  <Form.Control
                    size="lg"
                    type="text"
                    placeholder="Apellido"
                    value={formData.apellido_cliente}
                    onChange={e => setField('apellido_cliente', e.target.value)}
                    className="bg-light text-dark"
                  />
                </Form.Group>
              </Col>

              <Col xs={12} md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark">Email</Form.Label>
                  <Form.Control
                    size="lg"
                    type="email"
                    placeholder="cliente@email.com"
                    value={formData.email}
                    onChange={e => setField('email', e.target.value)}
                    className="bg-light text-dark"
                  />
                </Form.Group>
              </Col>

              <Col xs={12} md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark">Teléfono</Form.Label>
                  <Form.Control
                    size="lg"
                    type="text"
                    placeholder="Ej: +54 9 11 1234-5678"
                    value={formData.telefono}
                    onChange={e => setField('telefono', e.target.value)}
                    className="bg-light text-dark"
                  />
                </Form.Group>
              </Col>

              <Col xs={12} md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark">
                    Vendedor / Cajero{' '}
                    <small className="text-muted fw-normal">(opcional)</small>
                  </Form.Label>
                  <Form.Control
                    size="lg"
                    type="text"
                    placeholder={
                      currentUser?.displayName ||
                      currentUser?.email?.split('@')[0] ||
                      'Nombre del vendedor'
                    }
                    value={formData.vendedor}
                    onChange={e => setField('vendedor', e.target.value)}
                    maxLength={80}
                    className="bg-light text-dark"
                  />
                  <Form.Text className="text-muted">
                    Si lo dejás vacío, se registra con tu usuario automáticamente
                  </Form.Text>
                </Form.Group>
              </Col>

              {/* Notas */}
              <Col xs={12}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark">Notas adicionales</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="Alergias, necesidades especiales, pedidos particulares, decoración..."
                    value={formData.notas}
                    onChange={e => setField('notas', e.target.value)}
                    className="bg-light text-dark"
                  />
                </Form.Group>
              </Col>

            </Row>
          </Card.Body>
        </Card>

        {/* ════════════════════════════════════════════════
            BOTONES
        ════════════════════════════════════════════════ */}
        <div className="d-flex gap-3 flex-wrap">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={enviando || dispEstado === 'ocupado' || cargandoConf}
            style={{ minWidth: 220 }}
          >
            {enviando ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Procesando...
              </>
            ) : modoEdicion ? (
              '✅ Actualizar Reserva'
            ) : (
              '🎉 Crear Reserva'
            )}
          </Button>

          {modoEdicion && onCancelarEdicion && (
            <Button
              type="button"
              variant="outline-secondary"
              size="lg"
              onClick={onCancelarEdicion}
            >
              Cancelar
            </Button>
          )}
        </div>

      </Form>
    </>
  );
};

export default FormularioReserva;