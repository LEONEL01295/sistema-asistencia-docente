# Sistema de Asistencia Docente — Portal de Docentes V4

Sistema web institucional con dos tipos principales de acceso:

- **Administración:** gestiona docentes, horarios, asistencias, reportes y justificantes.
- **Docente:** consulta exclusivamente su propio resumen, historial, horario y justificantes.

La base inicia vacía. Únicamente se crea la cuenta administrativa inicial.

## Credenciales iniciales

- Usuario: `admin`
- Contraseña: `Admin123!`

## Requisitos

- Node.js 22 o superior.
- Windows, Linux o macOS.

## Instalación

```powershell
Copy-Item .env.example .env -ErrorAction SilentlyContinue
npm install
npm start
```

Abrir:

```text
http://localhost:3000
```

## Crear un acceso docente

1. Iniciar sesión como administrador.
2. Abrir **Docentes**.
3. Registrar número de empleado, ID biométrico, nombre, usuario y contraseña inicial.
4. El docente podrá iniciar sesión con esas credenciales.

Para docentes importados desde la futura base institucional, utilizar el botón **Crear acceso** en la tabla de docentes.

## Funciones disponibles para el docente

- Mi resumen del día.
- Mi historial por rango de fechas.
- Descarga de mi historial en CSV.
- Mi horario semanal.
- Mis justificantes.
- Solicitud de justificantes.
- Cambio de contraseña.

## Seguridad aplicada

- Cada cuenta docente está vinculada a un único `teacher_id`.
- El backend filtra asistencias, horarios, reportes y justificantes por ese identificador.
- Un docente no puede consultar datos de otros docentes modificando la URL.
- El canal Socket.IO exige JWT y separa a los usuarios por salas.
- Las contraseñas se almacenan con hash bcrypt.

## Base vacía

No se incluyen docentes, horarios, asistencias ni movimientos de ejemplo. Los datos aparecerán cuando se registren manualmente o se conecte la base institucional.

## Despliegue público

Consulte `DEPLOY_RENDER.md`. Esta versión tiene dos rutas públicas separadas:

- `/admin`: inicio de sesión exclusivo para administrador.
- `/docente`: inicio de sesión por número de empleado y contraseña.

La ruta raíz `/` redirige al portal docente.
