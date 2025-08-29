import { getSettings, setSettings, getAccounts, saveAccounts, setYear, getYear, applyTheme, getCategories, saveCategories, getBudgets, saveBudgets } from '../storage.js';

const view = {
  route:'#/config', title:'Configuración',
  async mount(root){
    const s = getSettings();
    const acc = getAccounts();
    root.innerHTML = `<div class="row">
      <div class="col"><div class="card">
        <h1>Configuración</h1>
        <div class="row">
          <div class="col">
            <h2>Preferencias</h2>
            <label class="small muted">Año activo</label><br/>
            <input type="number" id="year" value="${getYear()}" style="width:140px"> 
            <button class="primary" id="saveYear">Guardar</button>
            <div style="height:10px"></div>
            <label class="small muted">Tema</label><br/>
            <select id="theme" style="width:140px">
              <option value="light" ${s.theme==='light'?'selected':''}>Claro</option>
              <option value="dark" ${s.theme==='dark'?'selected':''}>Oscuro</option>
            </select>
            <div style="height:10px"></div>
            <label class="small muted">Color de acento (#HEX)</label><br/>
            <input id="accent" value="${s.accent||'#7c3aed'}" style="width:140px"> 
            <button id="apply" class="primary">Aplicar</button>
          </div>
          <div class="col">
            <h2 style="font-size: 16px; font-weight: 500; margin: 0 0 15px 0;">Cuentas bancarias</h2>
            <div class="grid"><table id="acct"><thead><tr><th>Logo</th><th>ID</th><th>Nombre</th><th>Umbral</th><th></th></tr></thead><tbody></tbody></table></div>
            <div style="margin-top:15px; padding: 15px; background: var(--header-bg); border-radius: 8px;">
              <h3 style="font-size: 14px; font-weight: 500; margin: 0 0 10px 0;">Añadir nuevo banco</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                <input placeholder="ID (ej: SANTANDER)" id="id" style="width:100%">
                <input placeholder="Nombre" id="name" style="width:100%">
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                <input placeholder="Umbral €" id="thr" type="number" style="width:100%">
                <input placeholder="Color #HEX" id="color" style="width:100%">
              </div>
              <div style="margin-bottom: 10px;">
                <label style="font-size: 12px; color: var(--text-secondary);">Logotipo del banco</label>
                <input type="file" id="logoFile" accept="image/*" style="width:100%; margin-bottom: 5px;">
                <input placeholder="O URL del logotipo" id="logoUrl" style="width:100%;">
              </div>
              <button id="add" class="primary" style="width: 100%;">Añadir banco</button>
            </div>
          </div>
        </div>
        <div class="row" style="margin-top:16px">
          <div class="col">
            <h2>Categorías</h2>
            <div class="grid"><table id="cat"><thead><tr><th>ID</th><th>Nombre</th><th>Color</th><th>Tipo</th><th></th></tr></thead><tbody></tbody></table></div>
            <div style="margin-top:6px">
              <input placeholder="ID" id="catId" style="width:90px">
              <input placeholder="Nombre" id="catName" style="width:120px">
              <input placeholder="#COLOR" id="catColor" style="width:80px">
              <select id="catType" style="width:90px">
                <option value="income">Ingreso</option>
                <option value="expense">Gasto</option>
              </select>
              <button id="addCat" class="primary">Añadir</button>
            </div>
          </div>
        </div>
        <div class="row" style="margin-top:16px">
          <div class="col">
            <h2>Presupuestos Mensuales</h2>
            <div class="grid"><table id="budget"><thead><tr><th>Categoría</th><th>Límite Mensual</th><th>Alerta (%)</th><th></th></tr></thead><tbody></tbody></table></div>
            <div style="margin-top:6px">
              <select id="budgetCat" style="width:120px">
                <option value="">Seleccionar...</option>
              </select>
              <input placeholder="Límite €" id="budgetLimit" type="number" style="width:100px">
              <input placeholder="80" id="budgetAlert" type="number" min="50" max="100" value="80" style="width:60px">
              <button id="addBudget" class="primary">Añadir</button>
            </div>
          </div>
        </div>
      </div></div>
    </div>`;
    const tbody = root.querySelector('#acct tbody');
    const catTbody = root.querySelector('#cat tbody');
    const budgetTbody = root.querySelector('#budget tbody');
    const budgetCatSelect = root.querySelector('#budgetCat');
    
    function draw(){
      const a = getAccounts();
      tbody.innerHTML = a.map((r,i)=>`<tr>
        <td>
          ${r.logo ? `<img src="${r.logo}" alt="${r.name}" style="width: 24px; height: 24px; object-fit: contain; border-radius: 2px;">` : `<div style="width: 24px; height: 24px; background: ${r.color || '#ccc'}; border-radius: 2px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: white;">${r.name.charAt(0)}</div>`}
        </td>
        <td>${r.id}</td>
        <td>${r.name}</td>
        <td>${r.threshold}€</td>
        <td>
          <button onclick="editBank(${i})" class="small secondary" style="margin-right: 5px;">✏</button>
          <button data-i="${i}" class="del small danger">🗑</button>
        </td>
      </tr>`).join('');
      tbody.querySelectorAll('.del').forEach(b=> b.onclick = ()=>{
        const idx = +b.getAttribute('data-i');
        const arr = getAccounts(); 
        if(confirm(`¿Eliminar banco "${arr[idx].name}"?`)) {
          arr.splice(idx,1); 
          saveAccounts(arr); 
          draw();
        }
      });
    }
    
    function drawCategories(){
      const cats = getCategories();
      catTbody.innerHTML = cats.map((r,i)=>`<tr><td>${r.id}</td><td>${r.name}</td>
      <td><span style="color:${r.color}">${r.color}</span></td><td>${r.type==='income'?'Ingreso':'Gasto'}</td>
      <td><button data-i="${i}" class="delCat">Borrar</button></td></tr>`).join('');
      catTbody.querySelectorAll('.delCat').forEach(b=> b.onclick = ()=>{
        const idx = +b.getAttribute('data-i');
        const arr = getCategories(); arr.splice(idx,1); saveCategories(arr); drawCategories(); updateBudgetSelect();
      });
      updateBudgetSelect();
    }
    
    function updateBudgetSelect(){
      const cats = getCategories().filter(c => c.type === 'expense');
      budgetCatSelect.innerHTML = '<option value="">Seleccionar...</option>' + 
        cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    
    function drawBudgets(){
      const budgets = getBudgets();
      const cats = getCategories();
      const catMap = Object.fromEntries(cats.map(c => [c.id, c]));
      
      budgetTbody.innerHTML = budgets.map((r,i)=>{
        const cat = catMap[r.categoryId];
        return `<tr><td>${cat ? cat.name : r.categoryId}</td><td>${r.monthlyLimit}€</td><td>${(r.alertThreshold*100).toFixed(0)}%</td>
        <td><button data-i="${i}" class="delBudget">Borrar</button></td></tr>`;
      }).join('');
      budgetTbody.querySelectorAll('.delBudget').forEach(b=> b.onclick = ()=>{
        const idx = +b.getAttribute('data-i');
        const arr = getBudgets(); arr.splice(idx,1); saveBudgets(arr); drawBudgets();
      });
    }
    
    draw();
    drawCategories();
    drawBudgets();

    // Helper function to convert file to base64
    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    root.querySelector('#add').onclick = async ()=>{
      const id = root.querySelector('#id').value.trim().toUpperCase();
      const name = root.querySelector('#name').value.trim();
      const thr = parseFloat(root.querySelector('#thr').value||0);
      const color = root.querySelector('#color').value.trim() || '#666666';
      const logoFile = root.querySelector('#logoFile').files[0];
      const logoUrl = root.querySelector('#logoUrl').value.trim();
      
      if(!id || !name) {
        alert('ID y nombre son obligatorios');
        return;
      }
      
      // Check if ID already exists
      const existingAccounts = getAccounts();
      if(existingAccounts.find(acc => acc.id === id)) {
        alert('Ya existe un banco con ese ID');
        return;
      }
      
      let logo = logoUrl;
      
      // If user uploaded a file, convert to base64
      if(logoFile) {
        try {
          logo = await fileToBase64(logoFile);
        } catch(error) {
          alert('Error al procesar el archivo de imagen');
          return;
        }
      }
      
      const newBank = {
        id, 
        name, 
        threshold: thr,
        color: color,
        logo: logo || null
      };
      
      const arr = getAccounts(); 
      arr.push(newBank); 
      saveAccounts(arr); 
      draw();
      
      // Clear form
      root.querySelector('#id').value=''; 
      root.querySelector('#name').value=''; 
      root.querySelector('#thr').value='';
      root.querySelector('#color').value='';
      root.querySelector('#logoFile').value='';
      root.querySelector('#logoUrl').value='';
      
      alert(`Banco "${name}" añadido correctamente`);
    };
    
    // Global function for editing banks
    window.editBank = function(index) {
      const banks = getAccounts();
      const bank = banks[index];
      if(!bank) return;
      
      // Create edit modal
      const modalOverlay = document.createElement('div');
      modalOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.7); z-index: 1000; display: flex; 
        align-items: center; justify-content: center;
      `;
      
      modalOverlay.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 8px; max-width: 500px; width: 90%;">
          <h2 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 500;">Editar banco: ${bank.name}</h2>
          
          <div style="margin-bottom: 15px;">
            <label style="font-size: 12px; color: var(--text-secondary);">Nombre del banco</label>
            <input type="text" id="editName" value="${bank.name}" style="width: 100%; margin-top: 5px;">
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
              <label style="font-size: 12px; color: var(--text-secondary);">Umbral (€)</label>
              <input type="number" id="editThreshold" value="${bank.threshold}" style="width: 100%; margin-top: 5px;">
            </div>
            <div>
              <label style="font-size: 12px; color: var(--text-secondary);">Color</label>
              <input type="text" id="editColor" value="${bank.color || '#666666'}" style="width: 100%; margin-top: 5px;">
            </div>
          </div>
          
          <div style="margin-bottom: 15px;">
            <label style="font-size: 12px; color: var(--text-secondary);">Logotipo actual</label>
            <div style="margin: 5px 0;">
              ${bank.logo ? `<img src="${bank.logo}" alt="${bank.name}" style="width: 48px; height: 48px; object-fit: contain; border: 1px solid var(--border); border-radius: 4px;">` : '<div style="color: var(--text-secondary);">Sin logotipo</div>'}
            </div>
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="font-size: 12px; color: var(--text-secondary);">Nuevo logotipo</label>
            <input type="file" id="editLogoFile" accept="image/*" style="width: 100%; margin: 5px 0;">
            <input type="text" id="editLogoUrl" placeholder="O URL del logotipo" style="width: 100%;">
          </div>
          
          <div style="text-align: right;">
            <button onclick="closeEditModal()" class="secondary" style="margin-right: 10px;">Cancelar</button>
            <button onclick="saveEditedBank(${index})" class="primary">Guardar cambios</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modalOverlay);
      
      // Modal functions
      window.closeEditModal = () => {
        document.body.removeChild(modalOverlay);
      };
      
      window.saveEditedBank = async (bankIndex) => {
        const name = document.getElementById('editName').value.trim();
        const threshold = parseFloat(document.getElementById('editThreshold').value || 0);
        const color = document.getElementById('editColor').value.trim();
        const logoFile = document.getElementById('editLogoFile').files[0];
        const logoUrl = document.getElementById('editLogoUrl').value.trim();
        
        if(!name) {
          alert('El nombre es obligatorio');
          return;
        }
        
        let logo = bank.logo; // Keep existing logo by default
        
        // If new logo file uploaded
        if(logoFile) {
          try {
            logo = await fileToBase64(logoFile);
          } catch(error) {
            alert('Error al procesar el archivo de imagen');
            return;
          }
        }
        // If new logo URL provided
        else if(logoUrl) {
          logo = logoUrl;
        }
        
        // Update bank
        const banks = getAccounts();
        banks[bankIndex] = {
          ...banks[bankIndex],
          name,
          threshold,
          color,
          logo
        };
        
        saveAccounts(banks);
        draw();
        closeEditModal();
        alert(`Banco "${name}" actualizado correctamente`);
      };
    };
    
    root.querySelector('#addCat').onclick = ()=>{
      const id = root.querySelector('#catId').value.trim();
      const name = root.querySelector('#catName').value.trim();
      const color = root.querySelector('#catColor').value.trim();
      const type = root.querySelector('#catType').value;
      if(!id || !name || !color) return;
      const arr = getCategories(); arr.push({id, name, color, type}); saveCategories(arr); drawCategories();
      root.querySelector('#catId').value=''; root.querySelector('#catName').value=''; root.querySelector('#catColor').value='';
    };
    
    root.querySelector('#addBudget').onclick = ()=>{
      const categoryId = root.querySelector('#budgetCat').value;
      const monthlyLimit = parseFloat(root.querySelector('#budgetLimit').value || 0);
      const alertThreshold = parseInt(root.querySelector('#budgetAlert').value || 80) / 100;
      if(!categoryId || monthlyLimit <= 0) return;
      
      const budgets = getBudgets();
      const existingIndex = budgets.findIndex(b => b.categoryId === categoryId);
      if(existingIndex >= 0) {
        budgets[existingIndex] = {categoryId, monthlyLimit, alertThreshold};
      } else {
        budgets.push({categoryId, monthlyLimit, alertThreshold});
      }
      saveBudgets(budgets); drawBudgets();
      root.querySelector('#budgetCat').value=''; root.querySelector('#budgetLimit').value=''; root.querySelector('#budgetAlert').value='80';
    };
    root.querySelector('#apply').onclick = ()=>{
      const theme = root.querySelector('#theme').value;
      const accent = root.querySelector('#accent').value;
      const s = getSettings(); s.theme=theme; s.accent=accent; setSettings(s); applyTheme();
    };
    root.querySelector('#saveYear').onclick = ()=>{
      const y = parseInt(root.querySelector('#year').value||new Date().getFullYear(),10);
      setYear(y); alert('Año guardado');
    };
  }
};
export default view;
