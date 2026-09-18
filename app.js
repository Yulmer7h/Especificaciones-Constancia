let DATASET = null;
let CURRENT_PROJECT = null;
let CURRENT_MATERIAL = null;
let CURRENT_DETALLE = null;
let SEARCH_TERM = '';
let CODIGOS_MAP = {};
let REFERENCIAS_MAP = {};

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey && e.key === 'f') || e.key === '/') {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
    if (e.key === 'Escape') closeModal();
  });
});

// ============================================================
// CARGA INICIAL (sin google.script.run)
// ============================================================
function loadData() {
  document.getElementById('loading').style.display = 'flex';
  document.getElementById('main').style.display = 'none';
  try {
    const response = getMaterialesLigeros();
    onDataLoaded(response);
  } catch (e) {
    console.error(e);
    onError({ message: e.message, stack: e.stack });
  }
}

function onDataLoaded(response) {
  try {
    if (!response) throw new Error('Respuesta nula');
    if (!response.success) throw new Error(response.error || 'Error del backend');
    if (!response.materiales || !Array.isArray(response.materiales)) throw new Error('Sin materiales');
    if (response.materiales.length === 0) throw new Error('Materiales vacío');
    if (!response.proyectos || !Array.isArray(response.proyectos)) throw new Error('Sin proyectos');
    if (response.proyectos.length === 0) throw new Error('Proyectos vacío');

    DATASET = response;
    response.materiales.forEach(m => { if (m.codigo) CODIGOS_MAP[m.codigo] = m.id; });
    REFERENCIAS_MAP = response.referencias || {};

    renderProjectTabs();
    selectProject(response.proyectos[0].id);

    document.getElementById('loading').style.display = 'none';
    document.getElementById('main').style.display = 'block';

    const cfg = response.config || {};
    document.getElementById('appName').textContent = cfg.APP_NAME || 'Especificaciones Técnicas';
    document.getElementById('appSubtitle').textContent = cfg.APP_SUBTITLE || 'Constancia Project';
    document.getElementById('footerInfo').textContent = `${cfg.CLIENTE||''} · ${cfg.PROYECTO||''} · v${cfg.APP_VERSION||'1.0'}`;
  } catch (e) {
    console.error('onDataLoaded:', e);
    onError({ message: e.message, stack: e.stack });
  }
}

function onError(err) {
  let mensaje = 'Error desconocido';
  let detalle = '';
  if (typeof err === 'string') {
    mensaje = err;
  } else if (err) {
    mensaje = err.message || 'Error sin mensaje';
    detalle = err.stack || '';
  }
  document.getElementById('loading').innerHTML = `
    <div style="text-align:center;padding:40px 20px;max-width:600px;margin:0 auto;">
      <i class="material-icons" style="font-size:56px;color:#e53e3e;">error_outline</i>
      <h3 style="margin-top:12px;color:#e53e3e;">Error al cargar</h3>
      <p style="margin-top:8px;color:#4a5568;font-size:14px;font-weight:600;">${mensaje}</p>
      ${detalle ? `<pre style="margin-top:12px;padding:10px;background:#f7fafc;border:1px solid #e2e8f0;border-radius:8px;text-align:left;font-size:11px;overflow:auto;max-height:200px;">${detalle}</pre>` : ''}
      <button onclick="loadData()" style="margin-top:20px;padding:10px 24px;background:#2b6cb0;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Reintentar</button>
    </div>`;
}

function reloadData() {
  DATASET = null;
  CURRENT_MATERIAL = null;
  CURRENT_DETALLE = null;
  loadData();
}

// ============================================================
// TABS DE PROYECTO
// ============================================================
function renderProjectTabs() {
  document.getElementById('projectTabs').innerHTML = DATASET.proyectos.map(p => `
    <button class="project-tab" data-pid="${p.id}" onclick="selectProject('${p.id}')">
      <i class="material-icons" style="font-size:18px;">${p.codigo==='TMF'?'construction':'water'}</i>
      ${p.codigo} <span style="font-weight:400;opacity:0.8;">${p.revision}</span>
      <span class="badge">${p.totalMateriales}</span>
    </button>
  `).join('');
}

function selectProject(pid) {
  CURRENT_PROJECT = pid;
  document.querySelectorAll('.project-tab').forEach(t => t.classList.toggle('active', t.dataset.pid === pid));
  renderContent();
}

// ============================================================
// BÚSQUEDA
// ============================================================
function onSearch() {
  SEARCH_TERM = document.getElementById('searchInput').value.toLowerCase().trim();
  document.getElementById('clearBtn').style.display = SEARCH_TERM ? 'flex' : 'none';
  renderContent();
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  SEARCH_TERM = '';
  document.getElementById('clearBtn').style.display = 'none';
  renderContent();
}

// ============================================================
// RENDER PRINCIPAL
// ============================================================
function renderContent() {
  const cont = document.getElementById('contentContainer');
  const proy = DATASET.proyectos.find(p => p.id === CURRENT_PROJECT);
  if (!proy) return;

  let categorias = proy.categorias;
  let totalVisible = 0;

  if (SEARCH_TERM) {
    categorias = categorias.map(c => {
      const mats = c.materiales.filter(m => {
        const hay = [m.codigo,m.nombre,m.nombreEN,m.zona,m.seccion,m.observaciones,m.tipo.nombre].join(' ').toLowerCase();
        return hay.includes(SEARCH_TERM);
      });
      totalVisible += mats.length;
      return {...c, materiales: mats};
    }).filter(c => c.materiales.length > 0);
  } else {
    totalVisible = proy.totalMateriales;
  }

  document.getElementById('statsCount').textContent = `${totalVisible} materiales`;

  if (categorias.length === 0) {
    cont.innerHTML = '';
    document.getElementById('emptyState').style.display = 'block';
    return;
  }
  document.getElementById('emptyState').style.display = 'none';

  cont.innerHTML = categorias.map(c => `
    <div class="category-block" data-cat="${c.id}">
      <div class="category-header" onclick="toggleCategory('${c.id}')">
        <div class="category-title">
          <i class="material-icons">${c.icono}</i>
          <span>${c.nombre}</span>
          <span class="category-count">${c.materiales.length}</span>
        </div>
        <i class="material-icons category-toggle">expand_more</i>
      </div>
      <div class="category-materials">
        ${c.materiales.map(m => `
          <div class="material-card" style="border-left-color:${m.tipo.color}" onclick="openModal(${m.id})">
            <div class="mc-info">
              <div class="mc-top">
                <span class="mc-badge" style="background:${m.tipo.color}">${m.codigo}</span>
                <span class="mc-section">${m.seccion}</span>
                ${m.zona && m.zona !== '-' ? `<span class="mc-section">· Zona ${m.zona}</span>` : ''}
              </div>
              <div class="mc-name">${m.nombre}</div>
              <div class="mc-name-en">${m.nombreEN}</div>
            </div>
            <i class="material-icons mc-arrow">chevron_right</i>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function toggleCategory(cid) {
  const block = document.querySelector(`.category-block[data-cat="${cid}"]`);
  if (block) block.classList.toggle('collapsed');
}

// ============================================================
// MODAL - Carga bajo demanda (sin google.script.run)
// ============================================================
function openModal(id) {
  CURRENT_MATERIAL = DATASET.materiales.find(m => m.id === id);
  if (!CURRENT_MATERIAL) return;

  CURRENT_DETALLE = null;
  const m = CURRENT_MATERIAL;

  document.getElementById('modalBody').innerHTML = `
    <div class="detail-header">
      <span class="mc-badge" style="background:${m.tipo.color}">${m.tipo.nombre} · ${m.codigo}</span>
      <h2>${m.nombre}</h2>
      <p class="en-name">${m.nombreEN}</p>
      <div class="detail-tags">
        <span class="detail-tag"><i class="material-icons">folder</i>${m.proyecto.codigo} · ${m.proyecto.revision}</span>
        <span class="detail-tag"><i class="material-icons">event</i>${m.proyecto.fecha}</span>
        <span class="detail-tag"><i class="material-icons">bookmark</i>Sección ${m.seccion}</span>
        ${m.zona && m.zona !== '-' ? `<span class="detail-tag"><i class="material-icons">place</i>Zona ${m.zona}</span>` : ''}
      </div>
      ${m.observaciones ? `<p style="margin-top:12px;font-size:13px;color:#4a5568;padding:10px;background:#f7fafc;border-radius:8px;">${linkificar(m.observaciones)}</p>` : ''}
      <p style="margin-top:12px;font-size:11px;color:#a0aec0;"><i class="material-icons" style="font-size:12px;vertical-align:middle;">description</i> Fuente: ${m.proyecto.pdf}</p>
    </div>
    <div style="padding:60px 20px;text-align:center;">
      <div class="spinner" style="margin:0 auto;"></div>
      <p style="margin-top:16px;color:#718096;font-size:13px;">Cargando detalles...</p>
    </div>
  `;

  document.getElementById('detailModal').classList.add('open');
  document.body.style.overflow = 'hidden';

  // Llamada local sincrónica (con un pequeño delay para que se vea el spinner)
  setTimeout(() => {
    try {
      const response = getMaterialDetalle(id);
      if (!response || !response.success) {
        document.getElementById('modalBody').innerHTML = `
          <div class="detail-header">
            <span class="mc-badge" style="background:${m.tipo.color}">${m.tipo.nombre} · ${m.codigo}</span>
            <h2>${m.nombre}</h2>
            <p class="en-name">${m.nombreEN}</p>
          </div>
          <div class="info-msg">❌ Error al cargar detalles: ${(response && response.error) || 'Error'}</div>
        `;
        return;
      }
      CURRENT_DETALLE = response;
      renderModalBody();
    } catch (err) {
      document.getElementById('modalBody').innerHTML = `
        <div class="detail-header">
          <span class="mc-badge" style="background:${m.tipo.color}">${m.tipo.nombre} · ${m.codigo}</span>
          <h2>${m.nombre}</h2>
        </div>
        <div class="info-msg">❌ Error de conexión: ${err.message || 'Error'}</div>
      `;
    }
  }, 50);
}

function closeModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('detailModal').classList.remove('open');
  document.body.style.overflow = '';
  CURRENT_MATERIAL = null;
  CURRENT_DETALLE = null;
}

function renderModalBody() {
  const m = CURRENT_MATERIAL;
  const d = CURRENT_DETALLE;
  if (!d) return;

  const hasEspec = d.especificaciones && d.especificaciones.length > 0;
  const hasGran = d.granulometria && d.granulometria.length > 0;
  const hasColoc = d.metodosColocacion && d.metodosColocacion.length > 0;
  const hasFrec = d.frecuencias && d.frecuencias.length > 0;

  let activeTab = 'espec';
  if (!hasEspec && hasGran) activeTab = 'gran';
  else if (!hasEspec && !hasGran && hasColoc) activeTab = 'coloc';
  else if (!hasEspec && !hasGran && !hasColoc && hasFrec) activeTab = 'frec';

  document.getElementById('modalBody').innerHTML = `
    <div class="detail-header">
      <span class="mc-badge" style="background:${m.tipo.color}">${m.tipo.nombre} · ${m.codigo}</span>
      <h2>${m.nombre}</h2>
      <p class="en-name">${m.nombreEN}</p>
      <div class="detail-tags">
        <span class="detail-tag"><i class="material-icons">folder</i>${m.proyecto.codigo} · ${m.proyecto.revision}</span>
        <span class="detail-tag"><i class="material-icons">event</i>${m.proyecto.fecha}</span>
        <span class="detail-tag"><i class="material-icons">bookmark</i>Sección ${m.seccion}</span>
        ${m.zona && m.zona !== '-' ? `<span class="detail-tag"><i class="material-icons">place</i>Zona ${m.zona}</span>` : ''}
      </div>
      ${m.observaciones ? `<p style="margin-top:12px;font-size:13px;color:#4a5568;padding:10px;background:#f7fafc;border-radius:8px;">${linkificar(m.observaciones)}</p>` : ''}
      <p style="margin-top:12px;font-size:11px;color:#a0aec0;"><i class="material-icons" style="font-size:12px;vertical-align:middle;">description</i> Fuente: ${m.proyecto.pdf}</p>
    </div>

    <div class="modal-tabs">
      <button class="modal-tab ${activeTab==='espec'?'active':''}" onclick="showTab('espec',this)">
        <i class="material-icons">science</i> Especificaciones ${!hasEspec?'<span style="color:#a0aec0;font-size:11px;">(vacío)</span>':''}
      </button>
      <button class="modal-tab ${activeTab==='gran'?'active':''}" onclick="showTab('gran',this)">
        <i class="material-icons">show_chart</i> Granulometría ${!hasGran?'<span style="color:#a0aec0;font-size:11px;">(vacío)</span>':''}
      </button>
      <button class="modal-tab ${activeTab==='coloc'?'active':''}" onclick="showTab('coloc',this)">
        <i class="material-icons">engineering</i> Colocación ${!hasColoc?'<span style="color:#a0aec0;font-size:11px;">(vacío)</span>':''}
      </button>
      <button class="modal-tab ${activeTab==='frec'?'active':''}" onclick="showTab('frec',this)">
        <i class="material-icons">schedule</i> Frecuencias ${!hasFrec?'<span style="color:#a0aec0;font-size:11px;">(vacío)</span>':''}
      </button>
    </div>

    <div id="tab-espec" class="tab-panel ${activeTab==='espec'?'active':''}">${renderEspec(d.especificaciones)}</div>
    <div id="tab-gran" class="tab-panel ${activeTab==='gran'?'active':''}">${renderGran(d)}</div>
    <div id="tab-coloc" class="tab-panel ${activeTab==='coloc'?'active':''}">${renderColoc(d.metodosColocacion)}</div>
    <div id="tab-frec" class="tab-panel ${activeTab==='frec'?'active':''}">${renderFrec(d.frecuencias)}</div>
  `;
}

function showTab(tab, btn) {
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-'+tab).classList.add('active');
}

// ============================================================
// RENDER: ESPECIFICACIONES
// ============================================================
function renderEspec(items) {
  if (!items || items.length === 0) return '<div class="info-msg">📋 Sin especificaciones</div>';
  return `<table class="detail-table">
    <thead><tr><th>Parámetro</th><th>Valor</th><th>Unidad</th><th>Mín.</th><th>Máx.</th></tr></thead>
    <tbody>${items.map(i => `<tr>
      <td><strong>${i.Parametro||'-'}</strong></td>
      <td class="val">${linkificar(String(i.Valor||'—'))}</td>
      <td>${i.Unidad && i.Unidad!=='-' ? i.Unidad : '—'}</td>
      <td>${i.Minimo!=='-' && i.Minimo!=='' ? i.Minimo : '—'}</td>
      <td>${i.Maximo!=='-' && i.Maximo!=='' ? i.Maximo : '—'}</td>
    </tr>`).join('')}</tbody></table>`;
}

// ============================================================
// RENDER: GRANULOMETRÍA
// ============================================================
function renderGran(d) {
  const vars = d.granulometria;
  if (!vars || vars.length === 0) return '<div class="info-msg">📊 Sin granulometría</div>';

  const notas = d.notasGranulometria || {};
  const hasMulti = vars.length > 1;

  let html = '';
  if (hasMulti) {
    html += '<div class="variantes-tabs">';
    vars.forEach((v,i) => {
      html += `<button class="variante-tab ${i===0?'active':''}" data-vid="${v.VarianteID}" onclick="switchVar('${v.VarianteID}',this)" style="background:${i===0?'#2b6cb0':'#edf2f7'};color:${i===0?'white':'#2d3748'};border:2px solid transparent;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:inherit;">${v.VarianteNombre}</button>`;
    });
    html += '</div>';
  }
  html += `<div id="granContent">${renderVar(vars[0], notas)}</div>`;
  return html;
}

function switchVar(vid, btn) {
  document.querySelectorAll('.variante-tab').forEach(t => {
    t.classList.remove('active');
    t.style.background='#edf2f7';
    t.style.color='#2d3748';
  });
  btn.classList.add('active');
  btn.style.background='#2b6cb0';
  btn.style.color='white';

  const v = CURRENT_DETALLE.granulometria.find(x => x.VarianteID === vid);
  document.getElementById('granContent').innerHTML = renderVar(v, CURRENT_DETALLE.notasGranulometria||{});
}

function renderVar(v, notas) {
  const items = v.Items || [];
  const hasMasa = items.some(i => i.MasaTipica_kg !== '' && i.MasaTipica_kg !== null && i.MasaTipica_kg !== undefined);
  const notasVar = notas[v.VarianteID] || notas['UNICA'] || [];

  let html = `<table class="detail-table">
    <thead><tr><th>Malla</th><th>Tamaño (mm)</th><th>% Pasa Máx.</th><th>% Pasa Mín.</th>${hasMasa?'<th>Masa (kg)</th>':''}</tr></thead>
    <tbody>${items.map(i => `<tr>
      <td><strong>${i.Malla||'-'}</strong></td>
      <td style="font-family:monospace;text-align:center;">${i.Tamano_mm||'-'}</td>
      <td style="color:#2b6cb0;font-weight:700;text-align:center;">${i.PasaMax}%</td>
      <td style="color:#38a169;font-weight:700;text-align:center;">${i.PasaMin}%</td>
      ${hasMasa?`<td style="text-align:center;font-weight:600;color:#805ad5;">${i.MasaTipica_kg||'—'}</td>`:''}
    </tr>`).join('')}</tbody></table>`;

  if (notasVar.length > 0) {
    html += '<div class="notas-box">';
    notasVar.forEach(n => {
      const w = /rechazo|incumplimiento|obligatorio|⚠️/i.test(n.Texto||'');
      html += `<div class="nota-item ${w?'warning':''}"><i class="material-icons">${w?'warning':'info'}</i><div>${linkificar(n.Texto||'')}</div></div>`;
    });
    html += '</div>';
  }
  return html;
}

// ============================================================
// RENDER: COLOCACIÓN
// ============================================================
function renderColoc(items) {
  if (!items || items.length === 0) {
    return '<div class="info-msg">🔧 Sin métodos de colocación registrados</div>';
  }
  return items.map(item => `
    <div class="coloc-item">
      <div class="coloc-header">
        <i class="material-icons">${getIconoColoc(item.Aspecto)}</i>
        <span>${item.Aspecto || 'Aspecto'}</span>
      </div>
      <div class="coloc-desc">${linkificar(item.Descripcion || '')}</div>
    </div>
  `).join('');
}

function getIconoColoc(aspecto) {
  if (!aspecto) return 'info';
  const a = aspecto.toLowerCase();
  if (a.includes('espesor') || a.includes('capa')) return 'straighten';
  if (a.includes('compact') || a.includes('pasada')) return 'compress';
  if (a.includes('densidad')) return 'speed';
  if (a.includes('humedad')) return 'water_drop';
  if (a.includes('precauc') || a.includes('cuidar')) return 'warning';
  if (a.includes('temperatura')) return 'thermostat';
  if (a.includes('curado')) return 'hourglass_empty';
  if (a.includes('junta')) return 'join_inner';
  if (a.includes('aplicac') || a.includes('uso')) return 'place';
  if (a.includes('control') || a.includes('ensayo') || a.includes('prueba')) return 'fact_check';
  if (a.includes('método')) return 'build';
  if (a.includes('weep')) return 'water';
  if (a.includes('fijación') || a.includes('anclaje')) return 'anchor';
  return 'info';
}

// ============================================================
// RENDER: FRECUENCIAS
// ============================================================
function renderFrec(items) {
  if (!items || items.length === 0) return '<div class="info-msg">⏰ Sin frecuencias</div>';
  return `<table class="detail-table">
    <thead><tr><th>Tipo</th><th>Método</th><th>Frecuencia</th><th>Unidad</th></tr></thead>
    <tbody>${items.map(f => `<tr>
      <td><strong>${f.TipoPrueba||'-'}</strong></td>
      <td class="met">${f.MetodoASTM||'-'}</td>
      <td class="val">1 / ${f.Frecuencia||'-'}</td>
      <td>${f.Unidad||'-'}</td>
    </tr>`).join('')}</tbody></table>`;
}

// ============================================================
// LINKS CLICKEABLES
// ============================================================
function linkificar(texto) {
  if (!texto || typeof texto !== 'string') return texto;

  const patrones = [];

  Object.keys(REFERENCIAS_MAP)
    .sort((a,b) => b.length - a.length)
    .forEach(r => patrones.push({ tipo: 'ref', patron: r, id: REFERENCIAS_MAP[r] }));

  Object.keys(CODIGOS_MAP)
    .sort((a,b) => b.length - a.length)
    .forEach(c => patrones.push({ tipo: 'code', patron: c, id: CODIGOS_MAP[c] }));

  if (patrones.length === 0) return texto;

  const re = new RegExp(
    patrones.map(p => p.patron.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
    'g'
  );

  return texto.replace(re, (match) => {
    const found = patrones.find(p => p.patron === match);
    if (!found) return match;

    if (CURRENT_MATERIAL && String(CURRENT_MATERIAL.id) === String(found.id)) {
      return match;
    }

    const clase = found.tipo === 'ref' ? 'material-link ref-link' : 'material-link';
    const titulo = found.tipo === 'ref'
      ? ' title="Ir al material TMF equivalente"'
      : '';

    return `<a href="#" class="${clase}"${titulo} onclick="event.preventDefault();navTo(${found.id});return false;">${match}</a>`;
  });
}

// ============================================================
// NAVEGACIÓN
// ============================================================
function navTo(id) {
  const destino = DATASET.materiales.find(m => m.id === id);
  closeModal();

  setTimeout(() => {
    if (destino && destino.proyecto && destino.proyecto.id !== CURRENT_PROJECT) {
      selectProject(destino.proyecto.id);
    }
    setTimeout(() => openModal(id), 200);
  }, 250);
}
