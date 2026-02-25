import React, { createContext, useContext, useState, useEffect } from 'react';

import { auth } from './firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const logout = async () => {
    try {
      setAuthError(null);
      await signOut(auth);
      setCurrentUser(null);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      setAuthError('Error al cerrar sesión');
      throw error;
    }
  };

  const clearError = () => setAuthError(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
      setAuthError(null);
    }, (error) => {
      console.error('Error en autenticación:', error);
      setAuthError('Error de autenticación');
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    logout,
    authError,
    clearError,
    isAuthenticated: !!currentUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};