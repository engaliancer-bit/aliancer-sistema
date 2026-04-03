import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

export interface RomaneioItem {
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  notes?: string;
}

export interface RomaneioData {
  id: string;
  quoteId?: string;
  tipo: 'orcamento' | 'entrega';
  numero: string;
  emissao: Date;
  validade: Date;
  cliente: {
    name: string;
    cpf_cnpj?: string;
    address?: string;
    phone?: string;
  };
  entrega: {
    address?: string;
    scheduled_at?: Date;
    driver_name?: string;
    vehicle_plate?: string;
  };
  itens: RomaneioItem[];
  subtotal: number;
  frete: number;
  total_geral: number;
  incluirPrecos: boolean;
  empresa: {
    name: string;
    cnpj?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo_url?: string;
  };
}

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const formatDateTime = (d: Date) =>
  d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function generateQRCodeBase64(text: string): Promise<string | null> {
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      width: 120,
      margin: 1,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    });
    return dataUrl;
  } catch {
    return null;
  }
}

export async function generateRomaneioPDF(data: RomaneioData): Promise<Uint8Array> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - margin * 2;

  const primaryColor: [number, number, number] = [10, 90, 160];
  const darkGray: [number, number, number] = [40, 40, 40];
  const lightGray: [number, number, number] = [245, 246, 248];
  const midGray: [number, number, number] = [120, 120, 120];
  const white: [number, number, number] = [255, 255, 255];
  const borderGray: [number, number, number] = [210, 215, 220];

  let yPos = margin;

  // ─── HEADER (white background) ────────────────────────────────────────────
  let logoLoaded = false;
  if (data.empresa.logo_url) {
    const logoB64 = await loadImageAsBase64(data.empresa.logo_url);
    if (logoB64) {
      try {
        doc.addImage(logoB64, 'PNG', margin, yPos, 22, 22);
        logoLoaded = true;
      } catch { /* ignore */ }
    }
  }

  const textStart = logoLoaded ? margin + 26 : margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...darkGray);
  doc.text(data.empresa.name || 'Aliancer', textStart, yPos + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...midGray);
  const companyLine: string[] = [];
  if (data.empresa.cnpj) companyLine.push(`CNPJ: ${data.empresa.cnpj}`);
  if (data.empresa.phone) companyLine.push(`Tel: ${data.empresa.phone}`);
  if (data.empresa.email) companyLine.push(data.empresa.email);
  if (companyLine.length) doc.text(companyLine.join('  |  '), textStart, yPos + 14);
  if (data.empresa.address) doc.text(data.empresa.address, textStart, yPos + 19);

  // Title block (right side)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...primaryColor);
  doc.text('ROMANEIO DE ENTREGA', pageW - margin, yPos + 8, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);
  doc.text(`Nº ${data.numero}`, pageW - margin, yPos + 15, { align: 'right' });
  doc.text(`Emissão: ${formatDateTime(data.emissao)}`, pageW - margin, yPos + 21, { align: 'right' });

  yPos += 26;

  // Separator line
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageW - margin, yPos);

  yPos += 5;

  // ─── CLIENTE + ENTREGA ────────────────────────────────────────────────────
  const colW = (contentW - 4) / 2;

  // Cliente card
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, yPos, colW, 30, 2, 2, 'F');
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, yPos, colW, 30, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...primaryColor);
  doc.text('CLIENTE', margin + 3, yPos + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...darkGray);
  const clientNameLines = doc.splitTextToSize(data.cliente.name || '-', colW - 6);
  doc.text(clientNameLines[0], margin + 3, yPos + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...midGray);
  let clientY = yPos + 17;
  if (data.cliente.cpf_cnpj) {
    doc.text(`CPF/CNPJ: ${data.cliente.cpf_cnpj}`, margin + 3, clientY);
    clientY += 4.5;
  }
  if (data.cliente.phone) {
    doc.text(`Tel: ${data.cliente.phone}`, margin + 3, clientY);
    clientY += 4.5;
  }
  if (data.cliente.address) {
    const maxW = colW - 6;
    const lines = doc.splitTextToSize(data.cliente.address, maxW);
    doc.text(lines.slice(0, 1), margin + 3, clientY);
  }

  // Entrega card
  const col2X = margin + colW + 4;
  doc.setFillColor(...lightGray);
  doc.roundedRect(col2X, yPos, colW, 30, 2, 2, 'F');
  doc.setDrawColor(...borderGray);
  doc.roundedRect(col2X, yPos, colW, 30, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...primaryColor);
  doc.text('DADOS DA ENTREGA', col2X + 3, yPos + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkGray);
  let entY = yPos + 11;

  const entFields: [string, string][] = [
    ['Motorista:', data.entrega.driver_name || '______________________'],
    ['Placa:', data.entrega.vehicle_plate || '__________'],
    ['Data/Hora:', data.entrega.scheduled_at ? formatDateTime(data.entrega.scheduled_at) : '__/__/____ __:__'],
    ['Destino:', data.entrega.address || data.cliente.address || '______________________'],
  ];
  for (const [label, val] of entFields) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...midGray);
    doc.text(label, col2X + 3, entY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkGray);
    const labelW = doc.getTextWidth(label) + 2;
    const maxW = colW - 6 - labelW;
    const lines = doc.splitTextToSize(val, maxW);
    doc.text(lines[0], col2X + 3 + labelW, entY);
    entY += 4.8;
  }

  yPos += 34;

  // ─── TABELA DE ITENS ──────────────────────────────────────────────────────
  const tableColumns = data.incluirPrecos
    ? [
        { header: 'Item / Produto', dataKey: 'name' },
        { header: 'Qtd.', dataKey: 'qty' },
        { header: 'Und.', dataKey: 'unit' },
        { header: 'Vlr. Unit.', dataKey: 'unit_price' },
        { header: 'Vlr. Total', dataKey: 'total' },
        { header: 'Obs.', dataKey: 'notes' },
      ]
    : [
        { header: 'Item / Produto', dataKey: 'name' },
        { header: 'Qtd.', dataKey: 'qty' },
        { header: 'Und.', dataKey: 'unit' },
        { header: 'Observações', dataKey: 'notes' },
      ];

  const tableRows = data.itens.map((item, i) => ({
    name: `${i + 1}. ${item.name}`,
    qty: Number(item.quantity).toFixed(2),
    unit: item.unit || 'un',
    unit_price: data.incluirPrecos ? formatCurrency(item.unit_price) : '',
    total: data.incluirPrecos ? formatCurrency(item.total_price) : '',
    notes: item.notes || '',
  }));

  const columnStyles: Record<string, object> = {
    name: { cellWidth: data.incluirPrecos ? 70 : 110 },
    qty: { cellWidth: 18, halign: 'center' },
    unit: { cellWidth: 14, halign: 'center' },
    notes: { cellWidth: 'auto' },
  };
  if (data.incluirPrecos) {
    columnStyles['unit_price'] = { cellWidth: 26, halign: 'right' };
    columnStyles['total'] = { cellWidth: 26, halign: 'right' };
  }

  autoTable(doc, {
    startY: yPos,
    columns: tableColumns,
    body: tableRows,
    columnStyles,
    headStyles: {
      fillColor: primaryColor,
      textColor: white,
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: darkGray,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
    },
    alternateRowStyles: {
      fillColor: [250, 251, 252],
    },
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    theme: 'grid',
    styles: {
      lineColor: borderGray,
      lineWidth: 0.1,
      overflow: 'linebreak',
    },
    didDrawPage: (_hookData) => {
      doc.setFontSize(6.5);
      doc.setTextColor(...midGray);
      doc.text(
        `${data.empresa.name}${data.empresa.cnpj ? ` | CNPJ ${data.empresa.cnpj}` : ''}`,
        pageW / 2,
        pageH - 5,
        { align: 'center' }
      );
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY || yPos + 40;

  // ─── TOTAIS ────────────────────────────────────────────────────────────────
  if (data.incluirPrecos) {
    const totalsW = 80;
    const totalsX = pageW - margin - totalsW;
    const totalsY = finalY + 4;

    doc.setFillColor(...lightGray);
    doc.roundedRect(totalsX, totalsY, totalsW, 20, 2, 2, 'F');
    doc.setDrawColor(...borderGray);
    doc.roundedRect(totalsX, totalsY, totalsW, 20, 2, 2, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...midGray);

    const totalsRows: [string, string][] = [
      ['Subtotal:', formatCurrency(data.subtotal)],
      ['Frete:', formatCurrency(data.frete)],
    ];

    let ty = totalsY + 6;
    for (const [label, val] of totalsRows) {
      doc.text(label, totalsX + 4, ty);
      doc.text(val, totalsX + totalsW - 4, ty, { align: 'right' });
      ty += 5;
    }

    doc.setDrawColor(...primaryColor as [number, number, number]);
    doc.setLineWidth(0.4);
    doc.line(totalsX + 4, ty - 1.5, totalsX + totalsW - 4, ty - 1.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...primaryColor);
    doc.text('TOTAL:', totalsX + 4, ty + 4);
    doc.text(formatCurrency(data.total_geral), totalsX + totalsW - 4, ty + 4, { align: 'right' });
  }

  // ─── CANHOTO DESTACAVEL ────────────────────────────────────────────────────
  const canhoW = data.incluirPrecos ? 75 : contentW;
  const canhoX = margin;
  const canhoY = Math.min(
    finalY + (data.incluirPrecos ? 28 : 8),
    pageH - 55
  );

  // Dotted cut line
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1, 1.5], 0);
  doc.line(margin, canhoY - 2, pageW - margin, canhoY - 2);
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...midGray);
  doc.text('- - - - CANHOTO DO CLIENTE - - - -', pageW / 2, canhoY + 1, { align: 'center' });

  const receiptH = 42;
  doc.setFillColor(252, 253, 255);
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, canhoY + 4, contentW, receiptH, 2, 2, 'FD');

  // Left section: fields
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...primaryColor);
  doc.text('RECEBIMENTO DE ENTREGA', canhoX + 4, canhoY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkGray);

  const receiptFields: [string, string][] = [
    ['Romaneio:', data.numero],
    ['Cliente:', data.cliente.name],
    ['Data:', `${formatDate(data.emissao)}`],
  ];

  let ry = canhoY + 17;
  for (const [lbl, val] of receiptFields) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...midGray);
    doc.text(lbl, canhoX + 4, ry);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkGray);
    const lw = doc.getTextWidth(lbl) + 2;
    doc.text(val, canhoX + 4 + lw, ry);
    ry += 5;
  }

  // Signature lines
  const sigY = canhoY + 37;
  const sigW = (contentW - 44) / 2;
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.3);
  doc.line(canhoX + 4, sigY, canhoX + 4 + sigW, sigY);
  doc.line(canhoX + 4 + sigW + 12, sigY, canhoX + 4 + sigW * 2 + 12, sigY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...midGray);
  doc.text('Assinatura do Recebedor', canhoX + 4, sigY + 4);
  doc.text('Testemunha / Data', canhoX + 4 + sigW + 12, sigY + 4);

  // QR code (right section of canhoto)
  const qrPayload = JSON.stringify({
    romaneio: data.numero,
    cliente: data.cliente.name,
    emissao: formatDate(data.emissao),
    quoteId: data.quoteId || data.id,
    itens: data.itens.length,
    total: data.total_geral,
  });

  const qrB64 = await generateQRCodeBase64(qrPayload);
  if (qrB64) {
    const qrSize = 30;
    const qrX = pageW - margin - qrSize - 4;
    const qrY = canhoY + 7;
    try {
      doc.addImage(qrB64, 'PNG', qrX, qrY, qrSize, qrSize);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...midGray);
      doc.text('QR de Autenticidade', qrX + qrSize / 2, qrY + qrSize + 3.5, { align: 'center' });
    } catch { /* ignore */ }
  }

  // ─── FOOTER ───────────────────────────────────────────────────────────────
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...midGray);
  doc.text(
    `${data.empresa.name}${data.empresa.cnpj ? ` | CNPJ ${data.empresa.cnpj}` : ''}`,
    pageW / 2,
    pageH - 5,
    { align: 'center' }
  );

  return doc.output('arraybuffer') as unknown as Uint8Array;
}
