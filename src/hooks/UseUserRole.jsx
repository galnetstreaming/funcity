// ============================================================
//  useUserRole — Hook para gestión de roles de usuario
//  v2.0: Sin localStorage. La config de roles viene de la API.
// ============================================================

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import { obtenerConfiguracion, guardarConfiguracion, CONFIG_DEFAULT } from '../services/api';

// ── Roles disponibles ─────────────────────────────────────────
export const ROLES = {
  ADMIN:  'admin',
  CAJERO: 'cajero',
};

// ── Emails admin por defecto (fallback si la API no responde) ─
const ADMIN_EMAILS_DEFAULT = CONFIG_DEFAULT.admin_emails;

// ── Contexto ──────────────────────────────────────────────────
const RoleContext = createContext(null);

// ── Provider ──────────────────────────────────────────────────
export const RoleProvider = ({ children }) => {
  const { currentUser } = useAuth();

  const [rolesConfig,    setRolesConfig]    = useState({ adminEmails: ADMIN_EMAILS_DEFAULT });
  const [cargandoConfig, setCargandoConfig] = useState(true);

  useEffect(() => {
    const cargarConfig = async () => {
      setCargandoConfig(true);
      try {
        const data = await obtenerConfiguracion();
        if (data?.admin_emails?.length) {
          setRolesConfig({ adminEmails: data.admin_emails });
        }
      } catch {
        // Silencioso — usar default
      } finally {
        setCargandoConfig(false);
      }
    };
    cargarConfig();
  }, []);

  const actualizarRoles = useCallback(async (nuevaConfig) => {
    setRolesConfig(nuevaConfig);
    await guardarConfiguracion({ admin_emails: nuevaConfig.adminEmails });
  }, []);

  const getRole = useCallback((email) => {
    if (!email) return null;
    if (rolesConfig.adminEmails.includes(email.toLowerCase())) return ROLES.ADMIN;
    return ROLES.CAJERO;
  }, [rolesConfig]);

  const currentRole = getRole(currentUser?.email);
  const isAdmin     = currentRole === ROLES.ADMIN;
  const isCajero    = currentRole === ROLES.CAJERO;

  const value = {
    currentRole,
    isAdmin,
    isCajero,
    rolesConfig,
    cargandoConfig,
    actualizarRoles,
    getRole,
    ROLES,
    canDelete:        isAdmin,
    canEditPrices:    isAdmin,
    canViewSettings:  isAdmin,
    canViewRoles:     isAdmin,
    canViewCaja:      true,
    canViewStats:     true,
    canCreateReserva: true,
    canRegisterPago:  true,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};
  
// ── Hook de consumo (CORREGIDO: minúscula) ─────────────────────
export const useUserRole = () => {
  const context = useContext(RoleContext);
  if (!context) {
    console.warn('useUserRole: usado fuera de RoleProvider. Aplicando modo cajero por defecto.');
    return {
      currentRole:      ROLES.CAJERO,
      isAdmin:          false,
      isCajero:         true,
      rolesConfig:      { adminEmails: ADMIN_EMAILS_DEFAULT },
      cargandoConfig:   false,
      actualizarRoles:  async () => {},
      getRole:          () => ROLES.CAJERO,
      ROLES,
      canDelete:        false,
      canEditPrices:    false,
      canViewSettings:  false,
      canViewRoles:     false,
      canViewCaja:      true,
      canViewStats:     true,
      canCreateReserva: true,
      canRegisterPago:  true,
    };
  }
  return context;
};

export default useUserRole;  // ← Cambiado a minúscula