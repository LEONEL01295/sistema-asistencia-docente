# Manual de usuario

## 1. Portal administrativo

Dirección:

```text
http://localhost:3000/admin
```

Credenciales iniciales:

```text
Usuario: admin
Contraseña: Admin123!
```

El administrador puede registrar docentes, asignar horarios, revisar asistencias, generar faltas, autorizar justificantes y descargar reportes.

### Registrar un docente

1. Abrir **Docentes**.
2. Capturar número de empleado, ID biométrico, nombre, departamento y correo.
3. Asignar una contraseña inicial de al menos ocho caracteres.
4. Guardar.
5. Comunicar al docente su número de empleado y contraseña.

El número de empleado será la credencial de acceso del docente.

### Restablecer la contraseña de un docente

1. Abrir **Docentes**.
2. Localizar al docente.
3. Pulsar **Cambiar contraseña**.
4. Escribir la nueva contraseña.
5. Guardar.

## 2. Portal del docente

Dirección:

```text
http://localhost:3000/docente
```

El docente inicia sesión con:

- Número de empleado.
- Contraseña asignada por el administrador.

Funciones disponibles:

- Consultar el resumen del día.
- Revisar puntualidades, retardos, faltas y justificaciones.
- Consultar el historial por rango de fechas.
- Descargar el historial personal en CSV.
- Consultar su horario.
- Enviar solicitudes de justificante.
- Cambiar su contraseña.

Cada docente únicamente puede consultar la información vinculada a su propia cuenta.
