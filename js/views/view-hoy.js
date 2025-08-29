import { getProperties, getLoans, getAccounts, getReal } from '../storage.js'; 
import { fmtEUR } from '../utils.js';

const view = {
  route:'#/hoy', title:'Dashboard',
  async mount(root){
    const properties = getProperties();
    const loans = getLoans();
    const accounts = getAccounts();
    const transactions = getReal();
    
    // Calculate portfolio metrics
    const totalProperties = properties.length;
    const totalRentalIncome = properties.reduce((sum, prop) => sum + (prop.monthlyRent || 0), 0);
    const totalMortgagePayments = loans.reduce((sum, loan) => {
      if (loan.associatedProperty) {
        // Simple monthly payment calculation
        const monthlyPayment = loan.principal * (loan.annualRate / 100 / 12) / (1 - Math.pow(1 + (loan.annualRate / 100 / 12), -loan.years * 12));
        return sum + monthlyPayment;
      }
      return sum;
    }, 0);
    
    const netCashFlow = totalRentalIncome - totalMortgagePayments;
    const totalPortfolioValue = properties.reduce((sum, prop) => sum + (prop.purchaseValue || 0), 0);
    const grossYield = totalPortfolioValue > 0 ? (totalRentalIncome * 12 / totalPortfolioValue * 100) : 0;
    
    // Account balances
    const accountBalances = accounts.map(account => {
      const balance = transactions
        .filter(t => t.bank === account.id)
        .reduce((sum, t) => sum + t.amount, 0);
      return { ...account, balance };
    });
    
    // Property alerts
    const alerts = [];
    properties.forEach(prop => {
      if (prop.rooms) {
        const vacantRooms = prop.rooms.filter(room => !room.isOccupied);
        if (vacantRooms.length > 0) {
          alerts.push({
            type: 'vacancy',
            message: `${vacantRooms.length} habitación(es) vacante(s) en ${prop.address || prop.city}`,
            level: 'warning'
          });
        }
      }
    });
    
    // Low balance alerts
    accountBalances.forEach(account => {
      if (account.balance < (account.threshold || 200)) {
        alerts.push({
          type: 'balance',
          message: `Saldo bajo en ${account.name}: ${fmtEUR(account.balance)} (umbral: ${fmtEUR(account.threshold || 200)})`,
          level: account.balance < 0 ? 'danger' : 'warning'
        });
      }
    });
    
    // Create alerts section
    const alertsHtml = alerts.length > 0 ? `
      <div class="row">
        <div class="col">
          <div class="card" style="border-left:4px solid ${alerts.some(a=>a.level==='danger')?'#ef4444':'#f59e0b'}">
            <h2>⚠️ Alertas</h2>
            ${alerts.map(alert => `
              <div class="small" style="color:${alert.level==='danger'?'#ef4444':'#f59e0b'};margin-bottom:4px">
                ${alert.message}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    ` : '';
    
    // Property cards
    const propertyCards = properties.slice(0, 3).map(prop => {
      const loan = loans.find(l => l.associatedProperty === prop.id);
      const monthlyPayment = loan ? loan.principal * (loan.annualRate / 100 / 12) / (1 - Math.pow(1 + (loan.annualRate / 100 / 12), -loan.years * 12)) : 0;
      const propCashFlow = (prop.monthlyRent || 0) - monthlyPayment;
      const propYield = prop.purchaseValue > 0 ? ((prop.monthlyRent || 0) * 12 / prop.purchaseValue * 100) : 0;
      
      return `<div class="col">
        <div class="card">
          <h3>${prop.address || prop.city || 'Inmueble'}</h3>
          <div class="small muted">${prop.city || ''}</div>
          <div style="margin:8px 0">
            <div class="small">Alquiler mensual: <strong>${fmtEUR(prop.monthlyRent || 0)}</strong></div>
            <div class="small">Cuota hipoteca: <strong>${fmtEUR(monthlyPayment)}</strong></div>
            <div class="small" style="color:${propCashFlow >= 0 ? 'var(--accent)' : '#ef4444'}">
              Cashflow: <strong>${fmtEUR(propCashFlow)}</strong>
            </div>
            <div class="small">Rentabilidad bruta: <strong>${propYield.toFixed(1)}%</strong></div>
          </div>
          ${prop.rooms && prop.rooms.length > 0 ? `
            <div class="small muted">
              Habitaciones: ${prop.rooms.filter(r => r.isOccupied).length}/${prop.rooms.length} ocupadas
            </div>
          ` : ''}
        </div>
      </div>`;
    }).join('');
    
    root.innerHTML = `
      <div class="row">
        <div class="col"><div class="card">
          <h1>Dashboard</h1>
          <div class="muted">Resumen ejecutivo de tu cartera inmobiliaria</div>
        </div></div>
      </div>
      ${alertsHtml}
      <div class="row">
        <div class="col"><div class="card">
          <h2>Ingresos por Alquiler</h2>
          <div class="kpi" style="color:var(--accent)">${fmtEUR(totalRentalIncome)}</div>
          <div class="small muted">mensual</div>
        </div></div>
        <div class="col"><div class="card">
          <h2>Cashflow Neto</h2>
          <div class="kpi" style="color:${netCashFlow >= 0 ? 'var(--accent)' : '#ef4444'}">${fmtEUR(netCashFlow)}</div>
          <div class="small muted">mensual</div>
        </div></div>
        <div class="col"><div class="card">
          <h2>Rentabilidad Bruta</h2>
          <div class="kpi" style="color:var(--primary)">${grossYield.toFixed(1)}%</div>
          <div class="small muted">anual</div>
        </div></div>
      </div>
      <div class="row">
        <div class="col"><div class="card">
          <h2>Portfolio</h2>
          <div style="margin-bottom:16px">
            <div class="small">Inmuebles: <strong>${totalProperties}</strong></div>
            <div class="small">Valor total: <strong>${fmtEUR(totalPortfolioValue)}</strong></div>
          </div>
          <h3>Tesorería</h3>
          ${accountBalances.map(acc => `
            <div class="small" style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span>${acc.name}</span>
              <span style="color:${acc.balance >= 0 ? 'var(--accent)' : '#ef4444'}">${fmtEUR(acc.balance)}</span>
            </div>
          `).join('')}
        </div></div>
        ${propertyCards ? `${propertyCards}` : ''}
      </div>`;
  }
};
export default view;
