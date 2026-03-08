import jsPDF from 'jspdf';
import QRCode from 'qrcode';

interface CompanySettings {
  logo_url?: string;
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  company_cnpj?: string;
}

interface PaymentReceiptData {
  paymentId: string;
  paymentDate: string;
  value: number;
  paymentMethod: string;
  accountName: string;
  notes?: string;
  projectName: string;
  customerName: string;
  propertyName?: string;
  grandTotal: number;
  totalReceived: number;
  balance: number;
}

const paymentMethodLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  transferencia: 'Transferencia Bancaria',
  cartao_credito: 'Cartao de Credito',
  cartao_debito: 'Cartao de Debito',
  cheque: 'Cheque',
  boleto: 'Boleto'
};

const ALIANCER_BLUE: [number, number, number] = [27, 58, 107];
const ALIANCER_BLUE_LIGHT: [number, number, number] = [235, 241, 250];
const ALIANCER_BLUE_MID: [number, number, number] = [180, 202, 232];

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function shortId(id: string): string {
  return id.replace(/-/g, '').substring(0, 8).toUpperCase();
}

async function loadLogoAsDataUrl(logoUrl: string): Promise<string | null> {
  try {
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateProjectPaymentReceipt(
  data: PaymentReceiptData,
  companySettings: CompanySettings
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const receiptRef = shortId(data.paymentId);
  const isPartial = data.balance > 0.01;
  const emittedAt = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  // --- CABECALHO: logo esquerda + dados empresa direita ---
  const headerHeight = 38;

  doc.setFillColor(...ALIANCER_BLUE_LIGHT);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  doc.setFillColor(...ALIANCER_BLUE);
  doc.rect(0, headerHeight - 2, pageWidth, 2, 'F');

  const logoAreaWidth = 50;
  const textAreaX = margin + logoAreaWidth + 4;
  const textAreaWidth = contentWidth - logoAreaWidth - 4;

  let logoLoaded = false;
  if (companySettings.logo_url) {
    try {
      const logoData = await loadLogoAsDataUrl(companySettings.logo_url);
      if (logoData) {
        doc.addImage(logoData, 'PNG', margin, 4, 44, 30);
        logoLoaded = true;
      }
    } catch {}
  }

  if (!logoLoaded) {
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ALIANCER_BLUE);
    doc.text(companySettings.company_name || 'Aliancer Engenharia', margin, 16);
  }

  const companyName = companySettings.company_name || 'Aliancer Engenharia e Topografia';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...ALIANCER_BLUE);
  doc.text(companyName, textAreaX, 11, { maxWidth: textAreaWidth });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(55, 75, 105);

  let infoY = 18;
  if (companySettings.company_cnpj) {
    doc.text(`CNPJ: ${companySettings.company_cnpj}`, textAreaX, infoY);
    infoY += 4;
  }
  if (companySettings.company_address) {
    const addressLines = doc.splitTextToSize(companySettings.company_address, textAreaWidth);
    doc.text(addressLines, textAreaX, infoY);
    infoY += addressLines.length * 4;
  }
  const contactParts: string[] = [];
  if (companySettings.company_phone) contactParts.push(`Tel: ${companySettings.company_phone}`);
  if (companySettings.company_email) contactParts.push(companySettings.company_email);
  if (contactParts.length > 0) {
    doc.text(contactParts.join('  |  '), textAreaX, infoY);
  }

  let y = headerHeight + 10;

  // --- TITULO DO RECIBO ---
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text('RECIBO DE PAGAMENTO', margin, y);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Referencia: #${receiptRef}`, pageWidth - margin, y - 4, { align: 'right' });
  doc.text(`Emitido em: ${emittedAt}`, pageWidth - margin, y + 1.5, { align: 'right' });

  if (isPartial) {
    doc.setFillColor(230, 100, 30);
    doc.roundedRect(pageWidth - margin - 52, y - 8, 52, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('PAGAMENTO PARCIAL', pageWidth - margin - 26, y - 2, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }

  y += 6;
  doc.setDrawColor(...ALIANCER_BLUE_MID);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  // --- DADOS DO PROJETO ---
  y += 10;
  doc.setFillColor(245, 247, 252);
  doc.roundedRect(margin, y - 5, contentWidth, 28, 2, 2, 'F');
  doc.setDrawColor(...ALIANCER_BLUE_MID);
  doc.setLineWidth(0.3);
  doc.rect(margin, y - 5, contentWidth, 28);

  doc.setFillColor(...ALIANCER_BLUE);
  doc.rect(margin, y - 5, 3, 28, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('DADOS DO PROJETO', margin + 7, y + 1);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9);

  const col1X = margin + 7;
  const col2X = margin + contentWidth / 2 + 4;

  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', col1X, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.text(data.customerName, col1X + 17, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.text('Projeto:', col2X, y + 9);
  doc.setFont('helvetica', 'normal');
  const projectName = data.projectName.length > 35 ? data.projectName.substring(0, 35) + '...' : data.projectName;
  doc.text(projectName, col2X + 17, y + 9);

  if (data.propertyName && data.propertyName !== 'Nao informado') {
    doc.setFont('helvetica', 'bold');
    doc.text('Imovel:', col1X, y + 17);
    doc.setFont('helvetica', 'normal');
    doc.text(data.propertyName, col1X + 17, y + 17);
  }

  y += 34;

  // --- VALOR PRINCIPAL DESTAQUE (azul Aliancer) ---
  doc.setFillColor(...ALIANCER_BLUE);
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('VALOR RECEBIDO', pageWidth / 2, y + 7, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.text(`R$ ${formatCurrency(data.value)}`, pageWidth / 2, y + 17, { align: 'center' });

  y += 30;

  // --- DETALHES DO PAGAMENTO ---
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(margin, y - 4, contentWidth, 38, 2, 2, 'F');
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.rect(margin, y - 4, contentWidth, 38);

  doc.setFillColor(...ALIANCER_BLUE);
  doc.rect(margin, y - 4, 3, 38, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('DETALHES DO PAGAMENTO', margin + 7, y + 2);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9);

  const labelOffset = 28;

  doc.setFont('helvetica', 'bold');
  doc.text('Data:', col1X, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(data.paymentDate), col1X + labelOffset, y + 10);

  doc.setFont('helvetica', 'bold');
  doc.text('Forma:', col2X, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(paymentMethodLabels[data.paymentMethod] || data.paymentMethod, col2X + labelOffset, y + 10);

  doc.setFont('helvetica', 'bold');
  doc.text('Conta:', col1X, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(data.accountName, col1X + labelOffset, y + 18);

  if (data.notes) {
    doc.setFont('helvetica', 'bold');
    doc.text('Obs:', col1X, y + 26);
    doc.setFont('helvetica', 'normal');
    const notesText = data.notes.length > 80 ? data.notes.substring(0, 80) + '...' : data.notes;
    doc.text(notesText, col1X + labelOffset, y + 26);
  }

  y += 44;

  // --- RESUMO FINANCEIRO DO PROJETO ---
  doc.setFillColor(245, 247, 252);
  doc.roundedRect(margin, y - 4, contentWidth, 28, 2, 2, 'F');
  doc.setDrawColor(...ALIANCER_BLUE_MID);
  doc.rect(margin, y - 4, contentWidth, 28);

  doc.setFillColor(...ALIANCER_BLUE);
  doc.rect(margin, y - 4, 3, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('RESUMO FINANCEIRO DO PROJETO', margin + 7, y + 2);

  doc.setFontSize(9);
  const colW = contentWidth / 3;

  const financialItems = [
    { label: 'Valor Total', value: `R$ ${formatCurrency(data.grandTotal)}`, color: [30, 30, 30] as [number, number, number] },
    { label: 'Total Recebido', value: `R$ ${formatCurrency(data.totalReceived)}`, color: [34, 120, 60] as [number, number, number] },
    { label: 'Saldo Pendente', value: `R$ ${formatCurrency(data.balance)}`, color: isPartial ? [190, 80, 20] as [number, number, number] : [100, 100, 100] as [number, number, number] },
  ];

  financialItems.forEach((item, i) => {
    const colX = margin + 7 + i * colW;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text(item.label, colX, y + 11);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...item.color);
    doc.text(item.value, colX, y + 20);
    doc.setFontSize(9);
  });

  if (isPartial) {
    y += 34;
    doc.setFillColor(255, 243, 230);
    doc.roundedRect(margin, y - 4, contentWidth, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(160, 70, 10);
    doc.text(
      `Atencao: Este e um pagamento parcial. Saldo remanescente: R$ ${formatCurrency(data.balance)}`,
      margin + 4, y + 3
    );
  }

  // --- LINHA DE ASSINATURA ---
  y += isPartial ? 18 : 14;

  const sigY = Math.max(y, pageHeight - 65);

  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.5);
  const sigWidth = 70;
  const sigX = margin + contentWidth / 2 - sigWidth / 2;
  doc.line(sigX, sigY + 10, sigX + sigWidth, sigY + 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(companySettings.company_name || 'Aliancer Engenharia', pageWidth / 2, sigY + 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Emissora do Recibo', pageWidth / 2, sigY + 21, { align: 'center' });

  // --- QR CODE DE AUTENTICACAO ---
  const qrData = [
    `Recibo: #${receiptRef}`,
    `Valor: R$ ${formatCurrency(data.value)}`,
    `Data: ${formatDate(data.paymentDate)}`,
    `Projeto: ${data.projectName}`,
    `Cliente: ${data.customerName}`,
    `Emissor: ${companySettings.company_name || 'Aliancer Engenharia'}`,
    `Sistema: Aliancer`,
  ].join(' | ');

  try {
    const qrDataUrl = await QRCode.toDataURL(qrData, {
      width: 120,
      margin: 1,
      color: { dark: '#1B3A6B', light: '#ffffff' }
    });
    const qrSize = 28;
    const qrX = pageWidth - margin - qrSize;
    const qrY = sigY - 4;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(120, 120, 120);
    doc.text('Escaneie para verificar', qrX + qrSize / 2, qrY + qrSize + 3, { align: 'center' });
    doc.text('os dados deste recibo', qrX + qrSize / 2, qrY + qrSize + 7, { align: 'center' });
  } catch {}

  // --- RODAPE DE AUTENTICIDADE ---
  const footerY = pageHeight - 16;
  doc.setDrawColor(...ALIANCER_BLUE_MID);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text(
    'Este recibo foi emitido pelo sistema Aliancer - plataforma de gestao da Aliancer Engenharia e Topografia Ltda.',
    margin, footerY
  );
  doc.text(
    'A autenticidade deste documento e conferida pelo codigo QR e pelo numero de referencia acima.',
    margin, footerY + 4
  );

  doc.setTextColor(0, 0, 0);

  const filename = `recibo_${receiptRef}_${data.paymentDate.replace(/-/g, '')}.pdf`;
  doc.save(filename);
}
