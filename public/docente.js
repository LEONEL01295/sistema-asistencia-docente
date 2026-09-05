/**
 * PORTAL DOCENTE - JavaScript Optimizado v3.0
 * Compatible con CSS Premium
 * Animaciones, transiciones y efectos mejorados
 */

const teacherState = {
  token: localStorage.getItem('attendance_teacher_token'),
  user: null,
  date: new Date().toLocaleDateString('en-CA'),
  view: 'summary',
  socket: null,
  schedules: [],
  historyStart: null,
  historyEnd: null,
  loading: false
};

const tEl = (id) => document.getElementById(id);
const weekDays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const teacherStatusLabels = {
  ON_TIME: 'Puntual',
  LATE: 'Retardo',
  ABSENT: 'Falta',
  JUSTIFIED: 'Justificada',
  PENDING: 'Pendiente',
  OUT_OF_SCHEDULE: 'Fuera de horario',
  EXIT: 'Salida',
  MANUAL: 'Registro manual'
};

/* ========== UTILIDADES ========== */

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function teacherInitials(name = '') {
  return name
    .replace(/Mtr[oa]?\.?/gi, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'D';
}

function teacherBadge(status) {
  const badgeClass = `badge-${(status || 'PENDING').toLowerCase()}`;
  const label = escapeHtml(teacherStatusLabels[status] || status || 'Pendiente');
  return `<span class="badge ${badgeClass}">${label}</span>`;
}

function shortTime(value) {
  return value ? String(value).slice(0, 5) : '—';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ========== API & NETWORK ========== */

async function teacherApi(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (teacherState.token) headers.Authorization = `Bearer ${teacherState.token}`;

  try {
    const response = await fetch(path, { ...options, headers });
    const data = response.status === 204 ? null : await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
      teacherLogout();
      throw new Error(data?.error || 'La sesión ya no es válida');
    }
    if (!response.ok) throw new Error(data?.error || 'No fue posible completar la operación');
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

/* ========== UI & ANIMATIONS ========== */

function teacherToast(message, type = 'info') {
  const toast = tEl('teacherToast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

function showLoadingState() {
  const content = tEl('teacherContent');
  if (!content) return;
  
  content.innerHTML = `
    <div class="teacher-loading">
      <div class="loading-spinner"></div>
      <p>Cargando información...</p>
    </div>
  `;
  content.style.animation = 'fadeIn 0.3s ease-out';
}

function fadeOutContent() {
  const content = tEl('teacherContent');
  if (content) {
    content.style.opacity = '0';
    content.style.transition = 'opacity 0.2s ease-out';
  }
}

function fadeInContent() {
  const content = tEl('teacherContent');
  if (content) {
    content.style.opacity = '1';
    content.style.transition = 'opacity 0.3s ease-out';
  }
}

function teacherClock() {
  const date = new Date();
  tEl('teacherClockTime').textContent = date.toLocaleTimeString('es-MX', { hour12: false });
  tEl('teacherClockDate').textContent = date.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}

setInterval(teacherClock, 1000);
teacherClock();

/* ========== AUTHENTICATION ========== */

async function teacherLogin(event) {
  event.preventDefault();
  const errorEl = tEl('teacherLoginError');
  errorEl.textContent = '';
  errorEl.classList.remove('show');

  const employeeEl = tEl('employeeNumber');
  const passwordEl = tEl('teacherPassword');

  if (!employeeEl.value.trim() || !passwordEl.value) {
    errorEl.textContent = 'Por favor completa todos los campos';
    errorEl.classList.add('show');
    return;
  }

  try {
    const data = await teacherApi('/api/auth/teacher-login', {
      method: 'POST',
      body: JSON.stringify({
        employeeNumber: employeeEl.value.trim(),
        password: passwordEl.value
      })
    });

    teacherState.token = data.token;
    teacherState.user = data.user;
    localStorage.setItem('attendance_teacher_token', data.token);
    
    // Animación de transición
    tEl('teacherLoginView').style.opacity = '0';
    tEl('teacherLoginView').style.transform = 'scale(0.95)';
    
    setTimeout(() => {
      teacherBoot();
    }, 300);
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.add('show');
    passwordEl.value = '';
  }
}

function teacherLogout() {
  teacherState.socket?.disconnect();
  teacherState.socket = null;
  teacherState.token = null;
  teacherState.user = null;
  localStorage.removeItem('attendance_teacher_token');
  
  tEl('teacherAppView').classList.add('hidden');
  tEl('teacherLoginView').classList.remove('hidden');
  tEl('teacherLoginView').style.opacity = '1';
  tEl('teacherLoginView').style.transform = 'scale(1)';
  tEl('teacherPassword').value = '';
  
  teacherToast('Sesión cerrada correctamente', 'info');
}

async function teacherBoot() {
  try {
    const me = await teacherApi('/api/auth/me');
    if (me.user.role !== 'DOCENTE' || !me.user.teacher) {
      throw new Error('Esta cuenta no corresponde a un docente');
    }

    teacherState.user = me.user;
    teacherState.schedules = await teacherApi('/api/schedules');

    // Actualizar UI
    tEl('teacherCurrentName').textContent = teacherState.user.name;
    tEl('teacherEmployeeLabel').textContent = `Empleado: ${teacherState.user.teacher.employee_number}`;
    tEl('teacherAvatar').textContent = teacherInitials(teacherState.user.name);
    tEl('teacherSelectedDate').value = teacherState.date;

    // Mostrar app
    tEl('teacherLoginView').classList.add('hidden');
    tEl('teacherAppView').classList.remove('hidden');
    tEl('teacherAppView').classList.add('show');
    
    teacherClock();
    connectTeacherSocket();
    await renderTeacherPortal();
  } catch (error) {
    teacherLogout();
    const errorEl = tEl('teacherLoginError');
    errorEl.textContent = error.message;
    errorEl.classList.add('show');
  }
}

/* ========== WEBSOCKET ========== */

function connectTeacherSocket() {
  teacherState.socket?.disconnect();
  teacherState.socket = io({ 
    autoConnect: false, 
    auth: { token: teacherState.token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });

  teacherState.socket.on('connect', () => {
    const dot = tEl('teacherSocketDot');
    const label = tEl('teacherSocketLabel');
    if (dot && label) {
      dot.classList.add('online');
      label.textContent = 'En línea';
    }
  });

  teacherState.socket.on('disconnect', () => {
    const dot = tEl('teacherSocketDot');
    const label = tEl('teacherSocketLabel');
    if (dot && label) {
      dot.classList.remove('online');
      label.textContent = 'Desconectado';
    }
  });

  teacherState.socket.on('connect_error', () => {
    const dot = tEl('teacherSocketDot');
    const label = tEl('teacherSocketLabel');
    if (dot && label) {
      dot.classList.remove('online');
      label.textContent = 'Sin canal';
    }
  });

  teacherState.socket.on('biometric:event', async (result) => {
    const attendance = result.attendance;
    teacherToast(
      `${teacherStatusLabels[attendance.status] || attendance.status} a las ${shortTime(attendance.registered_time)}`,
      'success'
    );
    if (teacherState.view === 'summary') await renderTeacherSummary();
    if (teacherState.view === 'history') await renderTeacherHistory();
  });

  teacherState.socket.on('dashboard:refresh', async (event) => {
    if (teacherState.view === 'summary' && event.date === teacherState.date) {
      await renderTeacherSummary();
    }
    if (teacherState.view === 'history') {
      await renderTeacherHistory();
    }
  });

  teacherState.socket.connect();
}

/* ========== PORTAL RENDERING ========== */

async function renderTeacherPortal() {
  // Actualizar navegación activa
  document.querySelectorAll('#teacherNav button').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === teacherState.view);
  });

  const titles = {
    summary: 'Mi resumen',
    history: 'Mi historial de asistencia',
    schedule: 'Mi horario',
    justifications: 'Mis justificantes',
    account: 'Mi cuenta'
  };

  tEl('teacherPageTitle').textContent = titles[teacherState.view] || 'Portal docente';

  fadeOutContent();
  
  setTimeout(async () => {
    if (teacherState.view === 'summary') await renderTeacherSummary();
    if (teacherState.view === 'history') await renderTeacherHistory();
    if (teacherState.view === 'schedule') renderTeacherSchedule();
    if (teacherState.view === 'justifications') await renderTeacherJustifications();
    if (teacherState.view === 'account') renderTeacherAccount();
    
    fadeInContent();
  }, 200);
}

/* ========== SUMMARY VIEW ========== */

async function renderTeacherSummary() {
  showLoadingState();
  
  try {
    const dashboard = await teacherApi(`/api/dashboard?date=${teacherState.date}`);
    const counts = dashboard.counts;
    const teacher = teacherState.user.teacher;

    tEl('teacherContent').innerHTML = `
      <div class="teacher-welcome">
        <div>
          <p class="eyebrow">BIENVENIDO AL PORTAL</p>
          <h3>${escapeHtml(teacherState.user.name)}</h3>
          <p>${escapeHtml(teacher.department || 'Sin departamento registrado')}</p>
        </div>
        <div class="employee-chip">N.º de empleado: ${escapeHtml(teacher.employee_number)}</div>
      </div>

      <div class="grid-stats">
        <div class="stat">
          <span>Clases programadas</span>
          <strong>${counts.scheduled}</strong>
          <small>Fecha seleccionada</small>
        </div>
        <div class="stat">
          <span>Puntuales</span>
          <strong style="color:var(--green)">${counts.onTime}</strong>
          <small style="color:var(--green)">Dentro de tolerancia</small>
        </div>
        <div class="stat">
          <span>Retardos</span>
          <strong style="color:var(--yellow)">${counts.late}</strong>
          <small style="color:var(--yellow)">Fuera de tolerancia</small>
        </div>
        <div class="stat">
          <span>Faltas</span>
          <strong style="color:var(--red)">${counts.absent}</strong>
          <small style="color:var(--red)">Sin registro</small>
        </div>
        <div class="stat">
          <span>Justificadas</span>
          <strong>${counts.justified}</strong>
          <small>Con autorización</small>
        </div>
        <div class="stat">
          <span>Pendientes</span>
          <strong>${counts.pending}</strong>
          <small>Sin cerrar</small>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card">
          <div class="card-head">
            <h3>Mis clases del ${formatDate(teacherState.date)}</h3>
            <span>${dashboard.scheduled.length} registros</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Horario</th>
                  <th>Materia</th>
                  <th>Aula</th>
                  <th>Registro</th>
                  <th>Estado</th>
                  <th>Retraso</th>
                </tr>
              </thead>
              <tbody>
                ${dashboard.scheduled.map((row) => `
                  <tr>
                    <td>${shortTime(row.start_time)}–${shortTime(row.end_time)}</td>
                    <td><b>${escapeHtml(row.subject || 'Sin materia')}</b></td>
                    <td>${escapeHtml(row.classroom || '—')}</td>
                    <td>${shortTime(row.registered_time)}</td>
                    <td>${teacherBadge(row.status || 'PENDING')}</td>
                    <td>${row.status === 'LATE' ? `${Number(row.delay_minutes || 0)} min` : '—'}</td>
                  </tr>
                `).join('') || '<tr><td colspan="6" class="teacher-empty"><strong>No hay clases registradas para esta fecha.</strong>Cuando el administrador cargue tu horario, aparecerá aquí.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>Últimos movimientos</h3></div>
          <div class="card-body activity">
            ${dashboard.latest.map((item) => `
              <div class="activity-item">
                <div class="activity-icon">${item.event_type === 'EXIT' ? '↗' : '✓'}</div>
                <div>
                  <p>${escapeHtml(item.subject || 'Registro de asistencia')}</p>
                  <small>${escapeHtml(teacherStatusLabels[item.status] || item.status)} · ${formatDate(item.attendance_date)}</small>
                </div>
                <b>${shortTime(item.registered_time)}</b>
              </div>
            `).join('') || '<div class="teacher-empty"><strong>No hay movimientos.</strong>Los registros aparecerán cuando se sincronice la base institucional.</div>'}
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    tEl('teacherContent').innerHTML = `
      <div class="teacher-empty">
        <strong>❌ Error al cargar</strong>
        <p>${error.message}</p>
        <button class="btn" onclick="renderTeacherSummary()">Reintentar</button>
      </div>
    `;
    teacherToast(error.message, 'error');
  }
}

/* ========== HISTORY VIEW ========== */

async function renderTeacherHistory() {
  showLoadingState();

  try {
    const today = teacherState.date;
    const start = teacherState.historyStart || `${today.slice(0, 8)}01`;
    const end = teacherState.historyEnd || today;
    const rows = await teacherApi(`/api/attendance?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);

    const counts = rows.reduce((acc, row) => {
      acc.total++;
      if (row.status === 'ON_TIME') acc.onTime++;
      if (row.status === 'LATE') acc.late++;
      if (row.status === 'ABSENT') acc.absent++;
      if (row.status === 'JUSTIFIED') acc.justified++;
      return acc;
    }, { total: 0, onTime: 0, late: 0, absent: 0, justified: 0 });

    tEl('teacherContent').innerHTML = `
      <div class="card">
        <div class="card-head">
          <h3>Consultar mi historial</h3>
          <span>Solo se muestran tus registros</span>
        </div>
        <div class="card-body">
          <form id="teacherHistoryFilter" class="teacher-history-toolbar">
            <label class="field">Fecha inicial<input type="date" name="start" value="${escapeHtml(start)}" required></label>
            <label class="field">Fecha final<input type="date" name="end" value="${escapeHtml(end)}" required></label>
            <button class="btn primary" type="submit">Consultar</button>
            <div class="spacer"></div>
            <button id="teacherDownloadHistory" class="btn" type="button">Descargar CSV</button>
          </form>
        </div>
      </div>

      <div class="grid-stats history-stats">
        <div class="stat">
          <span>Total de movimientos</span>
          <strong>${counts.total}</strong>
          <small>Periodo consultado</small>
        </div>
        <div class="stat">
          <span>Puntuales</span>
          <strong style="color:var(--green)">${counts.onTime}</strong>
          <small style="color:var(--green)">Asistencias correctas</small>
        </div>
        <div class="stat">
          <span>Retardos</span>
          <strong style="color:var(--yellow)">${counts.late}</strong>
          <small style="color:var(--yellow)">Llegadas tardías</small>
        </div>
        <div class="stat">
          <span>Faltas</span>
          <strong style="color:var(--red)">${counts.absent}</strong>
          <small style="color:var(--red)">Ausencias registradas</small>
        </div>
        <div class="stat">
          <span>Justificadas</span>
          <strong>${counts.justified}</strong>
          <small>Ausencias autorizadas</small>
        </div>
      </div>

      <div class="card history-card">
        <div class="card-head">
          <h3>Detalle de asistencia</h3>
          <span>${rows.length} registros</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Materia</th>
                <th>Hora programada</th>
                <th>Hora registrada</th>
                <th>Evento</th>
                <th>Estado</th>
                <th>Retraso</th>
                <th>Método</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => `
                <tr>
                  <td>${formatDate(row.attendance_date)}</td>
                  <td>${escapeHtml(row.subject || '—')}<br><small>${escapeHtml(row.classroom || '')}</small></td>
                  <td>${shortTime(row.scheduled_time)}</td>
                  <td>${shortTime(row.registered_time)}</td>
                  <td>${row.event_type === 'ENTRY' ? 'Entrada' : row.event_type === 'EXIT' ? 'Salida' : row.event_type === 'ABSENCE' ? 'Falta' : 'Manual'}</td>
                  <td>${teacherBadge(row.status)}</td>
                  <td>${row.status === 'LATE' ? `${Number(row.delay_minutes || 0)} min` : '—'}</td>
                  <td>${escapeHtml(row.method || '—')}</td>
                </tr>
              `).join('') || '<tr><td colspan="8" class="teacher-empty"><strong>No hay registros en este periodo.</strong>La información aparecerá después de conectar y sincronizar la base institucional.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;

    tEl('teacherHistoryFilter').onsubmit = async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.target));
      if (values.end < values.start) {
        teacherToast('La fecha final no puede ser anterior a la inicial', 'error');
        return;
      }
      teacherState.historyStart = values.start;
      teacherState.historyEnd = values.end;
      await renderTeacherHistory();
    };

    tEl('teacherDownloadHistory').onclick = () => downloadTeacherHistory(start, end);
  } catch (error) {
    tEl('teacherContent').innerHTML = `
      <div class="teacher-empty">
        <strong>❌ Error al cargar historial</strong>
        <p>${error.message}</p>
        <button class="btn" onclick="renderTeacherHistory()">Reintentar</button>
      </div>
    `;
    teacherToast(error.message, 'error');
  }
}

async function downloadTeacherHistory(start, end) {
  try {
    const response = await fetch(`/api/reports/csv?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, {
      headers: { Authorization: `Bearer ${teacherState.token}` }
    });
    
    if (!response.ok) throw new Error('No fue posible generar el archivo');

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mi_historial_${start}_${end}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    
    teacherToast('Archivo descargado correctamente', 'success');
  } catch (error) {
    teacherToast(error.message, 'error');
  }
}

/* ========== SCHEDULE VIEW ========== */

function renderTeacherSchedule() {
  const active = teacherState.schedules.filter((schedule) => schedule.active);

  tEl('teacherContent').innerHTML = `
    <div class="card">
      <div class="card-head">
        <h3>Mi horario registrado</h3>
        <span>${active.length} clases</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Día</th>
              <th>Entrada</th>
              <th>Salida</th>
              <th>Tolerancia</th>
              <th>Materia</th>
              <th>Aula</th>
              <th>Periodo</th>
            </tr>
          </thead>
          <tbody>
            ${active.map((schedule) => `
              <tr>
                <td><b>${escapeHtml(weekDays[schedule.weekday])}</b></td>
                <td>${shortTime(schedule.start_time)}</td>
                <td>${shortTime(schedule.end_time)}</td>
                <td>${Number(schedule.tolerance_minutes || 0)} min</td>
                <td>${escapeHtml(schedule.subject || '—')}</td>
                <td>${escapeHtml(schedule.classroom || '—')}</td>
                <td>${escapeHtml(schedule.period || '—')}</td>
              </tr>
            `).join('') || '<tr><td colspan="7" class="teacher-empty"><strong>No tienes horarios registrados.</strong>Solicita al administrador que cargue tu horario institucional.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* ========== JUSTIFICATIONS VIEW ========== */

async function renderTeacherJustifications() {
  showLoadingState();

  try {
    const rows = await teacherApi('/api/justifications');

    tEl('teacherContent').innerHTML = `
      <div class="modalish">
        <h3>Solicitar justificante</h3>
        <p class="muted">La solicitud quedará pendiente hasta que el administrador la revise.</p>
        <form id="teacherJustificationForm" class="form-grid">
          <label class="field">Fecha inicial<input type="date" name="start_date" value="${teacherState.date}" required></label>
          <label class="field">Fecha final<input type="date" name="end_date" value="${teacherState.date}" required></label>
          <label class="field full">Motivo<input name="reason" required placeholder="Comisión, incapacidad, permiso u otro motivo"></label>
          <div class="full"><button class="btn primary" type="submit">Enviar solicitud</button></div>
        </form>
      </div>

      <div class="card">
        <div class="card-head">
          <h3>Mis solicitudes</h3>
          <span>${rows.length} registros</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Periodo</th>
                <th>Motivo</th>
                <th>Estado</th>
                <th>Revisado por</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((item) => `
                <tr>
                  <td>${formatDate(item.start_date)} a ${formatDate(item.end_date)}</td>
                  <td>${escapeHtml(item.reason)}</td>
                  <td>${teacherBadge(item.status === 'APPROVED' ? 'JUSTIFIED' : item.status === 'REJECTED' ? 'ABSENT' : 'PENDING')}</td>
                  <td>${escapeHtml(item.approved_by_name || 'Pendiente')}</td>
                </tr>
              `).join('') || '<tr><td colspan="4" class="teacher-empty"><strong>No tienes solicitudes.</strong>Los justificantes que envíes aparecerán aquí.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;

    tEl('teacherJustificationForm').onsubmit = async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.target));
      
      if (values.end_date < values.start_date) {
        teacherToast('La fecha final no puede ser anterior a la inicial', 'error');
        return;
      }

      try {
        await teacherApi('/api/justifications', {
          method: 'POST',
          body: JSON.stringify(values)
        });
        teacherToast('Solicitud enviada al administrador', 'success');
        await renderTeacherJustifications();
      } catch (error) {
        teacherToast(error.message, 'error');
      }
    };
  } catch (error) {
    tEl('teacherContent').innerHTML = `
      <div class="teacher-empty">
        <strong>❌ Error al cargar justificantes</strong>
        <p>${error.message}</p>
        <button class="btn" onclick="renderTeacherJustifications()">Reintentar</button>
      </div>
    `;
    teacherToast(error.message, 'error');
  }
}

/* ========== ACCOUNT VIEW ========== */

function renderTeacherAccount() {
  const teacher = teacherState.user.teacher;

  tEl('teacherContent').innerHTML = `
    <div class="account-grid">
      <div class="card">
        <div class="card-head"><h3>Mis datos</h3></div>
        <div class="card-body profile-card">
          <div class="profile-avatar">${teacherInitials(teacher.full_name)}</div>
          <div>
            <h3>${escapeHtml(teacher.full_name)}</h3>
            <p>Docente</p>
          </div>
          <dl>
            <div><dt>Número de empleado</dt><dd>${escapeHtml(teacher.employee_number)}</dd></div>
            <div><dt>ID biométrico</dt><dd>${escapeHtml(teacher.biometric_id)}</dd></div>
            <div><dt>Departamento</dt><dd>${escapeHtml(teacher.department || '—')}</dd></div>
            <div><dt>Correo</dt><dd>${escapeHtml(teacher.email || '—')}</dd></div>
          </dl>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Cambiar mi contraseña</h3></div>
        <div class="card-body">
          <form id="teacherPasswordForm" class="form-grid one-column">
            <label class="field">
              Contraseña actual
              <input type="password" name="currentPassword" required autocomplete="current-password">
            </label>
            <label class="field">
              Nueva contraseña
              <input type="password" name="newPassword" minlength="8" required autocomplete="new-password">
            </label>
            <label class="field">
              Confirmar contraseña
              <input type="password" name="confirmPassword" minlength="8" required autocomplete="new-password">
            </label>
            <button class="btn primary" type="submit">Actualizar contraseña</button>
          </form>
        </div>
      </div>
    </div>
  `;

  tEl('teacherPasswordForm').onsubmit = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    
    if (values.newPassword !== values.confirmPassword) {
      teacherToast('Las contraseñas nuevas no coinciden', 'error');
      return;
    }

    if (values.newPassword.length < 8) {
      teacherToast('La contraseña debe tener al menos 8 caracteres', 'error');
      return;
    }

    try {
      await teacherApi('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword
        })
      });
      event.target.reset();
      teacherToast('Contraseña actualizada correctamente', 'success');
    } catch (error) {
      teacherToast(error.message, 'error');
    }
  };
}

/* ========== EVENT LISTENERS ========== */

if (tEl('teacherLoginForm')) {
  tEl('teacherLoginForm').addEventListener('submit', teacherLogin);
}

if (tEl('teacherLogoutBtn')) {
  tEl('teacherLogoutBtn').onclick = teacherLogout;
}

if (tEl('teacherSelectedDate')) {
  tEl('teacherSelectedDate').onchange = async (event) => {
    teacherState.date = event.target.value;
    if (teacherState.view === 'summary') await renderTeacherSummary();
  };
}

document.querySelectorAll('#teacherNav button').forEach((button) => {
  button.onclick = async () => {
    teacherState.view = button.dataset.view;
    await renderTeacherPortal();
  };
});

/* ========== INIT ========== */

if (teacherState.token) {
  teacherBoot();
}
