import {
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  checkBackendHealth,
  onStatusChange,
  getPendingSyncCount,
  syncPendingActivities,
  getStatus,
  getCurrentUser,
  loginUser,
  registerUser,
  logoutUser,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  fetchCurrentUserProfile,
  onAuthChange
} from './api.js?v=3.1';

// ==========================================================================
// Constantes y Configuración del Servicio Social
// ==========================================================================
const META_HORAS = 480;
const FECHA_INICIO = new Date('2026-07-01T00:00:00');
const FECHA_FIN = new Date('2026-12-31T23:59:59');
const CIRCUNFERENCIA = 2 * Math.PI * 92; // r = 92 en el SVG -> ~578.05

// Variables globales de estado
let allActivities = [];
let weeklyChartInstance = null;
let currentDeletingId = null;
let currentTheme = localStorage.getItem('sst_theme') || 'dark';
let selectedMonth = 'all';

// Elementos del DOM
const statusBadge = document.getElementById('serverStatusBadge');
const statusLabel = statusBadge.querySelector('.status-label');
const themeToggleBtn = document.getElementById('themeToggleBtn');

// Elementos de Autenticación y Perfil en Navbar
const openAuthModalBtn = document.getElementById('openAuthModalBtn');
const userNavProfile = document.getElementById('userNavProfile');
const userProfileBtn = document.getElementById('userProfileBtn');
const navUserAvatar = document.getElementById('navUserAvatar');
const navUserName = document.getElementById('navUserName');
const userDropdownMenu = document.getElementById('userDropdownMenu');
const dropdownUserName = document.getElementById('dropdownUserName');
const dropdownUserEmail = document.getElementById('dropdownUserEmail');
const dropdownUserVerified = document.getElementById('dropdownUserVerified');
const logoutBtn = document.getElementById('logoutBtn');

// Banner de verificación de correo
const unverifiedEmailBanner = document.getElementById('unverifiedEmailBanner');
const closeUnverifiedBannerBtn = document.getElementById('closeUnverifiedBannerBtn');

// Modal de Autenticación
const authModal = document.getElementById('authModal');
const authModalTitle = document.getElementById('authModalTitle');
const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
const authTabs = document.getElementById('authTabs');
const authTabButtons = authTabs.querySelectorAll('.auth-tab');

// Formularios de Autenticación
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const submitLoginBtn = document.getElementById('submitLoginBtn');
const toForgotBtn = document.getElementById('toForgotBtn');

const registerForm = document.getElementById('registerForm');
const registerNombre = document.getElementById('registerNombre');
const registerEmail = document.getElementById('registerEmail');
const registerPassword = document.getElementById('registerPassword');
const registerPasswordConfirm = document.getElementById('registerPasswordConfirm');
const submitRegisterBtn = document.getElementById('submitRegisterBtn');

const forgotForm = document.getElementById('forgotForm');
const forgotEmail = document.getElementById('forgotEmail');
const submitForgotBtn = document.getElementById('submitForgotBtn');
const backToLoginFromForgotBtn = document.getElementById('backToLoginFromForgotBtn');

const resetPasswordForm = document.getElementById('resetPasswordForm');
const resetTokenValue = document.getElementById('resetTokenValue');
const newPassword = document.getElementById('newPassword');
const newPasswordConfirm = document.getElementById('newPasswordConfirm');
const submitResetPasswordBtn = document.getElementById('submitResetPasswordBtn');

// Banner de sincronización a la nube
const syncAlertBanner = document.getElementById('syncAlertBanner');
const pendingSyncCount = document.getElementById('pendingSyncCount');
const btnSyncNow = document.getElementById('btnSyncNow');

// KPIs
const kpiHorasTotales = document.getElementById('kpiHorasTotales');
const kpiProgressBar = document.getElementById('kpiProgressBar');
const kpiPorcentajeText = document.getElementById('kpiPorcentajeText');
const kpiHorasRestantes = document.getElementById('kpiHorasRestantes');
const kpiRitmoSemanal = document.getElementById('kpiRitmoSemanal');
const kpiDiasRestantes = document.getElementById('kpiDiasRestantes');

// Dial
const circleFill = document.getElementById('circleFill');
const circlePercent = document.getElementById('circlePercent');
const circleHoras = document.getElementById('circleHoras');
const dialStatusText = document.getElementById('dialStatusText');

// Formulario de Registro Rápido
const activityForm = document.getElementById('activityForm');
const fechaInput = document.getElementById('fecha');
const horasInput = document.getElementById('horas');
const descripcionInput = document.getElementById('descripcion');
const lugarInput = document.getElementById('lugar');
const evidenciaUrlInput = document.getElementById('evidenciaUrl');
const submitBtn = document.getElementById('submitBtn');
const quickChips = document.querySelectorAll('.quick-chip');

// Filtros y Búsqueda
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const monthChips = document.querySelectorAll('.month-chip');
const monthHoursSummary = document.getElementById('monthHoursSummary');
const activityCountBadge = document.getElementById('activityCountBadge');
const activityList = document.getElementById('activityList');

// Modal de Eliminación
const deleteModal = document.getElementById('deleteModal');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

// Modal de Edición
const editModal = document.getElementById('editModal');
const editActivityForm = document.getElementById('editActivityForm');
const editIdInput = document.getElementById('editId');
const editFechaInput = document.getElementById('editFecha');
const editHorasInput = document.getElementById('editHoras');
const editDescripcionInput = document.getElementById('editDescripcion');
const editLugarInput = document.getElementById('editLugar');
const editEvidenciaUrlInput = document.getElementById('editEvidenciaUrl');
const closeEditModalBtn = document.getElementById('closeEditModalBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

// Toast Container
const toastContainer = document.getElementById('toastContainer');

// ==========================================================================
// Inicialización y Listeners
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Configurar tema inicial
  applyTheme(currentTheme);

  // Inicializar fecha de hoy por defecto
  const today = new Date().toISOString().split('T')[0];
  fechaInput.value = today;

  // Renderizar iconos de Lucide
  refreshIcons();

  // Calcular días restantes del periodo oficial
  renderDaysRemaining();

  // Escuchar estado del backend
  onStatusChange((isOnline) => {
    updateBackendStatusUI(isOnline);
    updateSyncBanner();
  });

  // Escuchar estado de autenticación
  onAuthChange((user) => {
    updateAuthUI(user);
  });

  // Inicializar eventos de autenticación
  initAuthEvents();

  // Revisar si existen parámetros de verificación o reset en la URL
  handleUrlAuthParams();

  // Refrescar perfil con el backend para sincronizar estado de verificación en tiempo real
  refreshVerificationStatus();

  // Al volver a la pestaña, comprobar si se verificó el correo en otra ventana/dispositivo
  window.addEventListener('focus', async () => {
    const user = getCurrentUser();
    if (user && !user.isVerified) {
      const fresh = await refreshVerificationStatus();
      if (fresh?.isVerified) {
        showToast('¡Tu correo ha sido verificado con éxito!', 'success');
      }
    }
  });

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    const user = getCurrentUser();
    if (user && !user.isVerified) {
      const fresh = await refreshVerificationStatus();
      if (fresh?.isVerified) {
        showToast('¡Tu correo ha sido verificado con éxito!', 'success');
      }
    }
  });

  // Sincronización entre pestañas abiertas
  window.addEventListener('storage', (e) => {
    if (e.key === 'sst_auth_user') {
      try {
        const updated = e.newValue ? JSON.parse(e.newValue) : null;
        updateAuthUI(updated);
        if (updated && !updated.isVerified) {
          refreshVerificationStatus();
        }
      } catch (err) {
        console.warn('Error al sincronizar auth entre pestañas:', err);
      }
    }
  });

  // Cargar datos principales
  loadApp(true);
});

// Selector de Tema (Oscuro / Claro)
themeToggleBtn.addEventListener('click', () => {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(currentTheme);
  localStorage.setItem('sst_theme', currentTheme);
  
  // Re-renderizar gráfico para adaptar colores
  if (weeklyChartInstance && allActivities) {
    renderChart(allActivities);
  }
  
  showToast(
    currentTheme === 'dark' ? 'Modo Oscuro Ejecutivo activado' : 'Modo Claro activado',
    'info'
  );
});

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  refreshIcons();
}

// Botón de Comprobar Conexión con Backend
statusBadge.addEventListener('click', async () => {
  statusLabel.textContent = 'Comprobando...';
  const isUp = await checkBackendHealth();
  updateSyncBanner();
  if (isUp) {
    showToast('Conectado exitosamente con MongoDB', 'success');
  } else {
    showToast('Sin conexión con servidor backend. Operando en Modo Local.', 'info');
  }
});

function updateBackendStatusUI(isOnline) {
  if (isOnline) {
    statusBadge.className = 'status-badge online';
    statusLabel.textContent = 'Servidor Conectado';
    statusBadge.title = 'Conectado a la base de datos MongoDB Atlas';
  } else {
    statusBadge.className = 'status-badge offline';
    statusLabel.textContent = 'Modo Local (Offline)';
    statusBadge.title = 'Servidor local no detectado. Datos respaldados en tu navegador.';
  }
}

// Banner y Acción de Sincronización a la nube
function updateSyncBanner() {
  if (!syncAlertBanner) return;
  const count = getPendingSyncCount();
  const isOnline = getStatus();

  if (count > 0 && isOnline) {
    syncAlertBanner.style.display = 'flex';
    pendingSyncCount.textContent = count;
  } else {
    syncAlertBanner.style.display = 'none';
  }
  refreshIcons();
}

if (btnSyncNow) {
  btnSyncNow.addEventListener('click', async () => {
    btnSyncNow.disabled = true;
    const origHtml = btnSyncNow.innerHTML;
    btnSyncNow.innerHTML = `<span>Subiendo a la nube...</span>`;

    try {
      const result = await syncPendingActivities();
      await loadApp(false);
      showToast(`¡${result.synced} actividad(es) sincronizadas exitosamente en MongoDB!`, 'success');
    } catch (e) {
      console.error('Error al sincronizar:', e);
      showToast('No se pudo completar la sincronización', 'error');
    } finally {
      btnSyncNow.disabled = false;
      btnSyncNow.innerHTML = origHtml;
      updateSyncBanner();
      refreshIcons();
    }
  });
}

// ==========================================================================
// Carga Principal de la Aplicación
// ==========================================================================
async function loadApp(isInitialLoad = false) {
  try {
    allActivities = await getActivities();
    
    renderKPIs(allActivities);
    renderProgress(allActivities);
    renderChart(allActivities);
    applyFilters();
    updateSyncBanner();

    if (isInitialLoad) {
      animateEntrance();
    }
  } catch (err) {
    console.error('Error al inicializar la aplicación:', err);
    showToast('Error al cargar la información', 'error');
  }
}

// ==========================================================================
// Renderizado de KPIs y Métricas
// ==========================================================================
function renderKPIs(activities) {
  const target = getTargetHours();
  const totalHoras = activities.reduce((sum, a) => sum + Number(a.horas || 0), 0);
  const porcentaje = Math.min((totalHoras / target) * 100, 100);
  const horasRestantes = Math.max(target - totalHoras, 0);

  // Animación del número de Horas Totales
  animateNumber(kpiHorasTotales, totalHoras, 1, false);
  kpiProgressBar.style.width = `${porcentaje}%`;
  kpiPorcentajeText.textContent = `${porcentaje.toFixed(1)}% completado`;

  // Animación de Horas Restantes
  animateNumber(kpiHorasRestantes, horasRestantes, 1, false);

  // Ritmo Semanal promedio
  const semanasMap = {};
  activities.forEach((act) => {
    const sem = getWeekNumber(new Date(act.fecha));
    semanasMap[sem] = (semanasMap[sem] || 0) + Number(act.horas);
  });
  const numSemanasActivas = Object.keys(semanasMap).length || 1;
  const ritmo = totalHoras > 0 ? (totalHoras / numSemanasActivas).toFixed(1) : '0.0';
  kpiRitmoSemanal.textContent = ritmo;
}

function renderDaysRemaining() {
  // Contabilizar estrictamente los días de Lunes a Viernes del 1 de julio al 31 de diciembre de 2026
  let fechaCursor = new Date(FECHA_INICIO);
  fechaCursor.setHours(0, 0, 0, 0);

  const finNormalizado = new Date(FECHA_FIN);
  finNormalizado.setHours(23, 59, 59, 999);

  let diasHabilesTotales = 0;
  while (fechaCursor <= finNormalizado) {
    const diaSemana = fechaCursor.getDay(); // 0 = Domingo, 6 = Sábado
    // Contar exclusivamente Lunes a Viernes (días hábiles oficiales, sin descontar ningún festivo)
    if (diaSemana !== 0 && diaSemana !== 6) {
      diasHabilesTotales++;
    }
    fechaCursor.setDate(fechaCursor.getDate() + 1);
  }

  // Son exactamente 132 días hábiles
  animateNumber(kpiDiasRestantes, diasHabilesTotales, 1, false);
}

// ==========================================================================
// Dial Circular de Progreso con GSAP
// ==========================================================================
function renderProgress(activities) {
  const target = getTargetHours();
  const totalHoras = activities.reduce((sum, a) => sum + Number(a.horas || 0), 0);
  const porcentaje = Math.min((totalHoras / target) * 100, 100);

  circleFill.style.strokeDasharray = CIRCUNFERENCIA;
  const offset = CIRCUNFERENCIA - (porcentaje / 100) * CIRCUNFERENCIA;

  // Animación del trazo SVG con GreenSock
  gsap.to(circleFill, {
    strokeDashoffset: offset,
    duration: 1.5,
    ease: 'power3.out'
  });

  // Animación del porcentaje central
  const counterObj = { val: parseFloat(circlePercent.textContent) || 0 };
  gsap.to(counterObj, {
    val: porcentaje,
    duration: 1.5,
    ease: 'power3.out',
    onUpdate: () => {
      circlePercent.textContent = `${Math.round(counterObj.val)}%`;
    }
  });

  circleHoras.textContent = `${totalHoras} / ${target} hrs`;

  // Subtexto motivacional según el progreso
  if (porcentaje === 0) {
    dialStatusText.textContent = 'Iniciando registro de actividades';
  } else if (porcentaje < 25) {
    dialStatusText.textContent = 'Excelente comienzo, mantén el ritmo';
  } else if (porcentaje < 50) {
    dialStatusText.textContent = 'Avance constante y disciplinado';
  } else if (porcentaje < 75) {
    dialStatusText.textContent = '¡Más de la mitad completado!';
  } else if (porcentaje < 100) {
    dialStatusText.textContent = 'Etapa final para concluir tu meta';
  } else {
    dialStatusText.textContent = `🎉 ¡Felicidades! Meta de ${target} hrs cumplida`;
  }
}

// ==========================================================================
// Gráfica de Distribución Semanal (Chart.js Monocromática)
// ==========================================================================
function renderChart(activities) {
  const semanas = {};

  activities.forEach((act) => {
    const fecha = new Date(act.fecha);
    const numSemana = getWeekNumber(fecha);
    semanas[numSemana] = (semanas[numSemana] || 0) + Number(act.horas);
  });

  const sortedKeys = Object.keys(semanas).sort((a, b) => Number(a) - Number(b));
  const labels = sortedKeys.length ? sortedKeys.map((s) => `Sem. ${s}`) : ['Sem. 1'];
  const data = sortedKeys.length ? sortedKeys.map((s) => semanas[s]) : [0];

  const ctx = document.getElementById('weeklyChart');
  if (!ctx) return;

  if (weeklyChartInstance) {
    weeklyChartInstance.destroy();
  }

  const isDark = currentTheme === 'dark';
  const barColor = isDark ? '#fafafa' : '#18181b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const textColor = isDark ? '#71717a' : '#9ca3af';

  weeklyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Horas',
          data,
          backgroundColor: barColor,
          borderRadius: 8,
          borderSkipped: false,
          maxBarThickness: 38
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#18181b' : '#ffffff',
          titleColor: isDark ? '#ffffff' : '#09090b',
          bodyColor: isDark ? '#a1a1aa' : '#4b5563',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          usePointStyle: true,
          callbacks: {
            label: (ctx) => `  ${ctx.parsed.y} horas registradas`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: textColor,
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            stepSize: 5
          },
          grid: { color: gridColor, drawBorder: false }
        },
        x: {
          ticks: {
            color: textColor,
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: '500' }
          },
          grid: { display: false, drawBorder: false }
        }
      }
    }
  });
}

// Redimensionar automáticamente el gráfico cuando cambia el tamaño de pantalla
let chartResizeDebounce;
window.addEventListener('resize', () => {
  clearTimeout(chartResizeDebounce);
  chartResizeDebounce = setTimeout(() => {
    if (weeklyChartInstance) {
      weeklyChartInstance.resize();
    }
  }, 100);
});

function getWeekNumber(fecha) {
  const diff = fecha - FECHA_INICIO;
  const semanas = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
  return semanas > 0 ? semanas : 1;
}

// ==========================================================================
// Bitácora de Actividades (Renderizado y Filtrado)
// ==========================================================================
function applyFilters() {
  const query = searchInput.value.toLowerCase().trim();

  const filtered = allActivities.filter((act) => {
    // Filtro por texto (descripción o lugar)
    const desc = (act.descripcion || '').toLowerCase();
    const lugar = (act.lugar || '').toLowerCase();
    const matchesSearch = desc.includes(query) || lugar.includes(query);

    // Filtro por mes seleccionado
    let matchesMonth = true;
    if (selectedMonth !== 'all') {
      const actDate = new Date(act.fecha);
      const actMonth = actDate.getUTCMonth(); // 0 a 11
      matchesMonth = actMonth === parseInt(selectedMonth, 10);
    }

    return matchesSearch && matchesMonth;
  });

  // Resumen de horas del mes filtrado
  if (selectedMonth !== 'all') {
    const totalMes = filtered.reduce((s, a) => s + Number(a.horas || 0), 0);
    monthHoursSummary.textContent = `Total en mes: ${totalMes.toFixed(1)} hrs`;
  } else {
    monthHoursSummary.textContent = '';
  }

  renderList(filtered);
}

function renderList(activities) {
  activityList.innerHTML = '';
  activityCountBadge.textContent = `${activities.length} ${activities.length === 1 ? 'registro' : 'registros'}`;

  if (activities.length === 0) {
    activityList.innerHTML = `
      <li class="empty-state">
        <div class="empty-state-icon">
          <i data-lucide="inbox"></i>
        </div>
        <p class="empty-state-title">No hay actividades encontradas</p>
        <p class="empty-state-desc">Prueba cambiando el filtro de mes o tu término de búsqueda.</p>
      </li>
    `;
    refreshIcons();
    return;
  }

  activities.forEach((act) => {
    const li = document.createElement('li');
    li.className = 'activity-item';
    li.dataset.id = act._id;

    // Formateo de fecha elegante en español
    const dateObj = new Date(act.fecha);
    const fechaFormateada = dateObj.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    });

    const isLocalPending = act._id && String(act._id).startsWith('local_');

    li.innerHTML = `
      <div class="activity-main">
        <div class="activity-top-row">
          <span class="activity-hours-badge">+${Number(act.horas).toFixed(1)} hrs</span>
          <span class="activity-date">
            <i data-lucide="calendar"></i>
            ${fechaFormateada}
          </span>
          ${
            isLocalPending
              ? `<span class="badge-local" style="font-size:0.68rem; padding:0.15rem 0.5rem; border-radius:6px; background:rgba(234,179,8,0.12); color:#eab308; border:1px solid rgba(234,179,8,0.25); font-family:'JetBrains Mono', monospace;" title="Guardado en tu laptop (pendiente de subir a la nube)">● Local</span>`
              : ''
          }
        </div>
        <p class="activity-desc">${escapeHtml(act.descripcion)}</p>
        <div class="activity-meta-row">
          ${
            act.lugar
              ? `<span class="activity-place"><i data-lucide="map-pin"></i>${escapeHtml(act.lugar)}</span>`
              : ''
          }
          ${
            act.evidenciaUrl
              ? `<a href="${escapeHtml(act.evidenciaUrl)}" target="_blank" rel="noopener noreferrer" class="activity-link">
                  <i data-lucide="external-link"></i> Ver Evidencia
                </a>`
              : ''
          }
        </div>
      </div>
      <div class="activity-actions">
        <button class="btn-edit-activity" data-id="${act._id}" title="Editar actividad">
          <i data-lucide="pencil"></i>
        </button>
        <button class="btn-delete-activity" data-id="${act._id}" title="Eliminar actividad">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `;

    activityList.appendChild(li);
  });

  refreshIcons();

  // Asignar eventos de Edición
  document.querySelectorAll('.btn-edit-activity').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      openEditModal(id);
    });
  });

  // Asignar eventos de Eliminación
  document.querySelectorAll('.btn-delete-activity').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      openDeleteModal(id);
    });
  });
}

// Filtro por Mes
monthChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    monthChips.forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    selectedMonth = chip.dataset.month;
    applyFilters();
  });
});

// Búsqueda en Vivo
searchInput.addEventListener('input', (e) => {
  const query = e.target.value.trim();
  clearSearchBtn.style.display = query ? 'flex' : 'none';
  applyFilters();
});

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  clearSearchBtn.style.display = 'none';
  applyFilters();
});

// Quick chips de horas
quickChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    horasInput.value = chip.dataset.hours;
    gsap.fromTo(chip, { scale: 0.9 }, { scale: 1, duration: 0.2, ease: 'back.out(2)' });
  });
});

// ==========================================================================
// Formulario de Creación de Actividad
// ==========================================================================
activityForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fechaVal = fechaInput.value;
  const horasVal = parseFloat(horasInput.value);
  const descVal = descripcionInput.value.trim();
  const lugarVal = lugarInput.value.trim();
  const evidenciaVal = evidenciaUrlInput.value.trim();

  if (!fechaVal || isNaN(horasVal) || horasVal <= 0 || !descVal) {
    showToast('Por favor completa todos los campos requeridos', 'error');
    return;
  }

  const originalBtnContent = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span>Guardando...</span>`;

  try {
    await createActivity({
      fecha: fechaVal,
      horas: horasVal,
      descripcion: descVal,
      lugar: lugarVal,
      evidenciaUrl: evidenciaVal
    });

    activityForm.reset();
    fechaInput.value = new Date().toISOString().split('T')[0];

    await loadApp(false);
    showToast('Actividad registrada correctamente', 'success');
  } catch (err) {
    console.error('Error al guardar actividad:', err);
    showToast('Hubo un error al guardar la actividad', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnContent;
    refreshIcons();
  }
});

// ==========================================================================
// Modal de Edición de Actividad
// ==========================================================================
function openEditModal(id) {
  const act = allActivities.find((a) => String(a._id) === String(id));
  if (!act) return;

  editIdInput.value = act._id;
  // Extraer YYYY-MM-DD
  const rawFecha = act.fecha ? new Date(act.fecha).toISOString().split('T')[0] : '';
  editFechaInput.value = rawFecha;
  editHorasInput.value = act.horas;
  editDescripcionInput.value = act.descripcion || '';
  editLugarInput.value = act.lugar || '';
  editEvidenciaUrlInput.value = act.evidenciaUrl || '';

  editModal.classList.add('is-open');
  editModal.setAttribute('aria-hidden', 'false');
  refreshIcons();
}

function closeEditModal() {
  editModal.classList.remove('is-open');
  editModal.setAttribute('aria-hidden', 'true');
  editActivityForm.reset();
}

if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', closeEditModal);
if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);

editModal.addEventListener('click', (e) => {
  if (e.target === editModal) {
    closeEditModal();
  }
});

editActivityForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = editIdInput.value;
  const fechaVal = editFechaInput.value;
  const horasVal = parseFloat(editHorasInput.value);
  const descVal = editDescripcionInput.value.trim();
  const lugarVal = editLugarInput.value.trim();
  const evidenciaVal = editEvidenciaUrlInput.value.trim();

  if (!id || !fechaVal || isNaN(horasVal) || horasVal <= 0 || !descVal) {
    showToast('Por favor completa los campos obligatorios', 'error');
    return;
  }

  const saveBtn = document.getElementById('saveEditBtn');
  const origText = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = 'Actualizando...';

  try {
    await updateActivity(id, {
      fecha: fechaVal,
      horas: horasVal,
      descripcion: descVal,
      lugar: lugarVal,
      evidenciaUrl: evidenciaVal
    });

    closeEditModal();
    await loadApp(false);
    showToast('Actividad actualizada correctamente', 'success');
  } catch (err) {
    console.error('Error al actualizar:', err);
    showToast('Error al actualizar la actividad', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = origText;
  }
});

// ==========================================================================
// Modal de Eliminación
// ==========================================================================
function openDeleteModal(id) {
  currentDeletingId = id;
  deleteModal.classList.add('is-open');
  deleteModal.setAttribute('aria-hidden', 'false');
}

function closeDeleteModal() {
  currentDeletingId = null;
  deleteModal.classList.remove('is-open');
  deleteModal.setAttribute('aria-hidden', 'true');
}

cancelDeleteBtn.addEventListener('click', closeDeleteModal);

deleteModal.addEventListener('click', (e) => {
  if (e.target === deleteModal) {
    closeDeleteModal();
  }
});

confirmDeleteBtn.addEventListener('click', async () => {
  if (!currentDeletingId) return;

  const idToDelete = currentDeletingId;
  closeDeleteModal();

  try {
    await deleteActivity(idToDelete);
    await loadApp(false);
    showToast('Actividad eliminada con éxito', 'info');
  } catch (err) {
    console.error('Error al eliminar:', err);
    showToast('Error al eliminar la actividad', 'error');
  }
});

// ==========================================================================
// Notificaciones Toast Flotantes con GSAP
// ==========================================================================
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconName =
    type === 'success' ? 'check-circle-2' : type === 'error' ? 'alert-circle' : 'info';

  toast.innerHTML = `
    <i data-lucide="${iconName}" class="toast-icon"></i>
    <span>${escapeHtml(message)}</span>
  `;

  toastContainer.appendChild(toast);
  refreshIcons();

  // Animación de entrada GSAP
  gsap.to(toast, {
    opacity: 1,
    y: 0,
    duration: 0.35,
    ease: 'power3.out'
  });

  // Auto remoción después de 3.5 segundos
  setTimeout(() => {
    gsap.to(toast, {
      opacity: 0,
      y: -10,
      duration: 0.25,
      ease: 'power2.in',
      onComplete: () => {
        toast.remove();
      }
    });
  }, 3500);
}

// ==========================================================================
// Animaciones de Entrada y Micro-interacciones
// ==========================================================================
function animateEntrance() {
  gsap.from('[data-animate]', {
    opacity: 0,
    y: 24,
    duration: 0.85,
    stagger: 0.1,
    ease: 'power3.out'
  });
}

function animateNumber(element, target, duration = 1, isFloat = false) {
  const current = parseFloat(element.textContent) || 0;
  const obj = { val: current };
  gsap.to(obj, {
    val: target,
    duration,
    ease: 'power2.out',
    onUpdate: () => {
      element.textContent = isFloat ? obj.val.toFixed(1) : Math.round(obj.val);
    }
  });
}

// ==========================================================================
// Utilidades
// ==========================================================================
function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================================================
// Módulo de Autenticación y Gestión de Usuarios
// ==========================================================================

function getTargetHours() {
  const user = getCurrentUser();
  return (user && user.metaHoras) ? user.metaHoras : META_HORAS;
}

let verificationPollTimer = null;
let verificationRefreshPromise = null;

async function refreshVerificationStatus() {
  if (verificationRefreshPromise) return verificationRefreshPromise;

  verificationRefreshPromise = fetchCurrentUserProfile()
    .then((fresh) => {
      if (fresh?.isVerified) {
        stopVerificationPolling();
        updateAuthUI(fresh);
      }
      return fresh;
    })
    .finally(() => {
      verificationRefreshPromise = null;
    });

  return verificationRefreshPromise;
}

function startVerificationPolling() {
  if (verificationPollTimer) return;
  refreshVerificationStatus();
  verificationPollTimer = setInterval(async () => {
    const user = getCurrentUser();
    if (!user || user.isVerified) {
      stopVerificationPolling();
      return;
    }
    const fresh = await refreshVerificationStatus();
    if (fresh?.isVerified) {
      showToast('¡Tu correo ha sido verificado con éxito!', 'success');
    }
  }, 3000);
}

function stopVerificationPolling() {
  if (verificationPollTimer) {
    clearInterval(verificationPollTimer);
    verificationPollTimer = null;
  }
}

function updateAuthUI(user) {
  if (user) {
    // Modo Sesión Iniciada
    if (openAuthModalBtn) openAuthModalBtn.style.display = 'none';
    if (userNavProfile) userNavProfile.style.display = 'inline-flex';

    const initials = (user.nombre || user.email || 'U')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0].toUpperCase())
      .slice(0, 2)
      .join('');

    if (navUserAvatar) navUserAvatar.textContent = initials || 'U';
    if (navUserName) navUserName.textContent = user.nombre || user.email.split('@')[0];
    if (dropdownUserName) dropdownUserName.textContent = user.nombre || 'Usuario';
    if (dropdownUserEmail) dropdownUserEmail.textContent = user.email;

    if (user.isVerified) {
      if (dropdownUserVerified) {
        dropdownUserVerified.className = 'dropdown-user-status';
        dropdownUserVerified.textContent = '● Correo verificado';
      }
      if (unverifiedEmailBanner) unverifiedEmailBanner.style.display = 'none';
      stopVerificationPolling();
    } else {
      if (dropdownUserVerified) {
        dropdownUserVerified.className = 'dropdown-user-status unverified';
        dropdownUserVerified.textContent = '● Correo pendiente de verificación';
      }
      if (unverifiedEmailBanner) unverifiedEmailBanner.style.display = 'flex';
      startVerificationPolling();
    }
  } else {
    // Modo Invitado (Sin Sesión)
    if (openAuthModalBtn) openAuthModalBtn.style.display = 'inline-flex';
    if (userNavProfile) {
      userNavProfile.style.display = 'none';
      userNavProfile.classList.remove('menu-open');
    }
    if (unverifiedEmailBanner) unverifiedEmailBanner.style.display = 'none';
    stopVerificationPolling();
  }
  refreshIcons();
}

function openAuthModal(initialTab = 'login') {
  if (!authModal) return;
  authModal.classList.add('is-open');
  authModal.setAttribute('aria-hidden', 'false');
  switchAuthTab(initialTab);
}

function closeAuthModal() {
  if (!authModal) return;
  authModal.classList.remove('is-open');
  authModal.setAttribute('aria-hidden', 'true');
  if (loginForm) loginForm.reset();
  if (registerForm) registerForm.reset();
  if (forgotForm) forgotForm.reset();
  if (resetPasswordForm) resetPasswordForm.reset();
}

function switchAuthTab(tabName) {
  if (loginForm) loginForm.style.display = 'none';
  if (registerForm) registerForm.style.display = 'none';
  if (forgotForm) forgotForm.style.display = 'none';
  if (resetPasswordForm) resetPasswordForm.style.display = 'none';

  if (authTabs) authTabs.style.display = 'flex';
  authTabButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  if (tabName === 'login') {
    if (authModalTitle) authModalTitle.textContent = 'Acceso Seguro';
    if (loginForm) loginForm.style.display = 'block';
  } else if (tabName === 'register') {
    if (authModalTitle) authModalTitle.textContent = 'Crear Cuenta Segura';
    if (registerForm) registerForm.style.display = 'block';
  } else if (tabName === 'forgot') {
    if (authModalTitle) authModalTitle.textContent = 'Recuperar Contraseña';
    if (authTabs) authTabs.style.display = 'none';
    if (forgotForm) forgotForm.style.display = 'block';
  } else if (tabName === 'reset') {
    if (authModalTitle) authModalTitle.textContent = 'Restablecer Contraseña';
    if (authTabs) authTabs.style.display = 'none';
    if (resetPasswordForm) resetPasswordForm.style.display = 'block';
  }
  refreshIcons();
}

function initAuthEvents() {
  // Abrir y cerrar modal
  if (openAuthModalBtn) {
    openAuthModalBtn.addEventListener('click', () => openAuthModal('login'));
  }

  if (closeAuthModalBtn) {
    closeAuthModalBtn.addEventListener('click', closeAuthModal);
  }

  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) {
        closeAuthModal();
      }
    });
  }

  // Pestañas Login / Registro
  authTabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      switchAuthTab(btn.dataset.tab);
    });
  });

  // Alternar vista Olvidé contraseña
  if (toForgotBtn) {
    toForgotBtn.addEventListener('click', () => switchAuthTab('forgot'));
  }

  if (backToLoginFromForgotBtn) {
    backToLoginFromForgotBtn.addEventListener('click', () => switchAuthTab('login'));
  }

  // Menú de usuario en navbar
  if (userProfileBtn && userNavProfile) {
    userProfileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userNavProfile.classList.toggle('menu-open');
    });

    document.addEventListener('click', (e) => {
      if (!userNavProfile.contains(e.target)) {
        userNavProfile.classList.remove('menu-open');
      }
    });
  }

  // Cerrar sesión
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      logoutUser();
      updateAuthUI(null);
      showToast('Has cerrado sesión correctamente', 'info');
      await loadApp(false);
    });
  }

  // Cerrar banner de correo no verificado
  if (closeUnverifiedBannerBtn && unverifiedEmailBanner) {
    closeUnverifiedBannerBtn.addEventListener('click', () => {
      unverifiedEmailBanner.style.display = 'none';
    });
  }

  // Reenviar / Verificar correo desde el banner
  const btnResendVerification = document.getElementById('btnResendVerification');
  if (btnResendVerification) {
    btnResendVerification.addEventListener('click', async () => {
      btnResendVerification.disabled = true;
      const origHtml = btnResendVerification.innerHTML;
      btnResendVerification.innerHTML = `<span>Comprobando...</span>`;

      try {
        // 1. Verificar si ya está validado en la base de datos MongoDB
        const fresh = await fetchCurrentUserProfile();
        if (fresh && fresh.isVerified) {
          updateAuthUI(fresh);
          showToast('¡Tu correo ya ha sido verificado con éxito!', 'success');
          return;
        }

        // 2. Si aún no está verificado, reenviar el correo
        const res = await resendVerification();
        if (res.devVerificationLink) {
          showToast('Modo Local: Verificando cuenta automáticamente...', 'info');
          const token = new URL(res.devVerificationLink).searchParams.get('verifyToken');
          if (token) {
            await verifyEmail(token);
            const current = await fetchCurrentUserProfile();
            if (current) {
              updateAuthUI(current);
            }
            showToast('¡Cuenta verificada exitosamente!', 'success');
          }
        } else {
          showToast(res.message || 'Correo de verificación reenviado a tu bandeja', 'success');
        }
      } catch (err) {
        showToast(err.message || 'No se pudo procesar la verificación', 'error');
      } finally {
        btnResendVerification.disabled = false;
        btnResendVerification.innerHTML = origHtml;
        refreshIcons();
      }
    });
  }

  // Ver / Ocultar contraseñas
  document.querySelectorAll('.btn-toggle-pwd').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      btn.innerHTML = isPass ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
      refreshIcons();
    });
  });

  // Envío de Formulario: Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginEmail.value.trim();
      const password = loginPassword.value;

      if (!email || !password) {
        showToast('Por favor introduce tu correo y contraseña', 'error');
        return;
      }

      submitLoginBtn.disabled = true;
      const origText = submitLoginBtn.innerHTML;
      submitLoginBtn.innerHTML = `<span>Iniciando...</span>`;

      try {
        const data = await loginUser({ email, password });
        closeAuthModal();
        showToast(`¡Bienvenido de nuevo, ${data.user.nombre || ''}!`, 'success');
        updateAuthUI(data.user);
        await loadApp(false);
      } catch (err) {
        showToast(err.message || 'Error al iniciar sesión', 'error');
      } finally {
        submitLoginBtn.disabled = false;
        submitLoginBtn.innerHTML = origText;
        refreshIcons();
      }
    });
  }

  // Envío de Formulario: Registro
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = registerNombre.value.trim();
      const email = registerEmail.value.trim();
      const password = registerPassword.value;
      const passwordConfirm = registerPasswordConfirm.value;

      if (!nombre || !email || !password) {
        showToast('Por favor completa todos los campos requeridos', 'error');
        return;
      }

      if (password !== passwordConfirm) {
        showToast('Las contraseñas no coinciden', 'error');
        return;
      }

      if (password.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
      }

      submitRegisterBtn.disabled = true;
      const origText = submitRegisterBtn.innerHTML;
      submitRegisterBtn.innerHTML = `<span>Creando cuenta...</span>`;

      try {
        const data = await registerUser({ nombre, email, password });
        closeAuthModal();
        if (data.devVerificationLink) {
          showToast('Cuenta creada. (Modo Local: revisa tu terminal o pulsa Reenviar/Verificar en el aviso)', 'info');
        } else {
          showToast('¡Cuenta creada con éxito! Revisa tu bandeja de correo para verificar.', 'success');
        }
        updateAuthUI(data.user);
        await loadApp(false);
      } catch (err) {
        showToast(err.message || 'Error al registrar usuario', 'error');
      } finally {
        submitRegisterBtn.disabled = false;
        submitRegisterBtn.innerHTML = origText;
        refreshIcons();
      }
    });
  }

  // Envío de Formulario: Olvidé Contraseña
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = forgotEmail.value.trim();

      if (!email) {
        showToast('Por favor ingresa tu correo electrónico', 'error');
        return;
      }

      submitForgotBtn.disabled = true;
      const origText = submitForgotBtn.innerHTML;
      submitForgotBtn.innerHTML = `<span>Enviando enlace...</span>`;

      try {
        const res = await forgotPassword(email);
        closeAuthModal();
        showToast(res.message || 'Se ha enviado un correo con instrucciones para restablecer tu contraseña', 'info');
      } catch (err) {
        showToast('Error al enviar la solicitud de recuperación', 'error');
      } finally {
        submitForgotBtn.disabled = false;
        submitForgotBtn.innerHTML = origText;
        refreshIcons();
      }
    });
  }

  // Envío de Formulario: Restablecer Contraseña
  if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = resetTokenValue.value;
      const password = newPassword.value;
      const confirm = newPasswordConfirm.value;

      if (!token) {
        showToast('Token de restablecimiento no detectado', 'error');
        return;
      }

      if (password !== confirm) {
        showToast('Las contraseñas no coinciden', 'error');
        return;
      }

      if (password.length < 6) {
        showToast('La nueva contraseña debe tener al menos 6 caracteres', 'error');
        return;
      }

      submitResetPasswordBtn.disabled = true;
      const origText = submitResetPasswordBtn.innerHTML;
      submitResetPasswordBtn.innerHTML = `<span>Restableciendo...</span>`;

      try {
        const data = await resetPassword(token, password);
        closeAuthModal();
        showToast('¡Contraseña restablecida con éxito! Sesión iniciada.', 'success');
        updateAuthUI(data.user);
        await loadApp(false);
      } catch (err) {
        showToast(err.message || 'Error al restablecer contraseña', 'error');
      } finally {
        submitResetPasswordBtn.disabled = false;
        submitResetPasswordBtn.innerHTML = origText;
        refreshIcons();
      }
    });
  }
}

// Verificación y Recuperación vía Parámetros de URL (?verifyToken= & ?resetToken=)
async function handleUrlAuthParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const verifyToken = urlParams.get('verifyToken');
  const resetToken = urlParams.get('resetToken');

  if (verifyToken) {
    try {
      const res = await verifyEmail(verifyToken);
      showToast(res.message || '¡Tu correo ha sido verificado con éxito!', 'success');
      window.history.replaceState({}, document.title, window.location.pathname);
      await fetchCurrentUserProfile();
      updateAuthUI(getCurrentUser());
      await loadApp(false);
    } catch (err) {
      showToast(err.message || 'El enlace de verificación es inválido o ha caducado', 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } else if (resetToken) {
    resetTokenValue.value = resetToken;
    openAuthModal('reset');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}