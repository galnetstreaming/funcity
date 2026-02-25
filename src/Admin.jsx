import React, { useState, useEffect, useCallback } from 'react';
import { Container, Toast, ToastContainer, Badge, Alert, Button, Modal } from 'react-bootstrap';

import ZabbixNavBar           from './layout/ZabbixNavBar';
import FormularioReserva      from './components/FormularioReserva';
import CalendarioDisponibilidad from './components/CalendarioDisponibilidad';
import ListaReservas           from './components/ListaReservas';
import HistorialReservas       from './components/HistorialReservas';

import './Admin.css';

// ── Clave de almacenamiento ───────────────────────────────────
const STORAGE_KEY = 'funcity_reservas_historial';

const cargarReservasGuardadas = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const guardarReservas = (lista) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  } catch (e) {
    console.warn('No se pudo guardar en localStorage:', e);
  }
};

// ─────────────────────────────────────────────────────────────
//  Admin — Panel principal
//  El ZabbixNavBar controla la vista activa.
//  Reservas persisten en localStorage entre sesiones.
// ─────────────────────────────────────────────────────────────
const Admin = () => {
  // ── Vista activa (manejada por ZabbixNavBar) ─────────────
  const [vistaActiva, setVistaActiva]     = useState('formulario');

  // ── Estado global: reservas persistidas ─────────────────
  const [reservas, setReservasState]      = useState(() => cargarReservasGuardadas());

  // Wrapper que persiste cada cambio automáticamente
  const setReservas = useCallback((updater) => {
    setReservasState(prev => {
      const siguiente = typeof updater === 'function' ? updater(prev) : updater;
      guardarReservas(siguiente);
      return siguiente;
    });
  }, []);

  // ── Modo edición ────────────────────────────────────────
  const [modoEdicion, setModoEdicion]     = useState(false);
  const [reservaEditar, setReservaEditar] = useState(null);

  // ── Pre-carga desde calendario ──────────────────────────
  const [precarga, setPrecarga]           = useState(null); // {fecha, hora_inicio}

  // ── Toasts globales ──────────────────────────────────────
  const [toasts, setToasts] = useState([]);

  // ── Modal limpiar historial ──────────────────────────────
  const [modalLimpiar, setModalLimpiar]   = useState(false);

  const handleLimpiarHistorial = () => {
    setReservas([]);
    setModalLimpiar(false);
    addToast("Historial limpiado correctamente", "secondary");
  };

  const addToast = (mensaje, variante = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, mensaje, variante }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  // ── Navegación desde navbar ──────────────────────────────
  const handleNavSelect = (id) => {
    // Si cambia de pantalla sin ser editar, limpiar modo edición
    if (id !== 'formulario') {
      setModoEdicion(false);
      setReservaEditar(null);
      setPrecarga(null);
    }
    setVistaActiva(id);
  };

  // ── Callback: reserva creada ─────────────────────────────
  const handleReservaCreada = (reserva) => {
    setReservas(prev => [reserva, ...prev]);
    setModoEdicion(false);
    setReservaEditar(null);
    setPrecarga(null);
    addToast(`🎉 ¡Reserva creada! ID #${reserva.bloqueo_id} — ${reserva.nombre_ninio}`);
    setTimeout(() => setVistaActiva('listareservas'), 700);
  };

  // ── Callback: editar reserva (desde ListaReservas) ───────
  const handleEditar = (reserva) => {
    setReservaEditar(reserva);
    setModoEdicion(true);
    setPrecarga(null);
    setVistaActiva('formulario');
  };

  // ── Callback: reserva actualizada ───────────────────────
  const handleReservaActualizada = (nuevaReserva) => {
    setReservas(prev =>
      prev.map(r => r.bloqueo_id === reservaEditar?.bloqueo_id ? nuevaReserva : r)
    );
    addToast(`✅ Reserva actualizada — nuevo ID #${nuevaReserva.bloqueo_id}`);
    setModoEdicion(false);
    setReservaEditar(null);
    setTimeout(() => setVistaActiva('listareservas'), 700);
  };

  // ── Callback: cancelar edición ───────────────────────────
  const handleCancelarEdicion = () => {
    setModoEdicion(false);
    setReservaEditar(null);
    setVistaActiva('listareservas');
  };

  // ── Callback: eliminar desde lista ───────────────────────
  const handleActualizarReservas = (updater) => {
    setReservas(updater);
  };

  // ── Callback: ir a reservar desde calendario ────────────
  const handleIrAReservar = (fecha, hora) => {
    setPrecarga({ fecha, hora_inicio: hora });
    setModoEdicion(false);
    setReservaEditar(null);
    setVistaActiva('formulario');
  };

  // ── Título de cada sección ────────────────────────────────
  const titulos = {
    formulario:    { emoji: '🎉', titulo: modoEdicion ? 'Editar Reserva' : 'Nueva Reserva',    sub: modoEdicion ? `Modificando reserva #${reservaEditar?.bloqueo_id}` : 'Completá los datos para crear un cumpleaños' },
    listareservas: { emoji: '📋', titulo: 'Reservas',                                           sub: `${reservas.length} reservas en esta sesión` },
    calendario:    { emoji: '📅', titulo: 'Disponibilidad',                                     sub: 'Consultá los horarios disponibles en Bookly' },
    historial:     { emoji: '📊', titulo: 'Historial',                                          sub: 'Detalle completo de reservas creadas en la sesión' },
    settings:      { emoji: '⚙️', titulo: 'Configuración',                                     sub: 'Opciones del sistema' },
  };

  const pageInfo = titulos[vistaActiva] || { emoji: '⚙️', titulo: 'Panel', sub: '' };

  // ─────────────────────────────────────────────────────────
  return (
    <div className="admin-root">

      {/* ── Navbar ── */}
      <ZabbixNavBar
        onSelectComponent={handleNavSelect}
        activeComponent={vistaActiva}
        reservasCount={reservas.length}
      />

      {/* ── Toast notifications ── */}
      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
        {toasts.map(t => (
          <Toast
            key={t.id}
            bg={t.variante}
            autohide
            delay={4500}
            onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
          >
            <Toast.Body className="d-flex align-items-center gap-2 fw-semibold text-white">
              {t.mensaje}
            </Toast.Body>
          </Toast>
        ))}
      </ToastContainer>

      {/* ── Main layout ── */}
      <main className="admin-main">
        <Container fluid className="admin-container">

          {/* ── Page header ── */}
          <div className="page-header">
            <div className="page-header-left">
              <div className="page-header-icon">{pageInfo.emoji}</div>
              <div>
                <h1 className="page-title">{pageInfo.titulo}</h1>
                <p className="page-subtitle">{pageInfo.sub}</p>
              </div>
            </div>

            <div className="page-header-right">
              {reservas.length > 0 && (
                <>
                  <div className="session-badge">
                    <span className="session-badge-dot" />
                    <span>{reservas.length} {reservas.length === 1 ? 'reserva' : 'reservas'} guardadas</span>
                  </div>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => setModalLimpiar(true)}
                    title="Limpiar historial guardado"
                  >
                    🗑️ Limpiar historial
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* ── Modal confirmar limpiar historial ── */}
          <Modal show={modalLimpiar} onHide={() => setModalLimpiar(false)} centered>
            <Modal.Header closeButton>
              <Modal.Title>🗑️ Limpiar historial</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <p>¿Estás seguro de que querés eliminar las <strong>{reservas.length} reservas</strong> del historial guardado?</p>
              <Alert variant="warning" className="mb-0">
                <small>Esto solo borra el registro local. Las reservas en <strong>Bookly</strong> no se ven afectadas.</small>
              </Alert>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setModalLimpiar(false)}>Cancelar</Button>
              <Button variant="danger" onClick={handleLimpiarHistorial}>Sí, limpiar</Button>
            </Modal.Footer>
          </Modal>

          {/* ── Banner de edición activa ── */}
          {modoEdicion && vistaActiva === 'formulario' && (
            <Alert variant="warning" className="edit-banner" dismissible onClose={handleCancelarEdicion}>
              <strong>✏️ Modo edición</strong> — Modificando reserva <Badge bg="warning" text="dark">#{reservaEditar?.bloqueo_id}</Badge>
              {' '}para <strong>{reservaEditar?.nombre_ninio}</strong>.
              El bloqueo anterior se eliminará al confirmar.
            </Alert>
          )}

          {/* ── Banner de pre-carga desde calendario ── */}
          {precarga && !modoEdicion && vistaActiva === 'formulario' && (
            <Alert variant="info" className="edit-banner" dismissible onClose={() => setPrecarga(null)}>
              📅 Reserva iniciada desde el calendario —{' '}
              <strong>{precarga.fecha}</strong> a las <strong>{precarga.hora_inicio}</strong>
            </Alert>
          )}

          {/* ── Contenido de la vista ── */}
          <div className="page-content">

            {/* ─ Formulario (nueva / editar) ─ */}
            {vistaActiva === 'formulario' && (
              <FormularioReserva
                key={modoEdicion ? `editar-${reservaEditar?.bloqueo_id}` : `nueva-${precarga?.fecha}`}
                onReservaCreada={modoEdicion ? handleReservaActualizada : handleReservaCreada}
                modoEdicion={modoEdicion}
                reservaEditar={modoEdicion ? reservaEditar : precarga}
                onCancelarEdicion={modoEdicion ? handleCancelarEdicion : null}
              />
            )}

            {/* ─ Lista de reservas ─ */}
            {vistaActiva === 'listareservas' && (
              <ListaReservas
                reservas={reservas}
                onEditar={handleEditar}
                onActualizar={handleActualizarReservas}
              />
            )}

            {/* ─ Calendario ─ */}
            {vistaActiva === 'calendario' && (
              <CalendarioDisponibilidad
                onIrAReservar={handleIrAReservar}
              />
            )}

            {/* ─ Historial ─ */}
            {vistaActiva === 'historial' && (
              <HistorialReservas reservas={reservas} />
            )}

            {/* ─ Configuración ─ */}
            {vistaActiva === 'settings' && (
              <div className="empty-state">
                <div className="empty-state-icon">⚙️</div>
                <h3>Configuración</h3>
                <p>Esta sección está en construcción.</p>
              </div>
            )}

            {/* ─ Default ─ */}
            {!['formulario','listareservas','calendario','historial','settings'].includes(vistaActiva) && (
              <div className="empty-state">
                <div className="empty-state-icon">🔧</div>
                <h3>Componente no encontrado</h3>
                <p>Navegá usando el menú superior.</p>
              </div>
            )}

          </div>

        </Container>
      </main>
    </div>
  );
};

export default Admin;