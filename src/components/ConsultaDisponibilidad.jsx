import { useState } from 'react';
import { Card, Alert, Button, Badge, Form, Row, Col } from 'react-bootstrap';

const ConsultaDisponibilidad = () => {
  const [fecha, setFecha] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [resultados, setResultados] = useState(null);

  const horariosParaProbar = {
    finDeSemana: ['10:30', '12:20'], // Staff ID 6
    entreSemana: ['12:30', '14:20', '16:10'] // Staff ID 7
  };

  const esFinDeSemana = (fecha) => {
    if (!fecha) return false;
    const dia = new Date(fecha + 'T00:00:00').getDay();
    return dia === 0 || dia === 6;
  };

  const probarHorario = async (fecha, hora) => {
    try {
      const response = await fetch('https://testsite.funcity.com.ar/wp-json/bookly-sync/v1/bloquear-pase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: 'fcBk2025!x9kM7pQ2vR8tW3zY5uN1jL4hG6eD9aS0rT',
          fecha: fecha,
          hora_inicio: hora,
          personas: 1  // Solo 1 persona para prueba rápida
        })
      });

      const data = await response.json();

      if (response.ok) {
        return { hora, disponible: true, mensaje: 'Disponible' };
      } else {
        if (data.code === 'slot_ocupado') {
          return { hora, disponible: false, mensaje: 'Ocupado' };
        } else if (data.code === 'horario_no_valido') {
          return { hora, disponible: false, mensaje: 'No válido' };
        } else {
          return { hora, disponible: false, mensaje: data.message || 'Error' };
        }
      }
    } catch (error) {
      return { hora, disponible: false, mensaje: 'Error de conexión' };
    }
  };

  const consultarDisponibilidad = async () => {
    if (!fecha) {
      alert('Por favor selecciona una fecha');
      return;
    }

    setConsultando(true);
    setResultados(null);

    try {
      const esFinDeSem = esFinDeSemana(fecha);
      const horariosAProbar = esFinDeSem ? horariosParaProbar.finDeSemana : horariosParaProbar.entreSemana;

      console.log(`🔍 Consultando disponibilidad para ${fecha} (${esFinDeSem ? 'Fin de semana' : 'Entre semana'})`);

      const promesas = horariosAProbar.map(hora => probarHorario(fecha, hora));
      const resultados = await Promise.all(promesas);

      console.log('📊 Resultados:', resultados);

      setResultados({
        fecha,
        tipoDia: esFinDeSem ? 'Fin de semana' : 'Entre semana',
        horarios: resultados
      });

    } catch (error) {
      console.error('Error:', error);
      alert('Error al consultar disponibilidad');
    } finally {
      setConsultando(false);
    }
  };

  const obtenerFechaMinima = () => {
    const hoy = new Date();
    return hoy.toISOString().split('T')[0];
  };

  return (
    <Card className="mb-4 border-info">
      <Card.Header className="bg-info bg-opacity-10">
        <h5 className="mb-0 text-info">🔍 Consultar Disponibilidad de Horarios</h5>
      </Card.Header>
      <Card.Body>
        <Alert variant="info" className="mb-3">
          <small>
            <strong>ℹ️ ¿Cómo funciona?</strong>
            <p className="mb-0 mt-2">
              Esta herramienta prueba cada horario posible para la fecha seleccionada
              y te muestra cuáles están disponibles y cuáles ya están ocupados.
            </p>
          </small>
        </Alert>

        <Row className="align-items-end">
          <Col md={8}>
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold">Selecciona una Fecha</Form.Label>
              <Form.Control
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                min={obtenerFechaMinima()}
                size="lg"
              />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Button
              variant="info"
              onClick={consultarDisponibilidad}
              disabled={consultando || !fecha}
              size="lg"
              className="w-100 mb-3"
            >
              {consultando ? '⏳ Consultando...' : '🔍 Consultar'}
            </Button>
          </Col>
        </Row>

        {resultados && (
          <div>
            <Alert variant="light" className="border">
              <strong>📅 Fecha:</strong> {new Date(resultados.fecha + 'T00:00:00').toLocaleDateString('es-AR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
              <br />
              <strong>📋 Tipo:</strong> <Badge bg="secondary">{resultados.tipoDia}</Badge>
            </Alert>

            <h6 className="mb-3">Disponibilidad de Horarios:</h6>

            <div className="d-grid gap-2">
              {resultados.horarios.map((horario, index) => (
                <div
                  key={index}
                  className={`p-3 border rounded ${
                    horario.disponible ? 'bg-success bg-opacity-10 border-success' : 'bg-danger bg-opacity-10 border-danger'
                  }`}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <span className="fs-5 fw-bold">🕐 {horario.hora}</span>
                    </div>
                    <div>
                      {horario.disponible ? (
                        <Badge bg="success" className="fs-6">✅ Disponible</Badge>
                      ) : (
                        <Badge bg="danger" className="fs-6">❌ {horario.mensaje}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {resultados.horarios.filter(h => h.disponible).length === 0 && (
              <Alert variant="warning" className="mt-3">
                <strong>⚠️ Sin disponibilidad</strong>
                <p className="mb-0 mt-2">
                  No hay horarios disponibles para esta fecha. Prueba con otra fecha.
                </p>
              </Alert>
            )}

            {resultados.horarios.filter(h => h.disponible).length > 0 && (
              <Alert variant="success" className="mt-3">
                <strong>✅ Horarios disponibles encontrados</strong>
                <p className="mb-0 mt-2">
                  {resultados.horarios.filter(h => h.disponible).length} de {resultados.horarios.length} horarios disponibles
                </p>
              </Alert>
            )}
          </div>
        )}

        <Alert variant="warning" className="mt-3 mb-0">
          <small>
            <strong>⚠️ Importante:</strong>
            <ul className="mb-0 mt-2">
              <li>Esta consulta crea reservas de prueba con 1 persona</li>
              <li>Los horarios ocupados no están disponibles para reserva</li>
              <li>La disponibilidad puede cambiar en cualquier momento</li>
              <li>Verifica en el calendario de Bookly para confirmar</li>
            </ul>
          </small>
        </Alert>
      </Card.Body>
    </Card>
  );
};

export default ConsultaDisponibilidad;