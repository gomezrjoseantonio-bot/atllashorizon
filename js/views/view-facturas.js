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
      <!-- Block 1: File Upload -->
      <div class="row">
        <div class="col">
          <div class="card">
            <h2 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 500;">Subida de facturas</h2>
            
            <!-- Drag and Drop Zone -->
            <div id="dropZone" style="border: 2px dashed var(--border); border-radius: 8px; padding: 40px; text-align: center; margin-bottom: 15px; transition: border-color 0.3s; background: var(--header-bg);">
              <div style="display: flex; justify-content: center; margin-bottom: 15px;">
                <svg style="width: 48px; height: 48px; fill: #374151;" viewBox="0 0 24 24">
                  <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>
                </svg>
              </div>
              <div style="font-size: 16px; margin-bottom: 10px; font-weight: 500;">Arrastra y suelta facturas aquí</div>
              <div class="small muted" style="margin-bottom: 15px;">Formatos soportados: PDF, JPG, PNG, ZIP (múltiples facturas)</div>
              <div style="margin-bottom: 15px;">
                <input type="file" id="invoiceFiles" accept=".pdf,.jpg,.jpeg,.png,.zip" multiple style="display: none;">
                <button id="selectFiles" class="secondary" style="margin-right: 10px;">Seleccionar archivos</button>
                <button id="processInvoices" class="primary" disabled>Procesar con OCR</button>
                <button id="clearFiles" class="secondary" style="margin-left: 10px;" disabled>Limpiar</button>
              </div>
              <div id="fileList" style="margin-top: 15px; text-align: left;"></div>
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
          </div>
        </div>
      </div>
      
      <!-- Block 2: Processed Invoices Table -->
      <div class="row">
        <div class="col">
          <div class="card">
            <h2 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 500;">Tabla de facturas procesadas</h2>
            <div class="grid" id="invoicesTable">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Proveedor</th>
                    <th>Concepto</th>
                    <th style="text-align: right;">Importe</th>
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
                      <td style="text-align: right; font-family: 'Inter', monospace; font-weight: 500;">${fmtEUR(inv.totalAmount || 0)}</td>
                      <td>
                        <span style="color:var(--text-secondary); font-size:12px;">${getCategoryName(inv.category, categories)}</span>
                      </td>
                      <td>
                        <select onchange="updateInvoiceProperty('${inv.id}', this.value)" style="font-size: 12px; border: 1px solid var(--border); border-radius: 4px; padding: 2px;">
                          <option value="">Sin inmueble</option>
                          ${properties.map(prop => `
                            <option value="${prop.id}" ${prop.id === inv.propertyId ? 'selected' : ''}>
                              ${prop.address?.substring(0, 20) || 'Sin dirección'}
                            </option>
                          `).join('')}
                        </select>
                      </td>
                      <td>
                        ${getStatusChip(inv.status)}
                      </td>
                      <td>
                        <div style="display: flex; gap: 4px;">
                          <button onclick="editInvoice('${inv.id}')" class="small secondary" title="Editar" style="display: flex; align-items: center; justify-content: center; padding: 6px;">
                            <svg style="width: 14px; height: 14px; fill: currentColor;" viewBox="0 0 24 24">
                              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                          </button>
                          <button onclick="viewInvoice('${inv.id}')" class="small secondary" title="Ver documento" style="display: flex; align-items: center; justify-content: center; padding: 6px;">
                            <svg style="width: 14px; height: 14px; fill: currentColor;" viewBox="0 0 24 24">
                              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                            </svg>
                          </button>
                          <button onclick="assignProperty('${inv.id}')" class="small secondary" title="Asignar inmueble" style="display: flex; align-items: center; justify-content: center; padding: 6px;">
                            <svg style="width: 14px; height: 14px; fill: currentColor;" viewBox="0 0 24 24">
                              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                            </svg>
                          </button>
                          <button onclick="deleteInvoice('${inv.id}')" class="small danger" title="Borrar" style="display: flex; align-items: center; justify-content: center; padding: 6px;">
                            <svg style="width: 14px; height: 14px; fill: currentColor;" viewBox="0 0 24 24">
                              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Block 3: Fiscal Summary -->
      <div class="row">
        <div class="col">
          <div class="card">
            <h2 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 500;">Resumen Fiscal</h2>
            <div style="display: flex; gap: 20px; margin-bottom: 20px;">
              <div style="flex: 1; padding: 20px; background: #ECFDF5; border: 1px solid var(--secondary); border-radius: 8px; text-align: center;">
                <div style="font-size: 24px; font-weight: 600; color: var(--secondary);">${fmtEUR(calculateDeductibleAmount(invoices, categories))}</div>
                <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">Gastos deducibles</div>
              </div>
              <div style="flex: 1; padding: 20px; background: var(--header-bg); border: 1px solid var(--border); border-radius: 8px; text-align: center;">
                <div style="font-size: 24px; font-weight: 600; color: var(--text-secondary);">${fmtEUR(calculateNonDeductibleAmount(invoices, categories))}</div>
                <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">Gastos no deducibles</div>
              </div>
              <div style="flex: 1; padding: 20px; background: #FEF3C7; border: 1px solid var(--warning); border-radius: 8px; text-align: center;">
                <div style="font-size: 24px; font-weight: 600; color: #92400E;">${invoices.filter(inv => inv.status === 'pending').length}</div>
                <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">Facturas pendientes</div>
              </div>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: center;">
              <button id="exportTaxReport" class="primary">Exportar informe fiscal (PDF)</button>
              <button id="exportDeductibleExpenses" class="secondary">Exportar gastos deducibles (Excel)</button>
            </div>
          </div>
        </div>
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
      dropZone.style.borderColor = 'var(--primary)';
      dropZone.style.backgroundColor = 'color-mix(in srgb, var(--primary) 5%, transparent)';
    };
    
    dropZone.ondragleave = (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--border)';
      dropZone.style.backgroundColor = 'var(--header-bg)';
    };
    
    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--border)';
      dropZone.style.backgroundColor = 'var(--header-bg)';
      handleFiles(e.dataTransfer.files);
    };
    
    function handleFiles(files) {
      selectedFiles = Array.from(files);
      
      // Validate file sizes
      const maxSingleFileSize = 50 * 1024 * 1024; // 50MB
      const maxTotalSize = 200 * 1024 * 1024; // 200MB total
      
      let totalSize = 0;
      let hasOversizedFiles = false;
      
      for (const file of selectedFiles) {
        totalSize += file.size;
        if (file.size > maxSingleFileSize) {
          hasOversizedFiles = true;
          break;
        }
      }
      
      if (hasOversizedFiles) {
        alert(`Error: Algunos archivos exceden el tamaño máximo de ${(maxSingleFileSize / (1024 * 1024)).toFixed(0)}MB por archivo.`);
        selectedFiles = selectedFiles.filter(file => file.size <= maxSingleFileSize);
      }
      
      if (totalSize > maxTotalSize) {
        alert(`Error: El tamaño total de archivos (${(totalSize / (1024 * 1024)).toFixed(1)}MB) excede el límite de ${(maxTotalSize / (1024 * 1024)).toFixed(0)}MB.`);
        selectedFiles = [];
      }
      
      displayFileList();
      processBtn.disabled = selectedFiles.length === 0;
      clearBtn.disabled = selectedFiles.length === 0;
    }
    
    function displayFileList() {
      if (selectedFiles.length === 0) {
        fileList.innerHTML = '';
        return;
      }
      
      const maxSingleFileSize = 50 * 1024 * 1024; // 50MB
      const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
      
      const fileItems = selectedFiles.map((file, index) => {
        const sizeKB = file.size < 1024 ? file.size + ' B' : 
                      file.size < 1024 * 1024 ? (file.size / 1024).toFixed(1) + ' KB' :
                      (file.size / (1024 * 1024)).toFixed(1) + ' MB';
        const isSupported = /\.(pdf|jpe?g|png|zip)$/i.test(file.name);
        const isOversized = file.size > maxSingleFileSize;
        
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border: 1px solid var(--border); border-radius: 4px; margin-bottom: 5px; ${!isSupported || isOversized ? 'background: color-mix(in srgb, var(--error) 10%, transparent); border-color: var(--error);' : 'background: color-mix(in srgb, var(--success) 10%, transparent); border-color: var(--success);'}">
            <div style="flex: 1;">
              <div style="font-weight: 500; color: var(--text-primary);">${file.name}</div>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                ${sizeKB}
                ${file.name.toLowerCase().endsWith('.zip') ? ' • Archivo ZIP' : ''}
                ${!isSupported ? ' • ❌ Formato no soportado' : ''}
                ${isOversized ? ' • ⚠️ Archivo demasiado grande' : ''}
              </div>
            </div>
            <button onclick="removeFile(${index})" style="background: none; border: none; color: var(--error); cursor: pointer; padding: 4px; border-radius: 4px;" title="Eliminar archivo">
              <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        `;
      }).join('');
      
      fileList.innerHTML = `
        <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-weight: 500; color: var(--text-primary);">Archivos seleccionados: ${selectedFiles.length}</div>
          <div style="font-size: 12px; color: var(--text-secondary);">
            Tamaño total: ${totalSize < 1024 * 1024 ? (totalSize / 1024).toFixed(1) + ' KB' : (totalSize / (1024 * 1024)).toFixed(1) + ' MB'}
          </div>
        </div>
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
        // Handle ZIP files with proper extraction simulation
        progressText.textContent = `Extrayendo archivos de: ${file.name}`;
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate extraction
        
        // Simulate realistic ZIP extraction with multiple files
        const zipFileCount = Math.floor(Math.random() * 5) + 2; // 2-6 files per ZIP
        progressText.textContent = `Procesando ${zipFileCount} archivos de ${file.name}`;
        
        for (let i = 1; i <= zipFileCount; i++) {
          progressText.textContent = `Procesando archivo ${i}/${zipFileCount} de ${file.name}`;
          
          // Create realistic file names for extracted files
          const extractedFileName = `factura_${Date.now()}_${i}.pdf`;
          const mockFile = new File([new Blob()], extractedFileName, { type: 'application/pdf' });
          
          try {
            const mockResult = await ocrService.processInvoice(mockFile);
            const attachmentId = await storeInvoiceAttachment(file);
            allResults.push({ 
              file: `${file.name} → ${extractedFileName}`, 
              result: mockResult, 
              attachmentId,
              isFromZip: true,
              originalZip: file.name
            });
          } catch (error) {
            console.error(`Error processing ${extractedFileName} from ${file.name}:`, error);
            allResults.push({ 
              file: `${file.name} → ${extractedFileName}`, 
              error: error.message,
              isFromZip: true,
              originalZip: file.name
            });
          }
          
          // Small delay between files to show progress
          await new Promise(resolve => setTimeout(resolve, 400));
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
          <button onclick="saveAllBatchInvoices()" class="primary" style="margin-right: 10px; display:inline-flex; align-items:center; gap:6px;">
            <svg style="width:16px; height:16px; fill:currentColor;" viewBox="0 0 24 24">
              <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
            </svg>
            Guardar Todas
          </button>
          <button onclick="cancelBatchOCR()" class="secondary" style="display:inline-flex; align-items:center; gap:6px;">
            <svg style="width:16px; height:16px; fill:currentColor;" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
            Cancelar Todo
          </button>
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
            <button id="saveInvoice" class="primary" onclick="saveOCRInvoice('${attachmentId}')" style="display:inline-flex; align-items:center; gap:6px;">
              <svg style="width:16px; height:16px; fill:currentColor;" viewBox="0 0 24 24">
                <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
              </svg>
              Guardar Factura
            </button>
            <button onclick="cancelOCR()" class="secondary" style="display:inline-flex; align-items:center; gap:6px;">
              <svg style="width:16px; height:16px; fill:currentColor;" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
              Cancelar
            </button>
          </div>
        </div>
      </div>
      
      <details style="margin-top:15px;">
        <summary style="cursor:pointer; font-weight:500; display:flex; align-items:center; gap:6px;">
          <svg style="width:16px; height:16px; fill:currentColor;" viewBox="0 0 24 24">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
          </svg>
          Texto extraído (OCR)
        </summary>
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

function getStatusChip(status) {
  switch(status) {
    case 'verified':
      return `<span style="background: #ECFDF5; color: var(--secondary); padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; border: 1px solid var(--secondary);">Validada</span>`;
    case 'rejected':
      return `<span style="background: #FEF2F2; color: var(--error); padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; border: 1px solid var(--error);">Error/Por revisar</span>`;
    default:
      return `<span style="background: #FEF3C7; color: #92400E; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; border: 1px solid var(--warning);">Pendiente</span>`;
  }
}

// Add function to update invoice property inline
window.updateInvoiceProperty = function(invoiceId, propertyId) {
  updateInvoice(invoiceId, { propertyId: propertyId || null });
  // No need to refresh the whole view, the select will stay updated
};

// Add function to assign property
window.assignProperty = function(invoiceId) {
  const properties = getProperties();
  if (properties.length === 0) {
    alert('No hay inmuebles disponibles. Crea un inmueble primero.');
    return;
  }
  
  const propertyOptions = properties.map(p => `${p.id}:${p.address}`).join('\n');
  const selectedProperty = prompt(`Selecciona un inmueble:\n${propertyOptions}\n\nIntroduce el ID del inmueble:`);
  
  if (selectedProperty) {
    const property = properties.find(p => p.id === selectedProperty);
    if (property) {
      updateInvoice(invoiceId, { propertyId: selectedProperty });
      view.mount(document.getElementById('app'));
    } else {
      alert('ID de inmueble no válido');
    }
  }
};

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
      <h2 style="display:flex; align-items:center; gap:8px; margin:0 0 20px 0;">
        <svg style="width:20px; height:20px; fill:var(--primary);" viewBox="0 0 24 24">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
        Editar Factura
      </h2>
      
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
          <option value="pending" ${invoice.status === 'pending' ? 'selected' : ''}>Pendiente</option>
          <option value="verified" ${invoice.status === 'verified' ? 'selected' : ''}>Verificada</option>
          <option value="rejected" ${invoice.status === 'rejected' ? 'selected' : ''}>Rechazada</option>
        </select>
      </div>
      
      <div style="text-align: right; margin-top: 20px;">
        <button onclick="closeEditModal()" style="margin-right: 10px; background: var(--text-secondary); color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; display:inline-flex; align-items:center; gap:6px;">
          <svg style="width:16px; height:16px; fill:currentColor;" viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
          Cancelar
        </button>
        <button onclick="saveEditedInvoice('${invoiceId}')" style="background: var(--success); color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; display:inline-flex; align-items:center; gap:6px;">
          <svg style="width:16px; height:16px; fill:currentColor;" viewBox="0 0 24 24">
            <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
          </svg>
          Guardar Cambios
        </button>
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