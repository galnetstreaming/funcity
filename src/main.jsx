import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css'

import Login from './Login.jsx';
import Home from './Home.jsx';
import NavBarMain from './layout/NavBarMain.jsx';
import FormularioReserva from './components/FormularioReserva.jsx';
import CalendarioDisponibilidad from './components/CalendarioDisponibilidad.jsx';

// Crear un root para la aplicación
const root = ReactDOM.createRoot(document.getElementById('root'));

// Renderizar la aplicación
root.render(
  <Router>
    <Routes>
      <Route path="/" element={<NavBarMain />} />
      <Route index element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/app" element={<App />} />
      <Route path="/formulario" element={< FormularioReserva/>} />
      <Route path="/calendario" element={<CalendarioDisponibilidad  />} />
      <Route path='*' element={<Navigate replace to='/Home' />} />

    </Routes>
  </Router>
);