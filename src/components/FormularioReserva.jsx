import { useState } from 'react';
import { Form, Button, Row, Col, Alert, Card, Badge, ButtonGroup } from 'react-bootstrap';

const FormularioReserva = ({ onGuardar, deshabilitado }) => {
  const [formData, setFormData] = useState({
    nombre_ninio: '',
    fecha: '',
    hora_inicio: '',
    personas: '',
    email: '',
    telefono: '',
    tema: ''
  });

  const [errores, setErrores] = useState({});

  // Horarios disponibles por tipo de día (EXACTOS según API de Bookly)
  const horariosDisponibles = {
    finDeSemana: ['10:30', '12:20'], // Staff ID 6 - Confirmado por API
    entreSemana: ['12:30', '14:20', '16:10'] // Staff ID 7 - Confirmado por API
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errores[name]) {
      setErrores(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleHoraClick = (hora) => {
    setFormData(prev => ({
      ...prev,
      hora_inicio: hora
    }));
    
    if (errores.hora_inicio) {
      setErrores(prev => ({
        ...prev,
        hora_inicio: ''
      }));
    }
  };

  const esFinDeSemana = (fecha) => {
    if (!fecha) return false;
    const dia = new Date(fecha + 'T00:00:00').getDay();
    return dia === 0 || dia === 6; // 0 = Domingo, 6 = Sábado
  };

  const obtenerHorariosDisponibles = () => {
    if (!formData.fecha) return [];
    return esFinDeSemana(formData.fecha) 
      ? horariosDisponibles.finDeSemana 
      : horariosDisponibles.entreSemana;
  };

  const validarFormulario = () => {
    const nuevosErrores = {};

    if (!formData.fecha) {
      nuevosErrores.fecha = 'La fecha es requerida';
    } else {
      const fechaSeleccionada = new Date(formData.fecha + 'T00:00:00');
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      if (fechaSeleccionada < hoy) {
        nuevosErrores.fecha = 'La fecha no puede ser anterior a hoy';
      }
    }

    if (!formData.hora_inicio) {
      nuevosErrores.hora_inicio = 'La hora es requerida';
    }

    if (!formData.personas) {
      nuevosErrores.personas = 'La cantidad de personas es requerida';
    } else {
      const personas = parseInt(formData.personas);
      if (personas < 1 || personas > 40) {
        nuevosErrores.personas = 'La cantidad debe estar entre 1 y 40';
      }
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      nuevosErrores.email = 'Email inválido';
    }

    if (formData.telefono && !/^[0-9]{8,15}$/.test(formData.telefono.replace(/\s/g, ''))) {
      nuevosErrores.telefono = 'Teléfono inválido (8-15 dígitos)';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validarFormulario()) {
      const datosEnviar = {
        fecha: formData.fecha,
        hora_inicio: formData.hora_inicio,
        personas: parseInt(formData.personas)
      };

      if (formData.nombre_ninio.trim()) datosEnviar.nombre_ninio = formData.nombre_ninio.trim();
      if (formData.email.trim()) datosEnviar.email = formData.email.trim();
      if (formData.telefono.trim()) datosEnviar.telefono = formData.telefono.trim();
      if (formData.tema.trim()) datosEnviar.tema = formData.tema.trim();

      onGuardar(datosEnviar);
      handleReset();
    }
  };

  const handleReset = () => {
    setFormData({
      nombre_ninio: '',
      fecha: '',
      hora_inicio: '',
      personas: '',
      email: '',
      telefono: '',
      tema: ''
    });
    setErrores({});
  };

  const obtenerFechaMinima = () => {
    const hoy = new Date();
    return hoy.toISOString().split('T')[0];
  };

  const formatearFechaLegible = (fecha) => {
    if (!fecha) return '';
    const opciones = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es-AR', opciones);
  };

  const temasPopulares = [
    '🦸 Superhéroes',
    '👸 Princesas',
    '🦖 Dinosaurios',
    '🎮 Videojuegos',
    '⚽ Deportes',
    '🎨 Arte',
    '🚀 Espacio',
    '🧚 Hadas',
    '🦄 Unicornios',
    '🏴‍☠️ Piratas'
  ];

  return (
    <Form onSubmit={handleSubmit}>
      {/* Información de horarios */}
      <Alert variant="info" className="mb-4">
        <div className="d-flex align-items-center">
          <span className="fs-4 me-2">📅</span>
          <div>
            <strong>Horarios Disponibles:</strong>
            <div className="mt-2">
              <Badge bg="primary" className="me-2">Fin de Semana y Feriados</Badge>
              <small className="text-muted">10:30, 12:20</small>
              <br />
              <Badge bg="success" className="me-2 mt-1">$28,000</Badge>
            </div>
            <div className="mt-2">
              <Badge bg="secondary" className="me-2">Lunes a Viernes</Badge>
              <small className="text-muted">12:30, 14:20, 16:10</small>
              <br />
              <Badge bg="success" className="me-2 mt-1">$25,000</Badge>
            </div>
          </div>
        </div>
      </Alert>

      {/* Información del cumpleañero */}
      <Card className="mb-4 border-primary">
        <Card.Header className="bg-primary bg-opacity-10">
          <h5 className="mb-0 text-primary">🎂 Datos del Cumpleañero</h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">Nombre del Niño/a</Form.Label>
                <Form.Control
                  type="text"
                  name="nombre_ninio"
                  value={formData.nombre_ninio}
                  onChange={handleChange}
                  placeholder="Ej: Sofía"
                  disabled={deshabilitado}
                  size="lg"
                />
                <Form.Text className="text-muted">
                  <small>💡 Aparecerá en el calendario de Bookly</small>
                </Form.Text>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">Tema del Cumpleaños</Form.Label>
                <Form.Control
                  as="select"
                  name="tema"
                  value={formData.tema}
                  onChange={handleChange}
                  disabled={deshabilitado}
                  size="lg"
                >
                  <option value="">Seleccionar tema (opcional)</option>
                  {temasPopulares.map((tema, index) => (
                    <option key={index} value={tema}>{tema}</option>
                  ))}
                </Form.Control>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Fecha y Hora */}
      <Card className="mb-4 border-success">
        <Card.Header className="bg-success bg-opacity-10">
          <h5 className="mb-0 text-success">📆 Fecha y Horario</h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
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
                  required
                  disabled={deshabilitado}
                  size="lg"
                />
                <Form.Control.Feedback type="invalid">
                  {errores.fecha}
                </Form.Control.Feedback>
                
                {formData.fecha && (
                  <Alert variant="light" className="mt-2 py-2">
                    <small className="text-muted">
                      📅 {formatearFechaLegible(formData.fecha)}
                      {esFinDeSemana(formData.fecha) 
                        ? <Badge bg="primary" className="ms-2">Fin de Semana</Badge>
                        : <Badge bg="secondary" className="ms-2">Entre Semana</Badge>
                      }
                    </small>
                  </Alert>
                )}
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">
                  Hora de Inicio <span className="text-danger">*</span>
                </Form.Label>
                
                {formData.fecha ? (
                  <div>
                    <div className="d-grid gap-2">
                      {obtenerHorariosDisponibles().map((hora) => (
                        <Button
                          key={hora}
                          variant={formData.hora_inicio === hora ? 'success' : 'outline-success'}
                          onClick={() => handleHoraClick(hora)}
                          disabled={deshabilitado}
                          size="lg"
                          className="text-start"
                        >
                          <span className="fs-5">🕐</span> {hora}
                          {formData.hora_inicio === hora && (
                            <Badge bg="light" text="dark" className="ms-2">✓ Seleccionado</Badge>
                          )}
                        </Button>
                      ))}
                    </div>
                    
                    {errores.hora_inicio && (
                      <div className="text-danger small mt-2">
                        {errores.hora_inicio}
                      </div>
                    )}
                  </div>
                ) : (
                  <Alert variant="warning" className="mb-0">
                    <small>👆 Primero selecciona una fecha</small>
                  </Alert>
                )}
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Cantidad de personas */}
      <Card className="mb-4 border-warning">
        <Card.Header className="bg-warning bg-opacity-10">
          <h5 className="mb-0 text-warning">👥 Cantidad de Invitados</h5>
        </Card.Header>
        <Card.Body>
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">
              Cantidad de Personas <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="number"
              name="personas"
              value={formData.personas}
              onChange={handleChange}
              min="1"
              max="40"
              isInvalid={!!errores.personas}
              required
              disabled={deshabilitado}
              size="lg"
              placeholder="Ingresa la cantidad de personas"
            />
            <Form.Control.Feedback type="invalid">
              {errores.personas}
            </Form.Control.Feedback>
            
            <div className="d-flex justify-content-between align-items-center mt-2">
              <Form.Text className="text-muted">
                <small>📊 Mínimo 1, máximo 40 personas</small>
              </Form.Text>
              
              {formData.personas && (
                <Badge 
                  bg={formData.personas <= 20 ? 'success' : formData.personas <= 30 ? 'warning' : 'danger'}
                  className="fs-6"
                >
                  {formData.personas} {formData.personas == 1 ? 'persona' : 'personas'}
                </Badge>
              )}
            </div>

            {/* Sugerencias de cantidad */}
            <div className="mt-3">
              <small className="text-muted d-block mb-2">💡 Sugerencias rápidas:</small>
              <ButtonGroup size="sm">
                {[10, 15, 20, 25, 30, 40].map((cant) => (
                  <Button
                    key={cant}
                    variant={formData.personas == cant ? 'primary' : 'outline-primary'}
                    onClick={() => handleChange({ target: { name: 'personas', value: cant } })}
                    disabled={deshabilitado}
                  >
                    {cant}
                  </Button>
                ))}
              </ButtonGroup>
            </div>
          </Form.Group>
        </Card.Body>
      </Card>

      {/* Datos de contacto */}
      <Card className="mb-4 border-info">
        <Card.Header className="bg-info bg-opacity-10">
          <h5 className="mb-0 text-info">📞 Datos de Contacto</h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">Email del Cliente</Form.Label>
                <Form.Control
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="ejemplo@mail.com"
                  isInvalid={!!errores.email}
                  disabled={deshabilitado}
                  size="lg"
                />
                <Form.Control.Feedback type="invalid">
                  {errores.email}
                </Form.Control.Feedback>
                <Form.Text className="text-muted">
                  <small>
                    {formData.email 
                      ? `✅ Se enviará confirmación a: ${formData.email}`
                      : '📧 Si no se ingresa, se usará: bloqueo@funcity.com.ar'
                    }
                  </small>
                </Form.Text>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">Teléfono del Cliente</Form.Label>
                <Form.Control
                  type="tel"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  placeholder="Ej: 1123456789"
                  isInvalid={!!errores.telefono}
                  disabled={deshabilitado}
                  size="lg"
                />
                <Form.Control.Feedback type="invalid">
                  {errores.telefono}
                </Form.Control.Feedback>
                <Form.Text className="text-muted">
                  <small>📱 Formato: 1123456789 (sin guiones ni espacios)</small>
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Resumen de la reserva */}
      {(formData.fecha && formData.hora_inicio && formData.personas) && (
        <Alert variant="success" className="mb-4">
          <h6 className="alert-heading">✨ Resumen de tu Reserva</h6>
          <hr />
          <Row>
            <Col md={6}>
              <p className="mb-1">
                <strong>👤 Niño/a:</strong> {formData.nombre_ninio || 'Sin especificar'}
              </p>
              <p className="mb-1">
                <strong>📅 Fecha:</strong> {formatearFechaLegible(formData.fecha)}
              </p>
              <p className="mb-1">
                <strong>🕐 Hora:</strong> {formData.hora_inicio}
              </p>
            </Col>
            <Col md={6}>
              <p className="mb-1">
                <strong>👥 Personas:</strong> {formData.personas}
              </p>
              <p className="mb-1">
                <strong>🎨 Tema:</strong> {formData.tema || 'Sin especificar'}
              </p>
              <p className="mb-1">
                <strong>📧 Email:</strong> {formData.email || 'bloqueo@funcity.com.ar'}
              </p>
            </Col>
          </Row>
        </Alert>
      )}

      {/* Botones de acción */}
      <div className="d-grid gap-2 d-md-flex justify-content-md-end">
        <Button 
          variant="outline-secondary" 
          type="button" 
          onClick={handleReset}
          disabled={deshabilitado}
          size="lg"
        >
          🔄 Limpiar Formulario
        </Button>
        <Button 
          variant="primary" 
          type="submit"
          disabled={deshabilitado}
          size="lg"
        >
          🎉 Crear Reserva
        </Button>
      </div>

      {/* Nota final */}
      <Alert variant="light" className="mt-3 mb-0 border">
        <small>
          <strong>📝 Importante:</strong>
          <ul className="mb-0 mt-2">
            <li>Los campos marcados con <span className="text-danger">*</span> son obligatorios</li>
            <li>La reserva bloqueará el turno completo en el sistema Bookly</li>
            <li>Recibirás confirmación inmediata de tu reserva</li>
            <li>Para modificar una reserva, contacta al administrador</li>
          </ul>
        </small>
      </Alert>
    </Form>
  );
};

export default FormularioReserva;