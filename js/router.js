// Router muy simple + registro de vistas en el menú
import viewHoy from './views/view-hoy.js';
import viewConfig from './views/view-config.js';
import viewLoans from './views/view-loans.js';
import viewCalculator from './views/view-calculator.js';
import viewExport from './views/view-export.js';
import viewInmuebles from './views/view-inmuebles-complex.js';

const VIEWS = [viewHoy, viewInmuebles, viewLoans, viewCalculator, viewExport, viewConfig];

function currentRoute(){ return location.hash || '#/hoy'; }

async function render(){
  const root = document.getElementById('app');
  if(!root){ console.error('#app no existe'); return; }
  const route = currentRoute();
  const found = VIEWS.find(v => v.route === route) || viewHoy;
  await found.mount(root);
  highlight(route);
}

function buildMenu(){
  const el = document.getElementById('menu');
  if(!el) return;
  el.innerHTML = VIEWS.map(v => `<a href='${v.route}' class='nav' data-route='${v.route}'>${v.title}</a>`).join('');
}

function highlight(route){
  document.querySelectorAll('#menu .nav').forEach(a=>{
    if(a.getAttribute('data-route')===route) a.classList.add('active');
    else a.classList.remove('active');
  });
}

export function mount(){
  buildMenu();
  render();
  window.addEventListener('hashchange', render);
}
