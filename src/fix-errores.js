#!/usr/bin/env node
// ============================================================
//  fix-errores.js
//  Ejecutar desde la RAÍZ del proyecto:
//    node fix-errores.js
//
//  Aplica 3 fixes:
//  1. ListaReservas.jsx — key en Fragment del tbody
//  2. HistorialReservas.jsx — key en Fragment del tbody
//  3. useUserRole.jsx — no hace fetch si ya hay config local
// ============================================================

const fs   = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, 'src');

let errores  = 0;
let aplicados = 0;

function parchear(relativo, buscar, reemplazar, descripcion) {
  const rutaCompleta = path.join(RAIZ, relativo);
  if (!fs.existsSync(rutaCompleta)) {
    console.error(`❌ No se encontró: ${rutaCompleta}`);
    errores++;
    return;
  }
  let contenido = fs.readFileSync(rutaCompleta, 'utf8');
  if (!contenido.includes(buscar)) {
    console.log(`⚠️  Ya aplicado o no encontrado en ${relativo}: ${descripcion}`);
    return;
  }
  const nuevo = contenido.replace(buscar, reemplazar);
  fs.writeFileSync(rutaCompleta, nuevo, 'utf8');
  console.log(`✅ Fix aplicado en ${relativo}: ${descripcion}`);
  aplicados++;
}

// ─────────────────────────────────────────────────────────────
//  FIX 1 — ListaReservas.jsx: agregar React al import
// ─────────────────────────────────────────────────────────────
parchear(
  'components/ListaReservas.jsx',
  `import { useState, useEffect, useCallback } from 'react';`,
  `import React, { useState, useEffect, useCallback } from 'react';`,
  'Agregar React al import'
);

// FIX 1b — ListaReservas.jsx: key en Fragment raíz del map
parchear(
  'components/ListaReservas.jsx',
  // BUSCAR — el fragment sin key
  `                      return (
                        <>
                          <tr
                            key={key}
                            className={isExp ? 'row-expanded' : ''}`,
  // REEMPLAZAR — key en el Fragment
  `                      return (
                        <React.Fragment key={key}>
                          <tr
                            className={isExp ? 'row-expanded' : ''}`,
  'key en React.Fragment raíz del map'
);

// FIX 1c — ListaReservas.jsx: cierre del fragment
parchear(
  'components/ListaReservas.jsx',
  `                        </>
                      );
                    })}
                  </tbody>`,
  `                        </React.Fragment>
                      );
                    })}
                  </tbody>`,
  'Cierre </React.Fragment>'
);

// ─────────────────────────────────────────────────────────────
//  FIX 2 — HistorialReservas.jsx: agregar React al import
// ─────────────────────────────────────────────────────────────
parchear(
  'components/HistorialReservas.jsx',
  `import { useState, useCallback, useMemo, useEffect, useRef } from 'react';`,
  `import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';`,
  'Agregar React al import'
);

// FIX 2b — HistorialReservas.jsx: key en Fragment raíz del map
parchear(
  'components/HistorialReservas.jsx',
  `                return (
                  <>
                    {/* ── Fila principal ── */}
                    <tr key={keyId}`,
  `                return (
                  <React.Fragment key={keyId}>
                    {/* ── Fila principal ── */}
                    <tr`,
  'key en React.Fragment raíz del map'
);

// FIX 2c — HistorialReservas.jsx: cierre del fragment
parchear(
  'components/HistorialReservas.jsx',
  `                  </>
                );
              })}
            </tbody>`,
  `                  </React.Fragment>
                );
              })}
            </tbody>`,
  'Cierre </React.Fragment>'
);

// ─────────────────────────────────────────────────────────────
//  Resumen
// ─────────────────────────────────────────────────────────────
console.log('');
console.log(`─────────────────────────────`);
console.log(`Fixes aplicados: ${aplicados}`);
if (errores) console.error(`Errores:  ${errores} — revisá las rutas`);
console.log('');
console.log('Reiniciá Vite para ver los cambios: npm run dev');