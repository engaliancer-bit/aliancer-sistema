import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Download } from 'lucide-react';
import { createPDF } from '../lib/pdfGenerator';

interface CashFlowEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
  payment_status?: string;
  payment_confirmed_date?: string;
  cost_categories?: {
    name: string;
  };
}

interface PaymentReceiptGeneratorProps {
  entry: CashFlowEntry;
  onGenerating?: (isGenerating: boolean) => void;
}

export default function PaymentReceiptGenerator({
  entry,
  onGenerating
}: PaymentReceiptGeneratorProps) {
  const [loading, setLoading] = useState(false);

  async function getCompanySettings() {
    const { data, error } = await supabase
      .from('company_settings')
      .select('setting_key, setting_value')
      .limit(100);

    if (error) throw error;

    const settings: Record<string, string> = {};
    data?.forEach((item: any) => {
      settings[item.setting_key] = item.setting_value;
    });

    return settings;
  }

  async function generateReceipt() {
    setLoading(true);
    onGenerating?.(true);

    try {
      const settings = await getCompanySettings();
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF();

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let currentY = margin;

      // Logo da empresa
      const logoUrl = settings.company_logo_url;
      if (logoUrl) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          const imgData = await new Promise<string>((resolve, reject) => {
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
              } else {
                reject(new Error('Failed to get canvas context'));
              }
            };
            img.onerror = reject;
            img.src = logoUrl;
          });

          doc.addImage(imgData, 'PNG', margin, currentY, 30, 20);
          currentY += 22;
        } catch (e) {
          console.warn('Could not load logo:', e);
        }
      }

      // Header com dados da empresa
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('ALIANCER ENGENHARIA E TOPOGRAFIA LTDA', margin + 35, currentY - 15);
      currentY += 2;

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      const cnpj = settings.company_cnpj || settings.cnpj;
      if (cnpj) {
        doc.text(`CNPJ: ${cnpj}`, margin + 35, currentY - 11);
      }

      const phone = settings.company_phone || settings.phone;
      if (phone) {
        doc.text(`Telefone: ${phone}`, margin + 35, currentY - 7);
      }

      const address = settings.company_address || settings.address;
      if (address) {
        doc.text(`Endereço: ${address}`, margin + 35, currentY - 3);
      }

      currentY += 8;

      // Linha separadora
      currentY += 2;
      doc.setDrawColor(0, 0, 0);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 6;

      // Título
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('RECIBO DE PAGAMENTO', margin, currentY);
      currentY += 8;

      // Informações do recibo em caixa
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, currentY - 2, pageWidth - margin * 2, 35, 'F');

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');

      doc.text(`Data do Lançamento: ${new Date(entry.date).toLocaleDateString('pt-BR')}`, margin + 3, currentY + 2);

      doc.text(`Descrição: ${entry.description}`, margin + 3, currentY + 7);

      if (entry.cost_categories?.name) {
        doc.text(`Categoria: ${entry.cost_categories.name}`, margin + 3, currentY + 12);
      }

      if (entry.payment_confirmed_date) {
        doc.text(`Data de Confirmação: ${new Date(entry.payment_confirmed_date).toLocaleDateString('pt-BR')}`, margin + 3, currentY + 17);
      }

      doc.text(`Referência: ${entry.id.slice(0, 8).toUpperCase()}`, margin + 3, currentY + 22);

      currentY += 40;

      // Valor em destaque
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      const valorFormatado = entry.amount.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });
      doc.setTextColor(0, 102, 0);
      doc.text(`VALOR: ${valorFormatado}`, margin, currentY);
      doc.setTextColor(0, 0, 0);

      currentY += 15;

      // Linha separadora
      doc.setDrawColor(0, 0, 0);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 10;

      // Assinatura
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.text('Assinado em: _____ / _____ / _______', margin, currentY);
      currentY += 8;

      doc.text('Assinante (Recebedor):', margin, currentY);
      currentY += 5;

      doc.line(margin, currentY, pageWidth - margin - 20, currentY);
      currentY += 6;

      doc.text('_________________________________', margin, currentY);
      currentY += 5;

      doc.text('ALIANCER ENGENHARIA E TOPOGRAFIA LTDA', margin, currentY);

      // Salvar PDF
      const fileName = `recibo_${entry.id.slice(0, 8)}_${new Date().getTime()}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Erro ao gerar recibo:', error);
      alert('Erro ao gerar recibo. Tente novamente.');
    } finally {
      setLoading(false);
      onGenerating?.(false);
    }
  }

  return (
    <button
      onClick={generateReceipt}
      disabled={loading}
      className="text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50"
      title="Gerar Recibo"
    >
      {loading ? (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      ) : (
        <Download className="h-4 w-4" />
      )}
    </button>
  );
}
