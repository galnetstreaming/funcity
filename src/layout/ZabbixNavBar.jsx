import React, { useState, useEffect } from 'react';
import {
  Navbar, Nav, Container, Dropdown,
  Offcanvas, Badge, Tooltip, OverlayTrigger
} from 'react-bootstrap';
import {
  ClipboardCheck, Gear, List, PersonCircle,
  BoxArrowRight, Calendar3, PlusCircle,
  Table, ClockHistory
} from 'react-bootstrap-icons';
import { useAuth } from '../AuthContext';
import PropTypes from 'prop-types';
import './ZabbixNavBar.css';

const ZabbixNavBar = ({
  onSelectComponent,
  activeComponent = 'formulario',
  eventCount = 0,
  reservasCount = 0,
}) => {
  const [showOffcanvas, setShowOffcanvas] = useState(false);
  const [scrolled, setScrolled]           = useState(false);
  const { currentUser, logout }           = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSelect = (id) => {
    onSelectComponent(id);
    setShowOffcanvas(false);
  };

  const handleLogout = async () => {
    try { await logout(); } catch (e) { console.error(e); }
  };

  const getDisplayName = () =>
    currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Usuario';

  const getInitials = () =>
    getDisplayName().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  // ── Menú principal ────────────────────────────────────────
  const mainItems = [
    {
      id: 'formulario',
      title: 'Nueva Reserva',
      icon: <PlusCircle size={16} className="me-2" />,
      description: 'Crear una nueva reserva de cumpleaños',
    },
    {
      id: 'listareservas',
      title: 'Reservas',
      icon: <Table size={16} className="me-2" />,
      description: 'Ver y gestionar reservas de la sesión',
      badge: reservasCount,
    },
    {
      id: 'calendario',
      title: 'Disponibilidad',
      icon: <Calendar3 size={16} className="me-2" />,
      description: 'Consultar disponibilidad de horarios',
    },
    /*
    {
      id: 'historial',
      title: 'Historial',
      icon: <ClockHistory size={16} className="me-2" />,
      description: 'Historial de reservas creadas en esta sesión',
      badge: reservasCount,
    },
    */
  ];

  const secondaryItems = [
    {
      id: 'settings',
      title: 'Configuración',
      icon: <Gear size={16} className="me-2" />,
      description: 'Configuración del sistema',
    },
  ];

  const renderTooltip = (text) => (props) =>
    <Tooltip {...props}>{text}</Tooltip>;

  // ─────────────────────────────────────────────────────────
  return (
    <>
      <Navbar
        variant="dark"
        expand="lg"
        fixed="top"
        className={`zabbix-navbar ${scrolled ? 'navbar-scrolled' : ''}`}
      >
        <Container fluid className="px-3">

          {/* ── Brand ── */}
          <Navbar.Brand className="d-flex align-items-center gap-2 me-4">
            <div className="brand-icon">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <div className="brand-name">Cumpleaños</div>
              <div className="brand-sub">Sistema de Reservas</div>
            </div>
          </Navbar.Brand>

          {/* ── Mobile toggle ── */}
          <div className="d-flex align-items-center gap-2 d-lg-none">
            {reservasCount > 0 && (
              <Badge bg="primary" pill>{reservasCount}</Badge>
            )}
            <button className="navbar-toggler-custom" onClick={() => setShowOffcanvas(true)}>
              <List size={22} color="#ecf0f1" />
            </button>
          </div>

          {/* ── Desktop Nav ── */}
          <div className="d-none d-lg-flex align-items-center flex-grow-1">

            {/* Main nav */}
            <Nav className="me-auto nav-main">
              {mainItems.map(item => (
                <OverlayTrigger
                  key={item.id}
                  placement="bottom"
                  overlay={renderTooltip(item.description)}
                >
                  <button
                    className={`nav-btn ${activeComponent === item.id ? 'nav-btn--active' : ''}`}
                    onClick={() => handleSelect(item.id)}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                    {item.badge > 0 && (
                      <Badge bg="primary" pill className="ms-1" style={{ fontSize: '0.6rem' }}>
                        {item.badge > 99 ? '99+' : item.badge}
                      </Badge>
                    )}
                  </button>
                </OverlayTrigger>
              ))}

              {/* Dropdown Más */}
              <Dropdown>
                <Dropdown.Toggle as="button" className="nav-btn nav-btn--dropdown">
                  <Gear size={16} className="me-2" />
                  <span>Más</span>
                </Dropdown.Toggle>
                <Dropdown.Menu className="dropdown-custom">
                  {secondaryItems.map(item => (
                    <Dropdown.Item
                      key={item.id}
                      onClick={() => handleSelect(item.id)}
                      className={`dropdown-item-custom ${activeComponent === item.id ? 'active' : ''}`}
                    >
                      <div className="d-flex align-items-start gap-2">
                        <div className="mt-1">{item.icon}</div>
                        <div>
                          <div className="fw-semibold">{item.title}</div>
                          <div className="text-muted" style={{ fontSize: '0.78rem' }}>{item.description}</div>
                        </div>
                      </div>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </Nav>

            {/* Right side */}
            <Nav className="ms-auto d-flex align-items-center gap-2">

              {/* API status indicator */}
              <div className="api-status">
                <span className="api-dot" />
                <span className="api-label">Bookly</span>
              </div>

              {/* User dropdown */}
              <Dropdown align="end">
                <Dropdown.Toggle as="button" className="user-btn">
                  <div className="user-avatar">{getInitials()}</div>
                  <span className="d-none d-xl-inline ms-2">{getDisplayName()}</span>
                </Dropdown.Toggle>
                <Dropdown.Menu className="dropdown-custom dropdown-user">
                  <div className="dropdown-user-header">
                    <div className="user-avatar user-avatar--lg">{getInitials()}</div>
                    <div>
                      <div className="fw-bold text-white">{getDisplayName()}</div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{currentUser?.email}</div>
                    </div>
                  </div>
                  <Dropdown.Divider className="dropdown-divider-custom" />
                  <Dropdown.Item onClick={() => handleSelect('profile')} className="dropdown-item-custom">
                    <PersonCircle size={15} className="me-2" />Mi Perfil
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => handleSelect('settings')} className="dropdown-item-custom">
                    <Gear size={15} className="me-2" />Configuración
                  </Dropdown.Item>
                  <Dropdown.Divider className="dropdown-divider-custom" />
                  <Dropdown.Item onClick={handleLogout} className="dropdown-item-custom dropdown-item-danger">
                    <BoxArrowRight size={15} className="me-2" />Cerrar Sesión
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Nav>
          </div>
        </Container>
      </Navbar>

      {/* Spacer */}
      <div className="navbar-space" />

      {/* ── Offcanvas mobile ── */}
      <Offcanvas
        show={showOffcanvas}
        onHide={() => setShowOffcanvas(false)}
        placement="end"
        className="offcanvas-custom"
      >
        <Offcanvas.Header closeButton className="offcanvas-header-custom">
          <Offcanvas.Title className="d-flex align-items-center gap-2">
            <ClipboardCheck size={20} />
            <span>Fun City</span>
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="offcanvas-body-custom">

          <div className="offcanvas-section-label">Navegación</div>
          {mainItems.map(item => (
            <button
              key={item.id}
              className={`offcanvas-nav-btn ${activeComponent === item.id ? 'offcanvas-nav-btn--active' : ''}`}
              onClick={() => handleSelect(item.id)}
            >
              <div className="offcanvas-nav-icon">{item.icon}</div>
              <div className="flex-grow-1">
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-semibold">{item.title}</span>
                  {item.badge > 0 && <Badge bg="primary" pill style={{ fontSize: '0.65rem' }}>{item.badge}</Badge>}
                </div>
                <div className="offcanvas-nav-desc">{item.description}</div>
              </div>
            </button>
          ))}

          <div className="offcanvas-section-label mt-3">Sistema</div>
          {secondaryItems.map(item => (
            <button
              key={item.id}
              className={`offcanvas-nav-btn ${activeComponent === item.id ? 'offcanvas-nav-btn--active' : ''}`}
              onClick={() => handleSelect(item.id)}
            >
              <div className="offcanvas-nav-icon">{item.icon}</div>
              <div className="flex-grow-1">
                <div className="fw-semibold">{item.title}</div>
                <div className="offcanvas-nav-desc">{item.description}</div>
              </div>
            </button>
          ))}

          <div className="offcanvas-footer">
            <div className="offcanvas-user-info">
              <div className="user-avatar">{getInitials()}</div>
              <div>
                <div className="fw-semibold">{getDisplayName()}</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{currentUser?.email}</div>
              </div>
            </div>
            <button className="offcanvas-logout-btn" onClick={handleLogout}>
              <BoxArrowRight size={15} className="me-2" />
              Cerrar Sesión
            </button>
          </div>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
};

ZabbixNavBar.propTypes = {
  onSelectComponent: PropTypes.func.isRequired,
  activeComponent:   PropTypes.string,
  eventCount:        PropTypes.number,
  reservasCount:     PropTypes.number,
};

export default ZabbixNavBar;