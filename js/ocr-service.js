// OCR Service for Invoice Processing
// Simulated OCR functionality - in production would use Tesseract.js or similar

export class OCRService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    // In production, this would initialize Tesseract.js
    // For now, we'll simulate the initialization
    this.initialized = true;
    return true;
  }

  async processInvoice(file) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Simulate OCR processing time
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate OCR results based on filename or file type
    const filename = file.name.toLowerCase();
    
    // Generate realistic mock data based on common Spanish invoice patterns
    const mockData = this.generateMockOCRData(filename);
    
    return {
      confidence: Math.random() * 0.4 + 0.6, // 60-100% confidence
      extractedData: mockData,
      rawText: this.generateMockRawText(mockData),
      processingTime: 2000
    };
  }

  generateMockOCRData(filename) {
    // Common Spanish suppliers and their typical amounts
    const suppliers = [
      { name: 'IBERDROLA', concept: 'Suministro eléctrico', category: 'utilities', amount: Math.random() * 100 + 30 },
      { name: 'GAS NATURAL FENOSA', concept: 'Suministro de gas', category: 'utilities', amount: Math.random() * 60 + 20 },
      { name: 'CANAL DE ISABEL II', concept: 'Suministro de agua', category: 'utilities', amount: Math.random() * 40 + 15 },
      { name: 'MAPFRE', concept: 'Seguro hogar', category: 'insurance', amount: Math.random() * 50 + 25 },
      { name: 'SANTA LUCÍA', concept: 'Seguro multirriesgo', category: 'insurance', amount: Math.random() * 60 + 30 },
      { name: 'AYUNTAMIENTO', concept: 'IBI - Impuesto Bienes Inmuebles', category: 'taxes_fees', amount: Math.random() * 300 + 100 },
      { name: 'COMUNIDAD PROPIETARIOS', concept: 'Cuota comunidad', category: 'community_fees', amount: Math.random() * 100 + 80 },
      { name: 'FONTANERÍA LÓPEZ', concept: 'Reparación fontanería', category: 'maintenance', amount: Math.random() * 150 + 50 },
      { name: 'PINTURAS GARCÍA', concept: 'Pintura vivienda', category: 'maintenance', amount: Math.random() * 300 + 100 },
      { name: 'ORANGE', concept: 'Internet y telefonía', category: 'utilities', amount: Math.random() * 50 + 25 },
      { name: 'MOVISTAR', concept: 'Servicios telecomunicaciones', category: 'utilities', amount: Math.random() * 60 + 30 }
    ];

    const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
    const today = new Date();
    const invoiceDate = new Date(today.getFullYear(), today.getMonth() - Math.floor(Math.random() * 3), Math.floor(Math.random() * 28) + 1);
    
    const baseAmount = supplier.amount;
    const vatRate = 0.21; // 21% IVA Spain
    const vatAmount = baseAmount * vatRate;
    const totalAmount = baseAmount + vatAmount;

    return {
      supplier: supplier.name,
      concept: supplier.concept,
      date: invoiceDate.toISOString().split('T')[0],
      baseAmount: Math.round(baseAmount * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      invoiceNumber: this.generateInvoiceNumber(),
      suggestedCategory: supplier.category,
      confidence: Math.random() * 0.3 + 0.7 // 70-100% confidence for category
    };
  }

  generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const num = Math.floor(Math.random() * 999999) + 1;
    return `F${year}-${num.toString().padStart(6, '0')}`;
  }

  generateMockRawText(data) {
    return `
FACTURA

${data.supplier}
CIF: ${this.generateCIF()}
Dirección: Calle Example 123, Madrid

Fecha: ${data.date}
Número: ${data.invoiceNumber}

Concepto: ${data.concept}

Base imponible: ${data.baseAmount.toFixed(2)} €
IVA (21%): ${data.vatAmount.toFixed(2)} €
TOTAL: ${data.totalAmount.toFixed(2)} €

Forma de pago: Domiciliación bancaria
`.trim();
  }

  generateCIF() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const letter = letters[Math.floor(Math.random() * letters.length)];
    const numbers = Math.floor(Math.random() * 90000000) + 10000000;
    return `${letter}${numbers}`;
  }

  // Extract property suggestions based on invoice content
  extractPropertySuggestions(invoiceData, properties) {
    const suggestions = [];
    
    properties.forEach(property => {
      let score = 0;
      
      // Check if property address appears in supplier name or concept
      if (property.address && property.address.length > 10) {
        const addressParts = property.address.toLowerCase().split(' ');
        const searchText = (invoiceData.supplier + ' ' + invoiceData.concept).toLowerCase();
        
        addressParts.forEach(part => {
          if (part.length > 3 && searchText.includes(part)) {
            score += 0.3;
          }
        });
      }
      
      // Check if city matches
      if (property.city && invoiceData.supplier.toLowerCase().includes(property.city.toLowerCase())) {
        score += 0.4;
      }
      
      // Higher score for utility bills (usually building-specific)
      if (['utilities', 'community_fees', 'taxes_fees'].includes(invoiceData.suggestedCategory)) {
        score += 0.2;
      }
      
      if (score > 0.3) {
        suggestions.push({
          property: property,
          confidence: Math.min(score, 0.95)
        });
      }
    });
    
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }
}

// Expense classification keywords for automatic categorization
export const CLASSIFICATION_KEYWORDS = {
  loan_interest: ['interes', 'hipoteca', 'prestamo', 'credito', 'financiacion'],
  taxes_fees: ['ibi', 'impuesto', 'tasa', 'municipal', 'ayuntamiento', 'basura'],
  community_fees: ['comunidad', 'administrador', 'cuota', 'derrama', 'ascensor'],
  insurance: ['seguro', 'mapfre', 'santa lucia', 'axa', 'allianz', 'zurich'],
  utilities: ['luz', 'gas', 'agua', 'electricidad', 'iberdrola', 'endesa', 'telefonica', 'movistar', 'orange'],
  maintenance: ['fontaneria', 'electricista', 'pintura', 'reparacion', 'mantenimiento', 'albañil'],
  external_services: ['limpieza', 'jardineria', 'vigilancia', 'portero', 'conserjeria'],
  professional_fees: ['abogado', 'gestor', 'notario', 'arquitecto', 'tasacion'],
  marketing: ['idealista', 'fotocasa', 'anuncio', 'publicidad', 'inmobiliaria']
};

export function classifyExpense(concept, supplier) {
  const searchText = (concept + ' ' + supplier).toLowerCase();
  
  for (const [category, keywords] of Object.entries(CLASSIFICATION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        return {
          category,
          confidence: 0.8 + Math.random() * 0.15 // 80-95% confidence
        };
      }
    }
  }
  
  return {
    category: 'other_deductible',
    confidence: 0.3 // Low confidence, needs manual review
  };
}