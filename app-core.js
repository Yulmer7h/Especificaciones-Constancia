// app-core.js — Réplica navegador de Code.gs

const HEADERS = {
  PROYECTOS:       ['ProyectoID','Codigo','Nombre','Revision','Fecha','FuentePDF'],
  CATEGORIAS:      ['CategoriaID','ProyectoID','Nombre','Icono','Orden'],
  TIPOS:           ['TipoID','Codigo','Nombre','Color'],
  MATERIALES:      ['MaterialID','Codigo','Nombre','NombreEN','TipoID','ProyectoID','CategoriaID','Seccion','Zona','Estado','Observaciones'],
  ESPECIFICACIONES:['MaterialID','Parametro','Valor','Unidad','Minimo','Maximo','Orden'],
  GRANULOMETRIA:   ['MaterialID','VarianteID','VarianteNombre','Malla','Tamano_mm','PasaMax','PasaMin','MasaTipica_kg','Orden'],
  NOTAS_GRAN:      ['MaterialID','VarianteID','Orden','Texto'],
  FRECUENCIAS:     ['MaterialID','TipoPrueba','MetodoASTM','Frecuencia','Unidad','Orden'],
  METODOS:         ['MaterialID','Aspecto','Descripcion','Orden'],
  CONFIG:          ['Clave','Valor']
};

const REFERENCIAS_REV2 = {
  '4.8.4.1':1, '4.8.4.2':2, '4.8.4.3':3, '4.8.4.4':4, '4.8.4.5':5,
  '4.8.4.5.1':6, '4.8.4.5.2':7, '4.8.4.5.3':8,
  '4.8.4.6.1':9, '4.8.4.6.2':10, '4.8.4.6.3':11,
  '4.8.4.7.1':12, '4.8.4.7.2':13, '4.8.4.7.3':14,
  '4.8.4.7.4':15, '4.8.4.7.5':16, '4.8.4.7.6':17,
  '4.8.4.8':18, '4.8.4.9':19, '4.8.4.10':22, '4.8.4.11':23,
  '4.8.4.12':24, '4.8.4.13':25, '4.8.4.14':27, '4.8.4.15':28,
  '4.8.4.16':29, '4.8.4.17':30, '4.8.4.18':31, '4.8.4.19':32,
  '4.8.4.20':33, '4.8.4.21':37, '4.8.4.22':40, '4.8.4.23':41,
  '4.8.4.24':42, '4.8.4.25':43
};

function rowsToObjects(headers, rows) {
  return rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i] !== undefined ? row[i] : '');
    return obj;
  });
}

let _datasetLigero = null;
const _detalleCache = {};

function getMaterialesLigeros() {
  if (_datasetLigero) return _datasetLigero;

  const proyectos  = rowsToObjects(HEADERS.PROYECTOS,  DATA_PROYECTOS);
  const categorias = rowsToObjects(HEADERS.CATEGORIAS, DATA_CATEGORIAS);
  const tipos      = rowsToObjects(HEADERS.TIPOS,      DATA_TIPOS);
  const materiales = rowsToObjects(HEADERS.MATERIALES, DATA_MATERIALES);
  const config     = rowsToObjects(HEADERS.CONFIG,     DATA_CONFIG);

  const mapProy  = {}; proyectos.forEach(p => mapProy[p.ProyectoID] = p);
  const mapCat   = {}; categorias.forEach(c => mapCat[c.CategoriaID] = c);
  const mapTipos = {}; tipos.forEach(t => mapTipos[t.TipoID] = t);

  const dataset = materiales.map(m => {
    const proy = mapProy[m.ProyectoID] || {};
    const cat  = mapCat[m.CategoriaID]  || {};
    const tipo = mapTipos[m.TipoID]     || {};
    return {
      id: m.MaterialID,
      codigo: m.Codigo || '',
      nombre: m.Nombre || '',
      nombreEN: m.NombreEN || '',
      zona: m.Zona || '',
      estado: m.Estado || 'Activo',
      observaciones: m.Observaciones || '',
      seccion: m.Seccion || '',
      proyecto: {
        id: proy.ProyectoID || '', codigo: proy.Codigo || '',
        nombre: proy.Nombre || '', revision: proy.Revision || '',
        fecha: proy.Fecha || '', pdf: proy.FuentePDF || ''
      },
      categoria: {
        id: cat.CategoriaID || '', nombre: cat.Nombre || 'Sin categoría',
        icono: cat.Icono || 'folder', orden: Number(cat.Orden) || 999
      },
      tipo: {
        id: tipo.TipoID || '', codigo: tipo.Codigo || '',
        nombre: tipo.Nombre || 'Sin tipo', color: tipo.Color || '#718096'
      }
    };
  });

  const proyectosMap = {};
  dataset.forEach(m => {
    const pid = m.proyecto.id;
    if (!pid) return;
    if (!proyectosMap[pid]) {
      proyectosMap[pid] = {
        id: pid, codigo: m.proyecto.codigo, nombre: m.proyecto.nombre,
        revision: m.proyecto.revision, fecha: m.proyecto.fecha,
        pdf: m.proyecto.pdf, categorias: {}, totalMateriales: 0
      };
    }
    proyectosMap[pid].totalMateriales++;
    const cid = m.categoria.id || 'SIN_CAT';
    if (!proyectosMap[pid].categorias[cid]) {
      proyectosMap[pid].categorias[cid] = {
        id: cid, nombre: m.categoria.nombre,
        icono: m.categoria.icono, orden: m.categoria.orden, materiales: []
      };
    }
    proyectosMap[pid].categorias[cid].materiales.push(m);
  });

  const proyectosOrdenados = Object.values(proyectosMap).map(p => ({
    ...p,
    categorias: Object.values(p.categorias).sort((a,b) => a.orden - b.orden)
  })).sort((a,b) => a.codigo.localeCompare(b.codigo));

  const configObj = {};
  config.forEach(c => configObj[c.Clave] = c.Valor);

  _datasetLigero = {
    success: true,
    proyectos: proyectosOrdenados,
    materiales: dataset,
    config: configObj,
    referencias: REFERENCIAS_REV2,
    total: dataset.length
  };
  return _datasetLigero;
}

function getMaterialDetalle(materialId) {
  const id = String(materialId);
  if (_detalleCache[id]) return _detalleCache[id];

  const especificaciones = rowsToObjects(HEADERS.ESPECIFICACIONES, DATA_ESPECIFICACIONES)
    .filter(e => String(e.MaterialID) === id)
    .sort((a,b) => (Number(a.Orden)||0) - (Number(b.Orden)||0));

  const frecuencias = rowsToObjects(HEADERS.FRECUENCIAS, DATA_FRECUENCIAS)
    .filter(f => String(f.MaterialID) === id)
    .sort((a,b) => (Number(a.Orden)||0) - (Number(b.Orden)||0));

  const metodos = rowsToObjects(HEADERS.METODOS, DATA_METODOS)
    .filter(mt => String(mt.MaterialID) === id)
    .sort((a,b) => (Number(a.Orden)||0) - (Number(b.Orden)||0));

  const granRaw = rowsToObjects(HEADERS.GRANULOMETRIA, DATA_GRANULOMETRIA)
    .filter(g => String(g.MaterialID) === id);

  const notasRaw = rowsToObjects(HEADERS.NOTAS_GRAN, DATA_NOTAS_GRAN)
    .filter(n => String(n.MaterialID) === id);

  const mapGran = {};
  granRaw.forEach(g => {
    const vKey = g.VarianteID || 'UNICA';
    if (!mapGran[vKey]) {
      mapGran[vKey] = {
        VarianteID: vKey,
        VarianteNombre: g.VarianteNombre || 'Huso Granulométrico',
        Items: []
      };
    }
    mapGran[vKey].Items.push(g);
  });
  Object.values(mapGran).forEach(v => {
    v.Items.sort((a,b) => (Number(a.Orden)||0) - (Number(b.Orden)||0));
  });

  const mapNotas = {};
  notasRaw.forEach(n => {
    const vKey = n.VarianteID || 'UNICA';
    if (!mapNotas[vKey]) mapNotas[vKey] = [];
    mapNotas[vKey].push(n);
  });
  Object.values(mapNotas).forEach(arr => {
    arr.sort((a,b) => (Number(a.Orden)||0) - (Number(b.Orden)||0));
  });

  const resultado = {
    success: true, id,
    especificaciones, frecuencias,
    metodosColocacion: metodos,
    granulometria: Object.values(mapGran),
    notasGranulometria: mapNotas
  };
  _detalleCache[id] = resultado;
  return resultado;
}
