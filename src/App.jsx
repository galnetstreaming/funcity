import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './Login';
import LoadingSpinner from './LoadingSpinner';
import Admin from './Admin';
import './App.css';

const AppContent = () => {
  const { currentUser, loading } = useAuth();

  if (loading)      return <LoadingSpinner />;
  if (!currentUser) return <Login />;

  return <Admin />;
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;