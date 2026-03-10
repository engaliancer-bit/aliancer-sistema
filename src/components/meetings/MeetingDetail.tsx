import { ArrowLeft, Construction } from 'lucide-react';

interface MeetingDetailProps {
  meetingId: string;
  onBack: () => void;
}

export default function MeetingDetail({ meetingId: _meetingId, onBack }: MeetingDetailProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 text-gray-600 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <h2 className="text-2xl font-bold text-gray-900">Detalhes da Reunião</h2>
      </div>

      <div className="bg-white border border-dashed border-gray-300 rounded-xl p-16 text-center">
        <div className="w-16 h-16 mx-auto bg-yellow-100 rounded-full flex items-center justify-center mb-4">
          <Construction className="w-8 h-8 text-yellow-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Detalhes da Reunião em construção</h3>
        <p className="text-gray-400 text-sm">
          Esta tela exibirá transcrição completa, tópicos e tarefas extraídos da reunião.
        </p>
      </div>
    </div>
  );
}
