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
            <h2 style="color:var(--accent);">📊 Rentabilidad Global</h2>
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
            <h2 style="color:var(--accent);">💰 Cashflow Global</h2>
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
            <h2 style="color:var(--accent);">🏦 Tesorería</h2>
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
            <h2 style="color:var(--primary);">📈 Evolución Cashflow</h2>
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
            <h2 style="color:var(--primary);">⚡ Acciones Rápidas</h2>
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:15px;">
              <button class="primary" onclick="location.hash='#/inmuebles'">+ Añadir Inmueble</button>
              <button class="primary" onclick="location.hash='#/loans'">Gestionar Préstamos</button>
              <button class="secondary" onclick="generateReports()">📊 Generar Informes</button>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card">
            <h2 class="text-danger">🚨 Alertas</h2>
            <div style="margin-top:15px;">
              ${vacancyAlerts.length > 0 ? vacancyAlerts.map(alert => `
                <div class="badge danger" style="display:block; margin-bottom:8px; padding:12px; text-align:left;">
                  ${alert}
                </div>
              `).join('') : '<div class="muted">No hay alertas pendientes</div>'}
              
              ${treasuryByAccount.filter(acc => acc.balance < acc.threshold).map(acc => `
                <div class="badge danger" style="display:block; margin-bottom:8px; padding:12px; text-align:left;">
                  Saldo bajo en ${acc.name}: ${fmtEUR(acc.balance)} (umbral: ${fmtEUR(acc.threshold)})
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
            <h2 style="color:var(--primary);">🏠 Resumen de Propiedades</h2>
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