import React from 'react'
import ReactDOM from 'react-dom/client'

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css'
import App from './App.jsx';
import Login from './Login.jsx';
import Admin from './Admin.jsx';

// Crear un root para la aplicación
const root = ReactDOM.createRoot(document.getElementById('root'));

// Renderizar la aplicación
root.render(
  <Router>
    <Routes>
   <Route path="/" element={<Login />} />
      <Route path="/app" element={<App />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Login />} />
    </Routes>
  </Router>
);