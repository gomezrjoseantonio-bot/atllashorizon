import { getProperties, getLoans, getAccounts, getReal } from '../storage.js';
import { fmtEUR, fmtDateISO } from '../utils.js';

console.log('Loading ATLAS dashboard view module');

const view = {
  route: '#/dashboard',
  title: 'Dashboard',
  
  async mount(root) {
    const properties = getProperties();
    const loans = getLoans();
    const accounts = getAccounts();
    const realTransactions = getReal();
    
    // Calculate global metrics
    const totalProperties = properties.length;
    const totalRentalIncome = properties.reduce((sum, prop) => {
      if (prop.rentalType === 'rooms' && prop.rooms) {
        return sum + prop.rooms.filter(r => r.occupied).reduce((roomSum, room) => roomSum + (parseFloat(room.rent) || 0), 0);
      }
      return sum + (parseFloat(prop.monthlyRent) || 0);
    }, 0);
    
    const totalPropertyValue = properties.reduce((sum, prop) => sum + (parseFloat(prop.purchaseValue) || 0), 0);
    const totalLoanAmount = loans.reduce((sum, loan) => sum + (parseFloat(loan.principal) || 0), 0);
    
    // Calculate vacancy alerts
    const vacancyAlerts = [];
    properties.forEach(prop => {
      if (prop.rentalType === 'rooms' && prop.rooms) {
        const vacantRooms = prop.rooms.filter(r => !r.occupied);
        vacantRooms.forEach(room => {
          vacancyAlerts.push(`Habitación libre en ${prop.address || 'Propiedad'} - Pérdida: ${fmtEUR(parseFloat(room.rent) || 0)}/mes`);
        });
      } else if (!prop.occupied) {
        vacancyAlerts.push(`Propiedad libre: ${prop.address || 'Sin dirección'} - Pérdida: ${fmtEUR(parseFloat(prop.monthlyRent) || 0)}/mes`);
      }
    });
    
    // Calculate treasury by accounts
    const treasuryByAccount = accounts.map(account => {
      const accountTransactions = realTransactions.filter(t => t.bank === account.id);
      const balance = accountTransactions.reduce((sum, t) => sum + t.amount, 0);
      return {
        ...account,
        balance
      };
    });
    
    root.innerHTML = `
      <div class="row">
        <div class="col">
          <div class="card">
            <h1>Dashboard ATLAS</h1>
            <div class="muted">Panel de control de inversiones inmobiliarias</div>
          </div>
        </div>
      </div>
      
      <!-- Global Metrics Cards -->
      <div class="row">
        <div class="col">
          <div class="card">
            <h2 style="color:var(--primary); display:flex; align-items:center; gap:8px; margin:0 0 15px 0;">
              <svg style="width:20px; height:20px; fill:currentColor;" viewBox="0 0 24 24">
                <path d="M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2.5 2.25L12 15.5l-7.5 3.75v-2.5L12 13l7.5 3.75v2.5z"/>
              </svg>
              Rentabilidad Global
            </h2>
            <div class="kpi" style="color:var(--primary);">${((totalRentalIncome * 12 / totalPropertyValue) * 100).toFixed(2)}%</div>
            <div class="small muted">Rentabilidad bruta anual</div>
            <div style="margin-top:10px;">
              <div><strong>Ingresos anuales:</strong> ${fmtEUR(totalRentalIncome * 12)}</div>
              <div><strong>Valor total inmuebles:</strong> ${fmtEUR(totalPropertyValue)}</div>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card">
            <h2 style="color:var(--secondary); display:flex; align-items:center; gap:8px; margin:0 0 15px 0;">
              <svg style="width:20px; height:20px; fill:currentColor;" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              Cashflow Global
            </h2>
            <div class="kpi text-success">${fmtEUR(totalRentalIncome)}</div>
            <div class="small muted">Ingresos mensuales actuales</div>
            <div style="margin-top:10px;">
              <div><strong>Propiedades activas:</strong> ${totalProperties}</div>
              <div><strong>Deuda total:</strong> ${fmtEUR(totalLoanAmount)}</div>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card">
            <h2 style="color:var(--primary); display:flex; align-items:center; gap:8px; margin:0 0 15px 0;">
              <svg style="width:20px; height:20px; fill:currentColor;" viewBox="0 0 24 24">
                <path d="M2 4v16h20V4H2zm18 14H4V6h16v12zm-10-2h8V8h-8v8zm2-6h4v4h-4v-4z"/>
              </svg>
              Tesorería
            </h2>
            <div class="kpi" style="color:var(--primary);">${fmtEUR(treasuryByAccount.reduce((sum, acc) => sum + acc.balance, 0))}</div>
            <div class="small muted">Saldo total disponible</div>
            <div style="margin-top:10px;">
              ${treasuryByAccount.map(acc => `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                  <span>${acc.name}:</span>
                  <span class="${acc.balance >= acc.threshold ? 'text-success' : 'text-danger'}">${fmtEUR(acc.balance)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
      
      <!-- Cashflow Chart Placeholder -->
      <div class="row">
        <div class="col">
          <div class="card">
            <h2 style="color:var(--primary); display:flex; align-items:center; gap:8px; margin:0 0 15px 0;">
              <svg style="width:20px; height:20px; fill:currentColor;" viewBox="0 0 24 24">
                <path d="M5 3v4h8V3h6v18h-6v-4H5v4H1V3h4zm6 6H3v6h8V9z"/>
              </svg>
              Evolución Cashflow
            </h2>
            <div class="muted">Gráfico de flujo de caja mensual (próximamente con Chart.js)</div>
            <div style="height:200px; background:var(--card); border:1px dashed var(--border); border-radius:8px; display:flex; align-items:center; justify-content:center; margin-top:15px;">
              <span class="muted">Gráfico de barras: Ingresos vs Gastos por mes</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Quick Actions -->
      <div class="row">
        <div class="col">
          <div class="card">
            <h2 style="color:var(--primary); display:flex; align-items:center; gap:8px; margin:0 0 15px 0;">
              <svg style="width:20px; height:20px; fill:currentColor;" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              Acciones Rápidas
            </h2>
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:15px;">
              <button class="primary" onclick="location.hash='#/inmuebles'">+ Añadir Inmueble</button>
              <button class="primary" onclick="location.hash='#/loans'">Gestionar Préstamos</button>
              <button class="secondary" onclick="generateReports()" style="display:flex; align-items:center; gap:6px;">
                <svg style="width:16px; height:16px; fill:currentColor;" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
                Generar Informes
              </button>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card">
            <h2 style="color:var(--error); display:flex; align-items:center; gap:8px; margin:0 0 15px 0;">
              <svg style="width:20px; height:20px; fill:currentColor;" viewBox="0 0 24 24">
                <path d="M12 2L2 7v10c0 5.55 3.84 9.4 9 11 5.16-1.6 9-5.45 9-11V7l-10-5z"/>
              </svg>
              Alertas
            </h2>
            <div style="margin-top:15px;">
              ${vacancyAlerts.length > 0 ? vacancyAlerts.map(alert => `
                <div style="background:color-mix(in srgb, var(--error) 10%, transparent); border:1px solid var(--error); border-radius:8px; padding:12px; margin-bottom:12px; display:flex; align-items:flex-start; gap:12px;">
                  <svg style="width:18px; height:18px; flex-shrink:0; fill:var(--error); margin-top:2px;" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  <div style="flex:1;">
                    <div style="font-weight:500; color:var(--error); margin-bottom:4px;">Vacante detectada</div>
                    <div style="color:var(--text-primary); line-height:1.4;">${alert}</div>
                  </div>
                </div>
              `).join('') : '<div class="muted">No hay alertas pendientes</div>'}
              
              ${treasuryByAccount.filter(acc => acc.balance < acc.threshold).map(acc => `
                <div style="background:color-mix(in srgb, var(--warning) 10%, transparent); border:1px solid var(--warning); border-radius:8px; padding:12px; margin-bottom:12px; display:flex; align-items:flex-start; gap:12px;">
                  <svg style="width:18px; height:18px; flex-shrink:0; fill:var(--warning); margin-top:2px;" viewBox="0 0 24 24">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                  </svg>
                  <div style="flex:1;">
                    <div style="font-weight:500; color:var(--warning); margin-bottom:4px;">Saldo bajo</div>
                    <div style="color:var(--text-primary); line-height:1.4;">
                      ${acc.name}: ${fmtEUR(acc.balance)} (umbral: ${fmtEUR(acc.threshold)})
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
      
      <!-- Properties Summary -->
      ${totalProperties > 0 ? `
      <div class="row">
        <div class="col">
          <div class="card">
            <h2 style="color:var(--primary); display:flex; align-items:center; gap:8px; margin:0 0 15px 0;">
              <svg style="width:20px; height:20px; fill:currentColor;" viewBox="0 0 24 24">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
              Resumen de Propiedades
            </h2>
            <div class="grid" style="margin-top:15px;">
              <table>
                <thead>
                  <tr>
                    <th>Propiedad</th>
                    <th>Tipo</th>
                    <th>Ingresos Mensuales</th>
                    <th>Estado</th>
                    <th>Rentabilidad</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${properties.map(prop => {
                    const monthlyIncome = prop.rentalType === 'rooms' && prop.rooms ? 
                      prop.rooms.filter(r => r.occupied).reduce((sum, room) => sum + (parseFloat(room.rent) || 0), 0) :
                      parseFloat(prop.monthlyRent) || 0;
                    const grossYield = prop.purchaseValue ? ((monthlyIncome * 12 / prop.purchaseValue) * 100) : 0;
                    const occupancyRate = prop.rentalType === 'rooms' && prop.rooms ? 
                      (prop.rooms.filter(r => r.occupied).length / prop.rooms.length * 100) : 
                      (monthlyIncome > 0 ? 100 : 0);
                    
                    return `
                      <tr>
                        <td>${prop.address || 'Sin dirección'}</td>
                        <td>${prop.rentalType === 'rooms' ? `Habitaciones (${prop.rooms?.length || 0})` : 'Piso completo'}</td>
                        <td class="text-success" style="font-weight:600;">${fmtEUR(monthlyIncome)}</td>
                        <td>
                          <span class="badge ${occupancyRate === 100 ? 'success' : occupancyRate > 50 ? 'warning' : 'danger'}">
                            ${occupancyRate.toFixed(0)}% ocupado
                          </span>
                        </td>
                        <td>${grossYield.toFixed(2)}%</td>
                        <td>
                          <button onclick="location.hash='#/inmuebles'" style="font-size:12px; padding:4px 8px;">Ver</button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      ` : ''}
    `;
    
    // Setup event handlers
    setupEventHandlers();
  }
};

function setupEventHandlers() {
  // Global functions for button handlers
  window.generateReports = function() {
    alert('Funcionalidad de informes en desarrollo. Próximamente exportación a Excel/PDF.');
  };
}

export default view;