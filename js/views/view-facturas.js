import { getInvoices, saveInvoices, addInvoice, updateInvoice, deleteInvoice, getInvoiceAttachments, saveInvoiceAttachments, getProperties, getReal, saveReal, getCategories } from '../storage.js';
import { fmtEUR, parseEuro } from '../utils.js';
import { OCRService, classifyExpense } from '../ocr-service.js';
import { addSampleInvoices } from '../demo-invoices.js';

console.log('Loading invoice management view module');

const ocrService = new OCRService();

const view = {
  route: '#/facturas', 
  title: 'Facturas',
  async mount(root) {
    const invoices = getInvoices();
    const categories = getCategories();
    const properties = getProperties();
    
    root.innerHTML = `
      <div class="row">
        <div class="col"><div class="card">
          <h1>📄 Gestión de Facturas con OCR</h1>
          <div class="muted">Sube facturas (PDF/JPG/PNG) para clasificación automática</div>
        </div></div>
      </div>
      
      <div class="row">
        <div class="col"><div class="card">
          <h2>📤 Subir Nueva Factura</h2>
          <div style="margin-bottom:15px;">
            <label class="small muted">Seleccionar archivo (PDF, JPG, PNG)</label><br/>
            <input type="file" id="invoiceFile" accept=".pdf,.jpg,.jpeg,.png" style="margin-bottom:10px">
            <button id="processInvoice" class="primary" disabled>🔍 Procesar con OCR</button>
          </div>
          
          <div id="ocrProgress" style="display:none; margin-top:15px;">
            <div class="progress-bar">
              <div class="progress-fill" id="progressFill"></div>
            </div>
            <div class="small muted">Procesando factura con OCR...</div>
          </div>
          
          <div id="ocrResults" style="display:none; margin-top:20px;">
            <!-- OCR results will be displayed here -->
          </div>
        </div></div>
      </div>
      
      <div class="row">
        <div class="col"><div class="card">
          <h2>📋 Facturas Procesadas <span class="badge">${invoices.length}</span></h2>
          <div class="grid" id="invoicesTable">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Concepto</th>
                  <th>Importe</th>
                  <th>Categoría</th>
                  <th>Inmueble</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.map(inv => `
                  <tr>
                    <td>${inv.date || '-'}</td>
                    <td>${inv.supplier || '-'}</td>
                    <td title="${inv.concept || ''}">${(inv.concept || '').substring(0, 30)}${(inv.concept || '').length > 30 ? '...' : ''}</td>
                    <td>${fmtEUR(inv.totalAmount || 0)}</td>
                    <td>
                      <span style="color:${getCategoryColor(inv.category, categories)}">${getCategoryName(inv.category, categories)}</span>
                    </td>
                    <td>${getPropertyName(inv.propertyId, properties)}</td>
                    <td>
                      <span class="badge ${inv.status === 'verified' ? 'success' : inv.status === 'rejected' ? 'danger' : 'warning'}">
                        ${inv.status === 'verified' ? '✅ Verificada' : inv.status === 'rejected' ? '❌ Rechazada' : '⏳ Pendiente'}
                      </span>
                    </td>
                    <td>
                      <button onclick="editInvoice('${inv.id}')" class="small">✏️ Editar</button>
                      <button onclick="viewInvoice('${inv.id}')" class="small">👁️ Ver</button>
                      ${inv.status === 'pending' ? `<button onclick="verifyInvoice('${inv.id}')" class="small success">✅ Verificar</button>` : ''}
                      <button onclick="deleteInvoice('${inv.id}')" class="small danger">🗑️</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div></div>
      </div>
      
      <div class="row">
        <div class="col"><div class="card">
          <h2>📊 Resumen Fiscal</h2>
          <div class="row">
            <div class="col">
              <h3>Gastos Deducibles</h3>
              <div class="kpi text-success">${fmtEUR(calculateDeductibleAmount(invoices, categories))}</div>
              <div class="small muted">Total gastos deducibles del año</div>
            </div>
            <div class="col">
              <h3>Gastos No Deducibles</h3>
              <div class="kpi text-danger">${fmtEUR(calculateNonDeductibleAmount(invoices, categories))}</div>
              <div class="small muted">Total gastos no deducibles del año</div>
            </div>
            <div class="col">
              <h3>Facturas Pendientes</h3>
              <div class="kpi text-warning">${invoices.filter(inv => inv.status === 'pending').length}</div>
              <div class="small muted">Requieren verificación manual</div>
            </div>
          </div>
          
          <div style="margin-top:20px;">
            <button id="exportTaxReport" class="primary">📄 Exportar Informe Fiscal</button>
            <button id="exportDeductibleExpenses" class="secondary">📊 Exportar Gastos Deducibles (Excel)</button>
            <button id="loadDemoData" class="warning" style="margin-left:20px;">🧪 Cargar Datos Demo</button>
          </div>
        </div></div>
      </div>
    `;

    // Event handlers
    const fileInput = root.querySelector('#invoiceFile');
    const processBtn = root.querySelector('#processInvoice');
    
    fileInput.onchange = () => {
      processBtn.disabled = !fileInput.files[0];
    };
    
    processBtn.onclick = async () => {
      const file = fileInput.files[0];
      if (!file) return;
      
      await processInvoiceFile(file, root);
    };
    
    root.querySelector('#exportTaxReport').onclick = () => exportTaxReport(invoices, categories);
    root.querySelector('#exportDeductibleExpenses').onclick = () => exportDeductibleExpenses(invoices, categories);
    root.querySelector('#loadDemoData').onclick = () => {
      const result = addSampleInvoices();
      alert(result.message);
      view.mount(root.parentElement.parentElement); // Refresh view
    };
    
    // Global functions for invoice actions
    window.editInvoice = (invoiceId) => editInvoiceModal(invoiceId, root);
    window.viewInvoice = (invoiceId) => viewInvoiceModal(invoiceId, root);
    window.verifyInvoice = (invoiceId) => verifyInvoiceAction(invoiceId, root);
    window.deleteInvoice = (invoiceId) => deleteInvoiceAction(invoiceId, root);
  }
};

async function processInvoiceFile(file, root) {
  const progressContainer = root.querySelector('#ocrProgress');
  const progressFill = root.querySelector('#progressFill');
  const resultsContainer = root.querySelector('#ocrResults');
  
  progressContainer.style.display = 'block';
  resultsContainer.style.display = 'none';
  
  // Animate progress
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += 2;
    progressFill.style.width = Math.min(progress, 90) + '%';
  }, 50);
  
  try {
    // Process with OCR
    const ocrResult = await ocrService.processInvoice(file);
    clearInterval(progressInterval);
    progressFill.style.width = '100%';
    
    // Store file attachment
    const attachmentId = await storeInvoiceAttachment(file);
    
    // Get property suggestions
    const properties = getProperties();
    const propertySuggestions = ocrService.extractPropertySuggestions(ocrResult.extractedData, properties);
    
    // Show results for review
    showOCRResults(ocrResult, propertySuggestions, attachmentId, root);
    
  } catch (error) {
    clearInterval(progressInterval);
    progressContainer.style.display = 'none';
    alert('Error procesando la factura: ' + error.message);
  }
}

function showOCRResults(ocrResult, propertySuggestions, attachmentId, root) {
  const categories = getCategories();
  const properties = getProperties();
  const data = ocrResult.extractedData;
  
  const resultsContainer = root.querySelector('#ocrResults');
  resultsContainer.innerHTML = `
    <div class="card" style="border: 2px solid var(--accent);">
      <h3>📄 Datos Extraídos de la Factura</h3>
      <div class="row">
        <div class="col">
          <div style="margin-bottom:10px;">
            <strong>Confianza OCR:</strong> 
            <span class="badge ${ocrResult.confidence > 0.8 ? 'success' : ocrResult.confidence > 0.6 ? 'warning' : 'danger'}">
              ${(ocrResult.confidence * 100).toFixed(1)}%
            </span>
          </div>
          
          <label class="small muted">Proveedor</label><br/>
          <input type="text" id="ocrSupplier" value="${data.supplier}" style="width:100%; margin-bottom:10px">
          
          <label class="small muted">Concepto</label><br/>
          <input type="text" id="ocrConcept" value="${data.concept}" style="width:100%; margin-bottom:10px">
          
          <label class="small muted">Fecha</label><br/>
          <input type="date" id="ocrDate" value="${data.date}" style="width:100%; margin-bottom:10px">
          
          <label class="small muted">Importe Total</label><br/>
          <input type="number" id="ocrAmount" value="${data.totalAmount}" step="0.01" style="width:100%; margin-bottom:10px">
        </div>
        
        <div class="col">
          <label class="small muted">Categoría Fiscal</label><br/>
          <select id="ocrCategory" style="width:100%; margin-bottom:10px">
            ${categories.filter(c => c.type === 'expense').map(cat => `
              <option value="${cat.id}" ${cat.id === data.suggestedCategory ? 'selected' : ''}>
                ${cat.deductible ? '✅' : '❌'} ${cat.name}
              </option>
            `).join('')}
          </select>
          
          <label class="small muted">Inmueble Asociado</label><br/>
          <select id="ocrProperty" style="width:100%; margin-bottom:10px">
            <option value="">-- Seleccionar inmueble --</option>
            ${properties.map(prop => `
              <option value="${prop.id}" ${propertySuggestions[0]?.property.id === prop.id ? 'selected' : ''}>
                ${prop.address || 'Sin dirección'} (${prop.city || 'Sin ciudad'})
              </option>
            `).join('')}
          </select>
          
          ${propertySuggestions.length > 0 ? `
            <div class="small muted" style="margin-bottom:10px;">
              <strong>Sugerencias automáticas:</strong><br/>
              ${propertySuggestions.slice(0, 2).map(sug => 
                `• ${sug.property.address} (${(sug.confidence * 100).toFixed(1)}% confianza)`
              ).join('<br/>')}
            </div>
          ` : ''}
          
          <div style="margin-top:15px;">
            <button id="saveInvoice" class="primary" onclick="saveOCRInvoice('${attachmentId}')">💾 Guardar Factura</button>
            <button onclick="cancelOCR()" class="secondary">❌ Cancelar</button>
          </div>
        </div>
      </div>
      
      <details style="margin-top:15px;">
        <summary>📝 Texto extraído (OCR)</summary>
        <pre style="background:#f5f5f5; padding:10px; margin-top:10px; white-space:pre-wrap; font-size:12px;">${ocrResult.rawText}</pre>
      </details>
    </div>
  `;
  
  resultsContainer.style.display = 'block';
  
  // Global save function
  window.saveOCRInvoice = (attachmentId) => saveInvoiceFromOCR(attachmentId, root);
  window.cancelOCR = () => {
    resultsContainer.style.display = 'none';
    root.querySelector('#ocrProgress').style.display = 'none';
    root.querySelector('#invoiceFile').value = '';
    root.querySelector('#processInvoice').disabled = true;
  };
}

async function storeInvoiceAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const attachmentId = 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const attachments = getInvoiceAttachments();
      
      attachments[attachmentId] = {
        id: attachmentId,
        filename: file.name,
        type: file.type,
        size: file.size,
        data: reader.result, // Base64 data
        uploadedAt: new Date().toISOString()
      };
      
      saveInvoiceAttachments(attachments);
      resolve(attachmentId);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function saveInvoiceFromOCR(attachmentId, root) {
  const supplier = root.querySelector('#ocrSupplier').value;
  const concept = root.querySelector('#ocrConcept').value;
  const date = root.querySelector('#ocrDate').value;
  const amount = parseFloat(root.querySelector('#ocrAmount').value);
  const category = root.querySelector('#ocrCategory').value;
  const propertyId = root.querySelector('#ocrProperty').value;
  
  if (!supplier || !concept || !date || !amount) {
    alert('Por favor, completa todos los campos obligatorios');
    return;
  }
  
  // Create invoice record
  const invoice = addInvoice({
    supplier,
    concept,
    date,
    totalAmount: amount,
    baseAmount: amount / 1.21, // Assuming 21% VAT
    vatAmount: amount - (amount / 1.21),
    category,
    propertyId: propertyId || null,
    attachmentId,
    confidence: 0.9, // User-reviewed confidence
    status: 'verified'
  });
  
  // Add to financial transactions
  const transactions = getReal();
  transactions.push({
    date,
    bank: 'FACTURA', // Special bank for invoice-based expenses
    concept: `${supplier} - ${concept}`,
    amount: -amount, // Negative for expense
    category,
    invoiceId: invoice.id
  });
  saveReal(transactions);
  
  alert('✅ Factura guardada y añadida a las transacciones');
  
  // Refresh the view
  view.mount(root.parentElement.parentElement);
}

function getCategoryColor(categoryId, categories) {
  const category = categories.find(c => c.id === categoryId);
  return category ? category.color : '#666';
}

function getCategoryName(categoryId, categories) {
  const category = categories.find(c => c.id === categoryId);
  return category ? category.name : 'Sin categoría';
}

function getPropertyName(propertyId, properties) {
  if (!propertyId) return '-';
  const property = properties.find(p => p.id === propertyId);
  return property ? (property.address || 'Sin dirección') : '-';
}

function calculateDeductibleAmount(invoices, categories) {
  const deductibleCategories = categories.filter(c => c.deductible).map(c => c.id);
  return invoices
    .filter(inv => inv.status === 'verified' && deductibleCategories.includes(inv.category))
    .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
}

function calculateNonDeductibleAmount(invoices, categories) {
  const nonDeductibleCategories = categories.filter(c => !c.deductible).map(c => c.id);
  return invoices
    .filter(inv => inv.status === 'verified' && nonDeductibleCategories.includes(inv.category))
    .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
}

function exportTaxReport(invoices, categories) {
  const deductibleInvoices = invoices.filter(inv => {
    const category = categories.find(c => c.id === inv.category);
    return inv.status === 'verified' && category?.deductible;
  });
  
  let csvContent = 'Fecha,Proveedor,Concepto,Importe,Categoría,Deducible\n';
  
  deductibleInvoices.forEach(inv => {
    const category = categories.find(c => c.id === inv.category);
    csvContent += `"${inv.date}","${inv.supplier}","${inv.concept}","${inv.totalAmount}","${category?.name}","Sí"\n`;
  });
  
  downloadCSV(csvContent, `informe-fiscal-${new Date().getFullYear()}.csv`);
}

function exportDeductibleExpenses(invoices, categories) {
  const deductibleInvoices = invoices.filter(inv => {
    const category = categories.find(c => c.id === inv.category);
    return inv.status === 'verified' && category?.deductible;
  });
  
  // Group by category
  const byCategory = {};
  deductibleInvoices.forEach(inv => {
    const category = categories.find(c => c.id === inv.category);
    const categoryName = category?.name || 'Sin categoría';
    
    if (!byCategory[categoryName]) {
      byCategory[categoryName] = [];
    }
    byCategory[categoryName].push(inv);
  });
  
  let csvContent = 'Categoría Fiscal,Fecha,Proveedor,Concepto,Importe Base,IVA,Total\n';
  
  Object.entries(byCategory).forEach(([categoryName, invoices]) => {
    invoices.forEach(inv => {
      csvContent += `"${categoryName}","${inv.date}","${inv.supplier}","${inv.concept}","${(inv.baseAmount || 0).toFixed(2)}","${(inv.vatAmount || 0).toFixed(2)}","${inv.totalAmount.toFixed(2)}"\n`;
    });
  });
  
  downloadCSV(csvContent, `gastos-deducibles-${new Date().getFullYear()}.csv`);
}

function downloadCSV(content, filename) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Placeholder functions for modal actions
function editInvoiceModal(invoiceId, root) {
  alert('Función de edición en desarrollo');
}

function viewInvoiceModal(invoiceId, root) {
  const invoices = getInvoices();
  const invoice = invoices.find(inv => inv.id === invoiceId);
  if (!invoice) return;
  
  alert(`Factura: ${invoice.supplier}\nConcepto: ${invoice.concept}\nImporte: ${fmtEUR(invoice.totalAmount)}\nFecha: ${invoice.date}`);
}

function verifyInvoiceAction(invoiceId, root) {
  updateInvoice(invoiceId, { status: 'verified' });
  view.mount(root.parentElement.parentElement);
}

function deleteInvoiceAction(invoiceId, root) {
  if (confirm('¿Estás seguro de que quieres eliminar esta factura?')) {
    deleteInvoice(invoiceId);
    view.mount(root.parentElement.parentElement);
  }
}

export default view;