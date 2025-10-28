import { useState } from 'react';
import { Card, Alert, Button, Badge, ButtonGroup, Row, Col } from 'react-bootstrap';

const CalendarioSimple = () => {
  const [vista, setVista] = useState('mes');
  const [fechaActual, setFechaActual] = useState(new Date());
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null);

  const horariosConfig = {
    finDeSemana: ['10:30', '12:20'],
    entreSemana: ['12:30', '14:20', '16:10']
  };

  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const formatearFecha = (fecha) => {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  };

  const esFinDeSemana = (fecha) => {
    const dia = fecha.getDay();
    return dia === 0 || dia === 6;
  };

  const esHoy = (fecha) => {
    const hoy = new Date();
    return fecha.toDateString() === hoy.toDateString();
  };

  const esPasado = (fecha) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return fecha < hoy;
  };

  const obtenerDiasMes = (fecha) => {
    const año = fecha.getFullYear();
    const mes = fecha.getMonth();
    const primerDia = new Date(año, mes, 1);
    const ultimoDia = new Date(año, mes + 1, 0);
    const diasMes = [];

    const diaSemanaInicio = primerDia.getDay();
    for (let i = diaSemanaInicio - 1; i >= 0; i--) {
      const fecha = new Date(año, mes, -i);
      diasMes.push({ fecha, mesActual: false });
    }

    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      diasMes.push({ fecha: new Date(año, mes, dia), mesActual: true });
    }

    const diasRestantes = 7 - (diasMes.length % 7);
    if (diasRestantes < 7) {
      for (let i = 1; i <= diasRestantes; i++) {
        diasMes.push({ fecha: new Date(año, mes + 1, i), mesActual: false });
      }
    }

    return diasMes;
  };

  const obtenerDiasSemana = (fecha) => {
    const dias = [];
    const diaInicio = new Date(fecha);
    diaInicio.setDate(fecha.getDate() - fecha.getDay());

    for (let i = 0; i < 7; i++) {
      const dia = new Date(diaInicio);
      dia.setDate(diaInicio.getDate() + i);
      dias.push(dia);
    }

    return dias;
  };

  const navegarMes = (direccion) => {
    const nuevaFecha = new Date(fechaActual);
    nuevaFecha.setMonth(fechaActual.getMonth() + direccion);
    setFechaActual(nuevaFecha);
  };

  const navegarSemana = (direccion) => {
    const nuevaFecha = new Date(fechaActual);
    nuevaFecha.setDate(fechaActual.getDate() + (direccion * 7));
    setFechaActual(nuevaFecha);
  };

  const navegarDia = (direccion) => {
    const nuevaFecha = new Date(fechaActual);
    nuevaFecha.setDate(fechaActual.getDate() + direccion);
    setFechaActual(nuevaFecha);
  };

  const irHoy = () => {
    setFechaActual(new Date());
  };

  const renderVistaMes = () => {
    const dias = obtenerDiasMes(fechaActual);

    return (
      <div>
        <Row className="text-center fw-bold border-bottom mb-2 pb-2">
          {diasSemana.map(dia => (
            <Col key={dia} className="p-1">{dia}</Col>
          ))}
        </Row>

        <div>
          {Array.from({ length: Math.ceil(dias.length / 7) }).map((_, semanaIdx) => (
            <Row key={semanaIdx} className="g-2 mb-2">
              {dias.slice(semanaIdx * 7, (semanaIdx + 1) * 7).map((diaObj, idx) => {
                const { fecha, mesActual } = diaObj;
                const pasado = esPasado(fecha);
                const hoy = esHoy(fecha);
                const horarios = esFinDeSemana(fecha) 
                  ? horariosConfig.finDeSemana 
                  : horariosConfig.entreSemana;

                return (
                  <Col key={idx}>
                    <div
                      className={`
                        border rounded p-2 text-center position-relative
                        ${!mesActual ? 'bg-light text-muted' : ''}
                        ${pasado ? 'opacity-50' : 'cursor-pointer'}
                        ${hoy ? 'border-primary border-2' : ''}
                      `}
                      style={{ 
                        minHeight: '80px',
                        cursor: pasado ? 'not-allowed' : 'pointer'
                      }}
                      onClick={() => !pasado && setFechaSeleccionada(fecha)}
                    >
                      <div className="fw-bold">{fecha.getDate()}</div>
                      {mesActual && !pasado && (
                        <div className="mt-1">
                          <small className="text-muted">{horarios.length} slots</small>
                        </div>
                      )}
                    </div>
                  </Col>
                );
              })}
            </Row>
          ))}
        </div>
      </div>
    );
  };

  const renderVistaSemana = () => {
    const dias = obtenerDiasSemana(fechaActual);

    return (
      <Row className="g-2">
        {dias.map((fecha, idx) => {
          const pasado = esPasado(fecha);
          const hoy = esHoy(fecha);
          const horarios = esFinDeSemana(fecha) 
            ? horariosConfig.finDeSemana 
            : horariosConfig.entreSemana;

          return (
            <Col key={idx}>
              <Card 
                className={`
                  h-100
                  ${pasado ? 'opacity-50' : 'cursor-pointer'}
                  ${hoy ? 'border-primary border-2' : ''}
                `}
                style={{ cursor: pasado ? 'not-allowed' : 'pointer' }}
                onClick={() => !pasado && setFechaSeleccionada(fecha)}
              >
                <Card.Header className="text-center bg-light">
                  <small className="text-muted d-block">{diasSemana[fecha.getDay()]}</small>
                  <strong>{fecha.getDate()}</strong>
                </Card.Header>
                <Card.Body className="p-2">
                  {!pasado && (
                    <div className="text-center">
                      <Badge bg="secondary" className="mb-2">
                        {horarios.length} horarios
                      </Badge>
                      {horarios.map((h, i) => (
                        <div key={i} className="small mb-1">
                          🕐 {h}
                        </div>
                      ))}
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>
    );
  };

  const renderVistaDia = () => {
    const horarios = esFinDeSemana(fechaActual) 
      ? horariosConfig.finDeSemana 
      : horariosConfig.entreSemana;

    return (
      <div>
        <Alert variant="light" className="text-center mb-4">
          <h4>
            {diasSemana[fechaActual.getDay()]}, {fechaActual.getDate()} de {meses[fechaActual.getMonth()]} de {fechaActual.getFullYear()}
          </h4>
          <Badge bg="secondary">
            {esFinDeSemana(fechaActual) ? 'Fin de Semana' : 'Entre Semana'}
          </Badge>
        </Alert>

        <div className="d-grid gap-3">
          {horarios.map((hora, idx) => (
            <Card key={idx} className="border-2">
              <Card.Body className="p-4">
                <Row className="align-items-center">
                  <Col xs={3} className="text-center">
                    <h2 className="mb-0">🕐</h2>
                    <h4 className="mb-0">{hora}</h4>
                  </Col>
                  <Col xs={9}>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h5 className="mb-1">Turno de {hora}</h5>
                        <small className="text-muted">
                          Duración: 1h 30min | 
                          Precio: {esFinDeSemana(fechaActual) ? '$28,000' : '$25,000'}
                        </small>
                      </div>
                      <Badge bg="info" className="fs-6 px-3 py-2">
                        📅 Consultar en Bookly
                      </Badge>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderDetallesFecha = () => {
    if (!fechaSeleccionada) return null;

    const horarios = esFinDeSemana(fechaSeleccionada) 
      ? horariosConfig.finDeSemana 
      : horariosConfig.entreSemana;

    return (
      <Alert variant="info" className="mt-3" onClose={() => setFechaSeleccionada(null)} dismissible>
        <h5>
          {diasSemana[fechaSeleccionada.getDay()]}, {fechaSeleccionada.getDate()} de {meses[fechaSeleccionada.getMonth()]}
        </h5>
        <Badge bg="secondary" className="mb-3">
          {esFinDeSemana(fechaSeleccionada) ? 'Fin de Semana - $28,000' : 'Entre Semana - $25,000'}
        </Badge>
        <div className="mt-3">
          <strong>Horarios disponibles para este día:</strong>
          {horarios.map((h, i) => (
            <div key={i} className="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
              <span>🕐 {h}</span>
              <Badge bg="info">Consultar en Bookly</Badge>
            </div>
          ))}
        </div>
        <Alert variant="warning" className="mt-3 mb-0">
          <small>
            💡 <strong>Tip:</strong> Para ver disponibilidad real, consulta el calendario de Bookly en WordPress o intenta crear una reserva desde el formulario.
          </small>
        </Alert>
      </Alert>
    );
  };

  return (
    <Card className="mb-4 border-info">
      <Card.Header className="bg-info bg-opacity-10">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0 text-info">📅 Calendario de Horarios</h5>
          <ButtonGroup size="sm">
            <Button 
              variant={vista === 'dia' ? 'info' : 'outline-info'}
              onClick={() => setVista('dia')}
            >
              Día
            </Button>
            <Button 
              variant={vista === 'semana' ? 'info' : 'outline-info'}
              onClick={() => setVista('semana')}
            >
              Semana
            </Button>
            <Button 
              variant={vista === 'mes' ? 'info' : 'outline-info'}
              onClick={() => setVista('mes')}
            >
              Mes
            </Button>
          </ButtonGroup>
        </div>
      </Card.Header>

      <Card.Body>
        {/* Advertencia importante */}
        <Alert variant="warning" className="mb-4">
          <strong>⚠️ Importante:</strong>
          <p className="mb-0 mt-2">
            Este calendario muestra los horarios configurados para cada día, pero <strong>NO consulta disponibilidad en tiempo real</strong> para evitar bloquear turnos innecesariamente. 
            Para verificar disponibilidad real, consulta el calendario de Bookly o intenta crear una reserva desde el formulario.
          </p>
        </Alert>

        {/* Controles de navegación */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <Button 
            variant="outline-primary" 
            size="sm"
            onClick={() => {
              if (vista === 'dia') navegarDia(-1);
              else if (vista === 'semana') navegarSemana(-1);
              else navegarMes(-1);
            }}
          >
            ← Anterior
          </Button>

          <div className="text-center">
            <h4 className="mb-1">
              {vista === 'dia' && `${diasSemana[fechaActual.getDay()]}, ${fechaActual.getDate()}`}
              {vista === 'semana' && `Semana del ${fechaActual.getDate()}`}
              {vista === 'mes' && meses[fechaActual.getMonth()]}
              {' '}
              {vista !== 'mes' && meses[fechaActual.getMonth()]}
              {' '}
              {fechaActual.getFullYear()}
            </h4>
            <Button variant="link" size="sm" onClick={irHoy}>
              Hoy
            </Button>
          </div>

          <Button 
            variant="outline-primary" 
            size="sm"
            onClick={() => {
              if (vista === 'dia') navegarDia(1);
              else if (vista === 'semana') navegarSemana(1);
              else navegarMes(1);
            }}
          >
            Siguiente →
          </Button>
        </div>

        {/* Leyenda */}
        <Alert variant="light" className="mb-3">
          <small className="d-flex justify-content-around flex-wrap gap-2">
            <span><Badge bg="info">📅</Badge> Ver en Bookly para disponibilidad real</span>
            <span><Badge bg="primary">📍</Badge> Hoy</span>
            <span><Badge bg="secondary">🕐</Badge> Horarios posibles</span>
          </small>
        </Alert>

        {/* Renderizar vista seleccionada */}
        <div className="calendario-container">
          {vista === 'mes' && renderVistaMes()}
          {vista === 'semana' && renderVistaSemana()}
          {vista === 'dia' && renderVistaDia()}
        </div>

        {/* Detalles de fecha seleccionada */}
        {renderDetallesFecha()}

        {/* Información */}
        <Alert variant="info" className="mt-4 mb-0">
          <small>
            <strong>ℹ️ Información:</strong>
            <ul className="mb-0 mt-2">
              <li><strong>Fin de semana (Sáb-Dom):</strong> {horariosConfig.finDeSemana.join(', ')} - $28,000</li>
              <li><strong>Entre semana (Lun-Vie):</strong> {horariosConfig.entreSemana.join(', ')} - $25,000</li>
              <li>Para verificar disponibilidad real, consulta el calendario de Bookly en WordPress</li>
              <li>Puedes crear una reserva desde el formulario para verificar si un horario está disponible</li>
            </ul>
          </small>
        </Alert>
      </Card.Body>
    </Card>
  );
};

export default CalendarioSimple;