import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './Login';
import LoadingSpinner from './LoadingSpinner';
import Admin from './Admin';
import './App.css';


import { RoleProvider } from './hooks/useUserRole';

const AppContent = () => {

  const { currentUser, loading } = useAuth();

  if (loading)      return <LoadingSpinner />;
  if (!currentUser) return <Login />;

  return <Admin />;
};

function App() {
  return (
    <AuthProvider>
      <RoleProvider>
        <AppContent />
      </RoleProvider>
    </AuthProvider>
  );
}

export default App;