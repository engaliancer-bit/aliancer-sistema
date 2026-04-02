import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export async function generateRomaneioPDF(data: RomaneioData): Promise<Uint8Array> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentW = pageW - margin * 2;

  const primaryColor: [number, number, number] = [10, 126, 194];
  const darkGray: [number, number, number] = [50, 50, 50];
  const lightGray: [number, number, number] = [245, 245, 245];
  const midGray: [number, number, number] = [120, 120, 120];
  const white: [number, number, number] = [255, 255, 255];
  const green: [number, number, number] = [22, 163, 74];

  let yPos = margin;

  // ─── HEADER ───────────────────────────────────────────────────────────────
  // Header background
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageW, 28, 'F');

  // Logo
  let logoLoaded = false;
  if (data.empresa.logo_url) {
    const logoB64 = await loadImageAsBase64(data.empresa.logo_url);
    if (logoB64) {
      try {
        doc.addImage(logoB64, 'PNG', margin, 4, 20, 20);
        logoLoaded = true;
      } catch { /* ignore */ }
    }
  }

  const textStart = logoLoaded ? margin + 24 : margin;

  // Company name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...white);
  doc.text(data.empresa.name || 'Aliancer', textStart, 11);

  // Company sub-info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const companyLine: string[] = [];
  if (data.empresa.cnpj) companyLine.push(`CNPJ: ${data.empresa.cnpj}`);
  if (data.empresa.phone) companyLine.push(`Tel: ${data.empresa.phone}`);
  if (data.empresa.email) companyLine.push(data.empresa.email);
  if (companyLine.length) doc.text(companyLine.join('  |  '), textStart, 16.5);
  if (data.empresa.address) doc.text(data.empresa.address, textStart, 21);

  // Title block (right side)
  const titleX = pageW - 95;
  doc.setFillColor(255, 255, 255, 0.15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...white);
  const titleLabel = 'ROMANEIO DE ENTREGA';
  doc.text(titleLabel, pageW - margin, 10, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº ${data.numero}`, pageW - margin, 16, { align: 'right' });
  doc.text(`Emissão: ${formatDateTime(data.emissao)}`, pageW - margin, 21, { align: 'right' });
  doc.text(`Válido até: ${formatDate(data.validade)}`, pageW - margin, 25.5, { align: 'right' });

  yPos = 32;

  // ─── CLIENTE + ENTREGA ────────────────────────────────────────────────────
  const colW = (contentW - 4) / 2;

  // Cliente card
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, yPos, colW, 28, 2, 2, 'F');
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(margin, yPos, colW, 28, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...primaryColor);
  doc.text('CLIENTE', margin + 3, yPos + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...darkGray);
  doc.text(data.cliente.name || '-', margin + 3, yPos + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...midGray);
  let clientY = yPos + 16;
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
    doc.text(lines.slice(0, 2), margin + 3, clientY);
  }

  // Entrega card
  const col2X = margin + colW + 4;
  doc.setFillColor(...lightGray);
  doc.roundedRect(col2X, yPos, colW, 28, 2, 2, 'F');
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(col2X, yPos, colW, 28, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...primaryColor);
  doc.text('DADOS DA ENTREGA', col2X + 3, yPos + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkGray);
  let entY = yPos + 11;

  const entFields: [string, string][] = [
    ['Motorista:', data.entrega.driver_name || '______________________'],
    ['Placa:', data.entrega.vehicle_plate || '______________________'],
    ['Data/Hora prevista:', data.entrega.scheduled_at ? formatDateTime(data.entrega.scheduled_at) : '__/__/____ __:__'],
    ['Endereço destino:', data.entrega.address || data.cliente.address || '______________________'],
  ];
  for (const [label, val] of entFields) {
    doc.setFont('helvetica', 'bold');
    doc.text(label, col2X + 3, entY);
    doc.setFont('helvetica', 'normal');
    const labelW = doc.getTextWidth(label) + 2;
    const maxW = colW - 6 - labelW;
    const lines = doc.splitTextToSize(val, maxW);
    doc.text(lines[0], col2X + 3 + labelW, entY);
    entY += 4.5;
  }

  yPos += 31;

  // ─── TABELA DE ITENS ──────────────────────────────────────────────────────
  const tableColumns = data.incluirPrecos
    ? [
        { header: 'Item / Produto', dataKey: 'name' },
        { header: 'Qtd.', dataKey: 'qty' },
        { header: 'Und.', dataKey: 'unit' },
        { header: 'Valor Unit.', dataKey: 'unit_price' },
        { header: 'Valor Total', dataKey: 'total' },
        { header: 'Observações', dataKey: 'notes' },
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
    name: { cellWidth: data.incluirPrecos ? 80 : 120 },
    qty: { cellWidth: 20, halign: 'center' },
    unit: { cellWidth: 16, halign: 'center' },
    notes: { cellWidth: 'auto' },
  };
  if (data.incluirPrecos) {
    columnStyles['unit_price'] = { cellWidth: 30, halign: 'right' };
    columnStyles['total'] = { cellWidth: 30, halign: 'right' };
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
      fillColor: [250, 250, 250],
    },
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    theme: 'grid',
    styles: {
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
      overflow: 'linebreak',
    },
    didDrawPage: () => {
      // Footer on each page
      doc.setFontSize(7);
      doc.setTextColor(...midGray);
      doc.text(
        `Aliancer Engenharia e Topografia LTDA | ${data.empresa.cnpj ? `CNPJ ${data.empresa.cnpj} | ` : ''}Lei 10.833/2003 (NF-e compatível)`,
        pageW / 2,
        pageH - 4,
        { align: 'center' }
      );
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY || yPos + 40;

  // ─── RODAPÉ TOTAIS ────────────────────────────────────────────────────────
  if (data.incluirPrecos) {
    const totalsY = Math.min(finalY + 3, pageH - 50);
    const totalsX = pageW - margin - 90;
    const totalsW = 90;

    doc.setFillColor(...lightGray);
    doc.roundedRect(totalsX, totalsY, totalsW, 22, 2, 2, 'F');
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(totalsX, totalsY, totalsW, 22, 2, 2, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...midGray);

    const icms = data.subtotal * 0.18;
    const rows: [string, string][] = [
      ['Subtotal:', formatCurrency(data.subtotal)],
      ['ICMS 18%:', formatCurrency(icms)],
      ['Frete:', formatCurrency(data.frete)],
    ];

    let ty = totalsY + 6;
    for (const [label, val] of rows) {
      doc.text(label, totalsX + 4, ty);
      doc.text(val, totalsX + totalsW - 4, ty, { align: 'right' });
      ty += 4.5;
    }

    // Total line
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(totalsX + 4, ty - 1, totalsX + totalsW - 4, ty - 1);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...primaryColor);
    doc.text('TOTAL GERAL:', totalsX + 4, ty + 4);
    doc.text(formatCurrency(data.total_geral), totalsX + totalsW - 4, ty + 4, { align: 'right' });
  }

  // ─── ACEITE / ASSINATURA ──────────────────────────────────────────────────
  const aceiteY = Math.min(finalY + (data.incluirPrecos ? 30 : 6), pageH - 35);

  doc.setFillColor(255, 248, 220);
  doc.setDrawColor(234, 179, 8);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, aceiteY, contentW, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkGray);
  doc.text('RECEBIMENTO E ACEITE', margin + 3, aceiteY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text(
    'Recebi os itens acima listados em perfeito estado e autorizo o início da descarga.',
    margin + 3, aceiteY + 10
  );

  const sigY = aceiteY + 17;
  const sigSpacing = contentW / 3;

  const sigFields = [
    ['Assinatura do Cliente:', '_________________________'],
    ['Data: _____/_____/_____', ''],
    ['Testemunha:', '_________________________'],
  ];

  sigFields.forEach(([label, line], i) => {
    const sx = margin + i * sigSpacing + 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...darkGray);
    doc.text(label, sx, sigY);
    if (line) {
      doc.setFont('helvetica', 'normal');
      doc.text(line, sx, sigY + 3.5);
    }
  });

  // ─── FOOTER ───────────────────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...midGray);
  doc.text(
    `Aliancer Engenharia e Topografia LTDA | ${data.empresa.cnpj ? `CNPJ ${data.empresa.cnpj} | ` : ''}Lei 10.833/2003 (NF-e compatível)`,
    pageW / 2,
    pageH - 4,
    { align: 'center' }
  );

  return doc.output('arraybuffer') as unknown as Uint8Array;
}
