import { useState, useEffect } from 'react';
import {
  Form, Button, Row, Col, Alert, Card, Badge, ButtonGroup, Spinner
} from 'react-bootstrap';
import {
  crearReserva,
  eliminarBloqueo,
  consultarDisponibilidadReal,
  obtenerHorariosParaFecha,
  esFinDeSemana,
  validarDatosReserva,
  validarHorarioSegunDia,
} from '../services/api';

// ─── Temas sugeridos ──────────────────────────────────────────
const TEMAS_POPULARES = [
  '🦸 Superhéroes', '👸 Princesas', '🦖 Dinosaurios', '🎮 Videojuegos',
  '⚽ Deportes',    '🎨 Arte',      '🚀 Espacio',     '🧚 Hadas',
  '🦄 Unicornios',  '🏴‍☠️ Piratas', '❄️ Frozen',      '🕷️ Spider-Man',
  '🚗 Cars',        '🧱 Minecraft', '🪄 Harry Potter','🐾 Paw Patrol',
];

const FORM_VACIO = {
  nombre_ninio: '', fecha: '', hora_inicio: '',
  personas: '', email: '', telefono: '', tema: '', notas: '',
};

// ─── Componente principal ─────────────────────────────────────
const FormularioReserva = ({
  onReservaCreada,   // callback (reserva) => void — llamado al guardar con éxito
  modoEdicion = false,
  reservaEditar = null,
  onCancelarEdicion,
}) => {
  const [formData, setFormData]         = useState(FORM_VACIO);
  const [errores, setErrores]           = useState({});
  const [enviando, setEnviando]         = useState(false);
  const [exito, setExito]               = useState(null);   // objeto reserva creada
  const [errorGlobal, setErrorGlobal]   = useState('');

  // Verificación de disponibilidad en tiempo real
  const [dispEstado, setDispEstado]     = useState(null);   // null | 'verificando' | 'disponible' | 'ocupado' | 'error'
  const [dispMensaje, setDispMensaje]   = useState('');
  const [dispCapacidad, setDispCapacidad] = useState(null);

  // ── Cargar datos al editar ──────────────────────────────────
  useEffect(() => {
    if (modoEdicion && reservaEditar) {
      setFormData({
        nombre_ninio: reservaEditar.nombre_ninio || '',
        fecha:        reservaEditar.fecha        || '',
        hora_inicio:  reservaEditar.hora_inicio  || '',
        personas:     String(reservaEditar.personas || ''),
        email:        reservaEditar.email && reservaEditar.email !== 'bloqueo@funcity.com.ar' ? reservaEditar.email : '',
        telefono:     reservaEditar.telefono || '',
        tema:         reservaEditar.tema     || '',
        notas:        reservaEditar.notas    || '',
      });
    }
  }, [modoEdicion, reservaEditar]);

  // ── Verificar disponibilidad cuando cambian fecha/hora/personas ──
  useEffect(() => {
    if (!formData.fecha || !formData.hora_inicio || !formData.personas) {
      setDispEstado(null); setDispMensaje(''); setDispCapacidad(null);
      return;
    }
    // En modo edición no re-verificar si no cambió fecha/hora
    if (modoEdicion && reservaEditar) {
      const mismaFechaHora =
        formData.fecha === reservaEditar.fecha &&
        formData.hora_inicio === reservaEditar.hora_inicio;
      if (mismaFechaHora) {
        setDispEstado('disponible');
        setDispMensaje('Horario original de la reserva');
        return;
      }
    }

    let cancelado = false;
    setDispEstado('verificando');
    setDispMensaje('Verificando disponibilidad...');

    consultarDisponibilidadReal({
      fecha:       formData.fecha,
      hora_inicio: formData.hora_inicio,
      personas:    parseInt(formData.personas) || 1,
    }).then(res => {
      if (cancelado) return;
      if (res.disponible) {
        setDispEstado('disponible');
        setDispCapacidad(res.capacidadRestante);
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
    });
    return () => { cancelado = true; };
  }, [formData.fecha, formData.hora_inicio, formData.personas]);

  // ── Validación en tiempo real por campo ──────────────────────
  const validarCampo = (name, value) => {
    switch (name) {
      case 'nombre_ninio':
        if (!value.trim() || value.trim().length < 2)
          return 'Nombre requerido (mínimo 2 caracteres)';
        if (value.trim().length > 60)
          return 'Máximo 60 caracteres';
        return '';

      case 'email':
        if (!value) return ''; // opcional
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
          return 'Email inválido (ej: nombre@dominio.com)';
        return '';

      case 'telefono':
        if (!value) return ''; // opcional
        // Solo dígitos, espacios, +, -, ()
        if (/[^0-9\s\+\-\(\)]/.test(value))
          return 'Solo se permiten números, espacios y los caracteres: + - ( )';
        const soloDigitos = value.replace(/\D/g, '');
        if (soloDigitos.length < 8)
          return 'Mínimo 8 dígitos';
        if (soloDigitos.length > 15)
          return 'Máximo 15 dígitos';
        return '';

      case 'personas': {
        if (!value) return 'La cantidad de personas es requerida';
        const p = parseInt(value);
        if (isNaN(p) || p < 1) return 'Mínimo 1 persona';
        if (p > 40)            return 'Máximo 40 personas';
        return '';
      }

      default:
        return '';
    }
  };

  // ── Handlers ─────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Teléfono: bloquear letras y caracteres no permitidos en tiempo real
    if (name === 'telefono') {
      const limpio = value.replace(/[^0-9\s\+\-\(\)]/g, '');
      const errorInmediato = validarCampo('telefono', limpio);
      setFormData(prev => ({ ...prev, telefono: limpio }));
      setErrores(prev => ({ ...prev, telefono: errorInmediato }));
      if (errorGlobal) setErrorGlobal('');
      return;
    }

    setFormData(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'fecha') next.hora_inicio = ''; // reset hora al cambiar fecha
      return next;
    });

    // Validar el campo mientras escribe (solo si ya tiene valor o ya fue tocado)
    const errorCampo = validarCampo(name, value);
    setErrores(prev => ({ ...prev, [name]: errorCampo }));
    if (errorGlobal) setErrorGlobal('');
  };

  const handleHoraClick = (hora) => {
    setFormData(prev => ({ ...prev, hora_inicio: hora }));
    if (errores.hora_inicio) setErrores(prev => ({ ...prev, hora_inicio: '' }));
  };

  const handleTemaClick = (tema) => {
    setFormData(prev => ({ ...prev, tema }));
  };

  const handlePersonasQuick = (cant) => {
    setFormData(prev => ({ ...prev, personas: String(cant) }));
    if (errores.personas) setErrores(prev => ({ ...prev, personas: '' }));
  };

  const handleReset = () => {
    setFormData(FORM_VACIO);
    setErrores({});
    setErrorGlobal('');
    setExito(null);
    setDispEstado(null);
  };

  // ── Validación completa al enviar ─────────────────────────────
  const validarFront = () => {
    const nuevos = {};

    // Nombre
    const errNombre = validarCampo('nombre_ninio', formData.nombre_ninio);
    if (errNombre) nuevos.nombre_ninio = errNombre;

    // Fecha
    if (!formData.fecha) {
      nuevos.fecha = 'La fecha es requerida';
    } else {
      const hoy = new Date(); hoy.setHours(0,0,0,0);
      const sel = new Date(formData.fecha + 'T00:00:00');
      if (sel < hoy) nuevos.fecha = 'La fecha no puede ser anterior a hoy';
      const max = new Date(); max.setMonth(max.getMonth() + 6);
      if (sel > max) nuevos.fecha = 'Máximo 6 meses de anticipación';
    }

    // Hora
    if (!formData.hora_inicio) {
      nuevos.hora_inicio = 'Seleccioná un horario';
    } else {
      const valH = validarHorarioSegunDia(formData.fecha, formData.hora_inicio);
      if (!valH.valido) nuevos.hora_inicio = valH.mensaje;
    }

    // Personas
    const errPersonas = validarCampo('personas', formData.personas);
    if (errPersonas) nuevos.personas = errPersonas;

    // Email
    const errEmail = validarCampo('email', formData.email);
    if (errEmail) nuevos.email = errEmail;

    // Teléfono
    const errTelefono = validarCampo('telefono', formData.telefono);
    if (errTelefono) nuevos.telefono = errTelefono;

    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validarFront()) return;

    if (dispEstado === 'ocupado' && !modoEdicion) {
      setErrorGlobal('❌ El horario seleccionado no está disponible. Elegí otra fecha u horario.');
      return;
    }

    setEnviando(true);
    setErrorGlobal('');

    try {
      const datos = {
        fecha:        formData.fecha,
        hora_inicio:  formData.hora_inicio,
        personas:     parseInt(formData.personas),
        nombre_ninio: formData.nombre_ninio.trim(),
        email:        formData.email.trim()    || undefined,
        telefono:     formData.telefono.trim() || undefined,
        tema:         formData.tema.trim()     || undefined,
        notas:        formData.notas.trim()    || undefined,
      };

      let reservaResultado;

      if (modoEdicion && reservaEditar?.bloqueo_id) {
        // Edición: eliminar bloqueo anterior y crear nuevo
        await eliminarBloqueo(reservaEditar.bloqueo_id);
        reservaResultado = await crearReserva(datos);
      } else {
        reservaResultado = await crearReserva(datos);
      }

      setExito(reservaResultado);
      if (onReservaCreada) onReservaCreada(reservaResultado);
      if (!modoEdicion) handleReset();

    } catch (err) {
      setErrorGlobal(err.message);
    } finally {
      setEnviando(false);
    }
  };

  // ── Helpers de render ─────────────────────────────────────────
  const obtenerFechaMinima = () => new Date().toISOString().split('T')[0];

  const formatearFechaLegible = (fecha) => {
    if (!fecha) return '';
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es-AR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const horariosDelDia = formData.fecha ? obtenerHorariosParaFecha(formData.fecha) : [];
  const finDeSemana    = formData.fecha ? esFinDeSemana(formData.fecha) : false;
  const personasNum    = parseInt(formData.personas) || 0;

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  // ── Vista de éxito ──
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
            <p><strong>🆔 ID Bloqueo:</strong> <Badge bg="success">#{exito.bloqueo_id}</Badge></p>
            <p><strong>🎂 Festejado/a:</strong> {exito.nombre_ninio}</p>
            <p><strong>📅 Fecha:</strong> {formatearFechaLegible(exito.fecha)}</p>
          </Col>
          <Col md={6}>
            <p><strong>🕐 Hora:</strong> {exito.hora_inicio}</p>
            <p><strong>👥 Personas:</strong> {exito.personas}</p>
            {exito.tema && <p><strong>🎨 Tema:</strong> {exito.tema}</p>}
          </Col>
        </Row>
        <div className="d-flex justify-content-center gap-3 mt-3">
          <Button variant="success" onClick={handleReset}>
            ➕ Nueva Reserva
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <Form onSubmit={handleSubmit} noValidate>

      {/* ── Error global ── */}
      {errorGlobal && (
        <Alert variant="danger" onClose={() => setErrorGlobal('')} dismissible>
          {errorGlobal}
        </Alert>
      )}

      {/* ── Éxito en modo edición ── */}
      {exito && modoEdicion && (
        <Alert variant="success" dismissible onClose={() => setExito(null)}>
          ✅ Reserva actualizada correctamente — Nuevo ID: <Badge bg="success">#{exito.bloqueo_id}</Badge>
        </Alert>
      )}

      {/* ── Info horarios ── */}
      <Alert variant="info" className="mb-4">
        <div className="d-flex align-items-start gap-2">
          <span className="fs-4">📅</span>
          <div>
            <strong>Horarios disponibles:</strong>
            <div className="d-flex flex-wrap gap-3 mt-2">
              <div>
                <Badge bg="primary" className="me-1">Fin de semana y feriados</Badge>
                <small className="text-muted">10:30 · 12:20 · 14:10 · 16:00</small>
                <Badge bg="success" className="ms-2">$28.000</Badge>
              </div>
              <div>
                <Badge bg="secondary" className="me-1">Lunes a viernes</Badge>
                <small className="text-muted">12:30 · 14:20 · 16:10</small>
                <Badge bg="success" className="ms-2">$25.000</Badge>
              </div>
            </div>
          </div>
        </div>
      </Alert>

      {/* ══════════════════════════════════════════
          SECCIÓN 1 — Datos del festejado/a
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
                  size="lg"
                  maxLength={60}
                />
                <Form.Control.Feedback type="invalid">{errores.nombre_ninio}</Form.Control.Feedback>
                <Form.Text className="text-muted">
                  💡 Aparecerá en el calendario de Bookly como «BLOQUEO - Cumple {formData.nombre_ninio || 'Nombre'}»
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
                  list="temas-list"
                  maxLength={80}
                />
                <datalist id="temas-list">
                  {TEMAS_POPULARES.map(t => <option key={t} value={t} />)}
                </datalist>
                <Form.Text className="text-muted">Podés escribir el tuyo o elegir uno de los populares:</Form.Text>
                <div className="d-flex flex-wrap gap-1 mt-2">
                  {TEMAS_POPULARES.map(t => (
                    <Badge
                      key={t}
                      bg={formData.tema === t ? 'primary' : 'light'}
                      text={formData.tema === t ? 'white' : 'dark'}
                      style={{ cursor: 'pointer', fontSize: '0.75rem' }}
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
          SECCIÓN 2 — Fecha y horario
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
                  min={obtenerFechaMinima()}
                  isInvalid={!!errores.fecha}
                  size="lg"
                />
                <Form.Control.Feedback type="invalid">{errores.fecha}</Form.Control.Feedback>

                {formData.fecha && (
                  <Alert variant="light" className="mt-2 py-2 mb-0 border">
                    <small>
                      📅 {formatearFechaLegible(formData.fecha)}
                      {' '}
                      {finDeSemana
                        ? <Badge bg="primary">Fin de semana — $28.000</Badge>
                        : <Badge bg="secondary">Entre semana — $25.000</Badge>
                      }
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
                          variant={formData.hora_inicio === hora ? 'success' : 'outline-success'}
                          onClick={() => handleHoraClick(hora)}
                          className="text-start d-flex align-items-center justify-content-between"
                          size="lg"
                          type="button"
                        >
                          <span><span className="me-2">🕐</span>{hora}</span>
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
                  <Alert variant="warning" className="mb-0">
                    <small>👆 Primero seleccioná una fecha para ver los horarios disponibles</small>
                  </Alert>
                )}
              </Form.Group>
            </Col>
          </Row>

          {/* ── Verificador de disponibilidad ── */}
          {formData.fecha && formData.hora_inicio && formData.personas && (
            <Alert
              variant={
                dispEstado === 'verificando' ? 'light' :
                dispEstado === 'disponible'  ? 'success' :
                dispEstado === 'ocupado'     ? 'danger'  : 'light'
              }
              className="mb-0 d-flex align-items-center gap-2"
            >
              {dispEstado === 'verificando' && <Spinner animation="border" size="sm" />}
              <span>{dispMensaje}</span>
              {dispEstado === 'disponible' && dispCapacidad != null && (
                <Badge bg="success" className="ms-auto">{dispCapacidad} lugares libres</Badge>
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

            <Row className="align-items-center g-3">
              <Col xs="auto">
                <Button
                  variant="outline-secondary"
                  type="button"
                  onClick={() => handlePersonasQuick(Math.max(1, personasNum - 1))}
                  disabled={personasNum <= 1}
                  style={{ width: 48, height: 48, fontSize: 20 }}
                >
                  −
                </Button>
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
                  variant="outline-secondary"
                  type="button"
                  onClick={() => handlePersonasQuick(Math.min(40, personasNum + 1))}
                  disabled={personasNum >= 40}
                  style={{ width: 48, height: 48, fontSize: 20 }}
                >
                  +
                </Button>
              </Col>
              {formData.personas && !errores.personas && (
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

            <Form.Control.Feedback type="invalid" style={{ display: errores.personas ? 'block' : 'none' }}>
              {errores.personas}
            </Form.Control.Feedback>

            <div className="mt-3">
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

            <Form.Text className="text-muted d-block mt-2">
              📊 Mínimo 1 persona · Máximo 40 personas
              {personasNum > 0 && (
                <span className="ms-2">
                  · Capacidad usada: <strong>{Math.round((personasNum / 40) * 100)}%</strong>
                </span>
              )}
            </Form.Text>
          </Form.Group>
        </Card.Body>
      </Card>

      {/* ══════════════════════════════════════════
          SECCIÓN 4 — Contacto
      ══════════════════════════════════════════ */}
      <Card className="mb-4 border-info shadow-sm">
        <Card.Header className="bg-info bg-opacity-10">
          <h5 className="mb-0 text-info">📞 Datos de Contacto</h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">
                  Email del Cliente
                  <span className="text-muted fw-normal ms-1" style={{ fontSize: '0.78rem' }}>(opcional)</span>
                </Form.Label>
                <div className="input-with-status">
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
                  {!!formData.email && !errores.email && (
                    <span className="field-valid-icon">✓</span>
                  )}
                </div>
                <Form.Control.Feedback type="invalid">{errores.email}</Form.Control.Feedback>
                <Form.Text className={formData.email && !errores.email ? 'text-success' : 'text-muted'}>
                  {formData.email && !errores.email
                    ? `✅ Email válido — se enviará confirmación`
                    : '📧 Si no se ingresa, se usará bloqueo@funcity.com.ar'
                  }
                </Form.Text>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">
                  Teléfono del Cliente
                  <span className="text-muted fw-normal ms-1" style={{ fontSize: '0.78rem' }}>(opcional)</span>
                </Form.Label>
                <div className="input-with-status">
                  <Form.Control
                    type="tel"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleChange}
                    placeholder="Ej: 11 2345 6789"
                    isInvalid={!!errores.telefono}
                    isValid={!!formData.telefono && !errores.telefono && formData.telefono.replace(/\D/g,'').length >= 8}
                    size="lg"
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={20}
                  />
                  {!!formData.telefono && !errores.telefono && formData.telefono.replace(/\D/g,'').length >= 8 && (
                    <span className="field-valid-icon">✓</span>
                  )}
                </div>
                <Form.Control.Feedback type="invalid">{errores.telefono}</Form.Control.Feedback>
                <Form.Text className={formData.telefono && !errores.telefono ? 'text-success' : 'text-muted'}>
                  {formData.telefono && !errores.telefono
                    ? `✅ ${formData.telefono.replace(/\D/g,'').length} dígitos ingresados`
                    : '📱 Solo números — Ej: 11 2345 6789 · +54 9 11 2345 6789'
                  }
                </Form.Text>

                {/* Indicador visual de dígitos */}
                {formData.telefono && (
                  <div className="telefono-digits-indicator">
                    <div
                      className={`telefono-digits-bar ${
                        errores.telefono ? 'bar-error' :
                        formData.telefono.replace(/\D/g,'').length >= 8 ? 'bar-ok' : 'bar-warn'
                      }`}
                      style={{ width: `${Math.min(100, (formData.telefono.replace(/\D/g,'').length / 15) * 100)}%` }}
                    />
                    <span className="telefono-digits-count">
                      {formData.telefono.replace(/\D/g,'').length} / 15 dígitos
                    </span>
                  </div>
                )}
              </Form.Group>
            </Col>
          </Row>

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

      {/* ── Resumen pre-envío ── */}
      {formData.fecha && formData.hora_inicio && formData.personas && (
        <Alert variant="success" className="mb-4">
          <h6 className="alert-heading">✨ Resumen de la Reserva</h6>
          <hr />
          <Row>
            <Col md={6}>
              <p className="mb-1"><strong>🎂 Festejado/a:</strong> {formData.nombre_ninio || <span className="text-muted">Sin especificar</span>}</p>
              <p className="mb-1"><strong>📅 Fecha:</strong> {formatearFechaLegible(formData.fecha)}</p>
              <p className="mb-1"><strong>🕐 Hora:</strong> {formData.hora_inicio}</p>
            </Col>
            <Col md={6}>
              <p className="mb-1"><strong>👥 Personas:</strong> {formData.personas}</p>
              <p className="mb-1"><strong>🎨 Tema:</strong> {formData.tema || <span className="text-muted">Sin especificar</span>}</p>
              <p className="mb-1"><strong>💰 Precio:</strong>{' '}
                <Badge bg="success">{finDeSemana ? '$28.000' : '$25.000'}</Badge>
              </p>
            </Col>
          </Row>
        </Alert>
      )}

      {/* ── Botones ── */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div className="d-flex gap-2">
          {modoEdicion && onCancelarEdicion && (
            <Button variant="outline-secondary" type="button" onClick={onCancelarEdicion} disabled={enviando}>
              ✕ Cancelar
            </Button>
          )}
          <Button variant="outline-secondary" type="button" onClick={handleReset} disabled={enviando}>
            🔄 Limpiar
          </Button>
        </div>

        <Button
          variant={modoEdicion ? 'warning' : 'primary'}
          type="submit"
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

      {/* ── Nota importante ── */}
      <Alert variant="light" className="border mb-0">
        <small>
          <strong>📝 Importante:</strong>
          <ul className="mb-0 mt-1">
            <li>Los campos con <span className="text-danger">*</span> son obligatorios</li>
            <li>La reserva bloqueará el turno en Bookly como «BLOQUEO - Cumple [nombre]»</li>
            {modoEdicion && <li>Al actualizar se <strong>elimina la reserva anterior</strong> y se crea una nueva</li>}
          </ul>
        </small>
      </Alert>
    </Form>
  );
};

export default FormularioReserva;