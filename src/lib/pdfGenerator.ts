let jsPDFModule: any = null;
let autoTableModule: any = null;

export async function loadPDFLibraries() {
  if (!jsPDFModule || !autoTableModule) {
    const [jsPDF, autoTable] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    jsPDFModule = jsPDF.default;
    autoTableModule = autoTable.default;
  }
  return { jsPDF: jsPDFModule, autoTable: autoTableModule };
}

export async function createPDF() {
  const { jsPDF } = await loadPDFLibraries();
  return new jsPDF();
}

export function isPDFLoaded() {
  return jsPDFModule !== null;
}

interface CompanySettings {
  logo_url?: string;
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  company_cnpj?: string;
}

export async function addPDFHeader(
  doc: any,
  title: string,
  companySettings?: CompanySettings,
  startY: number = 20
): Promise<number> {
  let currentY = startY;

  // Se houver logo, adicionar ao PDF
  if (companySettings?.logo_url) {
    try {
      // Carregar imagem e adicionar ao PDF
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = companySettings.logo_url!;
      });

      // Adicionar logo (30x30mm no canto superior esquerdo)
      doc.addImage(img, 'PNG', 14, currentY, 30, 30);

      // Adicionar informações da empresa ao lado do logo
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');

      if (companySettings.company_name) {
        doc.text(companySettings.company_name, 50, currentY + 5);
      }

      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);

      let infoY = currentY + 10;

      if (companySettings.company_address) {
        doc.text(companySettings.company_address, 50, infoY);
        infoY += 4;
      }

      if (companySettings.company_phone) {
        doc.text(`Tel: ${companySettings.company_phone}`, 50, infoY);
        infoY += 4;
      }

      if (companySettings.company_email) {
        doc.text(`Email: ${companySettings.company_email}`, 50, infoY);
        infoY += 4;
      }

      if (companySettings.company_cnpj) {
        doc.text(`CNPJ: ${companySettings.company_cnpj}`, 50, infoY);
      }

      currentY += 35; // Espaço após logo e informações
    } catch (error) {
      console.error('Erro ao carregar logo:', error);
      // Continuar sem logo
    }
  }

  // Adicionar linha separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(14, currentY, 196, currentY);
  currentY += 5;

  // Adicionar título do documento
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text(title, 14, currentY);
  currentY += 10;

  return currentY;
}

export function addPDFFooter(
  doc: any,
  pageNumber: number,
  totalPages: number
): void {
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;

  // Linha separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);

  // Rodapé
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(128, 128, 128);

  const date = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  doc.text(`Emitido em: ${date}`, 14, pageHeight - 10);
  doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - 14, pageHeight - 10, { align: 'right' });

  // Reset cor do texto
  doc.setTextColor(0, 0, 0);
}
