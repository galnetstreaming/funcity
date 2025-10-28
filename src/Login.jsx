import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Container, Alert, Row, Col, Spinner } from 'react-bootstrap';


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
        <Col xxl={4} lg={6} md={8} className="p-4 bg-white rounded-4 shadow-sm">
          <div className="w-100" style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div className="text-center mb-4">
             
              <h1 className="mb-1 fw-bold">Bienvenidos</h1>
              <h2 className="mb-3 fw-bold"></h2>
              <p className="text-muted">Ingresa tus credenciales para continuar</p>
            </div>

            {error && (
              <Alert 
                variant="danger" 
                className="text-center d-flex align-items-center"
                onClose={() => setError('')}
                dismissible
              >
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                {error}
              </Alert>
            )}

            <Form onSubmit={handleLogin}>
              <Form.Group className="mb-3" controlId="formBasicEmail">
                <Form.Label className="fw-medium">Correo electrónico</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="nombre@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="py-2"
                />
              </Form.Group>

              <Form.Group className="mb-4" controlId="formBasicPassword">
                <Form.Label className="fw-medium">Contraseña</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="py-2"
                />
              </Form.Group>

              <div className="d-flex justify-content-between mb-4">
                <Form.Check 
                  type="checkbox"
                  id="rememberMe"
                  label="Recordarme"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="text-secondary"
                />
              </div>

              <Button 
                variant="primary" 
                type="submit" 
                className="w-100 mb-3 py-2 fw-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                  />
                ) : (
                  <span>Iniciar Sesión <i className="bi bi-arrow-right-short"></i></span>
                )}
              </Button>
            </Form>

            
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default Login;