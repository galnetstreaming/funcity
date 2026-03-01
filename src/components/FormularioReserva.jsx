import { useState, useEffect, useRef } from 'react';
import {
  Form, Button, Row, Col, Alert, Card, Badge, ButtonGroup, Spinner,
} from 'react-bootstrap';
import {
  crearReserva,
  eliminarBloqueo,
  consultarDisponibilidadReal,
  obtenerHorariosParaFecha,
  obtenerHorariosDisponibles,
  obtenerFeriadosRango,
  esFinDeSemana,
  validarHorarioSegunDia,
  PRECIO_SEMANA,
  PRECIO_FIN_SEMANA,
} from '../services/api';

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
  // Contacto del cliente (quién reserva)
  nombre_cliente:   '',
  apellido_cliente: '',
  email:            '',
  telefono:         '',
  notas:            '',
};

// ─────────────────────────────────────────────────────────────
const FormularioReserva = ({
  onReservaCreada,
  modoEdicion     = false,
  reservaEditar   = null,
  onCancelarEdicion,
}) => {
  const [formData, setFormData]             = useState(FORM_VACIO);
  const [errores, setErrores]               = useState({});
  const [enviando, setEnviando]             = useState(false);
  const [exito, setExito]                   = useState(null);
  const [errorGlobal, setErrorGlobal]       = useState('');

  // Verificación de disponibilidad en tiempo real
  const [dispEstado, setDispEstado]         = useState(null);
  const [dispMensaje, setDispMensaje]       = useState('');
  const [dispCapacidad, setDispCapacidad]   = useState(null);
  const dispTimerRef = useRef(null);

  // Feriados cargados desde ArgentinaDatos API
  const [feriados, setFeriados]             = useState({});
  const [infoFeriado, setInfoFeriado]       = useState(null);
  const [cargandoFeriados, setCargandoFeriados] = useState(false);

  // ── Cargar feriados al montar ─────────────────────────────
  useEffect(() => {
    const anio = new Date().getFullYear();
    setCargandoFeriados(true);
    obtenerFeriadosRango(anio, anio + 1)
      .then(mapa => { setFeriados(mapa); setCargandoFeriados(false); })
      .catch(() => setCargandoFeriados(false));
  }, []);

  // ── Detectar feriado al elegir fecha ──────────────────────
  useEffect(() => {
    setInfoFeriado(formData.fecha ? (feriados[formData.fecha] || null) : null);
  }, [formData.fecha, feriados]);

  // ── Pre-cargar datos al editar ────────────────────────────
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
        email:            reservaEditar.email && reservaEditar.email !== 'bloqueo@funcity.com.ar'
                            ? reservaEditar.email : '',
        telefono:         reservaEditar.telefono || '',
        notas:            reservaEditar.notas    || '',
      });
    } else if (!modoEdicion && reservaEditar?.fecha) {
      // Pre-carga desde calendario (solo fecha y hora)
      setFormData(prev => ({
        ...FORM_VACIO,
        fecha:       reservaEditar.fecha       || '',
        hora_inicio: reservaEditar.hora_inicio || '',
      }));
    }
  }, [modoEdicion, reservaEditar]);

  // ── Verificar disponibilidad (con debounce 600ms) ─────────
  useEffect(() => {
    if (!formData.fecha || !formData.hora_inicio || !formData.personas) {
      setDispEstado(null); setDispMensaje(''); setDispCapacidad(null);
      return;
    }
    // En edición, no re-verificar si fecha/hora no cambió
    if (modoEdicion && reservaEditar) {
      if (formData.fecha === reservaEditar.fecha &&
          formData.hora_inicio === reservaEditar.hora_inicio) {
        setDispEstado('disponible');
        setDispMensaje('✅ Horario original de la reserva');
        return;
      }
    }

    if (dispTimerRef.current) clearTimeout(dispTimerRef.current);
    setDispEstado('verificando');
    setDispMensaje('Verificando disponibilidad...');
    setDispCapacidad(null);

    dispTimerRef.current = setTimeout(async () => {
      const res = await consultarDisponibilidadReal({
        fecha:       formData.fecha,
        hora_inicio: formData.hora_inicio,
        personas:    parseInt(formData.personas) || 1,
      });
      if (res.disponible) {
        setDispEstado('disponible');
        setDispCapacidad(res.capacidadRestante ?? null);
        setDispMensaje(
          res.capacidadRestante != null
            ? `✅ Disponible — ${res.capacidadRestante} lugares libres`
            : '✅ Horario disponible'
        );
      } else {
        setDispEstado('ocupado');
        setDispCapacidad(0);
        setDispMensaje(res.error || '❌ Este horario no está disponible');
      }
    }, 600);

    return () => { if (dispTimerRef.current) clearTimeout(dispTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.fecha, formData.hora_inicio, formData.personas]);

  // ── Validación por campo ──────────────────────────────────
  const validarCampo = (name, value) => {
    switch (name) {
      case 'nombre_ninio':
        if (!value.trim() || value.trim().length < 2) return 'Nombre requerido (mínimo 2 caracteres)';
        if (value.trim().length > 60) return 'Máximo 60 caracteres';
        return '';
      case 'nombre_cliente':
        if (!value.trim() || value.trim().length < 2) return 'Nombre requerido (mínimo 2 caracteres)';
        if (value.trim().length > 60) return 'Máximo 60 caracteres';
        return '';
      case 'apellido_cliente':
        if (!value.trim() || value.trim().length < 2) return 'Apellido requerido (mínimo 2 caracteres)';
        if (value.trim().length > 60) return 'Máximo 60 caracteres';
        return '';
      case 'email':
        if (!value) return '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Email inválido (ej: nombre@dominio.com)';
        return '';
      case 'telefono': {
        if (!value) return '';
        if (/[^0-9\s+\-()]/.test(value)) return 'Solo números, espacios y los caracteres: + - ( )';
        const digits = value.replace(/\D/g, '');
        if (digits.length < 8)  return 'Mínimo 8 dígitos';
        if (digits.length > 15) return 'Máximo 15 dígitos';
        return '';
      }
      case 'personas': {
        if (!value) return 'La cantidad de personas es requerida';
        const p = parseInt(value);
        if (isNaN(p) || p < 1) return 'Mínimo 1 persona';
        if (p > 40)            return 'Máximo 40 personas';
        return '';
      }
      default: return '';
    }
  };

  // ── Handlers ─────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Teléfono: filtrar caracteres inválidos en tiempo real
    if (name === 'telefono') {
      const limpio = value.replace(/[^0-9\s+\-()]/g, '');
      setFormData(prev => ({ ...prev, telefono: limpio }));
      setErrores(prev => ({ ...prev, telefono: validarCampo('telefono', limpio) }));
      if (errorGlobal) setErrorGlobal('');
      return;
    }

    setFormData(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'fecha') next.hora_inicio = ''; // resetear hora al cambiar fecha
      return next;
    });
    setErrores(prev => ({ ...prev, [name]: validarCampo(name, value) }));
    if (errorGlobal) setErrorGlobal('');
  };

  const handleHoraClick     = (hora) => {
    setFormData(prev => ({ ...prev, hora_inicio: hora }));
    setErrores(prev => ({ ...prev, hora_inicio: '' }));
  };
  const handleTemaClick     = (tema)  => setFormData(prev => ({ ...prev, tema }));
  const handlePersonasQuick = (cant)  => {
    setFormData(prev => ({ ...prev, personas: String(cant) }));
    setErrores(prev => ({ ...prev, personas: '' }));
  };

  const handleReset = () => {
    setFormData(FORM_VACIO);
    setErrores({});
    setErrorGlobal('');
    setExito(null);
    setDispEstado(null);
    setInfoFeriado(null);
  };

  // ── Validación completa ───────────────────────────────────
  const validarFront = () => {
    const nuevos = {};

    const eN = validarCampo('nombre_ninio',     formData.nombre_ninio);
    if (eN) nuevos.nombre_ninio = eN;

    const eNC = validarCampo('nombre_cliente',   formData.nombre_cliente);
    if (eNC) nuevos.nombre_cliente = eNC;

    const eAC = validarCampo('apellido_cliente', formData.apellido_cliente);
    if (eAC) nuevos.apellido_cliente = eAC;

    if (!formData.fecha) {
      nuevos.fecha = 'La fecha es requerida';
    } else {
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const sel = new Date(formData.fecha + 'T00:00:00');
      if (sel < hoy) nuevos.fecha = 'La fecha no puede ser anterior a hoy';
      const max = new Date(); max.setMonth(max.getMonth() + 6);
      if (sel > max) nuevos.fecha = 'Máximo 6 meses de anticipación';
    }

    if (!formData.hora_inicio) {
      nuevos.hora_inicio = 'Seleccioná un horario';
    } else {
      const { valido, mensaje } = validarHorarioSegunDia(formData.fecha, formData.hora_inicio);
      if (!valido) nuevos.hora_inicio = mensaje;
    }

    const eP = validarCampo('personas', formData.personas);
    if (eP) nuevos.personas = eP;

    const eE = validarCampo('email', formData.email);
    if (eE) nuevos.email = eE;

    const eT = validarCampo('telefono', formData.telefono);
    if (eT) nuevos.telefono = eT;

    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) {
      setTimeout(() => {
        const el = document.querySelector('.is-invalid, [class*="text-danger"]');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
    }
    return Object.keys(nuevos).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validarFront()) return;

    if (dispEstado === 'ocupado' && !modoEdicion) {
      setErrorGlobal('❌ El horario seleccionado no está disponible. Elegí otra fecha u horario.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setEnviando(true);
    setErrorGlobal('');

    try {
      const datos = {
        fecha:            formData.fecha,
        hora_inicio:      formData.hora_inicio,
        personas:         parseInt(formData.personas),
        nombre_ninio:     formData.nombre_ninio.trim(),
        // Contacto del cliente → api.js lo incluye en el campo "notas" de Bookly
        nombre_cliente:   formData.nombre_cliente.trim()   || undefined,
        apellido_cliente: formData.apellido_cliente.trim() || undefined,
        email:            formData.email.trim()            || undefined,
        telefono:         formData.telefono.trim()         || undefined,
        tema:             formData.tema.trim()             || undefined,
        notas:            formData.notas.trim()            || undefined,
      };

      let resultado;
      if (modoEdicion && reservaEditar?.bloqueo_id) {
        await eliminarBloqueo(reservaEditar.bloqueo_id);
        resultado = await crearReserva(datos);
      } else {
        resultado = await crearReserva(datos);
      }

      setExito(resultado);
      if (onReservaCreada) onReservaCreada(resultado);
      if (!modoEdicion) handleReset();

    } catch (err) {
      setErrorGlobal(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setEnviando(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────
  const getFechaMin = () => new Date().toISOString().split('T')[0];
  const getFechaMax = () => {
    const d = new Date(); d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  };

  const fechaLegible = (f) => {
    if (!f) return '';
    return new Date(f + 'T00:00:00').toLocaleDateString('es-AR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const horariosDelDia  = formData.fecha ? obtenerHorariosParaFecha(formData.fecha) : [];
  const infoHorarios    = formData.fecha ? obtenerHorariosDisponibles(formData.fecha) : null;
  const finDeSemana     = formData.fecha ? esFinDeSemana(formData.fecha) : false;
  const personasNum     = parseInt(formData.personas) || 0;
  const precioActual    = infoHorarios?.precio || (finDeSemana ? PRECIO_FIN_SEMANA : PRECIO_SEMANA);
  const nombreCompleto  = [formData.nombre_cliente, formData.apellido_cliente].filter(Boolean).join(' ');
  const digitosTel      = formData.telefono.replace(/\D/g, '').length;

  // ─────────────────────────────────────────────────────────
  //  VISTA ÉXITO
  // ─────────────────────────────────────────────────────────
  if (exito && !modoEdicion) {
    return (
      <Alert variant="success" className="p-4">
        <div className="text-center mb-3">
          <span style={{ fontSize: '3rem' }}>🎉</span>
        </div>
        <Alert.Heading className="text-center">¡Reserva Creada con Éxito!</Alert.Heading>
        <hr />
        <Row>
          <Col md={6}>
            <p className="mb-2">
              <strong>🆔 ID Bloqueo:</strong>{' '}
              <Badge bg="success" className="fs-6">#{exito.bloqueo_id}</Badge>
            </p>
            <p className="mb-2"><strong>🎂 Festejado/a:</strong> {exito.nombre_ninio}</p>
            <p className="mb-2"><strong>📅 Fecha:</strong> {fechaLegible(exito.fecha)}</p>
            <p className="mb-2"><strong>🕐 Hora:</strong> {exito.hora_inicio}</p>
          </Col>
          <Col md={6}>
            <p className="mb-2"><strong>👥 Personas:</strong> {exito.personas}</p>
            {exito.tema && <p className="mb-2"><strong>🎨 Tema:</strong> {exito.tema}</p>}
            {(exito.nombre_cliente || exito.apellido_cliente) && (
              <p className="mb-2">
                <strong>👤 Contacto:</strong>{' '}
                {[exito.nombre_cliente, exito.apellido_cliente].filter(Boolean).join(' ')}
              </p>
            )}
            {exito.email && exito.email !== 'bloqueo@funcity.com.ar' && (
              <p className="mb-2"><strong>📧</strong> {exito.email}</p>
            )}
            {exito.telefono && (
              <p className="mb-2"><strong>📱</strong> {exito.telefono}</p>
            )}
          </Col>
        </Row>
        <div className="text-center mt-3">
          <Button variant="success" onClick={handleReset}>➕ Nueva Reserva</Button>
        </div>
      </Alert>
    );
  }

  // ─────────────────────────────────────────────────────────
  //  RENDER PRINCIPAL
  // ─────────────────────────────────────────────────────────
  return (
    <Form onSubmit={handleSubmit} noValidate>

      {/* Error global */}
      {errorGlobal && (
        <Alert variant="danger" dismissible onClose={() => setErrorGlobal('')} className="mb-4">
          <strong>⚠️ Error:</strong> {errorGlobal}
        </Alert>
      )}

      {/* Éxito en modo edición */}
      {exito && modoEdicion && (
        <Alert variant="success" dismissible onClose={() => setExito(null)} className="mb-4">
          ✅ Reserva actualizada — Nuevo ID: <Badge bg="success">#{exito.bloqueo_id}</Badge>
        </Alert>
      )}

      {/* Banner de precios y horarios — datos desde api.js */}
      <Alert variant="info" className="mb-4 py-3">
        <div className="d-flex align-items-start gap-2">
          <span style={{ fontSize: '1.4rem' }}>📅</span>
          <div style={{ flex: 1 }}>
            <strong className="d-block mb-2">Horarios y Precios</strong>
            <Row className="g-2">
              <Col xs={12} sm={6}>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <Badge bg="primary">Fin de semana / Feriados</Badge>
                  <small className="text-muted">10:30 · 12:20 · 14:10 · 16:00</small>
                  <Badge bg="success">{PRECIO_FIN_SEMANA}</Badge>
                </div>
              </Col>
              <Col xs={12} sm={6}>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <Badge bg="secondary">Lunes a Viernes</Badge>
                  <small className="text-muted">12:30 · 14:20 · 16:10</small>
                  <Badge bg="success">{PRECIO_SEMANA}</Badge>
                </div>
              </Col>
            </Row>
          </div>
        </div>
      </Alert>

      {/* ══════════════════════════════════════════
          SECCIÓN 1 — Festejado/a
      ══════════════════════════════════════════ */}
      <Card className="mb-4 border-primary shadow-sm">
        <Card.Header className="bg-primary bg-opacity-10">
          <h5 className="mb-0 text-primary">🎂 Datos del Festejado/a</h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">
                  Nombre del Niño/a <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="text"
                  name="nombre_ninio"
                  value={formData.nombre_ninio}
                  onChange={handleChange}
                  placeholder="Ej: Valentina García"
                  isInvalid={!!errores.nombre_ninio}
                  isValid={!!formData.nombre_ninio && !errores.nombre_ninio}
                  size="lg"
                  maxLength={60}
                  autoComplete="off"
                />
                <Form.Control.Feedback type="invalid">{errores.nombre_ninio}</Form.Control.Feedback>
                <Form.Text className="text-muted">
                  💡 Aparece en Bookly como: <em>«BLOQUEO - Cumple {formData.nombre_ninio || 'Nombre'}»</em>
                </Form.Text>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">Tema del Cumpleaños</Form.Label>
                <Form.Control
                  type="text"
                  name="tema"
                  value={formData.tema}
                  onChange={handleChange}
                  placeholder="Ej: Superhéroes Marvel"
                  size="lg"
                  list="temas-sugeridos"
                  maxLength={80}
                />
                <datalist id="temas-sugeridos">
                  {TEMAS_POPULARES.map(t => <option key={t} value={t} />)}
                </datalist>
                <Form.Text className="text-muted">Sugerencias:</Form.Text>
                <div className="d-flex flex-wrap gap-1 mt-1">
                  {TEMAS_POPULARES.map(t => (
                    <Badge
                      key={t}
                      bg={formData.tema === t ? 'primary' : 'light'}
                      text={formData.tema === t ? 'white' : 'dark'}
                      style={{ cursor: 'pointer', fontSize: '0.72rem', border: '1px solid #dee2e6' }}
                      onClick={() => handleTemaClick(t)}
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* ══════════════════════════════════════════
          SECCIÓN 2 — Fecha y Horario
      ══════════════════════════════════════════ */}
      <Card className="mb-4 border-success shadow-sm">
        <Card.Header className="bg-success bg-opacity-10">
          <h5 className="mb-0 text-success">📆 Fecha y Horario</h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={5}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">
                  Fecha <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="date"
                  name="fecha"
                  value={formData.fecha}
                  onChange={handleChange}
                  min={getFechaMin()}
                  max={getFechaMax()}
                  isInvalid={!!errores.fecha}
                  size="lg"
                />
                <Form.Control.Feedback type="invalid">{errores.fecha}</Form.Control.Feedback>

                {/* Info de fecha seleccionada: precio, tipo día y feriado desde API */}
                {formData.fecha && (
                  <Alert variant="light" className="mt-2 py-2 mb-0 border">
                    <small>
                      <strong>{fechaLegible(formData.fecha)}</strong>
                      <span className="d-flex align-items-center gap-2 flex-wrap mt-1">
                        {finDeSemana
                          ? <Badge bg="primary">Fin de semana</Badge>
                          : <Badge bg="secondary">Entre semana</Badge>
                        }
                        <Badge bg="success">{precioActual}</Badge>
                        {/* Feriado detectado automáticamente vía API de feriados */}
                        {infoFeriado && (
                          <Badge bg="warning" text="dark">
                            {infoFeriado.tipo === 'puente' ? '🌉' : '🏖️'} {infoFeriado.nombre}
                          </Badge>
                        )}
                        {cargandoFeriados && (
                          <small className="text-muted">
                            <Spinner animation="border" size="sm" className="me-1" />
                            Cargando feriados...
                          </small>
                        )}
                      </span>
                    </small>
                  </Alert>
                )}
              </Form.Group>
            </Col>

            <Col md={7}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">
                  Hora de Inicio <span className="text-danger">*</span>
                </Form.Label>

                {formData.fecha ? (
                  <>
                    <div className="d-grid gap-2">
                      {horariosDelDia.map(hora => (
                        <Button
                          key={hora}
                          type="button"
                          variant={formData.hora_inicio === hora ? 'success' : 'outline-success'}
                          onClick={() => handleHoraClick(hora)}
                          className="text-start d-flex align-items-center justify-content-between"
                          size="lg"
                        >
                          <span>🕐 {hora}</span>
                          {formData.hora_inicio === hora && (
                            <Badge bg="light" text="dark">✓ Seleccionado</Badge>
                          )}
                        </Button>
                      ))}
                    </div>
                    {errores.hora_inicio && (
                      <div className="text-danger small mt-2">{errores.hora_inicio}</div>
                    )}
                  </>
                ) : (
                  <Alert variant="warning" className="mb-0 py-2">
                    <small>👆 Primero seleccioná una fecha para ver los horarios disponibles</small>
                  </Alert>
                )}
              </Form.Group>
            </Col>
          </Row>

          {/* Verificador de disponibilidad en tiempo real */}
          {formData.fecha && formData.hora_inicio && formData.personas && (
            <Alert
              variant={
                dispEstado === 'verificando' ? 'light'   :
                dispEstado === 'disponible'  ? 'success' :
                dispEstado === 'ocupado'     ? 'danger'  : 'light'
              }
              className="mb-0 d-flex align-items-center gap-2 py-2"
            >
              {dispEstado === 'verificando' && <Spinner animation="border" size="sm" />}
              <span style={{ flex: 1 }}>{dispMensaje}</span>
              {dispEstado === 'disponible' && dispCapacidad != null && (
                <Badge bg="success">{dispCapacidad} lugares libres</Badge>
              )}
            </Alert>
          )}
        </Card.Body>
      </Card>

      {/* ══════════════════════════════════════════
          SECCIÓN 3 — Invitados
      ══════════════════════════════════════════ */}
      <Card className="mb-4 border-warning shadow-sm">
        <Card.Header className="bg-warning bg-opacity-10">
          <h5 className="mb-0 text-warning">👥 Cantidad de Invitados</h5>
        </Card.Header>
        <Card.Body>
          <Form.Group>
            <Form.Label className="fw-bold">
              Cantidad de Personas <span className="text-danger">*</span>
            </Form.Label>

            {/* Stepper */}
            <Row className="align-items-center g-3 mb-2">
              <Col xs="auto">
                <Button
                  type="button"
                  variant="outline-secondary"
                  onClick={() => handlePersonasQuick(Math.max(1, personasNum - 1))}
                  disabled={personasNum <= 1}
                  style={{ width: 48, height: 48, fontSize: 22 }}
                >−</Button>
              </Col>
              <Col xs={3} md={2}>
                <Form.Control
                  type="number"
                  name="personas"
                  value={formData.personas}
                  onChange={handleChange}
                  min="1" max="40"
                  isInvalid={!!errores.personas}
                  size="lg"
                  className="text-center fw-bold"
                  style={{ fontSize: '1.4rem' }}
                />
              </Col>
              <Col xs="auto">
                <Button
                  type="button"
                  variant="outline-secondary"
                  onClick={() => handlePersonasQuick(Math.min(40, personasNum + 1))}
                  disabled={personasNum >= 40}
                  style={{ width: 48, height: 48, fontSize: 22 }}
                >+</Button>
              </Col>
              {personasNum > 0 && !errores.personas && (
                <Col xs="auto">
                  <Badge
                    bg={personasNum <= 20 ? 'success' : personasNum <= 30 ? 'warning' : 'danger'}
                    className="fs-6"
                  >
                    {personasNum} {personasNum === 1 ? 'persona' : 'personas'}
                  </Badge>
                </Col>
              )}
            </Row>

            {errores.personas && (
              <div className="text-danger small mb-2">{errores.personas}</div>
            )}

            {/* Barra de capacidad */}
            {personasNum > 0 && (
              <div className="mb-3">
                <div style={{ height: 8, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, (personasNum / 40) * 100)}%`,
                    background: personasNum <= 20 ? '#22c55e' : personasNum <= 30 ? '#f59e0b' : '#ef4444',
                    borderRadius: 4,
                    transition: 'width .3s ease',
                  }} />
                </div>
                <small className="text-muted">
                  Capacidad: <strong>{Math.round((personasNum / 40) * 100)}%</strong> · Máximo 40 personas
                </small>
              </div>
            )}

            {/* Acceso rápido */}
            <div>
              <small className="text-muted d-block mb-2">⚡ Acceso rápido:</small>
              <ButtonGroup size="sm" className="flex-wrap">
                {[5, 10, 15, 20, 25, 30, 35, 40].map(cant => (
                  <Button
                    key={cant}
                    type="button"
                    variant={personasNum === cant ? 'primary' : 'outline-primary'}
                    onClick={() => handlePersonasQuick(cant)}
                  >
                    {cant}
                  </Button>
                ))}
              </ButtonGroup>
            </div>
          </Form.Group>
        </Card.Body>
      </Card>

      {/* ══════════════════════════════════════════
          SECCIÓN 4 — Contacto del cliente
      ══════════════════════════════════════════ */}
      <Card className="mb-4 border-info shadow-sm">
        <Card.Header className="bg-info bg-opacity-10">
          <div>
            <h5 className="mb-0 text-info">👤 Datos de Contacto</h5>
            <small className="text-muted">Persona que realiza la reserva</small>
          </div>
        </Card.Header>
        <Card.Body>

          {/* Nombre y Apellido */}
          <Row className="mb-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label className="fw-bold">
                  Nombre <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="text"
                  name="nombre_cliente"
                  value={formData.nombre_cliente}
                  onChange={handleChange}
                  placeholder="Ej: María"
                  isInvalid={!!errores.nombre_cliente}
                  isValid={!!formData.nombre_cliente && !errores.nombre_cliente}
                  size="lg"
                  maxLength={60}
                  autoComplete="given-name"
                />
                <Form.Control.Feedback type="invalid">{errores.nombre_cliente}</Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label className="fw-bold">
                  Apellido <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="text"
                  name="apellido_cliente"
                  value={formData.apellido_cliente}
                  onChange={handleChange}
                  placeholder="Ej: González"
                  isInvalid={!!errores.apellido_cliente}
                  isValid={!!formData.apellido_cliente && !errores.apellido_cliente}
                  size="lg"
                  maxLength={60}
                  autoComplete="family-name"
                />
                <Form.Control.Feedback type="invalid">{errores.apellido_cliente}</Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

          {/* Email y Teléfono */}
          <Row className="mb-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label className="fw-bold">
                  Email
                  <small className="text-muted fw-normal ms-1">(opcional)</small>
                </Form.Label>
                <Form.Control
                  type="text"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="ejemplo@mail.com"
                  isInvalid={!!errores.email}
                  isValid={!!formData.email && !errores.email}
                  size="lg"
                  autoComplete="email"
                  inputMode="email"
                />
                <Form.Control.Feedback type="invalid">{errores.email}</Form.Control.Feedback>
                <Form.Text className={formData.email && !errores.email ? 'text-success' : 'text-muted'}>
                  {formData.email && !errores.email
                    ? '✅ Email válido'
                    : '📧 Si no se ingresa, se usa bloqueo@funcity.com.ar'
                  }
                </Form.Text>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label className="fw-bold">
                  Teléfono
                  <small className="text-muted fw-normal ms-1">(opcional)</small>
                </Form.Label>
                <Form.Control
                  type="tel"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  placeholder="Ej: 11 2345-6789"
                  isInvalid={!!errores.telefono}
                  isValid={!!formData.telefono && !errores.telefono && digitosTel >= 8}
                  size="lg"
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={20}
                />
                <Form.Control.Feedback type="invalid">{errores.telefono}</Form.Control.Feedback>
                <Form.Text className={formData.telefono && !errores.telefono ? 'text-success' : 'text-muted'}>
                  {formData.telefono && !errores.telefono
                    ? `✅ ${digitosTel} dígitos`
                    : '📱 Ej: 11 2345-6789 · +54 9 11 2345 6789'
                  }
                </Form.Text>

                {/* Barra indicadora de dígitos */}
                {formData.telefono && (
                  <div className="mt-1">
                    <div style={{ height: 4, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, (digitosTel / 15) * 100)}%`,
                        background: errores.telefono ? '#ef4444' : digitosTel >= 8 ? '#22c55e' : '#f59e0b',
                        borderRadius: 2,
                        transition: 'width .2s',
                      }} />
                    </div>
                    <small className="text-muted">{digitosTel}/15 dígitos</small>
                  </div>
                )}
              </Form.Group>
            </Col>
          </Row>

          {/* Notas */}
          <Form.Group>
            <Form.Label className="fw-bold">Notas Adicionales</Form.Label>
            <Form.Control
              as="textarea"
              name="notas"
              value={formData.notas}
              onChange={handleChange}
              placeholder="Preferencias especiales, decoración, necesidades particulares..."
              rows={3}
              maxLength={500}
            />
            <Form.Text className="text-muted">{formData.notas.length}/500 caracteres</Form.Text>
          </Form.Group>
        </Card.Body>
      </Card>

      {/* ── Resumen previo al envío ───────────────────────── */}
      {formData.fecha && formData.hora_inicio && formData.personas && (
        <Alert variant="success" className="mb-4">
          <h6 className="alert-heading fw-bold">✨ Resumen de la Reserva</h6>
          <hr />
          <Row>
            <Col md={6}>
              <p className="mb-1">
                <strong>🎂 Festejado/a:</strong>{' '}
                {formData.nombre_ninio || <em className="text-muted">Sin especificar</em>}
              </p>
              <p className="mb-1"><strong>📅 Fecha:</strong> {fechaLegible(formData.fecha)}</p>
              <p className="mb-1"><strong>🕐 Hora:</strong> {formData.hora_inicio}</p>
              <p className="mb-1">
                <strong>💰 Precio:</strong> <Badge bg="success">{precioActual}</Badge>
                {infoFeriado && (
                  <Badge bg="warning" text="dark" className="ms-1" style={{ fontSize: '0.7rem' }}>
                    {infoFeriado.tipo === 'puente' ? '🌉' : '🏖️'} {infoFeriado.nombre}
                  </Badge>
                )}
              </p>
            </Col>
            <Col md={6}>
              <p className="mb-1"><strong>👥 Personas:</strong> {formData.personas}</p>
              <p className="mb-1">
                <strong>🎨 Tema:</strong>{' '}
                {formData.tema || <em className="text-muted">Sin especificar</em>}
              </p>
              {nombreCompleto && (
                <p className="mb-1"><strong>👤 Contacto:</strong> {nombreCompleto}</p>
              )}
              {formData.telefono && !errores.telefono && (
                <p className="mb-1"><strong>📱</strong> {formData.telefono}</p>
              )}
            </Col>
          </Row>
        </Alert>
      )}

      {/* ── Botones ──────────────────────────────────────── */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div className="d-flex gap-2">
          {modoEdicion && onCancelarEdicion && (
            <Button
              type="button"
              variant="outline-secondary"
              onClick={onCancelarEdicion}
              disabled={enviando}
            >
              ✕ Cancelar
            </Button>
          )}
          <Button
            type="button"
            variant="outline-secondary"
            onClick={handleReset}
            disabled={enviando}
          >
            🔄 Limpiar
          </Button>
        </div>

        <Button
          type="submit"
          variant={modoEdicion ? 'warning' : 'primary'}
          size="lg"
          disabled={enviando || (dispEstado === 'ocupado' && !modoEdicion)}
        >
          {enviando ? (
            <><Spinner animation="border" size="sm" className="me-2" />Guardando...</>
          ) : modoEdicion ? (
            '💾 Actualizar Reserva'
          ) : (
            '🎉 Confirmar Reserva'
          )}
        </Button>
      </div>

      {/* Nota importante */}
      <Alert variant="light" className="border mb-0 py-2">
        <small>
          <strong>📝 Importante:</strong> Los campos marcados con <span className="text-danger">*</span> son
          obligatorios. La reserva bloquea el turno en Bookly como <em>«BLOQUEO - Cumple [nombre]»</em>.
          El nombre y apellido del contacto se incluyen en las notas del bloqueo.
          {modoEdicion && (
            <strong className="d-block mt-1">
              ⚠️ Al actualizar se elimina la reserva anterior y se crea una nueva.
            </strong>
          )}
        </small>
      </Alert>

    </Form>
  );
};

export default FormularioReserva;