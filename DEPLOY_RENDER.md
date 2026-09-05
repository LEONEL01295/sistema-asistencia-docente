# Despliegue en Render

El proyecto se publica como un solo servicio Node.js y expone dos portales independientes:

- Administrador: `https://NOMBRE-DEL-SERVICIO.onrender.com/admin`
- Docentes: `https://NOMBRE-DEL-SERVICIO.onrender.com/docente`

Si el nombre `asistencia-docente-itsh` está disponible, las direcciones serán:

- `https://asistencia-docente-itsh.onrender.com/admin`
- `https://asistencia-docente-itsh.onrender.com/docente`

## Pasos

1. Subir esta carpeta a un repositorio de GitHub.
2. Entrar a Render y seleccionar **New > Blueprint**.
3. Vincular el repositorio. Render detectará `render.yaml`.
4. Cuando Render solicite `ADMIN_PASSWORD`, escribir una contraseña segura para el administrador.
5. Revisar el servicio y crear el despliegue.
6. Esperar a que `/api/health` responda correctamente.

## Base SQLite persistente

El archivo `render.yaml` usa un servicio de pago `starter` y monta un disco persistente en:

`/opt/render/project/src/data`

Sin ese disco, SQLite puede perder los datos después de reinicios o despliegues.

## Dominios propios opcionales

Con un dominio comprado se pueden configurar:

- `https://admin.tudominio.mx`
- `https://docentes.tudominio.mx`

Ambos pueden apuntar al mismo servicio. El control de acceso sigue realizándose por rol en el backend.

## Seguridad inicial

No use `Admin123!` en Internet. El Blueprint solicita una contraseña administrativa durante la creación del servicio.
