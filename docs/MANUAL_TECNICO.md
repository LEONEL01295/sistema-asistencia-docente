# Manual técnico

## Arquitectura

- Backend: Node.js y Express.
- Base local: SQLite integrada en Node.js.
- Tiempo real: Socket.IO.
- Autenticación: JWT.
- Contraseñas: bcrypt.
- Frontend administrativo: `public/index.html` y `public/app.js`.
- Frontend docente: `public/docente.html` y `public/docente.js`.

## Rutas principales

```text
GET  /admin
GET  /docente
POST /api/auth/admin-login
POST /api/auth/teacher-login
GET  /api/auth/me
PUT  /api/auth/password
```

### Inicio de sesión docente

```json
{
  "employeeNumber": "DOC-001",
  "password": "Docente123!"
}
```

El backend busca el número de empleado en `teachers`, verifica la cuenta `DOCENTE` vinculada mediante `teacher_id` y compara la contraseña con bcrypt.

## Separación de permisos

Las consultas de dashboard, asistencias, horarios, reportes y justificantes aplican automáticamente el `teacher_id` del token cuando el rol es `DOCENTE`. Por lo tanto, un docente no puede solicitar datos de otro docente modificando parámetros desde el navegador.

## Integración biométrica futura

```text
POST /api/attendance/biometric
```

El evento biométrico debe relacionarse con el campo `biometric_id` del docente. Después de guardar la marcación, el servidor actualiza al administrador y al docente correspondiente mediante salas separadas de Socket.IO.
