import { Link, useNavigate, useLocation } from "react-router-dom";
import { Image } from "react-bootstrap";
import { auth } from "../firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import "./NavBarMain.css";
import { useState, useEffect } from "react";
import {
  FaBirthdayCake,
  FaCashRegister,
  FaChartLine,
  FaCog,
  FaBars,
  FaSignOutAlt,
  FaStore,
  FaBuilding,
  FaUserCircle,
  FaAddressBook
} from "react-icons/fa";

const NavBarMain = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileView, setMobileView] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setMobileView(window.innerWidth <= 768);
      if (window.innerWidth <= 768) {
        setCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      unsubscribe();
    };
  }, []);

  // Definición de roles
  const ROLES = {
    ADMIN: 'admin',
    RIVADAVIA: 'rivadavia',
    BALVANERA: 'balvanera'
  };

  // Mapeo de usuarios a roles
  const getUserRole = (email) => {
    const adminEmails = [

      "acmleonardy@gmail.com",
      "mexico@funcity.com.ar",
      "info@apixelmarketing.com"


    ];

    const userRoles = {
      //    "cafekori.flores@gmail.com": ROLES.RIVADAVIA,
      //   "boomkidscafe@gmail.com": ROLES.BALVANERA
    };

    if (adminEmails.includes(email)) return ROLES.ADMIN;
    return userRoles[email] || null;
  };

  const currentRole = getUserRole(currentUser?.email);

  // Función para mostrar el nombre del rol
  const getRoleName = (role) => {
    switch (role) {
      case ROLES.ADMIN: return "Administrador";
      case ROLES.Mexico: return "Mexico";

      default: return "Usuario";
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  // Componente de sección condicional
  const ConditionalSection = ({ role, requiredRole, children }) => {
    return role === requiredRole || role === ROLES.ADMIN ? children : null;
  };

  return (
    <>
      <div className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <Image src="/fun.png" fluid className="logo" alt="FUN CITY" />
          <button className="toggle-btn" onClick={toggleSidebar}>
            <FaBars />
          </button>
        </div>

        {/* Información del usuario */}
        {currentUser && !collapsed && (
          <div className="user-info">
            <div className="user-details">
              <FaUserCircle className="user-icon" />
              <div>
                <p className="user-email">{currentUser.email}</p>
                <p className="user-role">{getRoleName(currentRole)}</p>
              </div>
            </div>
          </div>
        )}

        <div className="nav-links">
          {/* Sección Rivadavia - Visible para ADMIN y RMEXICO  */}
          <ConditionalSection role={currentRole} requiredRole={ROLES.Mexico}>
            <div className="nav-section">
              <div className="nav-section-header">
                <FaStore className="nav-icon" />
                <span className="nav-text">Mexico</span>
              </div>

              <Link
                to="/formulario"
                className={`nav-link ${location.pathname === "/formulario" ? "active" : ""}`}
              >
                <FaCashRegister className="nav-icon" />
                <span className="nav-text">Registro de Cumpleaños</span>
              </Link>
              {(currentRole === ROLES.ADMIN || currentRole === ROLES.RIVADAVIA) && (
                <Link
                  to="/calendario"
                  className={`nav-link ${location.pathname === "/calendario" ? "active" : ""}`}
                >
                  <FaChartLine className="nav-icon" />
                  <span className="nav-text">Calendario</span>
                </Link>
              )}
            </div>
          </ConditionalSection>



          {/* Sección Administrativo - Solo para ADMIN */}
          {currentRole === ROLES.ADMIN && (
            <div className="nav-section">
              <div className="nav-section-header">
                <FaAddressBook className="nav-icon" />
                <span className="nav-text">Administrativo</span>
              </div>
              <Link
                to="/administrativo"
                className={`nav-link ${location.pathname === "/administrativo" ? "active" : ""}`}
              >
                <FaStore className="nav-icon" />
                <span className="nav-text">Mexico</span>
              </Link>





            </div>
          )}

          {/* Soporte - Visible para todos los usuarios autenticados */}
          {currentUser && (
            <Link
              to="/soporte"
              className={`nav-link ${location.pathname === "/soporte" ? "active" : ""}`}
            >
              <FaCog className="nav-icon" />
              <span className="nav-text">Soporte</span>
            </Link>
          )}



        </div>

        {currentUser && (
          <div className="logout-container">
            <button onClick={handleLogout} className="logout-btn">
              <FaSignOutAlt className="nav-icon" />
              <span className="nav-text">Cerrar Sesión</span>
            </button>
          </div>
        )}
      </div>

      <div className={`main-content ${collapsed ? "collapsed" : ""}`}>
        {children}
      </div>
    </>
  );
};

export default NavBarMain;