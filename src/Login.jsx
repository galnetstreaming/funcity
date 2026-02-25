import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Container, Alert, Row, Col, Spinner, Image } from 'react-bootstrap';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/app');
    } catch (error) {
      setError(error.message.includes('invalid-credential') 
        ? 'Credenciales incorrectas. Por favor verifique sus datos'
        : 'Error al iniciar sesión. Intente nuevamente más tarde');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container fluid className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <Row className="w-100 justify-content-center m-0">
        <Col xxl={4} lg={6} md={8} className="p-4 bg-white rounded-4 shadow-lg">
          <div className="w-100" style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div className="text-center mb-4">
              {/* Logo profesional */}
              <div className="mb-4 d-flex justify-content-center align-items-center">
                <Image 
                  src="/Logo_principal.webp" 
                  alt="Logo EUN CIFTA AIDS CAFE"
                  fluid
                  className="mb-3"
                  style={{ 
                    maxHeight: '120px',
                    width: 'auto',
                    objectFit: 'contain'
                  }}
                />
              </div>
              
              <h1 className="h3 mb-1 fw-bold text-dark">Bienvenidos</h1>
              <p className="text-muted mb-0">Ingresa tus credenciales para continuar</p>
            </div>

            {error && (
              <Alert 
                variant="danger" 
                className="text-center d-flex align-items-center border-0"
                onClose={() => setError('')}
                dismissible
              >
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                {error}
              </Alert>
            )}

            <Form onSubmit={handleLogin}>
              <Form.Group className="mb-3" controlId="formBasicEmail">
                <Form.Label className="fw-semibold text-secondary small text-uppercase tracking-wide">
                  Correo electrónico
                </Form.Label>
                <Form.Control
                  type="email"
                  placeholder="nombre@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="py-2 border-0 bg-light rounded-3"
                  style={{ paddingLeft: '1rem' }}
                />
              </Form.Group>

              <Form.Group className="mb-4" controlId="formBasicPassword">
                <Form.Label className="fw-semibold text-secondary small text-uppercase tracking-wide">
                  Contraseña
                </Form.Label>
                <Form.Control
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="py-2 border-0 bg-light rounded-3"
                  style={{ paddingLeft: '1rem' }}
                />
              </Form.Group>

              <div className="d-flex justify-content-between align-items-center mb-4">
                <Form.Check 
                  type="checkbox"
                  id="rememberMe"
                  label="Recordarme"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="text-secondary small"
                />
                <a href="/recuperar-password" className="text-decoration-none small text-primary">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              <Button 
                variant="primary" 
                type="submit" 
                className="w-100 mb-3 py-2 fw-semibold border-0"
                disabled={isLoading}
                style={{ 
                  backgroundColor: '#0d6efd',
                  transition: 'all 0.3s ease'
                }}
              >
                {isLoading ? (
                  <>
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      role="status"
                      aria-hidden="true"
                      className="me-2"
                    />
                    <span>Iniciando sesión...</span>
                  </>
                ) : (
                  <span className="d-flex align-items-center justify-content-center">
                    Iniciar Sesión 
                    <i className="bi bi-arrow-right-short ms-2 fs-5"></i>
                  </span>
                )}
              </Button>
            </Form>
  
            {/* Línea divisoria decorativa */}
            <div className="position-relative my-4">
              <hr className="text-muted opacity-25" />
              <span className="position-absolute top-50 start-50 translate-middle px-3 bg-white text-muted small">
                Sistema de Gestión de Reservas y Eventos
              </span>
            </div>

          
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default Login;