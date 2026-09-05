const state = {
  token: localStorage.getItem('token'),
  user: null,
  date: new Date().toISOString().split('T')[0],
  view: 'dashboard',
  teachers: [],
  schedules: [],
  dashboard: {},
  socket: null
};

const socket = io();
state.socket = socket;

socket.on('connect', () => {
  document.getElementById('socketDot').classList.add('online');
  document.getElementById('socketLabel').textContent = 'Conectado';
});

socket.on('disconnect', () => {
  document.getElementById('socketDot').classList.remove('online');
  document.getElementById('socketLabel').textContent = 'Desconectado';
});

socket.on('dashboard:refresh', () => {
  if (state.view === 'dashboard') loadDashboard();
});

document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);
  
  if (state.token) {
    verifySession();
  } else {
    showLoginView();
  }

  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('selectedDate').addEventListener('change', (e) => {
    state.date = e.target.value;
    renderCurrentView();
  });

  document.querySelectorAll('#nav button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      state.view = e.currentTarget.dataset.view;
      renderCurrentView();
      document.querySelectorAll('#nav button').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
    });
  });
});

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) throw new Error('Login failed');
    const data = await res.json();
    
    localStorage.setItem('token', data.token);
    state.token = data.token;
    state.user = data.user;
    
    showAppView();
    loadBase();
  } catch (err) {
    document.getElementById('loginError').textContent = 'Usuario o contraseña incorrectos';
  }
}

async function verifySession() {
  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Session expired');
    const data = await res.json();
    state.user = data;
    showAppView();
    loadBase();
  } catch (err) {
    logout();
  }
}

async function loadBase() {
  try {
    const [teachers, schedules] = await Promise.all([
      fetch('/api/teachers', {
        headers: { 'Authorization': `Bearer ${state.token}` }
      }).then(r => r.json()),
      fetch('/api/schedules', {
        headers: { 'Authorization': `Bearer ${state.token}` }
      }).then(r => r.json())
    ]);

    state.teachers = Array.isArray(teachers) ? teachers : [];
    state.schedules = Array.isArray(schedules) ? schedules : [];
    
    renderCurrentView();
  } catch (err) {
    console.error('Error loading base:', err);
  }
}

async function loadDashboard() {
  try {
    const res = await fetch(`/api/dashboard?date=${state.date}`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Failed to load dashboard');
    state.dashboard = await res.json();
  } catch (err) {
    console.error('Error loading dashboard:', err);
    state.dashboard = {};
  }
}

function renderCurrentView() {
  const views = {
    dashboard: renderDashboard,
    teachers: renderTeachers,
    schedules: renderSchedules,
    attendance: renderAttendance,
    reports: renderReports,
    justifications: renderJustifications,
    account: renderAccount
  };

  document.getElementById('pageTitle').textContent = {
    dashboard: 'Dashboard',
    teachers: 'Docentes',
    schedules: 'Horarios',
    attendance: 'Asistencias',
    reports: 'Reportes',
    justifications: 'Justificantes',
    account: 'Mi Cuenta'
  }[state.view] || 'Dashboard';

  if (views[state.view]) {
    views[state.view]();
  }
}

async function renderDashboard() {
  await loadDashboard();
  const content = document.getElementById('content');
  
  if (!state.dashboard || !state.dashboard.counts) {
    content.innerHTML = '<div class="empty">Cargando datos...</div>';
    return;
  }

  const { counts = {}, scheduled = [], latest = [], devices = [] } = state.dashboard;

  content.innerHTML = `
    <div class="grid-stats">
      <div class="stat">
        <span>Programados</span>
        <strong>${counts.scheduled || 0}</strong>
      </div>
      <div class="stat">
        <span>Puntual</span>
        <strong>${counts.onTime || 0}</strong>
      </div>
      <div class="stat">
        <span>Retrasado</span>
        <strong>${counts.late || 0}</strong>
      </div>
      <div class="stat">
        <span>Ausente</span>
        <strong>${counts.absent || 0}</strong>
      </div>
      <div class="stat">
        <span>Justificado</span>
        <strong>${counts.justified || 0}</strong>
      </div>
    </div>
    <div class="dashboard-grid">
      <div class="card">
        <div class="card-head">
          <h3>Últimos Registros</h3>
        </div>
        <div class="card-body">
          <div class="activity">
            ${latest && latest.length > 0 ? latest.map(r => `
              <div class="activity-item">
                <div class="activity-icon">✓</div>
                <div>
                  <p>${r.teacher_name || 'Docente'}</p>
                  <small>${new Date(r.timestamp).toLocaleTimeString()}</small>
                </div>
                <span class="badge ${r.status || 'ON_TIME'}">${r.status || 'Puntual'}</span>
              </div>
            `).join('') : '<p class="muted">Sin registros hoy</p>'}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderTeachers() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="toolbar">
      <button class="btn primary" onclick="alert('Agregar docente')">+ Agregar Docente</button>
    </div>
    <div class="card">
      <div class="card-head">
        <h3>Docentes</h3>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Empleado</th>
              <th>Email</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${state.teachers && state.teachers.length > 0 ? state.teachers.map(t => `
              <tr>
                <td class="teacher-cell">
                  <div class="initials">${(t.full_name?.[0] || 'D').toUpperCase()}</div>
                  ${t.full_name || 'Docente'}
                </td>
                <td>${t.employee_id || '-'}</td>
                <td>${t.email || '-'}</td>
                <td>
                  <button class="btn" onclick="alert('Editar: ' + ${t.id})">Editar</button>
                </td>
              </tr>
            `).join('') : '<tr><td colspan="4" class="empty">Sin docentes registrados</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderSchedules() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="toolbar">
      <button class="btn primary" onclick="alert('Agregar horario')">+ Agregar Horario</button>
    </div>
    <div class="card">
      <div class="card-head">
        <h3>Horarios</h3>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Docente</th>
              <th>Día</th>
              <th>Hora Inicio</th>
              <th>Hora Fin</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${state.schedules && state.schedules.length > 0 ? state.schedules.map(s => `
              <tr>
                <td>${s.teacher_name || 'Docente'}</td>
                <td>${s.day_of_week || '-'}</td>
                <td>${s.start_time || '-'}</td>
                <td>${s.end_time || '-'}</td>
                <td>
                  <button class="btn" onclick="alert('Editar')">Editar</button>
                </td>
              </tr>
            `).join('') : '<tr><td colspan="5" class="empty">Sin horarios registrados</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAttendance() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="toolbar">
      <input type="date" id="attendanceDate" value="${state.date}">
      <button class="btn primary" onclick="loadAttendanceData()">Cargar</button>
    </div>
    <div class="card">
      <div class="card-head">
        <h3>Asistencias</h3>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Docente</th>
              <th>Hora</th>
              <th>Estado</th>
              <th>Dispositivo</th>
            </tr>
          </thead>
          <tbody id="attendanceBody">
            <tr><td colspan="4" class="empty">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
  loadAttendanceData();
}

async function loadAttendanceData() {
  try {
    const date = document.getElementById('attendanceDate')?.value || state.date;
    const res = await fetch(`/api/attendance?date=${date}`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Failed to load attendance');
    const records = await res.json();
    
    const tbody = document.getElementById('attendanceBody');
    tbody.innerHTML = Array.isArray(records) && records.length > 0 ? records.map(r => `
      <tr>
        <td>${r.teacher_name || 'Docente'}</td>
        <td>${r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : '-'}</td>
        <td><span class="badge ${r.status || 'ON_TIME'}">${r.status || 'Puntual'}</span></td>
        <td>${r.device_name || '-'}</td>
      </tr>
    `).join('') : '<tr><td colspan="4" class="empty">Sin registros</td></tr>';
  } catch (err) {
    console.error('Error loading attendance:', err);
  }
}

function renderReports() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="toolbar">
      <div>
        <label>Desde:</label>
        <input type="date" id="reportStart" value="${state.date}">
      </div>
      <div>
        <label>Hasta:</label>
        <input type="date" id="reportEnd" value="${state.date}">
      </div>
      <button class="btn primary" onclick="downloadReport()">Descargar CSV</button>
    </div>
    <div class="card">
      <div class="card-head">
        <h3>Reportes</h3>
      </div>
      <div class="card-body">
        <p class="muted">Selecciona fechas y descarga el reporte en formato CSV</p>
      </div>
    </div>
  `;
}

async function downloadReport() {
  const start = document.getElementById('reportStart')?.value || state.date;
  const end = document.getElementById('reportEnd')?.value || state.date;
  
  try {
    const res = await fetch(`/api/reports/csv?start=${start}&end=${end}`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Failed to download report');
    
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-${start}-${end}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert('Error al descargar reporte');
  }
}

function renderJustifications() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card">
      <div class="card-head">
        <h3>Justificantes</h3>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Docente</th>
              <th>Fecha</th>
              <th>Motivo</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="justificationsBody">
            <tr><td colspan="5" class="empty">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
  loadJustifications();
}

async function loadJustifications() {
  try {
    const res = await fetch('/api/justifications', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Failed to load justifications');
    const justifications = await res.json();
    
    const tbody = document.getElementById('justificationsBody');
    tbody.innerHTML = Array.isArray(justifications) && justifications.length > 0 ? justifications.map(j => `
      <tr>
        <td>${j.teacher_name || 'Docente'}</td>
        <td>${j.date || '-'}</td>
        <td>${j.reason || '-'}</td>
        <td><span class="badge ${j.status || 'PENDING'}">${j.status || 'Pendiente'}</span></td>
        <td>
          ${j.status === 'PENDING' ? `
            <button class="btn" onclick="alert('Aprobar')">Aprobar</button>
          ` : '-'}
        </td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="empty">Sin justificantes</td></tr>';
  } catch (err) {
    console.error('Error loading justifications:', err);
  }
}

function renderAccount() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card">
      <div class="card-head">
        <h3>Mi Cuenta</h3>
      </div>
      <div class="card-body">
        <div class="profile-card">
          <div class="profile-avatar">${state.user?.username?.[0]?.toUpperCase() || 'U'}</div>
          <div>
            <h3>${state.user?.username || 'Usuario'}</h3>
            <p class="muted">Administrador</p>
          </div>
        </div>
        
        <div style="margin-top: 30px;">
          <h4>Cambiar Contraseña</h4>
          <form onsubmit="handlePasswordChange(event)">
            <label>Contraseña Actual
              <input type="password" id="currentPassword" required>
            </label>
            <label>Nueva Contraseña
              <input type="password" id="newPassword" required>
            </label>
            <label>Confirmar
              <input type="password" id="confirmPassword" required>
            </label>
            <button class="btn primary">Cambiar Contraseña</button>
          </form>
        </div>
      </div>
    </div>
  `;
}

async function handlePasswordChange(e) {
  e.preventDefault();
  const current = document.getElementById('currentPassword').value;
  const newPass = document.getElementById('newPassword').value;
  const confirm = document.getElementById('confirmPassword').value;

  if (newPass !== confirm) {
    alert('Las contraseñas no coinciden');
    return;
  }

  try {
    const res = await fetch('/api/auth/password', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ currentPassword: current, newPassword: newPass })
    });

    if (!res.ok) throw new Error('Failed to change password');
    alert('Contraseña actualizada');
    e.target.reset();
  } catch (err) {
    alert('Error al cambiar contraseña');
  }
}

function updateClock() {
  const now = new Date();
  document.getElementById('clockTime').textContent = now.toLocaleTimeString();
  document.getElementById('clockDate').textContent = now.toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function logout() {
  localStorage.removeItem('token');
  state.token = null;
  showLoginView();
}

function showLoginView() {
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('appView').classList.add('hidden');
}

function showAppView() {
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  document.getElementById('currentUserName').textContent = state.user?.username || 'Usuario';
  document.getElementById('selectedDate').value = state.date;
}
