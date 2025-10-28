import { useState, useEffect } from 'react';
import { Card, Alert, Button, Badge, ButtonGroup, Spinner, Row, Col, ProgressBar } from 'react-bootstrap';
import { 
  
  consultarDisponibilidadRango

} from '../services/api';

const CalendarioDisponibilidad = () => {
  const [vista, setVista] = useState('mes'); // 'dia', 'semana', 'mes'
  const [fechaActual, setFechaActual] = useState(new Date());
  const [consultando, setConsultando] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [disponibilidad, setDisponibilidad] = useState({});
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  // Nombres de días y meses
  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Utilidades de fecha
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

  // Obtener días del mes
  const obtenerDiasMes = (fecha) => {
    const año = fecha.getFullYear();
    const mes = fecha.getMonth();
    const primerDia = new Date(año, mes, 1);
    const ultimoDia = new Date(año, mes + 1, 0);
    const diasMes = [];

    // Días del mes anterior para completar la semana
    const diaSemanaInicio = primerDia.getDay();
    for (let i = diaSemanaInicio - 1; i >= 0; i--) {
      const fecha = new Date(año, mes, -i);
      diasMes.push({ fecha, mesActual: false });
    }

    // Días del mes actual
    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      diasMes.push({ fecha: new Date(año, mes, dia), mesActual: true });
    }

    // Días del siguiente mes para completar la última semana
    const diasRestantes = 7 - (diasMes.length % 7);
    if (diasRestantes < 7) {
      for (let i = 1; i <= diasRestantes; i++) {
        diasMes.push({ fecha: new Date(año, mes + 1, i), mesActual: false });
      }
    }

    return diasMes;
  };

  // Obtener días de la semana
  const obtenerDiasSemana = (fecha) => {
    const dias = [];
    const diaInicio = new Date(fecha);
    diaInicio.setDate(fecha.getDate() - fecha.getDay()); // Ir al domingo

    for (let i = 0; i < 7; i++) {
      const dia = new Date(diaInicio);
      dia.setDate(diaInicio.getDate() + i);
      dias.push(dia);
    }

    return dias;
  };

  // Navegar fechas
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

  // Consultar disponibilidad según la vista actual
  const consultarVistaActual = async () => {
    setConsultando(true);
    setProgreso({ actual: 0, total: 0 });

    try {
      let fechasAConsultar = [];
      
      if (vista === 'dia') {
        if (!esPasado(fechaActual)) {
          fechasAConsultar = [fechaActual];
        }
      } else if (vista === 'semana') {
        fechasAConsultar = obtenerDiasSemana(fechaActual).filter(f => !esPasado(f));
      } else if (vista === 'mes') {
        fechasAConsultar = obtenerDiasMes(fechaActual)
          .filter(d => d.mesActual && !esPasado(d.fecha))
          .map(d => d.fecha);
      }

      // Preparar consultas con horarios correspondientes
      const consultasAHacer = fechasAConsultar.map(fecha => {
        const { horarios } = obtenerHorariosDisponibles(fecha);
        return { fecha: formatearFecha(fecha), horarios };
      });

      setProgreso({ actual: 0, total: consultasAHacer.length });

      // Consultar todas las fechas
      const resultados = await consultarDisponibilidadRango(
        consultasAHacer,
        (actual, total) => setProgreso({ actual, total })
      );

      // Actualizar estado con resultados
      const nuevoEstado = {};
      resultados.forEach(resultado => {
        nuevoEstado[resultado.fecha] = resultado;
      });

      setDisponibilidad(prev => ({ ...prev, ...nuevoEstado }));
      setUltimaActualizacion(new Date());

    } catch (error) {
      console.error('Error al consultar disponibilidad:', error);
      alert('Error al consultar disponibilidad. Por favor intenta nuevamente.');
    } finally {
      setConsultando(false);
      setProgreso({ actual: 0, total: 0 });
    }
  };

  // Refrescar cache
  const refrescarCache = () => {
    limpiarCacheDisponibilidad();
    setDisponibilidad({});
    setUltimaActualizacion(null);
  };

  // Obtener badge de disponibilidad para una fecha
  const obtenerBadgeDisponibilidad = (fecha) => {
    const fechaStr = formatearFecha(fecha);
    const info = disponibilidad[fechaStr];

    if (!info) return null;

    const { disponibles, ocupados, errores } = info.resumen;

    if (errores > 0) {
      return <Badge bg="secondary" className="w-100 mt-1">⚠ Error</Badge>;
    } else if (disponibles === info.resumen.total) {
      return <Badge bg="success" className="w-100 mt-1">✓ {disponibles}/{info.resumen.total}</Badge>;
    } else if (disponibles > 0) {
      return <Badge bg="warning" text="dark" className="w-100 mt-1">⚠ {disponibles}/{info.resumen.total}</Badge>;
    } else {
      return <Badge bg="danger" className="w-100 mt-1">✗ Ocupado</Badge>;
    }
  };

  // Renderizar vista de mes
  const renderVistaMes = () => {
    const dias = obtenerDiasMes(fechaActual);

    return (
      <div>
        {/* Encabezado días de la semana */}
        <Row className="text-center fw-bold border-bottom mb-2 pb-2">
          {diasSemana.map(dia => (
            <Col key={dia} className="p-1">
              {dia}
            </Col>
          ))}
        </Row>

        {/* Grid de días */}
        <div>
          {Array.from({ length: Math.ceil(dias.length / 7) }).map((_, semanaIdx) => (
            <Row key={semanaIdx} className="g-2 mb-2">
              {dias.slice(semanaIdx * 7, (semanaIdx + 1) * 7).map((diaObj, idx) => {
                const { fecha, mesActual } = diaObj;
                const pasado = esPasado(fecha);
                const hoy = esHoy(fecha);

                return (
                  <Col key={idx}>
                    <Card 
                      className={`
                        text-center h-100
                        ${!mesActual ? 'opacity-50' : ''}
                        ${pasado ? 'bg-light' : ''}
                        ${hoy ? 'border-primary border-2' : ''}
                        ${!pasado && mesActual ? 'cursor-pointer' : ''}
                      `}
                      onClick={() => !pasado && mesActual && setFechaSeleccionada(fecha)}
                      style={{ cursor: !pasado && mesActual ? 'pointer' : 'default' }}
                    >
                      <Card.Body className="p-2">
                        <div className="fw-bold">
                          {fecha.getDate()}
                          {hoy && <Badge bg="primary" className="ms-1" style={{ fontSize: '0.6rem' }}>📍</Badge>}
                        </div>
                        {!pasado && mesActual && obtenerBadgeDisponibilidad(fecha)}
                        {pasado && <small className="text-muted">Pasado</small>}
                      </Card.Body>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          ))}
        </div>
      </div>
    );
  };

  // Renderizar vista de semana
  const renderVistaSemana = () => {
    const dias = obtenerDiasSemana(fechaActual);

    return (
      <Row className="g-3">
        {dias.map((fecha, idx) => {
          const fechaStr = formatearFecha(fecha);
          const info = disponibilidad[fechaStr];
          const pasado = esPasado(fecha);
          const hoy = esHoy(fecha);

          return (
            <Col key={idx} xs={12} md={6} lg={4}>
              <Card 
                className={`
                  h-100
                  ${pasado ? 'bg-light' : ''}
                  ${hoy ? 'border-primary border-2' : ''}
                `}
              >
                <Card.Header className={hoy ? 'bg-primary text-white' : ''}>
                  <h6 className="mb-0">
                    {diasSemana[fecha.getDay()]} {fecha.getDate()}
                    {hoy && ' 📍'}
                  </h6>
                  <small>{esFinDeSemana(fecha) ? 'Fin de semana' : 'Entre semana'}</small>
                </Card.Header>
                <Card.Body>
                  {pasado ? (
                    <p className="text-muted mb-0">Fecha pasada</p>
                  ) : info ? (
                    <div>
                      <div className="mb-2">
                        <Badge bg="success" className="me-1">✓ {info.resumen.disponibles}</Badge>
                        <Badge bg="danger" className="me-1">✗ {info.resumen.ocupados}</Badge>
                        {info.resumen.errores > 0 && (
                          <Badge bg="secondary">⚠ {info.resumen.errores}</Badge>
                        )}
                      </div>
                      <div className="small">
                        {info.horarios.map((h, i) => (
                          <div key={i} className="d-flex justify-content-between mb-1">
                            <span>{h.hora}</span>
                            {h.disponible === true && <Badge bg="success" pill>✓</Badge>}
                            {h.disponible === false && <Badge bg="danger" pill>✗</Badge>}
                            {h.disponible === null && <Badge bg="secondary" pill>?</Badge>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted mb-0 small">Sin consultar</p>
                  )}
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>
    );
  };

  // Renderizar vista de día
  const renderVistaDia = () => {
    const fechaStr = formatearFecha(fechaActual);
    const info = disponibilidad[fechaStr];
    const { horarios: horariosConfig } = obtenerHorariosDisponibles(fechaActual);

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
          {horariosConfig.map((hora, idx) => {
            const horarioInfo = info?.horarios.find(h => h.hora === hora);

            return (
              <Card 
                key={idx}
                className={`
                  border-2
                  ${horarioInfo?.disponible === true ? 'border-success' : ''}
                  ${horarioInfo?.disponible === false ? 'border-danger' : ''}
                `}
              >
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
                          {horarioInfo?.motivo && (
                            <div className="mt-1">
                              <small className="text-muted">
                                {horarioInfo.mensaje}
                              </small>
                            </div>
                          )}
                        </div>
                        <div>
                          {horarioInfo?.disponible === true && (
                            <Badge bg="success" className="fs-6 px-3 py-2">
                              ✓ Disponible
                            </Badge>
                          )}
                          {horarioInfo?.disponible === false && (
                            <Badge bg="danger" className="fs-6 px-3 py-2">
                              ✗ {horarioInfo.motivo === 'slot_ocupado' ? 'Ocupado' : 'No disponible'}
                            </Badge>
                          )}
                          {horarioInfo?.disponible === null && (
                            <Badge bg="warning" text="dark" className="fs-6 px-3 py-2">
                              ⚠ Error de consulta
                            </Badge>
                          )}
                          {!horarioInfo && (
                            <Badge bg="secondary" className="fs-6 px-3 py-2">
                              Sin consultar
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  // Modal de detalles de fecha seleccionada
  const renderDetallesFecha = () => {
    if (!fechaSeleccionada) return null;

    const fechaStr = formatearFecha(fechaSeleccionada);
    const info = disponibilidad[fechaStr];

    return (
      <Alert variant="info" className="mt-3" onClose={() => setFechaSeleccionada(null)} dismissible>
        <h5>
          {diasSemana[fechaSeleccionada.getDay()]}, {fechaSeleccionada.getDate()} de {meses[fechaSeleccionada.getMonth()]}
        </h5>
        {info ? (
          <div>
            <div className="mb-2">
              <Badge bg="success" className="me-2">✓ {info.resumen.disponibles} disponibles</Badge>
              <Badge bg="danger" className="me-2">✗ {info.resumen.ocupados} ocupados</Badge>
              {info.resumen.errores > 0 && (
                <Badge bg="warning" text="dark">⚠ {info.resumen.errores} errores</Badge>
              )}
            </div>
            <div className="mt-3">
              {info.horarios.map((h, i) => (
                <div key={i} className="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
                  <div>
                    <strong>{h.hora}</strong>
                    {h.mensaje && (
                      <div className="small text-muted">{h.mensaje}</div>
                    )}
                  </div>
                  {h.disponible === true && <Badge bg="success">✓ Disponible</Badge>}
                  {h.disponible === false && <Badge bg="danger">✗ {h.motivo === 'slot_ocupado' ? 'Ocupado' : 'No disponible'}</Badge>}
                  {h.disponible === null && <Badge bg="warning" text="dark">⚠ Error</Badge>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mb-0">No hay datos de disponibilidad para esta fecha. Presiona "Consultar Disponibilidad".</p>
        )}
      </Alert>
    );
  };

  return (
    <Card className="mb-4 border-info">
      <Card.Header className="bg-info bg-opacity-10">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h5 className="mb-0 text-info">📅 Consulta de Disponibilidad - Fun City</h5>
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

        {/* Botones de acción */}
        <div className="text-center mb-4">
          <div className="d-flex gap-2 justify-content-center flex-wrap">
            <Button 
              variant="info"
              onClick={consultarVistaActual}
              disabled={consultando}
              size="lg"
            >
              {consultando ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Consultando...
                </>
              ) : (
                <>
                  🔍 Consultar Disponibilidad
                </>
              )}
            </Button>
            
            <Button 
              variant="outline-secondary"
              onClick={refrescarCache}
              disabled={consultando}
              title="Limpiar cache y recargar datos"
            >
              🔄 Refrescar
            </Button>
          </div>
          
          {/* Barra de progreso */}
          {consultando && progreso.total > 0 && (
            <div className="mt-3">
              <ProgressBar 
                now={(progreso.actual / progreso.total) * 100} 
                label={`${progreso.actual}/${progreso.total}`}
                animated
              />
            </div>
          )}
          
          <div className="mt-2">
            <small className="text-muted">
              {vista === 'dia' && 'Consulta 1 día'}
              {vista === 'semana' && 'Consulta hasta 7 días'}
              {vista === 'mes' && `Consulta hasta ${obtenerDiasMes(fechaActual).filter(d => d.mesActual && !esPasado(d.fecha)).length} días`}
            </small>
          </div>
          
          {ultimaActualizacion && (
            <div className="mt-1">
              <small className="text-muted">
                Última actualización: {ultimaActualizacion.toLocaleTimeString()}
              </small>
            </div>
          )}
        </div>

        {/* Leyenda */}
        <Alert variant="light" className="mb-3">
          <small className="d-flex justify-content-around flex-wrap gap-2">
            <span><Badge bg="success">✓</Badge> Disponible</span>
            <span><Badge bg="warning" text="dark">⚠</Badge> Parcialmente disponible</span>
            <span><Badge bg="danger">✗</Badge> Ocupado/Bloqueado</span>
            <span><Badge bg="secondary">?</Badge> Error de consulta</span>
            <span><Badge bg="primary">📍</Badge> Hoy</span>
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

        {/* Información adicional */}
        <Alert variant="info" className="mt-4 mb-0">
          <h6 className="alert-heading">ℹ️ Información Importante</h6>
          <small>
            <ul className="mb-0">
              <li><strong>Esta consulta NO crea reservas reales</strong> - solo verifica disponibilidad</li>
              <li>Los datos se actualizan en tiempo real desde el sistema Bookly</li>
              <li>Un turno "Ocupado" significa que ya fue reservado por otro cliente</li>
              <li>Las fechas pasadas no se pueden consultar</li>
              <li><strong>Horarios Fin de semana:</strong> 10:30 y 12:20</li>
              <li><strong>Horarios Entre semana:</strong> 12:30, 14:20 y 16:10</li>
              <li>Los resultados se guardan en cache por 5 minutos</li>
            </ul>
          </small>
        </Alert>
      </Card.Body>
    </Card>
  );
};

export default CalendarioDisponibilidad;