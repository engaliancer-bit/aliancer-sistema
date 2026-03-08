import { useEffect, useRef, useState } from 'react';
import { X, Printer } from 'lucide-react';
import QRCode from 'qrcode';

interface ProductionLabelProps {
  productionData: {
    productName: string;
    quantity: number;
    unit: string;
    productionDate: string;
    recipeName: string;
    orderNumber?: number;
    customerName?: string;
    qrToken: string;
  };
  onClose: () => void;
}

export default function ProductionLabel({ productionData, onClose }: ProductionLabelProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const trackingUrl = `${window.location.origin}/track/${productionData.qrToken}`;
        const url = await QRCode.toDataURL(trackingUrl, {
          width: 220,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
        setQrCodeUrl(url);
      } catch (error) {
        console.error('Erro ao gerar QR Code:', error);
      }
    };

    generateQRCode();
  }, [productionData.qrToken]);

  const handlePrint = async () => {
    if (labelRef.current && qrCodeUrl) {
      const logoImg = document.querySelector('.logo') as HTMLImageElement;
      let logoDataUrl = '';

      if (logoImg && logoImg.complete) {
        const canvas = document.createElement('canvas');
        canvas.width = logoImg.naturalWidth;
        canvas.height = logoImg.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(logoImg, 0, 0);
          logoDataUrl = canvas.toDataURL('image/jpeg');
        }
      }

      const printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Etiqueta de Produção</title>
            <style>
              @page {
                size: 5cm 8cm;
                margin: 0;
              }
              @media print {
                html, body {
                  width: 5cm;
                  height: 8cm;
                  margin: 0;
                  padding: 0;
                  overflow: hidden;
                }
                body {
                  page-break-inside: avoid;
                  page-break-after: avoid;
                  page-break-before: avoid;
                }
              }
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                font-family: Arial, sans-serif;
                width: 5cm;
                height: 8cm;
                padding: 0.15cm;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-start;
                background: white;
              }
              .logo {
                width: 1.6cm;
                height: auto;
                margin-bottom: 0.05cm;
                flex-shrink: 0;
              }
              .info {
                width: 100%;
                font-size: 6pt;
                margin-bottom: 0.03cm;
                text-align: center;
                flex-shrink: 0;
              }
              .info-label {
                font-weight: bold;
                font-size: 4.5pt;
                color: #0A7EC2;
                display: block;
                line-height: 1.1;
              }
              .info-value {
                font-size: 6.5pt;
                color: #000;
                display: block;
                margin-top: 0.01cm;
                line-height: 1.1;
              }
              .qr-code {
                width: 2.3cm;
                height: 2.3cm;
                margin-top: 0.05cm;
                flex-shrink: 0;
                display: block;
              }
              .divider {
                width: 100%;
                height: 1px;
                background: #ddd;
                margin: 0.05cm 0;
                flex-shrink: 0;
              }
            </style>
          </head>
          <body>
            <img src="${logoDataUrl}" alt="Aliancer" class="logo">
            <div class="info">
              <span class="info-label">Produto</span>
              <span class="info-value">${productionData.productName}</span>
            </div>
            <div class="divider"></div>
            <div class="info">
              <span class="info-label">Data de Produção</span>
              <span class="info-value">${formatDate(productionData.productionDate)}</span>
            </div>
            <div class="info">
              <span class="info-label">Traço</span>
              <span class="info-value">${productionData.recipeName}</span>
            </div>
            ${productionData.orderNumber ? `
            <div class="info">
              <span class="info-label">Ordem de Produção</span>
              <span class="info-value">OP #${productionData.orderNumber}</span>
            </div>
            ` : ''}
            <div class="info">
              <span class="info-label">${productionData.customerName ? 'Cliente' : 'Destino'}</span>
              <span class="info-value">${productionData.customerName || 'Reposição de Estoque'}</span>
            </div>
            <div class="divider"></div>
            <img src="${qrCodeUrl}" alt="QR Code" class="qr-code">
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.onafterprint = function() {
                    window.close();
                  };
                }, 500);
              };
            </script>
          </body>
        </html>
      `;

      const blob = new Blob([printContent], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      const printWindow = window.open(blobUrl, '_blank');

      if (printWindow) {
        const handleLoad = () => {
          URL.revokeObjectURL(blobUrl);
          printWindow.removeEventListener('load', handleLoad);
        };
        printWindow.addEventListener('load', handleLoad);

        // Fallback: liberar recursos se a janela não carregar em 5 segundos
        setTimeout(() => {
          try {
            if (printWindow && !printWindow.closed) {
              URL.revokeObjectURL(blobUrl);
              printWindow.removeEventListener('load', handleLoad);
            }
          } catch (e) {
            // Ignora erro de acesso cross-origin se a janela já estiver fechada
            URL.revokeObjectURL(blobUrl);
          }
        }, 5000);
      } else {
        URL.revokeObjectURL(blobUrl);
        alert('Por favor, permita pop-ups para imprimir a etiqueta');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">Etiqueta de Produção</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div
            ref={labelRef}
            className="bg-white border-2 border-gray-300 rounded-lg"
            style={{
              width: '5cm',
              height: '8cm',
              margin: '0 auto',
              padding: '0.15cm',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
            }}
          >
            <img
              src="/aliancer_logo_6cm-01-01.jpg"
              alt="Aliancer"
              className="logo"
              style={{ width: '1.6cm', height: 'auto', marginBottom: '0.05cm', flexShrink: 0 }}
            />

            <div className="info" style={{ width: '100%', fontSize: '6pt', marginBottom: '0.03cm', textAlign: 'center', flexShrink: 0 }}>
              <span className="info-label" style={{ fontWeight: 'bold', fontSize: '4.5pt', color: '#0A7EC2', display: 'block', lineHeight: 1.1 }}>
                Produto
              </span>
              <span className="info-value" style={{ fontSize: '6.5pt', color: '#000', display: 'block', marginTop: '0.01cm', lineHeight: 1.1 }}>
                {productionData.productName}
              </span>
            </div>

            <div className="divider" style={{ width: '100%', height: '1px', background: '#ddd', margin: '0.05cm 0', flexShrink: 0 }} />

            <div className="info" style={{ width: '100%', fontSize: '6pt', marginBottom: '0.03cm', textAlign: 'center', flexShrink: 0 }}>
              <span className="info-label" style={{ fontWeight: 'bold', fontSize: '4.5pt', color: '#0A7EC2', display: 'block', lineHeight: 1.1 }}>
                Data de Produção
              </span>
              <span className="info-value" style={{ fontSize: '6.5pt', color: '#000', display: 'block', marginTop: '0.01cm', lineHeight: 1.1 }}>
                {formatDate(productionData.productionDate)}
              </span>
            </div>

            <div className="info" style={{ width: '100%', fontSize: '6pt', marginBottom: '0.03cm', textAlign: 'center', flexShrink: 0 }}>
              <span className="info-label" style={{ fontWeight: 'bold', fontSize: '4.5pt', color: '#0A7EC2', display: 'block', lineHeight: 1.1 }}>
                Traço
              </span>
              <span className="info-value" style={{ fontSize: '6.5pt', color: '#000', display: 'block', marginTop: '0.01cm', lineHeight: 1.1 }}>
                {productionData.recipeName}
              </span>
            </div>

            {productionData.orderNumber && (
              <div className="info" style={{ width: '100%', fontSize: '6pt', marginBottom: '0.03cm', textAlign: 'center', flexShrink: 0 }}>
                <span className="info-label" style={{ fontWeight: 'bold', fontSize: '4.5pt', color: '#0A7EC2', display: 'block', lineHeight: 1.1 }}>
                  Ordem de Produção
                </span>
                <span className="info-value" style={{ fontSize: '6.5pt', color: '#000', display: 'block', marginTop: '0.01cm', lineHeight: 1.1 }}>
                  OP #{productionData.orderNumber}
                </span>
              </div>
            )}

            <div className="info" style={{ width: '100%', fontSize: '6pt', marginBottom: '0.03cm', textAlign: 'center', flexShrink: 0 }}>
              <span className="info-label" style={{ fontWeight: 'bold', fontSize: '4.5pt', color: '#0A7EC2', display: 'block', lineHeight: 1.1 }}>
                {productionData.customerName ? 'Cliente' : 'Destino'}
              </span>
              <span className="info-value" style={{ fontSize: '6.5pt', color: '#000', display: 'block', marginTop: '0.01cm', lineHeight: 1.1 }}>
                {productionData.customerName || 'Reposição de Estoque'}
              </span>
            </div>

            <div className="divider" style={{ width: '100%', height: '1px', background: '#ddd', margin: '0.05cm 0', flexShrink: 0 }} />

            {qrCodeUrl && (
              <img
                src={qrCodeUrl}
                alt="QR Code"
                className="qr-code"
                style={{ width: '2.3cm', height: '2.3cm', marginTop: '0.05cm', flexShrink: 0, display: 'block' }}
              />
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handlePrint}
              className="flex-1 bg-[#0A7EC2] text-white px-4 py-3 rounded-lg hover:bg-[#0968A8] transition-colors flex items-center justify-center gap-2 font-semibold"
            >
              <Printer className="w-5 h-5" />
              Imprimir Etiqueta
            </button>
            <button
              onClick={onClose}
              className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
