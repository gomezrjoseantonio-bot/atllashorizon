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
          <h2>📤 Subir Facturas</h2>
          
          <!-- Drag and Drop Zone -->
          <div id="dropZone" style="border: 2px dashed #ccc; border-radius: 10px; padding: 40px; text-align: center; margin-bottom: 15px; transition: border-color 0.3s;">
            <div style="font-size: 48px; margin-bottom: 15px;">📁</div>
            <div style="font-size: 18px; margin-bottom: 10px;">Arrastra y suelta facturas aquí</div>
            <div class="small muted" style="margin-bottom: 15px;">Soporta: PDF, JPG, PNG, ZIP (múltiples facturas)</div>
            <div style="margin-bottom: 15px;">
              <input type="file" id="invoiceFiles" accept=".pdf,.jpg,.jpeg,.png,.zip" multiple style="display: none;">
              <button id="selectFiles" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">📂 Seleccionar Archivos</button>
            </div>
            <div id="fileList" style="margin-top: 15px; text-align: left;"></div>
          </div>
          
          <div style="margin-bottom:15px;">
            <button id="processInvoices" class="primary" disabled>🔍 Procesar con OCR</button>
            <button id="clearFiles" class="secondary" style="margin-left:10px;" disabled>🗑️ Limpiar</button>
          </div>
          
          <div id="ocrProgress" style="display:none; margin-top:15px;">
            <div style="margin-bottom: 10px;">
              <span id="progressText">Procesando archivos...</span>
              <span id="progressCounter" style="float: right;">0/0</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" id="progressFill"></div>
            </div>
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
    const fileInput = root.querySelector('#invoiceFiles');
    const selectFilesBtn = root.querySelector('#selectFiles');
    const processBtn = root.querySelector('#processInvoices');
    const clearBtn = root.querySelector('#clearFiles');
    const dropZone = root.querySelector('#dropZone');
    const fileList = root.querySelector('#fileList');
    
    let selectedFiles = [];
    
    // File selection handler
    selectFilesBtn.onclick = () => fileInput.click();
    
    fileInput.onchange = (e) => {
      handleFiles(e.target.files);
    };
    
    // Drag and drop handlers
    dropZone.ondragover = (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#007bff';
      dropZone.style.backgroundColor = '#f8f9ff';
    };
    
    dropZone.ondragleave = (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#ccc';
      dropZone.style.backgroundColor = '';
    };
    
    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#ccc';
      dropZone.style.backgroundColor = '';
      handleFiles(e.dataTransfer.files);
    };
    
    function handleFiles(files) {
      selectedFiles = Array.from(files);
      displayFileList();
      processBtn.disabled = selectedFiles.length === 0;
      clearBtn.disabled = selectedFiles.length === 0;
    }
    
    function displayFileList() {
      if (selectedFiles.length === 0) {
        fileList.innerHTML = '';
        return;
      }
      
      const fileItems = selectedFiles.map((file, index) => {
        const sizeKB = (file.size / 1024).toFixed(1);
        const isSupported = /\.(pdf|jpe?g|png|zip)$/i.test(file.name);
        
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 5px; ${!isSupported ? 'background: #ffebee;' : ''}">
            <div>
              <span style="font-weight: bold;">${file.name}</span>
              <span class="small muted" style="margin-left: 10px;">${sizeKB} KB</span>
              ${!isSupported ? '<span style="color: red; margin-left: 10px;">❌ Formato no soportado</span>' : ''}
            </div>
            <button onclick="removeFile(${index})" style="background: none; border: none; color: #dc3545; cursor: pointer;">🗑️</button>
          </div>
        `;
      }).join('');
      
      fileList.innerHTML = `
        <div style="margin-bottom: 10px;"><strong>Archivos seleccionados (${selectedFiles.length}):</strong></div>
        ${fileItems}
      `;
    }
    
    window.removeFile = (index) => {
      selectedFiles.splice(index, 1);
      displayFileList();
      processBtn.disabled = selectedFiles.length === 0;
      clearBtn.disabled = selectedFiles.length === 0;
    };
    
    clearBtn.onclick = () => {
      selectedFiles = [];
      fileInput.value = '';
      displayFileList();
      processBtn.disabled = true;
      clearBtn.disabled = true;
    };
    
    processBtn.onclick = async () => {
      if (selectedFiles.length === 0) return;
      await processInvoiceFiles(selectedFiles, root);
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

async function processInvoiceFiles(files, root) {
  const progressContainer = root.querySelector('#ocrProgress');
  const progressFill = root.querySelector('#progressFill');
  const progressText = root.querySelector('#progressText');
  const progressCounter = root.querySelector('#progressCounter');
  const resultsContainer = root.querySelector('#ocrResults');
  
  progressContainer.style.display = 'block';
  resultsContainer.style.display = 'none';
  
  const validFiles = files.filter(file => /\.(pdf|jpe?g|png|zip)$/i.test(file.name));
  let processedCount = 0;
  let allResults = [];
  
  progressCounter.textContent = `${processedCount}/${validFiles.length}`;
  
  for (const file of validFiles) {
    progressText.textContent = `Procesando: ${file.name}`;
    progressFill.style.width = `${(processedCount / validFiles.length) * 100}%`;
    
    try {
      if (file.name.toLowerCase().endsWith('.zip')) {
        // Handle ZIP files (simplified - in real implementation would extract and process each file)
        progressText.textContent = `Procesando ZIP: ${file.name} (simulado)`;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing
        
        // For demo, create multiple sample invoices from ZIP
        for (let i = 1; i <= 3; i++) {
          const mockResult = await ocrService.processInvoice(new File([new Blob()], `invoice_${i}.pdf`, { type: 'application/pdf' }));
          const attachmentId = await storeInvoiceAttachment(file);
          allResults.push({ file: `${file.name}/invoice_${i}.pdf`, result: mockResult, attachmentId });
        }
      } else {
        // Process single file
        const ocrResult = await ocrService.processInvoice(file);
        const attachmentId = await storeInvoiceAttachment(file);
        allResults.push({ file: file.name, result: ocrResult, attachmentId });
      }
    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
      allResults.push({ file: file.name, error: error.message });
    }
    
    processedCount++;
    progressCounter.textContent = `${processedCount}/${validFiles.length}`;
  }
  
  progressFill.style.width = '100%';
  progressText.textContent = 'Procesamiento completado';
  
  // Show batch results
  showBatchOCRResults(allResults, root);
}

async function processInvoiceFile(file, root) {
  // Legacy function for single file processing - kept for compatibility
  return processInvoiceFiles([file], root);
}

function showBatchOCRResults(allResults, root) {
  const resultsContainer = root.querySelector('#ocrResults');
  const properties = getProperties();
  const categories = getCategories();
  
  const successfulResults = allResults.filter(r => !r.error);
  const errorResults = allResults.filter(r => r.error);
  
  resultsContainer.innerHTML = `
    <div class="card" style="border: 2px solid var(--accent);">
      <h3>📊 Resultados del Procesamiento por Lotes</h3>
      
      <div class="row" style="margin-bottom: 20px;">
        <div class="col">
          <div style="text-align: center; padding: 15px; background: #e8f5e8; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: bold; color: #28a745;">${successfulResults.length}</div>
            <div class="small">Archivos procesados</div>
          </div>
        </div>
        <div class="col">
          <div style="text-align: center; padding: 15px; background: ${errorResults.length > 0 ? '#ffebee' : '#f8f9fa'}; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: bold; color: ${errorResults.length > 0 ? '#dc3545' : '#666'};">${errorResults.length}</div>
            <div class="small">Errores</div>
          </div>
        </div>
      </div>
      
      ${errorResults.length > 0 ? `
        <div style="margin-bottom: 20px; padding: 15px; background: #ffebee; border-radius: 8px;">
          <h4 style="color: #dc3545; margin-bottom: 10px;">⚠️ Archivos con errores:</h4>
          ${errorResults.map(r => `<div>• ${r.file}: ${r.error}</div>`).join('')}
        </div>
      ` : ''}
      
      ${successfulResults.length > 0 ? `
        <div style="margin-bottom: 20px;">
          <h4>✅ Facturas procesadas exitosamente:</h4>
          <div style="max-height: 400px; overflow-y: auto;">
            ${successfulResults.map((r, index) => {
              const data = r.result.extractedData;
              const propertySuggestions = ocrService.extractPropertySuggestions(data, properties);
              
              return `
                <div class="batch-invoice-card" style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #fafafa;">
                  <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 10px;">
                    <div style="flex: 1;">
                      <strong>${data.supplier}</strong>
                      <div class="small muted">${r.file}</div>
                    </div>
                    <div style="text-align: right;">
                      <div style="font-size: 18px; font-weight: bold;">${fmtEUR(data.totalAmount)}</div>
                      <div class="small muted">${data.date}</div>
                    </div>
                  </div>
                  
                  <div class="row">
                    <div class="col">
                      <label class="small muted">Concepto</label><br/>
                      <input type="text" class="batch-concept-${index}" value="${data.concept}" style="width:100%; font-size: 12px;">
                    </div>
                    <div class="col">
                      <label class="small muted">Categoría</label><br/>
                      <select class="batch-category-${index}" style="width:100%; font-size: 12px;">
                        ${categories.filter(c => c.type === 'expense').map(cat => `
                          <option value="${cat.id}" ${cat.id === data.suggestedCategory ? 'selected' : ''}>
                            ${cat.deductible ? '✅' : '❌'} ${cat.name}
                          </option>
                        `).join('')}
                      </select>
                    </div>
                    <div class="col">
                      <label class="small muted">Inmueble</label><br/>
                      <select class="batch-property-${index}" style="width:100%; font-size: 12px;">
                        <option value="">-- Sin inmueble --</option>
                        ${properties.map(prop => `
                          <option value="${prop.id}" ${propertySuggestions[0]?.property.id === prop.id ? 'selected' : ''}>
                            ${prop.address || 'Sin dirección'}
                          </option>
                        `).join('')}
                      </select>
                    </div>
                  </div>
                  
                  <div style="margin-top: 10px; text-align: right;">
                    <button onclick="saveBatchInvoice(${index}, '${r.attachmentId}')" class="small success">💾 Guardar</button>
                    <button onclick="removeBatchInvoice(${index})" class="small danger">🗑️ Descartar</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
          <button onclick="saveAllBatchInvoices()" class="primary" style="margin-right: 10px;">💾 Guardar Todas</button>
          <button onclick="cancelBatchOCR()" class="secondary">❌ Cancelar Todo</button>
        </div>
      ` : ''}
    </div>
  `;
  
  resultsContainer.style.display = 'block';
  
  // Store batch data globally for save functions
  window.batchResults = successfulResults;
  
  // Global functions for batch operations
  window.saveBatchInvoice = (index, attachmentId) => {
    const result = window.batchResults[index];
    const data = result.result.extractedData;
    
    const concept = root.querySelector(`.batch-concept-${index}`).value;
    const category = root.querySelector(`.batch-category-${index}`).value;
    const propertyId = root.querySelector(`.batch-property-${index}`).value;
    
    saveSingleBatchInvoice(data, concept, category, propertyId, attachmentId);
    
    // Remove from batch
    window.batchResults.splice(index, 1);
    showBatchOCRResults(window.batchResults, root);
    
    if (window.batchResults.length === 0) {
      cancelBatchOCR();
      view.mount(root.parentElement.parentElement);
    }
  };
  
  window.removeBatchInvoice = (index) => {
    window.batchResults.splice(index, 1);
    showBatchOCRResults(window.batchResults, root);
  };
  
  window.saveAllBatchInvoices = () => {
    window.batchResults.forEach((result, index) => {
      const data = result.result.extractedData;
      const concept = root.querySelector(`.batch-concept-${index}`).value;
      const category = root.querySelector(`.batch-category-${index}`).value;
      const propertyId = root.querySelector(`.batch-property-${index}`).value;
      
      saveSingleBatchInvoice(data, concept, category, propertyId, result.attachmentId);
    });
    
    alert(`✅ Se han guardado ${window.batchResults.length} facturas correctamente`);
    cancelBatchOCR();
    view.mount(root.parentElement.parentElement);
  };
  
  window.cancelBatchOCR = () => {
    resultsContainer.style.display = 'none';
    root.querySelector('#ocrProgress').style.display = 'none';
    root.querySelector('#invoiceFiles').value = '';
    root.querySelector('#processInvoices').disabled = true;
    root.querySelector('#clearFiles').disabled = true;
    root.querySelector('#fileList').innerHTML = '';
    window.batchResults = [];
  };
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
    root.querySelector('#invoiceFiles').value = '';
    root.querySelector('#processInvoices').disabled = true;
    root.querySelector('#clearFiles').disabled = true;
    root.querySelector('#fileList').innerHTML = '';
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

// Modal functions for invoice actions
function editInvoiceModal(invoiceId, root) {
  const invoices = getInvoices();
  const invoice = invoices.find(inv => inv.id === invoiceId);
  if (!invoice) return;
  
  const categories = getCategories();
  const properties = getProperties();
  
  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,0,0,0.7); z-index: 1000; display: flex; 
    align-items: center; justify-content: center;
  `;
  
  modalOverlay.innerHTML = `
    <div style="background: white; padding: 30px; border-radius: 12px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
      <h2>✏️ Editar Factura</h2>
      
      <div class="row">
        <div class="col">
          <label class="small muted">Proveedor *</label><br/>
          <input type="text" id="editSupplier" value="${invoice.supplier || ''}" style="width:100%; margin-bottom:10px">
        </div>
        <div class="col">
          <label class="small muted">Fecha *</label><br/>
          <input type="date" id="editDate" value="${invoice.date || ''}" style="width:100%; margin-bottom:10px">
        </div>
      </div>
      
      <div style="margin-bottom:10px;">
        <label class="small muted">Concepto *</label><br/>
        <input type="text" id="editConcept" value="${invoice.concept || ''}" style="width:100%; margin-bottom:10px">
      </div>
      
      <div class="row">
        <div class="col">
          <label class="small muted">Importe Total (€) *</label><br/>
          <input type="number" id="editAmount" value="${invoice.totalAmount || 0}" step="0.01" style="width:100%; margin-bottom:10px">
        </div>
        <div class="col">
          <label class="small muted">Categoría Fiscal *</label><br/>
          <select id="editCategory" style="width:100%; margin-bottom:10px">
            ${categories.filter(c => c.type === 'expense').map(cat => `
              <option value="${cat.id}" ${cat.id === invoice.category ? 'selected' : ''}>
                ${cat.deductible ? '✅' : '❌'} ${cat.name}
              </option>
            `).join('')}
          </select>
        </div>
      </div>
      
      <div style="margin-bottom:15px;">
        <label class="small muted">Inmueble Asociado</label><br/>
        <select id="editProperty" style="width:100%; margin-bottom:10px">
          <option value="">-- Sin inmueble específico --</option>
          ${properties.map(prop => `
            <option value="${prop.id}" ${prop.id === invoice.propertyId ? 'selected' : ''}>
              ${prop.address || 'Sin dirección'} (${prop.city || 'Sin ciudad'})
            </option>
          `).join('')}
        </select>
      </div>
      
      <div style="margin-bottom:15px;">
        <label class="small muted">Estado</label><br/>
        <select id="editStatus" style="width:200px; margin-bottom:10px">
          <option value="pending" ${invoice.status === 'pending' ? 'selected' : ''}>⏳ Pendiente</option>
          <option value="verified" ${invoice.status === 'verified' ? 'selected' : ''}>✅ Verificada</option>
          <option value="rejected" ${invoice.status === 'rejected' ? 'selected' : ''}>❌ Rechazada</option>
        </select>
      </div>
      
      <div style="text-align: right; margin-top: 20px;">
        <button onclick="closeEditModal()" style="margin-right: 10px; background: #666; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">❌ Cancelar</button>
        <button onclick="saveEditedInvoice('${invoiceId}')" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">💾 Guardar Cambios</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modalOverlay);
  
  // Global functions for modal
  window.closeEditModal = () => {
    document.body.removeChild(modalOverlay);
  };
  
  window.saveEditedInvoice = (invoiceId) => {
    const supplier = document.getElementById('editSupplier').value;
    const concept = document.getElementById('editConcept').value;
    const date = document.getElementById('editDate').value;
    const amount = parseFloat(document.getElementById('editAmount').value);
    const category = document.getElementById('editCategory').value;
    const propertyId = document.getElementById('editProperty').value;
    const status = document.getElementById('editStatus').value;
    
    if (!supplier || !concept || !date || !amount || !category) {
      alert('Por favor, completa todos los campos obligatorios');
      return;
    }
    
    // Update invoice
    updateInvoice(invoiceId, {
      supplier,
      concept,
      date,
      totalAmount: amount,
      baseAmount: amount / 1.21, // Assuming 21% VAT
      vatAmount: amount - (amount / 1.21),
      category,
      propertyId: propertyId || null,
      status
    });
    
    // Update corresponding transaction if it exists
    const transactions = getReal();
    const transactionIndex = transactions.findIndex(t => t.invoiceId === invoiceId);
    if (transactionIndex >= 0) {
      transactions[transactionIndex] = {
        ...transactions[transactionIndex],
        date,
        concept: `${supplier} - ${concept}`,
        amount: -amount,
        category
      };
      saveReal(transactions);
    }
    
    closeEditModal();
    alert('✅ Factura actualizada correctamente');
    
    // Refresh the view
    view.mount(root.parentElement.parentElement);
  };
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

function saveSingleBatchInvoice(data, concept, category, propertyId, attachmentId) {
  const invoice = addInvoice({
    supplier: data.supplier,
    concept,
    date: data.date,
    totalAmount: data.totalAmount,
    baseAmount: data.totalAmount / 1.21,
    vatAmount: data.totalAmount - (data.totalAmount / 1.21),
    category,
    propertyId: propertyId || null,
    attachmentId,
    confidence: 0.85,
    status: 'verified'
  });
  
  // Add to financial transactions
  const transactions = getReal();
  transactions.push({
    date: data.date,
    bank: 'FACTURA',
    concept: `${data.supplier} - ${concept}`,
    amount: -data.totalAmount,
    category,
    invoiceId: invoice.id
  });
  saveReal(transactions);
}

export default view;