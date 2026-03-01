import React, { useState, useCallback } from 'react';
import { Container, Toast, ToastContainer, Badge, Alert, Button, Modal } from 'react-bootstrap';

import ZabbixNavBar             from './layout/ZabbixNavBar';
import FormularioReserva        from './components/FormularioReserva';
import CalendarioDisponibilidad from './components/CalendarioDisponibilidad';
import ListaReservas            from './components/ListaReservas';
import HistorialReservas        from './components/HistorialReservas';
import PanelAdministrativo      from './components/PanelAdministrativo';

import './Admin.css';

// ─────────────────────────────────────────────────────────────
//  PERSISTENCIA — solo reservas en localStorage
//  Los cobros ya no se guardan aquí; viven 100% en la API.
// ─────────────────────────────────────────────────────────────
const RESERVAS_KEY = 'funcity_reservas_v2';

const leerReservas = () => {
  try {
    const raw = localStorage.getItem(RESERVAS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

const guardarReservas = (lista) => {
  try { localStorage.setItem(RESERVAS_KEY, JSON.stringify(lista)); } catch {}
};

// ─────────────────────────────────────────────────────────────
//  ADMIN
// ─────────────────────────────────────────────────────────────
const Admin = () => {

  const [vistaActiva, setVistaActiva] = useState('formulario');

  // ── Reservas — persisten en localStorage ─────────────────
  const [reservas, setReservasState] = useState(() => leerReservas());

  const setReservas = useCallback((updater) => {
    setReservasState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      guardarReservas(next);
      return next;
    });
  }, []);

  // ── Edición ───────────────────────────────────────────────
  const [modoEdicion,   setModoEdicion]   = useState(false);
  const [reservaEditar, setReservaEditar] = useState(null);
  const [precarga,      setPrecarga]      = useState(null);

  // ── Toasts + Modal limpiar ────────────────────────────────
  const [toasts,       setToasts]       = useState([]);
  const [modalLimpiar, setModalLimpiar] = useState(false);

  const addToast = useCallback((mensaje, variante = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, mensaje, variante }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const handleLimpiarHistorial = () => {
    setReservas([]);
    setModalLimpiar(false);
    addToast('Historial local limpiado. Los cobros permanecen en la API.', 'secondary');
  };

  // ── Navegación ────────────────────────────────────────────
  const handleNavSelect = (id) => {
    if (id !== 'formulario') {
      setModoEdicion(false);
      setReservaEditar(null);
      setPrecarga(null);
    }
    setVistaActiva(id);
  };

  // ── Callbacks reservas ────────────────────────────────────
  const handleReservaCreada = (reserva) => {
    setReservas(prev => [reserva, ...prev]);
    setModoEdicion(false);
    setReservaEditar(null);
    setPrecarga(null);
    addToast(`🎉 Reserva creada — #${reserva.bloqueo_id} · ${reserva.nombre_ninio}`);
    setTimeout(() => setVistaActiva('historial'), 600);
  };

  const handleEditar = (reserva) => {
    setReservaEditar(reserva);
    setModoEdicion(true);
    setPrecarga(null);
    setVistaActiva('formulario');
  };

  const handleReservaActualizada = (nuevaReserva) => {
    setReservas(prev =>
      prev.map(r => r.bloqueo_id === reservaEditar?.bloqueo_id ? nuevaReserva : r)
    );
    addToast(`✅ Reserva actualizada — nuevo ID #${nuevaReserva.bloqueo_id}`);
    setModoEdicion(false);
    setReservaEditar(null);
    setTimeout(() => setVistaActiva('listareservas'), 600);
  };

  const handleCancelarEdicion = () => {
    setModoEdicion(false);
    setReservaEditar(null);
    setVistaActiva('listareservas');
  };

  const handleActualizarReservas = (updater) => setReservas(updater);

  const handleIrAReservar = (fecha, hora) => {
    setPrecarga({ fecha, hora_inicio: hora });
    setModoEdicion(false);
    setReservaEditar(null);
    setVistaActiva('formulario');
  };

  // ── Títulos ───────────────────────────────────────────────
  const paginas = {
    formulario:    { emoji: '🎉', titulo: modoEdicion ? 'Editar Reserva' : 'Nueva Reserva',    sub: modoEdicion ? `Modificando reserva #${reservaEditar?.bloqueo_id}` : 'Completá los datos para registrar un cumpleaños' },
    listareservas: { emoji: '📋', titulo: 'Reservas',           sub: `${reservas.length} ${reservas.length === 1 ? 'reserva' : 'reservas'} guardadas` },
    calendario:    { emoji: '📅', titulo: 'Disponibilidad',     sub: 'Consultá los horarios disponibles en Bookly' },
    historial:     { emoji: '💳', titulo: 'Historial y Cobros', sub: `${reservas.length} reservas · cobros guardados en la API` },
    settings:      { emoji: '⚙️', titulo: 'Panel Administrativo', sub: 'Estadísticas, precios, estado de API y herramientas' },
  };
  const pageInfo = paginas[vistaActiva] || { emoji: '⚙️', titulo: 'Panel', sub: '' };

  // ─────────────────────────────────────────────────────────
  return (
    <div className="admin-root">

      <ZabbixNavBar
        onSelectComponent={handleNavSelect}
        activeComponent={vistaActiva}
        reservasCount={reservas.length}
      />

      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
        {toasts.map(t => (
          <Toast key={t.id} bg={t.variante} autohide delay={4500}
            onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>
            <Toast.Body className="d-flex align-items-center gap-2 fw-semibold text-white">
              {t.mensaje}
            </Toast.Body>
          </Toast>
        ))}
      </ToastContainer>

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
                    <span>{reservas.length} {reservas.length === 1 ? 'reserva' : 'reservas'}</span>
                  </div>
                  <Button variant="outline-primary" size="sm"
                    onClick={() => setVistaActiva('historial')}>
                    💳 Ver cobros
                  </Button>
                  <Button variant="outline-danger" size="sm" onClick={() => setModalLimpiar(true)}>
                    🗑️ Limpiar
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* ── Modal limpiar ── */}
          <Modal show={modalLimpiar} onHide={() => setModalLimpiar(false)} centered>
            <Modal.Header closeButton>
              <Modal.Title>🗑️ Limpiar historial local</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <p>¿Borrar las <strong>{reservas.length} reservas</strong> del historial local?</p>
              <Alert variant="info" className="mb-0">
                <small>
                  Los <strong>cobros permanecen guardados en la API</strong>. Solo se elimina la lista de reservas
                  local. Las reservas en <strong>Bookly</strong> tampoco se ven afectadas.
                </small>
              </Alert>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setModalLimpiar(false)}>Cancelar</Button>
              <Button variant="danger" onClick={handleLimpiarHistorial}>Sí, limpiar</Button>
            </Modal.Footer>
          </Modal>

          {/* ── Banners contextuales ── */}
          {modoEdicion && vistaActiva === 'formulario' && (
            <Alert variant="warning" className="edit-banner" dismissible onClose={handleCancelarEdicion}>
              <strong>✏️ Modo edición</strong> — Reserva{' '}
              <Badge bg="warning" text="dark">#{reservaEditar?.bloqueo_id}</Badge>{' '}
              · <strong>{reservaEditar?.nombre_ninio}</strong>.
              El bloqueo anterior se eliminará al confirmar.
            </Alert>
          )}
          {precarga && !modoEdicion && vistaActiva === 'formulario' && (
            <Alert variant="info" className="edit-banner" dismissible onClose={() => setPrecarga(null)}>
              📅 Pre-carga desde el calendario — <strong>{precarga.fecha}</strong> a las{' '}
              <strong>{precarga.hora_inicio}</strong>
            </Alert>
          )}

          {/* ════════════════════════════════════════════════
              CONTENIDO
          ════════════════════════════════════════════════ */}
          <div className="page-content">

            {vistaActiva === 'formulario' && (
              <FormularioReserva
                key={modoEdicion ? `edit-${reservaEditar?.bloqueo_id}` : `new-${precarga?.fecha}`}
                onReservaCreada={modoEdicion ? handleReservaActualizada : handleReservaCreada}
                modoEdicion={modoEdicion}
                reservaEditar={modoEdicion ? reservaEditar : precarga}
                onCancelarEdicion={modoEdicion ? handleCancelarEdicion : null}
              />
            )}

            {vistaActiva === 'listareservas' && (
              <ListaReservas
                reservas={reservas}
                onEditar={handleEditar}
                onActualizar={handleActualizarReservas}
                onIrAHistorial={(r) => {
                  // navegar al historial — HistorialReservas abrirá el cobro de esa reserva
                  setVistaActiva('historial');
                }}
              />
            )}

            {vistaActiva === 'calendario' && (
              <CalendarioDisponibilidad onIrAReservar={handleIrAReservar} />
            )}

            {/* HistorialReservas maneja sus propios cobros internamente
                a través del hook useCobros que llama directo a la API.
                No recibe cobros como prop. */}
            {vistaActiva === 'historial' && (
              <HistorialReservas reservas={reservas} />
            )}

            {vistaActiva === 'settings' && (
              <PanelAdministrativo />
            )}

            {!['formulario','listareservas','calendario','historial','settings'].includes(vistaActiva) && (
              <div className="empty-state">
                <div className="empty-state-icon">🔧</div>
                <h3>Vista no encontrada</h3>
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