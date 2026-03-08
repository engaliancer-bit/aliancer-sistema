import { memo } from 'react';
import { Edit2, Eye, Calendar, DollarSign, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';

interface EngineeringProject {
  id: string;
  name: string;
  customer_name: string;
  property_name: string;
  status: string;
  has_deadline: boolean;
  deadline_date: string | null;
  grand_total: number;
  balance: number;
  created_at: string;
  exigency_description: string;
}

interface ProjectCardProps {
  project: EngineeringProject;
  progress?: { completed: number; total: number };
  daysUntilDeadline?: number | null;
  onView: (project: EngineeringProject) => void;
  onEdit: (project: EngineeringProject) => void;
}

/**
 * Componente memoizado para card individual de projeto
 *
 * Evita re-render quando outros projetos da lista mudam
 */
export const ProjectCard = memo(function ProjectCard({
  project,
  progress,
  daysUntilDeadline,
  onView,
  onEdit,
}: ProjectCardProps) {
  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; text: string; icon: any }> = {
      a_iniciar: { color: 'bg-gray-100 text-gray-800', text: 'A Iniciar', icon: Calendar },
      em_desenvolvimento: { color: 'bg-blue-100 text-blue-800', text: 'Em Desenvolvimento', icon: TrendingUp },
      em_correcao: { color: 'bg-yellow-100 text-yellow-800', text: 'Em Correção', icon: AlertCircle },
      finalizado: { color: 'bg-green-100 text-green-800', text: 'Finalizado', icon: CheckCircle2 },
      entregue: { color: 'bg-green-100 text-green-800', text: 'Entregue', icon: CheckCircle2 },
      em_exigencia: { color: 'bg-red-100 text-red-800', text: 'Em Exigência', icon: AlertCircle },
      registrado: { color: 'bg-purple-100 text-purple-800', text: 'Registrado', icon: CheckCircle2 },
    };

    const badge = badges[status] || badges.a_iniciar;
    const Icon = badge.icon;

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.text}
      </span>
    );
  };

  const getDeadlineWarning = () => {
    if (!project.has_deadline || daysUntilDeadline === null) return null;

    if (daysUntilDeadline < 0) {
      return (
        <div className="flex items-center gap-1 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span className="font-medium">Atrasado {Math.abs(daysUntilDeadline)} dias</span>
        </div>
      );
    }

    if (daysUntilDeadline <= 7) {
      return (
        <div className="flex items-center gap-1 text-orange-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span className="font-medium">Vence em {daysUntilDeadline} dias</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 text-gray-600 text-sm">
        <Calendar className="w-4 h-4" />
        <span>Prazo: {daysUntilDeadline} dias</span>
      </div>
    );
  };

  return (
    <div
      className={`bg-white border rounded-lg p-4 hover:shadow-md transition-shadow ${
        project.status === 'em_exigencia' ? 'border-red-300 bg-red-50' : 'border-gray-200'
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">{project.name}</h3>
          <p className="text-sm text-gray-600">Cliente: {project.customer_name}</p>
          <p className="text-sm text-gray-600">Imóvel: {project.property_name}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onView(project)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Ver detalhes"
          >
            <Eye className="w-5 h-5" />
          </button>
          <button
            onClick={() => onEdit(project)}
            className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            title="Editar"
          >
            <Edit2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          {getStatusBadge(project.status)}
          {getDeadlineWarning()}
        </div>

        {progress && progress.total > 0 && (
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Progresso</span>
              <span>
                {progress.completed}/{progress.total} etapas
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${(progress.completed / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {project.status === 'em_exigencia' && project.exigency_description && (
          <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-sm text-red-800">
            <strong>Exigência:</strong> {project.exigency_description}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-1 text-gray-700">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm font-medium">
              Total: R$ {project.grand_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          {project.balance > 0 && (
            <span className="text-sm text-orange-600 font-medium">
              Saldo: R$ {project.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
