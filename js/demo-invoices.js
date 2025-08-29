// Demo functionality to test invoice OCR workflow
// This script adds sample invoices to demonstrate the system

import { addInvoice, getReal, saveReal, getCategories } from './storage.js';

export function addSampleInvoices() {
  const categories = getCategories();
  const transactions = getReal();
  
  // Sample invoice 1: Electricity bill
  const invoice1 = addInvoice({
    supplier: 'IBERDROLA ESPAÑA',
    concept: 'Suministro eléctrico vivienda',
    date: '2024-01-15',
    totalAmount: 89.50,
    baseAmount: 73.97,
    vatAmount: 15.53,
    category: 'utilities',
    propertyId: null,
    attachmentId: 'demo_att_1',
    confidence: 0.92,
    status: 'verified',
    invoiceNumber: 'F2024-001234'
  });
  
  // Add corresponding transaction
  transactions.push({
    date: '2024-01-15',
    bank: 'FACTURA',
    concept: 'IBERDROLA ESPAÑA - Suministro eléctrico vivienda',
    amount: -89.50,
    category: 'utilities',
    invoiceId: invoice1.id
  });
  
  // Sample invoice 2: IBI tax
  const invoice2 = addInvoice({
    supplier: 'AYUNTAMIENTO DE MADRID',
    concept: 'IBI - Impuesto Bienes Inmuebles',
    date: '2024-02-20',
    totalAmount: 450.00,
    baseAmount: 450.00,
    vatAmount: 0.00,
    category: 'taxes_fees',
    propertyId: null,
    attachmentId: 'demo_att_2',
    confidence: 0.95,
    status: 'verified',
    invoiceNumber: 'IBI2024-789'
  });
  
  transactions.push({
    date: '2024-02-20',
    bank: 'FACTURA',
    concept: 'AYUNTAMIENTO DE MADRID - IBI - Impuesto Bienes Inmuebles',
    amount: -450.00,
    category: 'taxes_fees',
    invoiceId: invoice2.id
  });
  
  // Sample invoice 3: Insurance
  const invoice3 = addInvoice({
    supplier: 'MAPFRE SEGUROS',
    concept: 'Seguro hogar multirriesgo',
    date: '2024-03-10',
    totalAmount: 125.80,
    baseAmount: 104.00,
    vatAmount: 21.80,
    category: 'insurance',
    propertyId: null,
    attachmentId: 'demo_att_3',
    confidence: 0.88,
    status: 'pending'
  });
  
  transactions.push({
    date: '2024-03-10',
    bank: 'FACTURA',
    concept: 'MAPFRE SEGUROS - Seguro hogar multirriesgo',
    amount: -125.80,
    category: 'insurance',
    invoiceId: invoice3.id
  });
  
  // Sample invoice 4: Community fees
  const invoice4 = addInvoice({
    supplier: 'COMUNIDAD PROPIETARIOS MAYOR 123',
    concept: 'Cuota ordinaria comunidad',
    date: '2024-03-01',
    totalAmount: 95.00,
    baseAmount: 95.00,
    vatAmount: 0.00,
    category: 'community_fees',
    propertyId: null,
    attachmentId: 'demo_att_4',
    confidence: 0.90,
    status: 'verified'
  });
  
  transactions.push({
    date: '2024-03-01',
    bank: 'FACTURA',
    concept: 'COMUNIDAD PROPIETARIOS MAYOR 123 - Cuota ordinaria comunidad',
    amount: -95.00,
    category: 'community_fees',
    invoiceId: invoice4.id
  });
  
  // Sample invoice 5: Non-deductible personal expense
  const invoice5 = addInvoice({
    supplier: 'CARREFOUR',
    concept: 'Compra alimentación personal',
    date: '2024-03-15',
    totalAmount: 67.34,
    baseAmount: 55.65,
    vatAmount: 11.69,
    category: 'personal_expenses',
    propertyId: null,
    attachmentId: 'demo_att_5',
    confidence: 0.75,
    status: 'verified'
  });
  
  transactions.push({
    date: '2024-03-15',
    bank: 'FACTURA',
    concept: 'CARREFOUR - Compra alimentación personal',
    amount: -67.34,
    category: 'personal_expenses',
    invoiceId: invoice5.id
  });
  
  saveReal(transactions);
  
  return {
    message: 'Se han añadido 5 facturas de ejemplo',
    invoices: [invoice1, invoice2, invoice3, invoice4, invoice5]
  };
}