// ============================================================
//  PanelAdministrativo — v2.0
//  - Configuración completa desde API (sin localStorage)
//  - Horarios, precios, capacidad y admins editables
//  - Estadísticas con precios correctos según feriados
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Badge, Button, Spinner, Alert,
  Form, Table, Nav, InputGroup, Modal,
} from 'react-bootstrap';
import {
  obtenerTodasLasReservas,
  esPrecioFinDeSemana,
  obtenerFeriadosRango,
  obtenerConfiguracion,
  guardarConfiguracion,
  CONFIG_DEFAULT,
  HORARIOS_DISPONIBLES,
  API_BASE_URL,
  API_KEY,
  verificarEstadoAPI,
} from '../services/api';
//import { useUserRole } from "../hooks/useUserRole";

import CajaDelDia from './CajaDelDia';


// ── Helpers ───────────────────────────────────────────────────
const hoy    = () => new Date().toISOString().split('T')[0];
const hace   = (m) => { const d = new Date(); d.setMonth(d.getMonth() - m); return d.toISOString().split('T')[0]; };
const dentro = (m) => { const d = new Date(); d.setMonth(d.getMonth() + m); return d.toISOString().split('T')[0]; };

const fmt$ = (n) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n || 0);

// ─────────────────────────────────────────────────────────────
//  Sección: Roles y Usuarios
// ─────────────────────────────────────────────────────────────
const SeccionRoles = () => {
  const { rolesConfig, actualizarRoles, isAdmin } = useUserRole();
  const [emailsAdmin, setEmailsAdmin] = useState(rolesConfig.adminEmails.join('\n'));
  const [editando,    setEditando]    = useState(false);
  const [guardando,   setGuardando]   = useState(false);
  const [mensaje,     setMensaje]     = useState('');

  const guardar = async () => {
    setGuardando(true);
    setMensaje('');
    const lista = emailsAdmin
      .split(/[\n,;]/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e.includes('@'));

    await actualizarRoles({ adminEmails: lista });
    setGuardando(false);
    setEditando(false);
    setMensaje('✅ Roles actualizados correctamente.');
    setTimeout(() => setMensaje(''), 4000);
  };

  if (!isAdmin) {
    return (
      <Alert variant="warning" className="mb-0">
        🔒 No tenés permisos para gestionar roles. Contactá a un administrador.
      </Alert>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <Card.Header className="bg-white border-bottom">
        <div className="d-flex justify-content-between align-items-center">
          <h6 className="mb-0 fw-bold">👥 Gestión de Roles y Accesos</h6>
          {!editando ? (
            <Button size="sm" variant="outline-primary" onClick={() => setEditando(true)}>✏️ Editar</Button>
          ) : (
            <div className="d-flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => { setEditando(false); setEmailsAdmin(rolesConfig.adminEmails.join('\n')); }}>Cancelar</Button>
              <Button size="sm" variant="success" onClick={guardar} disabled={guardando}>
                {guardando ? <Spinner size="sm" animation="border" /> : '💾 Guardar'}
              </Button>
            </div>
          )}
        </div>
      </Card.Header>

      <Card.Body className="p-4">
        {mensaje && <Alert variant="success" className="py-2 mb-3">{mensaje}</Alert>}

        <Row className="g-4">
          <Col xs={12} md={6}>
            <div style={{
              background: 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)',
              border: '1px solid #fcd34d', borderRadius: 12, padding: '18px 20px',
            }}>
              <div className="d-flex align-items-center gap-2 mb-2">
                <span style={{ fontSize: '1.4rem' }}>👑</span>
                <div>
                  <strong>Administrador</strong>
                  <Badge bg="warning" text="dark" className="ms-2" style={{ fontSize: '0.65rem' }}>Admin</Badge>
                </div>
              </div>
              <ul style={{ fontSize: '0.8rem', color: '#92400e', margin: 0, paddingLeft: 18 }}>
                <li>Ver y gestionar todas las reservas</li>
                <li>Eliminar reservas</li>
                <li>Modificar precios, horarios y configuración</li>
                <li>Ver caja del día completa</li>
                <li>Gestionar roles de usuarios</li>
                <li>Ver estadísticas y diagnóstico API</li>
              </ul>
              <div className="mt-3">
                <Form.Label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Emails con acceso admin (uno por línea):
                </Form.Label>
                {editando ? (
                  <Form.Control
                    as="textarea" rows={4}
                    value={emailsAdmin}
                    onChange={e => setEmailsAdmin(e.target.value)}
                    placeholder="admin@empresa.com&#10;otro@empresa.com"
                    style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}
                  />
                ) : (
                  <div style={{ background: '#fff', borderRadius: 8, padding: '8px 12px', border: '1px solid #e5e7eb' }}>
                    {rolesConfig.adminEmails.map(email => (
                      <div key={email} style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#374151', padding: '2px 0' }}>
                        • {email}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Col>

          <Col xs={12} md={6}>
            <div style={{
              background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
              border: '1px solid #93c5fd', borderRadius: 12, padding: '18px 20px',
            }}>
              <div className="d-flex align-items-center gap-2 mb-2">
                <span style={{ fontSize: '1.4rem' }}>🧾</span>
                <div>
                  <strong>Usuario / Cajero</strong>
                  <Badge bg="info" className="ms-2" style={{ fontSize: '0.65rem' }}>Cajero</Badge>
                </div>
              </div>
              <ul style={{ fontSize: '0.8rem', color: '#1e40af', margin: 0, paddingLeft: 18 }}>
                <li>Ver reservas existentes</li>
                <li>Crear nuevas reservas</li>
                <li>Registrar cobros y pagos</li>
                <li>Ver caja del día</li>
                <li className="text-danger"><strong>No puede</strong> eliminar reservas</li>
                <li className="text-danger"><strong>No puede</strong> modificar precios o horarios</li>
                <li className="text-danger"><strong>No puede</strong> ver configuración</li>
              </ul>
              <Alert variant="info" className="mt-3 py-2 mb-0">
                <small>
                  <strong>Asignación automática:</strong> Cualquier usuario que no sea admin
                  recibe automáticamente el rol de cajero.
                </small>
              </Alert>
            </div>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────
//  Sección: Precios, Horarios y Configuración
//  - Solo admin puede editar
//  - Se guarda en la API
// ─────────────────────────────────────────────────────────────
const SeccionPreciosHorarios = () => {
  const { isAdmin } = useUserRole();

  const [config,     setConfig]     = useState(null);
  const [cargando,   setCargando]   = useState(true);
  const [editando,   setEditando]   = useState(false);
  const [guardando,  setGuardando]  = useState(false);
  const [mensaje,    setMensaje]    = useState('');
  const [borrador,   setBorrador]   = useState(null);

  // ── Cargar config desde API ───────────────────────────────
  useEffect(() => {
    const cargar = async () => {
      setCargando(true);
      try {
        const cfg = await obtenerConfiguracion();
        setConfig(cfg);
        setBorrador(normalizarBorrador(cfg));
      } catch {
        setConfig(CONFIG_DEFAULT);
        setBorrador(normalizarBorrador(CONFIG_DEFAULT));
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, []);

  const normalizarBorrador = (cfg) => ({
    precio_semana:        String(cfg.precio_semana        ?? CONFIG_DEFAULT.precio_semana),
    precio_fin_de_semana: String(cfg.precio_fin_de_semana ?? CONFIG_DEFAULT.precio_fin_de_semana),
    capacidad_maxima:     String(cfg.capacidad_maxima     ?? CONFIG_DEFAULT.capacidad_maxima),
    anticipacion_meses:   String(cfg.anticipacion_meses   ?? CONFIG_DEFAULT.anticipacion_meses),
    horarios_semana:      (cfg.horarios_semana      ?? CONFIG_DEFAULT.horarios_semana).join(', '),
    horarios_fin_semana:  (cfg.horarios_fin_semana   ?? CONFIG_DEFAULT.horarios_fin_semana).join(', '),
  });

  const parseHorarios = (str) =>
    str.split(/[,\s]+/).map(h => h.trim()).filter(h => /^\d{2}:\d{2}$/.test(h));

  const guardar = async () => {
    setGuardando(true);
    setMensaje('');

    const horasSemana  = parseHorarios(borrador.horarios_semana);
    const horasFDS     = parseHorarios(borrador.horarios_fin_semana);

    if (!horasSemana.length || !horasFDS.length) {
      setMensaje('❌ Ingresá al menos un horario válido en formato HH:MM para cada tipo de día.');
      setGuardando(false);
      return;
    }

    const nuevaConfig = {
      precio_semana:        parseInt(borrador.precio_semana)        || CONFIG_DEFAULT.precio_semana,
      precio_fin_de_semana: parseInt(borrador.precio_fin_de_semana) || CONFIG_DEFAULT.precio_fin_de_semana,
      capacidad_maxima:     parseInt(borrador.capacidad_maxima)     || CONFIG_DEFAULT.capacidad_maxima,
      anticipacion_meses:   parseInt(borrador.anticipacion_meses)   || CONFIG_DEFAULT.anticipacion_meses,
      horarios_semana:      horasSemana,
      horarios_fin_semana:  horasFDS,
    };

    const res = await guardarConfiguracion(nuevaConfig);
    setConfig({ ...(config || {}), ...nuevaConfig });
    setEditando(false);
    setMensaje(res.ok
      ? '✅ Configuración guardada en el servidor.'
      : '⚠️ El servidor no pudo guardar (endpoint no disponible). Los cambios se reflejarán localmente en esta sesión.');
    setGuardando(false);
    setTimeout(() => setMensaje(''), 6000);
  };

  const iniciarEdicion = () => {
    setBorrador(normalizarBorrador(config));
    setEditando(true);
  };

  if (cargando) {
    return (
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <div className="mt-2 text-muted">Cargando configuración...</div>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm mb-4">
      <Card.Header className="bg-white border-bottom">
        <div className="d-flex justify-content-between align-items-center">
          <h6 className="mb-0 fw-bold">💰 Precios, Horarios y Configuración</h6>
          {isAdmin && !editando && (
            <Button size="sm" variant="outline-primary" onClick={iniciarEdicion}>✏️ Editar</Button>
          )}
          {isAdmin && editando && (
            <div className="d-flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => { setEditando(false); setBorrador(normalizarBorrador(config)); }}>Cancelar</Button>
              <Button size="sm" variant="success" onClick={guardar} disabled={guardando}>
                {guardando ? <Spinner size="sm" animation="border" /> : '💾 Guardar en API'}
              </Button>
            </div>
          )}
        </div>
      </Card.Header>

      <Card.Body>
        {mensaje && (
          <Alert variant={mensaje.startsWith('✅') ? 'success' : mensaje.startsWith('❌') ? 'danger' : 'warning'} className="py-2 mb-3">
            {mensaje}
          </Alert>
        )}

        {!isAdmin && (
          <Alert variant="info" className="py-2 mb-3">
            <small>🔒 Solo los administradores pueden modificar precios, horarios y configuración.</small>
          </Alert>
        )}

        {/* ── Precios ── */}
        <h6 className="fw-bold mb-3 text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          💰 Precios por Persona
        </h6>
        <Row className="g-3 mb-4">
          {[
            { label: 'Precio Lunes–Viernes', key: 'precio_semana', icon: '📅' },
            { label: 'Precio Sáb/Dom/Feriados', key: 'precio_fin_de_semana', icon: '🎉' },
          ].map(({ label, key, icon }) => (
            <Col xs={6} md={3} key={key}>
              <Card className="border-0" style={{ background: '#f8fafc' }}>
                <Card.Body className="py-3 text-center">
                  {editando && isAdmin ? (
                    <>
                      <Form.Label style={{ fontSize: '0.75rem', fontWeight: 600 }}>{icon} {label}</Form.Label>
                      <InputGroup size="sm">
                        <InputGroup.Text>$</InputGroup.Text>
                        <Form.Control
                          type="number"
                          value={borrador[key]}
                          onChange={e => setBorrador(p => ({ ...p, [key]: e.target.value }))}
                        />
                      </InputGroup>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '0.72rem', color: '#6b7280', marginBottom: 2 }}>{icon} {label}</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1d4ed8' }}>
                        {fmt$(parseInt(config[key]))}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#9ca3af' }}>por persona</div>
                    </>
                  )}
                </Card.Body>
              </Card>
            </Col>
          ))}

          {[
            { label: 'Capacidad Máxima', key: 'capacidad_maxima', sufijo: 'personas', icon: '👥' },
            { label: 'Anticipación Máxima', key: 'anticipacion_meses', sufijo: 'meses', icon: '📆' },
          ].map(({ label, key, sufijo, icon }) => (
            <Col xs={6} md={3} key={key}>
              <Card className="border-0" style={{ background: '#f8fafc' }}>
                <Card.Body className="py-3 text-center">
                  {editando && isAdmin ? (
                    <>
                      <Form.Label style={{ fontSize: '0.75rem', fontWeight: 600 }}>{icon} {label}</Form.Label>
                      <InputGroup size="sm">
                        <Form.Control
                          type="number"
                          value={borrador[key]}
                          onChange={e => setBorrador(p => ({ ...p, [key]: e.target.value }))}
                        />
                        <InputGroup.Text>{sufijo}</InputGroup.Text>
                      </InputGroup>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '0.72rem', color: '#6b7280', marginBottom: 2 }}>{icon} {label}</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1d4ed8' }}>
                        {config[key]}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#9ca3af' }}>{sufijo}</div>
                    </>
                  )}
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        {/* ── Horarios ── */}
        <h6 className="fw-bold mb-3 text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          🕐 Horarios de Turno
        </h6>
        <Row className="g-3 mb-3">
          {[
            { label: 'Horarios Lunes–Viernes', key: 'horarios_semana', icon: '📅', bg: '#f0fdf4', border: '#86efac' },
            { label: 'Horarios Sáb/Dom/Feriados', key: 'horarios_fin_semana', icon: '🎉', bg: '#eff6ff', border: '#93c5fd' },
          ].map(({ label, key, icon, bg, border }) => (
            <Col xs={12} md={6} key={key}>
              <Card style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10 }}>
                <Card.Body className="py-3">
                  <Form.Label style={{ fontSize: '0.8rem', fontWeight: 700 }}>{icon} {label}</Form.Label>
                  {editando && isAdmin ? (
                    <>
                      <Form.Control
                        type="text"
                        value={borrador[key]}
                        onChange={e => setBorrador(p => ({ ...p, [key]: e.target.value }))}
                        placeholder="12:30, 14:20, 16:10"
                        style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                      />
                      <Form.Text className="text-muted" style={{ fontSize: '0.72rem' }}>
                        Separar con comas. Formato HH:MM. Ej: 10:30, 12:20, 14:10
                      </Form.Text>
                    </>
                  ) : (
                    <div className="d-flex flex-wrap gap-2 mt-1">
                      {(config[key] ?? []).map(h => (
                        <Badge key={h} bg="light" text="dark" style={{ border: `1px solid ${border}`, fontSize: '0.85rem', padding: '6px 10px' }}>
                          🕐 {h}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        <Alert variant="info" className="py-2 mb-0">
          <small>
            <strong>📌 Nota:</strong> Los cambios de horarios se aplican inmediatamente al formulario de reservas.
            Los precios finales también se deben actualizar en el plugin Bookly de WordPress.
            <br />
            <strong>🎉 Feriados:</strong> Los días feriados se cobran automáticamente con la tarifa de fin de semana,
            usando los datos de argentinadatos.com.
          </small>
        </Alert>
      </Card.Body>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────
//  Sección: Estadísticas (con precios correctos por feriado)
// ─────────────────────────────────────────────────────────────
const SeccionEstadisticas = () => {
  const [reservas,  setReservas]  = useState([]);
  const [feriados,  setFeriados]  = useState({});
  const [config,    setConfig]    = useState(CONFIG_DEFAULT);
  const [cargando,  setCargando]  = useState(false);
  const [error,     setError]     = useState('');
  const [ultimaAct, setUltimaAct] = useState(null);
  const [rango,     setRango]     = useState({ inicio: hace(1), fin: dentro(3) });

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [res, cfg, fer] = await Promise.all([
        obtenerTodasLasReservas({ fechaInicio: rango.inicio, fechaFin: rango.fin, usarCache: false }),
        obtenerConfiguracion(),
        obtenerFeriadosRango(new Date().getFullYear(), new Date().getFullYear() + 1),
      ]);
      setReservas(res.reservas || []);
      setConfig(cfg);
      setFeriados(fer);
      setUltimaAct(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [rango]);

  useEffect(() => { cargar(); }, [cargar]);

  // Calcular ingresos con lógica de feriados
  const calcIngreso = (r) => {
    const esFDS  = esPrecioFinDeSemana(r.fecha, feriados);
    const precio = esFDS ? config.precio_fin_de_semana : config.precio_semana;
    return (parseInt(r.personas) || 0) * precio;
  };

  const totalPersonas   = reservas.reduce((s, r) => s + (parseInt(r.personas) || 0), 0);
  const ingresoEstimado = reservas.reduce((s, r) => s + calcIngreso(r), 0);
  const reservasFDS     = reservas.filter(r => r.fecha && esPrecioFinDeSemana(r.fecha, feriados));
  const reservasSemana  = reservas.filter(r => r.fecha && !esPrecioFinDeSemana(r.fecha, feriados));
  const reservasFeriado = reservas.filter(r => r.fecha && feriados[r.fecha] && !['0','6'].includes(String(new Date(r.fecha + 'T00:00:00').getDay())));

  const temasCount = {};
  reservas.forEach(r => { if (r.tema) temasCount[r.tema] = (temasCount[r.tema] || 0) + 1; });
  const topTemas = Object.entries(temasCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const futuras = reservas
    .filter(r => r.fecha >= hoy())
    .sort((a, b) => (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio))
    .slice(0, 8);

  const kpiCard = (emoji, titulo, valor, sub, color = '#3b82f6') => (
    <Card className="border-0" style={{ background: '#f8fafc' }}>
      <Card.Body className="py-3 text-center">
        <div style={{ fontSize: '1.6rem' }}>{emoji}</div>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, color }}>{valor}</div>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>{titulo}</div>
        {sub && <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{sub}</div>}
      </Card.Body>
    </Card>
  );

  return (
    <Card className="mb-4 border-0 shadow-sm">
      <Card.Header className="bg-white border-bottom">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h6 className="mb-0 fw-bold">📊 Estadísticas en Tiempo Real</h6>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <Form.Group className="d-flex align-items-center gap-1 mb-0">
              <Form.Label className="mb-0" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Desde:</Form.Label>
              <Form.Control type="date" size="sm" value={rango.inicio}
                onChange={e => setRango(r => ({ ...r, inicio: e.target.value }))} style={{ width: 140 }} />
            </Form.Group>
            <Form.Group className="d-flex align-items-center gap-1 mb-0">
              <Form.Label className="mb-0" style={{ fontSize: '0.8rem' }}>Hasta:</Form.Label>
              <Form.Control type="date" size="sm" value={rango.fin}
                onChange={e => setRango(r => ({ ...r, fin: e.target.value }))} style={{ width: 140 }} />
            </Form.Group>
            <Button size="sm" variant="outline-primary" onClick={cargar} disabled={cargando}>
              {cargando ? <Spinner size="sm" animation="border" /> : '🔄 Actualizar'}
            </Button>
          </div>
        </div>
        {ultimaAct && (
          <small className="text-muted d-block mt-1">
            Última actualización: {ultimaAct.toLocaleTimeString('es-AR')} · Fuente: API en tiempo real
          </small>
        )}
      </Card.Header>

      <Card.Body>
        {error && <Alert variant="danger" className="py-2">{error}</Alert>}

        <Row className="g-2 mb-4">
          {kpiCard('📅', 'Total Reservas', reservas.length, `${reservasFDS.length} FDS/feriado · ${reservasSemana.length} semana`)}
          {kpiCard('👨‍👩‍👧', 'Total Personas', totalPersonas, 'Capacidad acumulada', '#8b5cf6')}
          {kpiCard('💰', 'Ingreso Estimado', fmt$(ingresoEstimado), 'Precios según día + feriados', '#16a34a')}
          {kpiCard('🎉', 'En Feriados', reservasFeriado.length, 'Semana con tarifa FDS', '#f59e0b')}
        </Row>

        {topTemas.length > 0 && (
          <div className="mb-4">
            <h6 className="fw-bold mb-2" style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '.06em', color: '#374151' }}>
              🎉 Top Temas
            </h6>
            <div className="d-flex flex-wrap gap-2">
              {topTemas.map(([tema, count]) => (
                <Badge key={tema} bg="light" text="dark" className="py-2 px-3" style={{ border: '1px solid #e5e7eb', fontSize: '0.78rem' }}>
                  {tema} <span style={{ opacity: .6 }}>({count})</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {futuras.length > 0 && (
          <>
            <h6 className="fw-bold mb-2" style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '.06em', color: '#374151' }}>
              🔮 Próximas Reservas
            </h6>
            <Table size="sm" hover style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th>Festejado/a</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Personas</th>
                  <th>Precio/u</th>
                  <th>Tema</th>
                </tr>
              </thead>
              <tbody>
                {futuras.map(r => {
                  const esFDS   = esPrecioFinDeSemana(r.fecha, feriados);
                  const precio  = esFDS ? config.precio_fin_de_semana : config.precio_semana;
                  const esFer   = !!feriados[r.fecha];
                  return (
                    <tr key={r.bloqueo_id}>
                      <td><strong>{r.nombre_ninio}</strong></td>
                      <td>
                        {new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {esFer && <Badge bg="warning" text="dark" className="ms-1" style={{ fontSize: '0.6rem' }}>Feriado</Badge>}
                      </td>
                      <td>{r.hora_inicio}</td>
                      <td>{r.personas}</td>
                      <td>
                        <span style={{ color: esFDS ? '#b45309' : '#374151', fontWeight: 600 }}>
                          {fmt$(precio)}
                        </span>
                      </td>
                      <td>{r.tema || <span className="text-muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </>
        )}
      </Card.Body>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────
//  Sección: Estado API
// ─────────────────────────────────────────────────────────────
const SeccionEstadoAPI = () => {
  const [estado,   setEstado]   = useState(null);
  const [cargando, setCargando] = useState(false);
  const [config,   setConfig]   = useState(null);

  const verificar = async () => {
    setCargando(true);
    try {
      const [res, cfg] = await Promise.all([verificarEstadoAPI(), obtenerConfiguracion()]);
      setEstado(res);
      setConfig(cfg);
    } catch {}
    setCargando(false);
  };

  useEffect(() => { verificar(); }, []);

  return (
    <Card className="border-0 shadow-sm mb-4">
      <Card.Header className="bg-white border-bottom d-flex justify-content-between align-items-center">
        <h6 className="mb-0 fw-bold">🔌 Estado de la API</h6>
        <Button size="sm" variant="outline-secondary" onClick={verificar} disabled={cargando}>
          {cargando ? <Spinner size="sm" animation="border" /> : '🔍 Verificar'}
        </Button>
      </Card.Header>
      <Card.Body>
        <Row>
          <Col md={6}>
            <Table size="sm" style={{ fontSize: '0.82rem' }}>
              <tbody>
                <tr>
                  <td className="text-muted">URL Base</td>
                  <td><code style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}>{API_BASE_URL}</code></td>
                </tr>
                <tr>
                  <td className="text-muted">Autenticación</td>
                  <td><Badge bg="success">API Key</Badge></td>
                </tr>
                <tr>
                  <td className="text-muted">Feriados</td>
                  <td><Badge bg="info">argentinadatos.com</Badge></td>
                </tr>
                {config && (
                  <>
                    <tr>
                      <td className="text-muted">Horarios Semana</td>
                      <td>{(config.horarios_semana ?? []).join(', ')}</td>
                    </tr>
                    <tr>
                      <td className="text-muted">Horarios FDS/Feriado</td>
                      <td>{(config.horarios_fin_semana ?? []).join(', ')}</td>
                    </tr>
                    <tr>
                      <td className="text-muted">Precio Semana</td>
                      <td>{fmt$(config.precio_semana)}/persona</td>
                    </tr>
                    <tr>
                      <td className="text-muted">Precio FDS/Feriado</td>
                      <td>{fmt$(config.precio_fin_de_semana)}/persona</td>
                    </tr>
                  </>
                )}
              </tbody>
            </Table>
          </Col>
          {estado && (
            <Col md={6}>
              <div className="mb-2" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                Endpoints: {estado.resumen.disponibles}/{estado.resumen.total} online
              </div>
              {estado.endpoints.map(ep => (
                <div key={ep.nombre} className="d-flex align-items-center gap-2 mb-1" style={{ fontSize: '0.78rem' }}>
                  <span>{ep.disponible ? '✅' : '❌'}</span>
                  <span style={{ fontFamily: 'monospace' }}>{ep.nombre}</span>
                  <Badge bg={ep.disponible ? 'success' : 'danger'} style={{ fontSize: '0.65rem' }}>{ep.status}</Badge>
                  <span className="text-muted">{ep.tiempo}</span>
                </div>
              ))}
            </Col>
          )}
        </Row>
      </Card.Body>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────
//  Sección: Herramientas
// ─────────────────────────────────────────────────────────────
const SeccionHerramientas = () => {
  const { isAdmin } = useUserRole();

  return (
    <Card className="border-0 shadow-sm mb-4">
      <Card.Header className="bg-white border-bottom">
        <h6 className="mb-0 fw-bold">🔧 Herramientas</h6>
      </Card.Header>
      <Card.Body>
        {!isAdmin && (
          <Alert variant="warning" className="py-2 mb-3">
            <small>🔒 Algunas herramientas requieren permisos de administrador.</small>
          </Alert>
        )}

        <Row className="g-3">
          {isAdmin && (
            <Col xs={12} md={6}>
              <Card className="border" style={{ borderRadius: 10 }}>
                <Card.Body>
                  <h6 className="fw-bold mb-1">📋 Exportar configuración</h6>
                  <p className="text-muted mb-3" style={{ fontSize: '0.82rem' }}>
                    Descargá un JSON con la configuración actual obtenida desde la API.
                  </p>
                  <Button
                    variant="outline-primary" size="sm"
                    onClick={async () => {
                      const config = await obtenerConfiguracion();
                      const blob = new Blob([JSON.stringify({ timestamp: new Date().toISOString(), config }, null, 2)], { type: 'application/json' });
                      const url  = URL.createObjectURL(blob);
                      const a    = document.createElement('a');
                      a.href     = url; a.download = `funcity-config-${hoy()}.json`; a.click();
                    }}
                  >
                    📥 Exportar
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          )}

          <Col xs={12} md={6}>
            <Card className="border" style={{ borderRadius: 10 }}>
              <Card.Body>
                <h6 className="fw-bold mb-1">ℹ️ Información del Sistema</h6>
                <p className="text-muted mb-3" style={{ fontSize: '0.82rem' }}>
                  Toda la configuración se almacena en la API del servidor.
                  No se usa almacenamiento local del navegador.
                </p>
                <Badge bg="success">Sin localStorage ✓</Badge>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────
//  COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────
const PanelAdministrativo = () => {
  const { isAdmin, currentRole } = useUserRole();
  const [tab, setTab] = useState('caja');

 const tabs = [
  { id: 'caja',         label: '🏪 Caja del Día',     siempreVisible: true  },
  { id: 'estadisticas', label: '📊 Estadísticas',      siempreVisible: true  },
  { id: 'precios',      label: '💰 Precios y Horarios', siempreVisible: false },
  { id: 'roles',        label: '👥 Roles y Accesos',   siempreVisible: false },
  { id: 'api',          label: '🔌 Estado API',         siempreVisible: false },
  { id: 'herramientas', label: '🔧 Herramientas',       siempreVisible: false },
].filter(t => (t.siempreVisible || isAdmin) && !['roles', 'api', 'herramientas'].includes(t.id));

  useEffect(() => {
    const disponibles = tabs.map(t => t.id);
    if (!disponibles.includes(tab)) setTab('caja');
  }, [isAdmin]);

  return (
    <div>
      <Alert variant="light" className="border mb-4 py-2">
        <div className="d-flex align-items-center gap-2">
          <span style={{ fontSize: '1.2rem' }}>⚙️</span>
          <div>
            <strong>Panel de Gestión</strong>
            <span className="text-muted ms-2" style={{ fontSize: '0.82rem' }}>
              Caja del día, estadísticas, precios, horarios y configuración
            </span>
          </div>
          <Badge
            bg={isAdmin ? 'warning' : 'info'}
            text={isAdmin ? 'dark' : undefined}
            className="ms-auto"
          >
            {isAdmin ? '👑 Admin' : '🧾 Cajero'}
          </Badge>
        </div>
      </Alert>

      <Nav variant="tabs" className="mb-4" activeKey={tab} onSelect={setTab}>
        {tabs.map(t => (
          <Nav.Item key={t.id}>
            <Nav.Link eventKey={t.id} style={{ fontSize: '0.85rem' }}>{t.label}</Nav.Link>
          </Nav.Item>
        ))}
      </Nav>

      {tab === 'caja'         && <CajaDelDia />}
      {tab === 'estadisticas' && <SeccionEstadisticas />}
      {tab === 'precios'      && <SeccionPreciosHorarios />}
      {tab === 'roles'        && <SeccionRoles />}
      {tab === 'api'          && <SeccionEstadoAPI />}
      {tab === 'herramientas' && <SeccionHerramientas />}
    </div>
  );
};

export default PanelAdministrativo;