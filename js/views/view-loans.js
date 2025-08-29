import { calculateFrenchAmortization, fmtEUR, parseEuro, fmtDateISO, addMonths, calculateCurrentLoanState, monthsBetween } from '../utils.js';
import { getLoans, saveLoans, getAccounts, getProperties, getReal, saveReal, getBudgets, saveBudgets, getCategories, saveCategories } from '../storage.js';

function renderCompactLoansList(loans, accounts, properties) {
  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]));
  const propertyMap = Object.fromEntries(properties.map(p => [p.id, p]));
  
  return `
    <div style="display: grid; gap: 20px;">
      ${loans.map(loan => {
        const account = accountMap[loan.bankId];
        const property = loan.associatedProperty ? propertyMap[loan.associatedProperty] : null;
        const schedule = calculateFrenchAmortization(loan.principal, loan.annualRate / 100, loan.years);
        const monthlyPayment = schedule.length > 0 ? schedule[0].payment : 0;
        const currentState = calculateCurrentLoanState(loan);
        
        return `
          <div style="background: white; border: 1px solid #e0e0e0; border-radius: 15px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); transition: transform 0.2s; cursor: pointer;" 
               onmouseover="this.style.transform='translateY(-2px)'" 
               onmouseout="this.style.transform='translateY(0)'">
            
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
              <div>
                <h3 style="margin: 0 0 5px 0; color: #333;">${getLoanTypeLabel(loan.type)}</h3>
                <div style="font-size: 14px; color: #666;">${loan.description}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 20px; font-weight: bold; color: #1A3C68;">${fmtEUR(monthlyPayment)}</div>
                <div style="font-size: 12px; color: #666;">cuota mensual</div>
              </div>
            </div>
            
            <!-- Progress Bar -->
            <div style="margin: 15px 0;">
              <div style="display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 5px;">
                <span>Progreso del préstamo</span>
                <span>${((currentState.monthsElapsed / (currentState.monthsElapsed + currentState.monthsRemaining)) * 100).toFixed(1)}%</span>
              </div>
              <div style="background: #f0f0f0; height: 8px; border-radius: 4px; overflow: hidden;">
                <div style="background: linear-gradient(90deg, #4CAF50, #8BC34A); height: 100%; width: ${(currentState.monthsElapsed / (currentState.monthsElapsed + currentState.monthsRemaining)) * 100}%; transition: width 0.3s;"></div>
              </div>
            </div>
            
            <!-- Key Info Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin: 15px 0;">
              <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                <div style="font-size: 16px; font-weight: bold; color: #333;">${fmtEUR(currentState.currentBalance)}</div>
                <div style="font-size: 11px; color: #666;">Pendiente</div>
              </div>
              <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                <div style="font-size: 16px; font-weight: bold; color: #333;">${loan.effectiveRate.toFixed(2)}%</div>
                <div style="font-size: 11px; color: #666;">Tipo efectivo</div>
              </div>
              <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                <div style="font-size: 16px; font-weight: bold; color: #333;">${currentState.monthsRemaining}</div>
                <div style="font-size: 11px; color: #666;">Meses restantes</div>
              </div>
              <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                <div style="font-size: 16px; font-weight: bold; color: ${account?.color || '#666'};">${account?.name || 'N/A'}</div>
                <div style="font-size: 11px; color: #666;">Banco</div>
              </div>
            </div>
            
            <!-- Actions -->
            <div style="display: flex; gap: 8px; margin-top: 15px; flex-wrap: wrap;">
              <button onclick="event.stopPropagation(); viewLoanDetails('${loan.id}')" 
                      style="flex: 1; min-width: 100px; background: #1A3C68; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                Detalles
              </button>
              <button onclick="event.stopPropagation(); calculatePartialAmortization('${loan.id}')" 
                      style="flex: 1; min-width: 100px; background: #37C785; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                Amortizar
              </button>
              <div style="position: relative; display: inline-block;">
                <button onclick="event.stopPropagation(); toggleKebabMenu('${loan.id}')" 
                        style="background: #f5f5f5; color: #333; border: 1px solid #ddd; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                  ⋯
                </button>
                <div id="kebab-${loan.id}" style="display: none; position: absolute; right: 0; top: 100%; background: white; border: 1px solid #ddd; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 100; min-width: 100px;">
                  <button onclick="event.stopPropagation(); editLoan('${loan.id}')" 
                          style="width: 100%; background: none; border: none; padding: 8px 12px; text-align: left; cursor: pointer; font-size: 12px; border-bottom: 1px solid #eee;">
                    Editar
                  </button>
                  <button onclick="event.stopPropagation(); deleteLoan('${loan.id}')" 
                          style="width: 100%; background: none; border: none; padding: 8px 12px; text-align: left; cursor: pointer; font-size: 12px; color: #E53935;">
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
            
            ${property ? `
              <div style="margin-top: 10px; padding: 8px; background: #e8f5e8; border-radius: 6px; font-size: 12px;">
                <strong>Inmueble asociado:</strong> ${property.address}
              </div>
            ` : `
              <div style="margin-top: 10px; padding: 8px; background: #fff3cd; border-radius: 6px; font-size: 12px; color: #856404;">
                <strong>Sin inmueble asociado</strong>
              </div>
            `}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function calculateTotalDebt(loans) {
  return loans.reduce((total, loan) => {
    const currentState = calculateCurrentLoanState(loan);
    return total + currentState.currentBalance;
  }, 0);
}

function calculateMonthlyPayments(loans) {
  return loans.reduce((total, loan) => {
    const schedule = calculateFrenchAmortization(loan.principal, loan.annualRate / 100, loan.years);
    const monthlyPayment = schedule.length > 0 ? schedule[0].payment : 0;
    return total + monthlyPayment;
  }, 0);
}

function getLoanTypeLabel(type) {
  const types = {
    'mortgage': 'Hipoteca',
    'personal': 'Personal',
    'car': 'Coche',
    'business': 'Negocio',
    'other': 'Otro'
  };
  return types[type] || type;
}

function renderLoanForm(accounts, properties) {
  return `
    <div style="background: #1A3C68; padding: 20px; border-radius: 15px; color: white; margin-bottom: 20px;">
      <h2 style="margin: 0 0 10px 0;">Nuevo Préstamo</h2>
      <p style="margin: 0; opacity: 0.9;">Añade un préstamo con cálculo automático de cuotas</p>
    </div>
    
    <form id="loanForm">
      <input type="hidden" id="loanId" value="">
      
      <!-- Basic Information Card -->
      <div style="background: white; border: 1px solid #e0e0e0; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h3 style="margin: 0 0 15px 0; color: #333; display: flex; align-items: center;">
          <span style="background: #1A3C68; color: white; border-radius: 50%; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">1</span>
          Información Básica
        </h3>
        
        <div class="row">
          <div class="col">
            <label class="small muted">Descripción *</label><br/>
            <input type="text" id="description" placeholder="ej: Hipoteca vivienda habitual" required style="width:100%; margin-bottom:10px">
          </div>
          <div class="col">
            <label class="small muted">Tipo de préstamo *</label><br/>
            <select id="loanType" required style="width:100%; margin-bottom:10px">
              <option value="">Seleccionar tipo</option>
              <option value="mortgage">Hipoteca</option>
              <option value="personal">Personal</option>
              <option value="car">Coche</option>
              <option value="business">Negocio</option>
              <option value="other">Otro</option>
            </select>
          </div>
        </div>
        
        <div class="row">
          <div class="col">
            <label class="small muted">Capital inicial (€) *</label><br/>
            <input type="number" id="principal" step="0.01" min="1" required style="width:100%; margin-bottom:10px" placeholder="200.000">
          </div>
          <div class="col">
            <label class="small muted">Tipo de interés anual (%) *</label><br/>
            <input type="number" id="annualRate" step="0.01" min="0" max="20" required style="width:100%; margin-bottom:10px" placeholder="3.50">
          </div>
          <div class="col">
            <label class="small muted">Plazo (años) *</label><br/>
            <input type="number" id="years" min="1" max="40" required style="width:100%; margin-bottom:10px" placeholder="25">
          </div>
        </div>
        
        <div class="row">
          <div class="col">
            <label class="small muted">Banco *</label><br/>
            <select id="bankId" required style="width:100%; margin-bottom:10px">
              <option value="">Seleccionar banco</option>
              ${accounts.map(account => `<option value="${account.id}">${account.name}</option>`).join('')}
            </select>
          </div>
          <div class="col">
            <label class="small muted">Día de cobro de cuota</label><br/>
            <input type="number" id="paymentDay" min="1" max="31" value="1" style="width:100%; margin-bottom:10px">
          </div>
          <div class="col">
            <label class="small muted">Fecha de inicio</label><br/>
            <input type="date" id="startDate" value="${fmtDateISO(new Date())}" style="width:100%; margin-bottom:10px">
          </div>
        </div>
      </div>
      
      <!-- Property Association Card -->
      <div style="background: white; border: 1px solid #e0e0e0; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h3 style="margin: 0 0 15px 0; color: #333; display: flex; align-items: center;">
          <span style="background: #37C785; color: white; border-radius: 50%; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">2</span>
          Asociación
        </h3>
        
        <div class="row">
          <div class="col">
            <label class="small muted">Asociar préstamo a *</label><br/>
            <select id="associationType" onchange="toggleAssociationOptions()" required style="width:100%; margin-bottom:10px">
              <option value="">Seleccionar asociación</option>
              <option value="property">Inmueble específico</option>
              <option value="investment">Cartera de inversión</option>
              <option value="personal">Uso personal</option>
            </select>
          </div>
          <div class="col">
            <div id="propertySelection" style="display:none">
              <label class="small muted">Inmueble</label><br/>
              <select id="associatedProperty" style="width:100%; margin-bottom:10px">
                <option value="">Seleccionar inmueble</option>
                ${properties.map(prop => `<option value="${prop.id}">${prop.address}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Bonifications Card - Compact Design -->
      <div style="background: white; border: 1px solid #e0e0e0; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h3 style="margin: 0 0 15px 0; color: #333; display: flex; align-items: center;">
          <span style="background: #F9A825; color: white; border-radius: 50%; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">3</span>
          Bonificaciones
          <span style="margin-left: auto; font-size: 12px; color: #666;">Opcional</span>
        </h3>
        
        <div class="small muted" style="margin-bottom: 15px;">
          Añade descuentos según productos contratados con el banco
        </div>
        
        <details>
          <summary style="cursor: pointer; color: #1A3C68; font-weight: 500;">Configurar bonificaciones</summary>
          <div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
            ${renderCompactConditionsForm()}
          </div>
        </details>
      </div>
      
      <!-- Action Buttons -->
      <div style="text-align: center; padding: 20px;">
        <button type="submit" style="background: #1A3C68; color: white; border: none; padding: 12px 30px; font-size: 16px; border-radius: 8px; cursor: pointer;">Guardar préstamo</button>
        <button type="button" onclick="clearForm()" style="margin-left:15px; padding: 12px 25px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 8px; cursor: pointer;">Limpiar</button>
      </div>
    </form>
  `;
}

function renderCompactConditionsForm() {
  const conditions = [
    { id: 'lifeInsurance', label: '💝 Seguro de vida', desc: 'Reduce hasta 0.20%' },
    { id: 'homeInsurance', label: '🏠 Seguro de hogar', desc: 'Reduce hasta 0.15%' },
    { id: 'payrollDomiciliation', label: '💰 Domiciliación nómina', desc: 'Reduce hasta 0.30%' },
    { id: 'cardTransactions', label: '💳 Operaciones tarjeta', desc: 'Reduce hasta 0.10%' },
    { id: 'cardSpending', label: '🛒 Gasto anual tarjeta', desc: 'Reduce hasta 0.15%' },
    { id: 'payrollAmount', label: '📊 Importe nómina', desc: 'Reduce hasta 0.25%' }
  ];
  
  return `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px;">
      ${conditions.map(condition => `
        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px;">
          <div style="display: flex; align-items: center; margin-bottom: 10px;">
            <input type="checkbox" id="${condition.id}_enabled" style="margin-right: 8px; transform: scale(1.2);"> 
            <div>
              <div style="font-weight: 500;">${condition.label}</div>
              <div class="small muted">${condition.desc}</div>
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px;">
            <div>
              <label class="small muted">Bonificación (%)</label>
              <input type="number" id="${condition.id}_bonus" step="0.01" min="0" max="1" style="width:100%; font-size: 12px;" disabled placeholder="0.20">
            </div>
            <div>
              <label class="small muted">Desde mes</label>
              <input type="number" id="${condition.id}_fromMonth" min="1" style="width:100%; font-size: 12px;" placeholder="1" disabled>
            </div>
          </div>
          
          <div style="margin-top: 8px;">
            <input type="text" id="${condition.id}_requirement" placeholder="ej: >2.000€/mes, >6.000€/año" style="width:100%; font-size: 11px;" disabled>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

const view = {
  route: '#/loans',
  title: 'Préstamos',
  
  async mount(root) {
    const loans = getLoans();
    const accounts = getAccounts();
    const properties = getProperties();
    
    root.innerHTML = `
      <div class="row">
        <div class="col">
          <div style="background: #1A3C68; padding: 30px; border-radius: 20px; color: white; margin-bottom: 30px; text-align: center;">
            <h1 style="margin: 0 0 10px 0; font-size: 2.5rem;">Préstamos e hipotecas</h1>
            <p style="margin: 0; font-size: 1.1rem; opacity: 0.9;">Gestión inteligente con cálculo automático y optimización fiscal</p>
            ${loans.length > 0 ? `
              <div style="margin-top: 20px; display: flex; justify-content: center; gap: 30px; flex-wrap: wrap;">
                <div style="text-align: center;">
                  <div style="font-size: 2rem; font-weight: bold;">${loans.length}</div>
                  <div style="opacity: 0.8;">Préstamos activos</div>
                </div>
                <div style="text-align: center;">
                  <div style="font-size: 2rem; font-weight: bold;">${fmtEUR(calculateTotalDebt(loans))}</div>
                  <div style="opacity: 0.8;">Deuda pendiente</div>
                </div>
                <div style="text-align: center;">
                  <div style="font-size: 2rem; font-weight: bold;">${fmtEUR(calculateMonthlyPayments(loans))}</div>
                  <div style="opacity: 0.8;">Cuota mensual total</div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
      
      ${loans.length > 0 ? `
      <div class="row">
        <div class="col">
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <h2 style="margin: 0;">Mis Préstamos</h2>
              <button onclick="showAddLoanForm()" style="background: #1A3C68; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                Nuevo Préstamo
              </button>
            </div>
            ${renderCompactLoansList(loans, accounts, properties)}
          </div>
        </div>
      </div>
      ` : ''}
      
      <div id="loanFormContainer" ${loans.length > 0 ? 'style="display:none;"' : ''}>
        <div class="row">
          <div class="col">
            <div class="card">
              ${renderLoanForm(accounts, properties)}
            </div>
          </div>
        </div>
      </div>
      
      <div id="loanDetails" style="display:none"></div>
    `;
    
    // Event handlers
    setupEventHandlers(root);
    
    // Global function to show/hide form
    window.showAddLoanForm = () => {
      const container = root.querySelector('#loanFormContainer');
      container.style.display = container.style.display === 'none' ? 'block' : 'none';
    };
  }
};

function setupEventHandlers(root) {
  // Loan form submission
  const loanForm = root.querySelector('#loanForm');
  if (loanForm) {
    loanForm.onsubmit = (e) => {
      e.preventDefault();
      saveLoan(root);
    };
  }
  
  // Condition checkboxes
  const conditions = ['lifeInsurance', 'homeInsurance', 'payrollDomiciliation', 'cardTransactions', 'cardSpending', 'payrollAmount'];
  conditions.forEach(condition => {
    const checkbox = root.querySelector(`#${condition}_enabled`);
    const bonusInput = root.querySelector(`#${condition}_bonus`);
    const reqInput = root.querySelector(`#${condition}_requirement`);
    const fromMonthInput = root.querySelector(`#${condition}_fromMonth`);
    
    if (checkbox && bonusInput && reqInput && fromMonthInput) {
      checkbox.onchange = () => {
        const enabled = checkbox.checked;
        bonusInput.disabled = !enabled;
        reqInput.disabled = !enabled;
        fromMonthInput.disabled = !enabled;
        if (!enabled) {
          bonusInput.value = '';
          reqInput.value = '';
          fromMonthInput.value = '';
        }
      };
    }
  });
  
  // Update bonification status icons
  updateBonificationStatus(root);
  
  // Add click listener to close kebab menus when clicking outside
  document.addEventListener('click', function(event) {
    if (!event.target.closest('[id^="kebab-"]') && !event.target.closest('button[onclick*="toggleKebabMenu"]')) {
      document.querySelectorAll('[id^="kebab-"]').forEach(menu => {
        menu.style.display = 'none';
      });
    }
  });
}

// Global functions for onclick handlers
window.toggleAssociationOptions = function() {
  const associationType = document.querySelector('#associationType').value;
  const propertySelection = document.querySelector('#propertySelection');
  
  if (propertySelection) {
    propertySelection.style.display = associationType === 'property' ? 'block' : 'none';
  }
};

window.clearForm = function() {
  const form = document.querySelector('#loanForm');
  if (form) form.reset();
  window.toggleAssociationOptions();
};

window.viewLoanDetails = function(loanId) {
  const loans = getLoans();
  const loan = loans.find(l => l.id === loanId);
  if (!loan) return;
  
  showLoanDetails(loan);
};

window.editLoan = function(loanId) {
  const loans = getLoans();
  const loan = loans.find(l => l.id === loanId);
  if (!loan) return;
  
  // Show the form container
  const container = document.querySelector('#loanFormContainer');
  if (container) {
    container.style.display = 'block';
  }
  
  // Scroll to form
  setTimeout(() => {
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
  
  populateLoanForm(loan);
};

window.toggleKebabMenu = function(loanId) {
  const menu = document.getElementById(`kebab-${loanId}`);
  if (menu) {
    // Close all other kebab menus first
    document.querySelectorAll('[id^="kebab-"]').forEach(m => {
      if (m.id !== `kebab-${loanId}`) m.style.display = 'none';
    });
    
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  }
};

window.deleteLoan = function(loanId) {
  if (!confirm('¿Estás seguro de que quieres eliminar este préstamo?')) return;
  
  const loans = getLoans();
  const updatedLoans = loans.filter(l => l.id !== loanId);
  saveLoans(updatedLoans);
  
  // Refresh the view
  view.mount(document.getElementById('app'));
};

window.calculatePartialAmortization = function(loanId) {
  const loans = getLoans();
  const loan = loans.find(l => l.id === loanId);
  if (!loan) return;
  
  showPartialAmortizationCalculator(loan);
};

function saveLoan(root) {
  const loanId = root.querySelector('#loanId').value || generateId();
  const description = root.querySelector('#description').value;
  const type = root.querySelector('#loanType').value;
  const principal = parseFloat(root.querySelector('#principal').value);
  const annualRate = parseFloat(root.querySelector('#annualRate').value);
  const years = parseInt(root.querySelector('#years').value);
  const bankId = root.querySelector('#bankId').value;
  const paymentDay = parseInt(root.querySelector('#paymentDay').value) || 1;
  const startDate = root.querySelector('#startDate').value;
  const associationType = root.querySelector('#associationType').value;
  const associatedProperty = root.querySelector('#associatedProperty').value;
  
  // Collect conditions
  const conditions = {};
  const conditionIds = ['lifeInsurance', 'homeInsurance', 'payrollDomiciliation', 'cardTransactions', 'cardSpending', 'payrollAmount'];
  conditionIds.forEach(id => {
    const enabled = root.querySelector(`#${id}_enabled`).checked;
    const bonus = parseFloat(root.querySelector(`#${id}_bonus`).value) || 0;
    const requirement = root.querySelector(`#${id}_requirement`).value;
    const fromMonth = parseInt(root.querySelector(`#${id}_fromMonth`).value) || 1;
    
    if (enabled && bonus > 0) {
      conditions[id] = { bonus, requirement, fromMonth };
    }
  });
  
  // Calculate effective rate with bonuses
  const totalBonus = Object.values(conditions).reduce((sum, cond) => sum + cond.bonus, 0);
  const effectiveRate = Math.max(0, annualRate - totalBonus);
  
  const loan = {
    id: loanId,
    description,
    type,
    principal,
    annualRate,
    effectiveRate,
    years,
    bankId,
    paymentDay,
    startDate,
    associationType,
    associatedProperty: associationType === 'property' ? associatedProperty : null,
    conditions,
    active: true,
    createdAt: new Date().toISOString(),
    lastPaymentDate: null
  };
  
  const loans = getLoans();
  const existingIndex = loans.findIndex(l => l.id === loanId);
  
  if (existingIndex >= 0) {
    loans[existingIndex] = loan;
  } else {
    loans.push(loan);
  }
  
  saveLoans(loans);
  
  // Add to budget category if not exists
  addLoanToBudget(loan);
  
  alert('Préstamo guardado correctamente');
  
  // Refresh the view
  view.mount(root.parentElement);
}

function addLoanToBudget(loan) {
  const categories = getCategories();
  const budgets = getBudgets();
  
  // Check if loan category exists
  let loanCategory = categories.find(c => c.id === 'loans');
  if (!loanCategory) {
    loanCategory = {
      id: 'loans',
      name: 'Préstamos e Hipotecas',
      color: '#dc2626',
      type: 'expense'
    };
    categories.push(loanCategory);
    saveCategories(categories);
  }
  
  // Add or update budget
  const schedule = calculateFrenchAmortization(loan.principal, loan.effectiveRate / 100, loan.years);
  const monthlyPayment = schedule.length > 0 ? schedule[0].payment : 0;
  
  let loanBudget = budgets.find(b => b.categoryId === 'loans');
  if (!loanBudget) {
    loanBudget = {
      categoryId: 'loans',
      monthlyLimit: monthlyPayment,
      alertThreshold: 0.9
    };
    budgets.push(loanBudget);
  } else {
    loanBudget.monthlyLimit += monthlyPayment;
  }
  
  saveBudgets(budgets);
}

function populateLoanForm(loan) {
  document.querySelector('#loanId').value = loan.id;
  document.querySelector('#description').value = loan.description;
  document.querySelector('#loanType').value = loan.type;
  document.querySelector('#principal').value = loan.principal;
  document.querySelector('#annualRate').value = loan.annualRate;
  document.querySelector('#years').value = loan.years;
  document.querySelector('#bankId').value = loan.bankId;
  document.querySelector('#paymentDay').value = loan.paymentDay;
  document.querySelector('#startDate').value = loan.startDate;
  document.querySelector('#associationType').value = loan.associationType;
  
  if (loan.associatedProperty) {
    document.querySelector('#associatedProperty').value = loan.associatedProperty;
  }
  
  window.toggleAssociationOptions();
  
  // Populate conditions
  if (loan.conditions) {
    Object.keys(loan.conditions).forEach(condId => {
      const cond = loan.conditions[condId];
      const checkbox = document.querySelector(`#${condId}_enabled`);
      const bonusInput = document.querySelector(`#${condId}_bonus`);
      const reqInput = document.querySelector(`#${condId}_requirement`);
      const fromMonthInput = document.querySelector(`#${condId}_fromMonth`);
      
      if (checkbox && bonusInput && reqInput && fromMonthInput) {
        checkbox.checked = true;
        bonusInput.disabled = false;
        reqInput.disabled = false;
        fromMonthInput.disabled = false;
        bonusInput.value = cond.bonus;
        reqInput.value = cond.requirement;
        fromMonthInput.value = cond.fromMonth || 1;
      }
    });
  }
}

function showLoanDetails(loan) {
  const accounts = getAccounts();
  const properties = getProperties();
  const account = accounts.find(a => a.id === loan.bankId);
  const property = loan.associatedProperty ? properties.find(p => p.id === loan.associatedProperty) : null;
  
  const schedule = calculateFrenchAmortization(loan.principal, loan.effectiveRate / 100, loan.years);
  const monthlyPayment = schedule.length > 0 ? schedule[0].payment : 0;
  const totalInterest = schedule.reduce((sum, p) => sum + p.interest, 0);
  const totalPaid = loan.principal + totalInterest;
  
  const detailsContainer = document.querySelector('#loanDetails');
  detailsContainer.style.display = 'block';
  detailsContainer.innerHTML = `
    <div class="row">
      <div class="col">
        <div class="card">
          <h2>📊 Detalles del préstamo: ${loan.description}</h2>
          
          <div class="row">
            <div class="col">
              <h3>📋 Información General</h3>
              <div><strong>Tipo:</strong> ${getLoanTypeLabel(loan.type)}</div>
              <div><strong>Capital inicial:</strong> ${fmtEUR(loan.principal)}</div>
              <div><strong>Tipo nominal:</strong> ${loan.annualRate}%</div>
              <div><strong>Tipo efectivo:</strong> ${loan.effectiveRate.toFixed(2)}%</div>
              <div><strong>Plazo:</strong> ${loan.years} años</div>
              <div><strong>Banco:</strong> <span style="color:${account?.color || '#666'}">${account?.name || 'N/A'}</span></div>
              <div><strong>Día de cobro:</strong> ${loan.paymentDay}</div>
              <div><strong>Fecha inicio:</strong> ${loan.startDate}</div>
              <div><strong>Asociado a:</strong> ${property ? property.address : loan.associationType === 'personal' ? 'Personal' : 'N/A'}</div>
            </div>
            <div class="col">
              <h3>💰 Resumen Financiero</h3>
              <div><strong>Cuota mensual:</strong> <span style="font-size:18px; font-weight:bold">${fmtEUR(monthlyPayment)}</span></div>
              <div><strong>Total intereses:</strong> ${fmtEUR(totalInterest)}</div>
              <div><strong>Total a pagar:</strong> ${fmtEUR(totalPaid)}</div>
              <div><strong>Estado:</strong> ${loan.active ? '✅ Activo' : '⏸️ Pausado'}</div>
            </div>
          </div>
          
          ${Object.keys(loan.conditions || {}).length > 0 ? `
          <div style="margin-top:15px">
            <h3>🎁 Condiciones Aplicadas</h3>
            <div class="grid">
              <table>
                <thead>
                  <tr><th>Condición</th><th>Bonificación</th><th>Requerimiento</th></tr>
                </thead>
                <tbody>
                  ${Object.entries(loan.conditions).map(([key, cond]) => `
                    <tr>
                      <td>${getConditionLabel(key)}</td>
                      <td>-${cond.bonus}%</td>
                      <td>${cond.requirement}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          ` : ''}
          
          <div style="margin-top:15px">
            <button onclick="document.querySelector('#loanDetails').style.display='none'" class="primary">❌ Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  detailsContainer.scrollIntoView({ behavior: 'smooth' });
}

function getConditionLabel(key) {
  const labels = {
    'lifeInsurance': 'Seguro de vida',
    'homeInsurance': 'Seguro de hogar',
    'payrollDomiciliation': 'Domiciliación nómina',
    'cardTransactions': 'Operaciones tarjeta',
    'cardSpending': 'Gasto anual tarjeta',
    'payrollAmount': 'Importe nómina'
  };
  return labels[key] || key;
}

function generateId() {
  return 'loan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function updateBonificationStatus(root) {
  const conditions = ['lifeInsurance', 'homeInsurance', 'payrollDomiciliation', 'cardTransactions', 'cardSpending', 'payrollAmount'];
  
  conditions.forEach(condition => {
    const statusElement = root.querySelector(`#${condition}_status`);
    if (statusElement) {
      // Check if the condition is met based on bank movements
      const isMet = checkBonificationCondition(condition);
      statusElement.innerHTML = isMet ? '✅' : '❌';
      statusElement.title = isMet ? 'Criterio cumplido según movimientos bancarios' : 'Criterio no cumplido';
    }
  });
}

function checkBonificationCondition(conditionId) {
  // This would check against actual bank movements
  // For now, we'll return a placeholder implementation
  // In a real system, this would analyze transactions from getReal()
  
  const real = getReal();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  // Get movements for current year
  const yearMovements = real.filter(mov => {
    const movDate = new Date(mov.date);
    return movDate.getFullYear() === currentYear;
  });
  
  switch(conditionId) {
    case 'payrollDomiciliation':
      // Check for regular salary deposits
      const salaryMovements = yearMovements.filter(mov => 
        mov.type === 'income' && 
        (mov.description?.toLowerCase().includes('nomina') || 
         mov.description?.toLowerCase().includes('salario') ||
         mov.description?.toLowerCase().includes('sueldo'))
      );
      return salaryMovements.length >= 6; // At least 6 salary payments this year
      
    case 'cardTransactions':
      // Check for card transactions (negative movements that might be card payments)
      const cardMovements = yearMovements.filter(mov => 
        mov.type === 'expense' && 
        (mov.description?.toLowerCase().includes('tarjeta') ||
         mov.description?.toLowerCase().includes('visa') ||
         mov.description?.toLowerCase().includes('mastercard'))
      );
      const avgMonthlyTransactions = cardMovements.length / currentMonth;
      return avgMonthlyTransactions >= 10; // At least 10 card transactions per month on average
      
    case 'cardSpending':
      // Check total card spending
      const cardSpending = yearMovements
        .filter(mov => mov.type === 'expense' && 
          (mov.description?.toLowerCase().includes('tarjeta') ||
           mov.description?.toLowerCase().includes('visa') ||
           mov.description?.toLowerCase().includes('mastercard')))
        .reduce((sum, mov) => sum + Math.abs(mov.amount), 0);
      return cardSpending >= 6000; // At least 6000€ annual card spending
      
    case 'payrollAmount':
      // Check payroll amount
      const recentSalaries = yearMovements
        .filter(mov => mov.type === 'income' && 
          (mov.description?.toLowerCase().includes('nomina') || 
           mov.description?.toLowerCase().includes('salario')))
        .slice(-3); // Last 3 salary payments
      
      if (recentSalaries.length === 0) return false;
      const avgSalary = recentSalaries.reduce((sum, mov) => sum + mov.amount, 0) / recentSalaries.length;
      return avgSalary >= 2000; // At least 2000€ average monthly salary
      
    case 'lifeInsurance':
    case 'homeInsurance':
      // Check for insurance payments
      const insuranceMovements = yearMovements.filter(mov => 
        mov.type === 'expense' && 
        (mov.description?.toLowerCase().includes('seguro') ||
         mov.description?.toLowerCase().includes('insurance'))
      );
      return insuranceMovements.length > 0; // Has insurance payments
      
    default:
      return false;
  }
}

function showPartialAmortizationCalculator(loan) {
  const detailsContainer = document.querySelector('#loanDetails');
  detailsContainer.style.display = 'block';
  
  // Calculate current loan state with accurate remaining months and balance
  const currentState = calculateCurrentLoanState(loan);
  
  detailsContainer.innerHTML = `
    <div class="row">
      <div class="col">
        <div class="card">
          <h2>🧮 Calculadora de Amortización - ${loan.description}</h2>
          
          <div class="row">
            <div class="col">
              <h3>📊 Datos actuales del préstamo</h3>
              <div><strong>Capital pendiente:</strong> ${fmtEUR(currentState.currentBalance)}</div>
              <div><strong>Cuota actual:</strong> ${fmtEUR(currentState.monthlyPayment)}</div>
              <div><strong>Tipo efectivo:</strong> ${loan.effectiveRate.toFixed(2)}%</div>
              <div><strong>Meses restantes:</strong> ${currentState.monthsRemaining}</div>
              <div><strong>Meses transcurridos:</strong> ${currentState.monthsElapsed}</div>
              <div><strong>Estado:</strong> ${currentState.isComplete ? '✅ Completado' : '⏳ Activo'}</div>
            </div>
            <div class="col">
              <h3>💰 Resumen de pagos</h3>
              <div><strong>Total pagado:</strong> ${fmtEUR(currentState.totalPaid)}</div>
              <div><strong>Intereses pagados:</strong> ${fmtEUR(currentState.interestPaid)}</div>
              <div><strong>Capital amortizado:</strong> ${fmtEUR(loan.principal - currentState.currentBalance)}</div>
            </div>
          </div>
          
          <div style="margin-top:20px">
            <button onclick="showCurrentAmortizationTable('${loan.id}')" class="primary">📋 Ver cuadro actual</button>
            <button onclick="exportAmortizationTable('${loan.id}')" style="margin-left:10px">📊 Exportar cuadro</button>
          </div>
          
          ${!currentState.isComplete ? `
          <div style="margin-top:20px; border:1px solid var(--border); border-radius:8px; padding:15px">
            <h3>💰 Simular Amortización Anticipada</h3>
            
            <div class="row">
              <div class="col">
                <label class="small muted">Importe a amortizar (€)</label><br/>
                <input type="number" id="extraAmount" step="0.01" min="1" style="width:150px" placeholder="10000">
              </div>
              <div class="col">
                <label class="small muted">¿En qué mes amortizar?</label><br/>
                <input type="number" id="monthToAmortize" min="1" max="${currentState.monthsRemaining}" value="${Math.min(12, currentState.monthsRemaining)}" style="width:100px">
                <div class="small muted">Relativo al mes actual</div>
              </div>
              <div class="col">
                <label class="small muted">Tipo de amortización</label><br/>
                <select id="amortizationType" style="width:180px">
                  <option value="reduce_term">Reducir plazo</option>
                  <option value="reduce_payment">Reducir cuota</option>
                </select>
              </div>
            </div>
            
            <div style="margin-top:15px">
              <button onclick="calculatePartialAmortizationResults('${loan.id}')" class="primary">🧮 Calcular</button>
              <button onclick="calculateTotalCancellation('${loan.id}')" style="margin-left:10px">🏁 Cancelación total</button>
            </div>
            
            <div id="amortizationResults" style="margin-top:15px"></div>
          </div>
          ` : `
          <div style="margin-top:20px; padding:15px; background:var(--success); color:white; border-radius:8px">
            <h3>🎉 Préstamo completado</h3>
            <p>Este préstamo ya ha sido completamente amortizado.</p>
          </div>
          `}
          
          <div style="margin-top:15px">
            <button onclick="document.querySelector('#loanDetails').style.display='none'" class="primary">❌ Cerrar</button>
          </div>
        </div>
      </div>
    </div>
    
    <div id="amortizationTableContainer" style="display:none"></div>
  `;
  
  detailsContainer.scrollIntoView({ behavior: 'smooth' });
}

window.calculatePartialAmortizationResults = function(loanId) {
  const loans = getLoans();
  const loan = loans.find(l => l.id === loanId);
  if (!loan) return;
  
  const extraAmount = parseFloat(document.querySelector('#extraAmount').value);
  const monthToAmortize = parseInt(document.querySelector('#monthToAmortize').value);
  const amortizationType = document.querySelector('#amortizationType').value;
  
  if (!extraAmount || extraAmount <= 0) {
    alert('Introduce un importe válido para amortizar');
    return;
  }
  
  if (!monthToAmortize || monthToAmortize <= 0) {
    alert('Introduce un mes válido');
    return;
  }
  
  // Get current loan state
  const currentState = calculateCurrentLoanState(loan);
  
  if (currentState.isComplete) {
    alert('El préstamo ya está completado');
    return;
  }
  
  if (monthToAmortize > currentState.monthsRemaining) {
    alert('El mes especificado supera la duración restante del préstamo');
    return;
  }
  
  // Get balance at the specified month from current schedule
  const balanceAtMonth = monthToAmortize <= currentState.currentSchedule.length ? 
                        currentState.currentSchedule[monthToAmortize - 1].balance : 0;
  const newBalance = balanceAtMonth - extraAmount;
  
  if (newBalance <= 0) {
    const totalNeeded = balanceAtMonth;
    const interestSavings = currentState.currentSchedule.slice(monthToAmortize).reduce((sum, p) => sum + p.interest, 0);
    
    document.querySelector('#amortizationResults').innerHTML = `
      <div style="background:var(--success); color:white; padding:15px; border-radius:8px">
        <h3>🎉 ¡Préstamo cancelado completamente!</h3>
        <p>Con ${fmtEUR(extraAmount)} en el mes ${monthToAmortize}, cancelas toda la deuda restante.</p>
        <p><strong>Importe necesario:</strong> ${fmtEUR(totalNeeded)}</p>
        <p><strong>Ahorro total:</strong> ${fmtEUR(interestSavings)}</p>
      </div>
    `;
    return;
  }
  
  // Calculate new schedule after partial amortization
  const remainingMonthsAfterAmortization = currentState.monthsRemaining - monthToAmortize;
  const newSchedule = calculateFrenchAmortization(newBalance, loan.effectiveRate / 100, remainingMonthsAfterAmortization / 12);
  
  // Calculate savings
  const originalInterestAfterMonth = currentState.currentSchedule.slice(monthToAmortize).reduce((sum, p) => sum + p.interest, 0);
  const newInterestAfterMonth = newSchedule.reduce((sum, p) => sum + p.interest, 0);
  const interestSavings = originalInterestAfterMonth - newInterestAfterMonth;
  
  let resultsHTML = '';
  
  if (amortizationType === 'reduce_term') {
    // Reduce term: keep same payment but reduce duration
    const newDuration = newSchedule.length;
    const monthsReduced = remainingMonthsAfterAmortization - newDuration;
    
    resultsHTML = `
      <div style="background:var(--card); border:1px solid var(--border); border-radius:8px; padding:15px">
        <h3>📉 Resultado: Reducir plazo</h3>
        <div class="row">
          <div class="col">
            <div class="small muted">Cuota mensual</div>
            <div><strong>${fmtEUR(newSchedule[0]?.payment || 0)}</strong> (igual)</div>
          </div>
          <div class="col">
            <div class="small muted">Plazo reducido</div>
            <div><strong>${monthsReduced} meses</strong> (${(monthsReduced/12).toFixed(1)} años)</div>
          </div>
          <div class="col">
            <div class="small muted">Ahorro en intereses</div>
            <div style="color:green; font-weight:bold">${fmtEUR(interestSavings)}</div>
          </div>
        </div>
        <div style="margin-top:10px; font-size:14px; color:var(--muted)">
          Nueva duración total restante: ${monthToAmortize + newDuration} meses (vs ${currentState.monthsRemaining} original)
        </div>
      </div>
    `;
  } else {
    // Reduce payment: calculate what the new payment would be with same term
    const newScheduleKeepTerm = calculateFrenchAmortization(newBalance, loan.effectiveRate / 100, remainingMonthsAfterAmortization / 12);
    const newPayment = newScheduleKeepTerm[0]?.payment || 0;
    const originalPayment = currentState.monthlyPayment;
    const paymentReduction = originalPayment - newPayment;
    
    resultsHTML = `
      <div style="background:var(--card); border:1px solid var(--border); border-radius:8px; padding:15px">
        <h3>💰 Resultado: Reducir cuota</h3>
        <div class="row">
          <div class="col">
            <div class="small muted">Nueva cuota mensual</div>
            <div><strong>${fmtEUR(newPayment)}</strong></div>
          </div>
          <div class="col">
            <div class="small muted">Reducción mensual</div>
            <div style="color:green; font-weight:bold">-${fmtEUR(paymentReduction)}</div>
          </div>
          <div class="col">
            <div class="small muted">Ahorro en intereses</div>
            <div style="color:green; font-weight:bold">${fmtEUR(interestSavings)}</div>
          </div>
        </div>
        <div style="margin-top:10px; font-size:14px; color:var(--muted)">
          Duración: ${remainingMonthsAfterAmortization} meses restantes (igual plazo)
        </div>
      </div>
    `;
  }
  
  document.querySelector('#amortizationResults').innerHTML = resultsHTML;
};

window.calculateTotalCancellation = function(loanId) {
  const loans = getLoans();
  const loan = loans.find(l => l.id === loanId);
  if (!loan) return;
  
  const monthToCancel = parseInt(document.querySelector('#monthToAmortize').value) || 1;
  const currentState = calculateCurrentLoanState(loan);
  
  if (currentState.isComplete) {
    alert('El préstamo ya está completado');
    return;
  }
  
  if (monthToCancel > currentState.monthsRemaining) {
    alert('El mes especificado supera la duración restante del préstamo');
    return;
  }
  
  // Get balance at the specified month from current schedule
  const balanceAtMonth = monthToCancel <= currentState.currentSchedule.length ? 
                        currentState.currentSchedule[monthToCancel - 1].balance : 0;
  const remainingInterest = currentState.currentSchedule.slice(monthToCancel).reduce((sum, p) => sum + p.interest, 0);
  
  document.querySelector('#amortizationResults').innerHTML = `
    <div style="background:var(--warning); color:white; padding:15px; border-radius:8px">
      <h3>🏁 Cancelación total en el mes ${monthToCancel} (desde hoy)</h3>
      <div class="row">
        <div class="col">
          <div class="small" style="opacity:0.9">Importe para cancelar</div>
          <div style="font-size:20px; font-weight:bold">${fmtEUR(balanceAtMonth)}</div>
        </div>
        <div class="col">
          <div class="small" style="opacity:0.9">Ahorro en intereses</div>
          <div style="font-size:18px; font-weight:bold">${fmtEUR(remainingInterest)}</div>
        </div>
      </div>
      <div style="margin-top:10px; font-size:14px; opacity:0.9">
        Te ahorrarías ${currentState.monthsRemaining - monthToCancel} cuotas restantes
      </div>
    </div>
  `;
};

window.showCurrentAmortizationTable = function(loanId) {
  const loans = getLoans();
  const loan = loans.find(l => l.id === loanId);
  if (!loan) return;
  
  const currentState = calculateCurrentLoanState(loan);
  const container = document.querySelector('#amortizationTableContainer');
  
  // Show full schedule with current position marked
  const allSchedule = currentState.originalSchedule;
  const monthsElapsed = currentState.monthsElapsed;
  
  const tableRows = allSchedule.map((payment, index) => {
    const isPaid = index < monthsElapsed;
    const isCurrent = index === monthsElapsed;
    const style = isPaid ? 'background-color: #e8f5e8; opacity: 0.7;' : 
                  isCurrent ? 'background-color: #fff3cd; font-weight: bold;' : '';
    
    return `
      <tr style="${style}">
        <td>${payment.month}${isPaid ? ' ✓' : isCurrent ? ' ◄' : ''}</td>
        <td>${fmtEUR(payment.payment)}</td>
        <td>${fmtEUR(payment.principal)}</td>
        <td>${fmtEUR(payment.interest)}</td>
        <td>${fmtEUR(payment.balance)}</td>
        <td>${isPaid ? 'Pagado' : isCurrent ? 'Actual' : 'Pendiente'}</td>
      </tr>
    `;
  }).join('');
  
  container.innerHTML = `
    <div class="row">
      <div class="col">
        <div class="card">
          <h3>📋 Cuadro de Amortización Completo - ${loan.description}</h3>
          <div class="small muted">
            ✓ = Pagado, ◄ = Próximo pago, Total pagado: ${fmtEUR(currentState.totalPaid)}
          </div>
          
          <div style="max-height: 400px; overflow-y: auto; margin-top: 15px;">
            <table>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Cuota</th>
                  <th>Capital</th>
                  <th>Interés</th>
                  <th>Pendiente</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
          
          <div style="margin-top:15px">
            <button onclick="exportAmortizationTable('${loanId}')" class="primary">📊 Exportar</button>
            <button onclick="document.querySelector('#amortizationTableContainer').style.display='none'" style="margin-left:10px">❌ Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth' });
};

window.exportAmortizationTable = function(loanId) {
  const loans = getLoans();
  const loan = loans.find(l => l.id === loanId);
  if (!loan) return;
  
  const currentState = calculateCurrentLoanState(loan);
  const schedule = currentState.originalSchedule;
  
  // Create CSV content
  let csvContent = 'Mes,Cuota,Capital,Interés,Pendiente,Estado\n';
  
  schedule.forEach((payment, index) => {
    const isPaid = index < currentState.monthsElapsed;
    const isCurrent = index === currentState.monthsElapsed;
    const status = isPaid ? 'Pagado' : isCurrent ? 'Actual' : 'Pendiente';
    
    csvContent += `${payment.month},${payment.payment.toFixed(2)},${payment.principal.toFixed(2)},${payment.interest.toFixed(2)},${payment.balance.toFixed(2)},${status}\n`;
  });
  
  // Add summary information
  csvContent += '\n\nResumen del préstamo:\n';
  csvContent += `Descripción,${loan.description}\n`;
  csvContent += `Capital inicial,${loan.principal.toFixed(2)}\n`;
  csvContent += `Tipo efectivo,${loan.effectiveRate.toFixed(2)}%\n`;
  csvContent += `Meses transcurridos,${currentState.monthsElapsed}\n`;
  csvContent += `Meses restantes,${currentState.monthsRemaining}\n`;
  csvContent += `Capital pendiente,${currentState.currentBalance.toFixed(2)}\n`;
  csvContent += `Total pagado,${currentState.totalPaid.toFixed(2)}\n`;
  csvContent += `Intereses pagados,${currentState.interestPaid.toFixed(2)}\n`;
  
  // Create download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `amortizacion_${loan.description.replace(/\s+/g, '_')}_${fmtDateISO(new Date())}.csv`;
  link.click();
};

export default view;