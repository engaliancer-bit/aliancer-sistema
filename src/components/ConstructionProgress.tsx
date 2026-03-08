import React, { useState, useEffect } from 'react';
import { HardHat, Package, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ConstructionQuoteItems from './ConstructionQuoteItems';

interface ConstructionProject {
  id: string;
  name: string;
  status: string;
  customer_id: string;
  customers?: {
    name: string;
  };
}

export default function ConstructionProgress() {
  const [projects, setProjects] = useState<ConstructionProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ [key: string]: { total: number; available: number; inProduction: number } }>({});

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('construction_projects')
        .select(`
          id,
          name,
          status,
          customer_id,
          customers(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProjects(data || []);

      // Carregar estatísticas de cada projeto
      if (data && data.length > 0) {
        const statsData: { [key: string]: { total: number; available: number; inProduction: number } } = {};

        for (const project of data) {
          const { data: items } = await supabase
            .from('construction_quote_items')
            .select('status')
            .eq('construction_project_id', project.id);

          if (items) {
            statsData[project.id] = {
              total: items.length,
              available: items.filter(i => i.status === 'available_for_delivery').length,
              inProduction: items.filter(i => i.status === 'in_production' || i.status === 'partially_available').length
            };
          }
        }

        setStats(statsData);
      }
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleItemsLoaded = (projectId: string) => {
    // Recarregar estatísticas quando items são atualizados
    loadProjects();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (selectedProject) {
    const project = projects.find(p => p.id === selectedProject);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => setSelectedProject(null)}
              className="text-orange-600 hover:text-orange-700 mb-2 flex items-center gap-2"
            >
              ← Voltar para lista de obras
            </button>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <HardHat className="w-8 h-8 text-orange-600" />
              {project?.name}
            </h2>
            {project?.customers && (
              <p className="text-gray-600 mt-1">Cliente: {project.customers.name}</p>
            )}
          </div>
        </div>

        <ConstructionQuoteItems
          constructionProjectId={selectedProject}
          onItemsLoaded={() => handleItemsLoaded(selectedProject)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <HardHat className="w-8 h-8 text-orange-600" />
          Acompanhamento de Obras
        </h2>
        <p className="text-gray-600">
          Gerencie os produtos vinculados a cada obra e acompanhe o status de produção e entregas
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <HardHat className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Nenhuma obra cadastrada
          </h3>
          <p className="text-gray-600">
            Cadastre obras na aba "Obras" para começar o acompanhamento
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const projectStats = stats[project.id] || { total: 0, available: 0, inProduction: 0 };

            return (
              <button
                key={project.id}
                onClick={() => setSelectedProject(project.id)}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:border-orange-600 hover:shadow-lg transition-all text-left"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg mb-1">
                      {project.name}
                    </h3>
                    {project.customers && (
                      <p className="text-sm text-gray-600">
                        {project.customers.name}
                      </p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    project.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    project.status === 'completed' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {project.status === 'in_progress' ? 'Em Andamento' :
                     project.status === 'completed' ? 'Concluída' : 'Planejamento'}
                  </span>
                </div>

                {projectStats.total > 0 && (
                  <div className="space-y-3 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Total de Produtos:</span>
                      <span className="font-semibold text-gray-900">
                        {projectStats.total}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1">
                        <Package className="w-4 h-4 text-green-600" />
                        Disponíveis:
                      </span>
                      <span className="font-semibold text-green-700">
                        {projectStats.available}
                      </span>
                    </div>

                    {projectStats.inProduction > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4 text-blue-600" />
                          Em Produção:
                        </span>
                        <span className="font-semibold text-blue-700">
                          {projectStats.inProduction}
                        </span>
                      </div>
                    )}

                    {projectStats.available > 0 && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm font-medium text-green-800">
                          ✅ Produtos prontos para entrega
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {projectStats.total === 0 && (
                  <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-600">
                      Nenhum orçamento vinculado
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
