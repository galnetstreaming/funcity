import { auth } from "../firebase"; // Importa auth desde Firebase
import { useAuthState } from "react-firebase-hooks/auth"; // Para obtener el estado de autenticación
import { Container, Navbar } from "react-bootstrap";

const Footer = () => {
  const [user] = useAuthState(auth); // Obtiene el usuario actual

  return (
    <Navbar bg="dark" variant="dark" fixed="bottom">
      <Container className="justify-content-center">
        <Navbar.Text>
          {user ? (
            <>
              {/* Muestra el nombre y el correo del usuario */}
              <span style={{ color: "white" }}>
                Usuario: {user.displayName || user.email}
              </span>
            </>
          ) : (
            <span style={{ color: "white" }}>No has iniciado sesión</span>
          )}
        </Navbar.Text>
      </Container>
    </Navbar>
  );
};

export default Footer;