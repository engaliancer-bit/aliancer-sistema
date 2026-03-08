import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Upload, FileText, AlertCircle, Loader } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface GenerateIADocumentModalProps {
  projectId: string;
  onClose: () => void;
  onSuccess: (jobId: string) => void;
}

interface Template {
  id: string;
  name: string;
  document_type: string;
  ia_doc_type: string;
  ia_intake_questions: any[];
  ia_sections: any[];
}

interface IntakeAnswer {
  [key: string]: any;
}

interface FileWithMetadata {
  file: File;
  type: string;
  description?: string;
  latitude?: string;
  longitude?: string;
}

interface TechnicalResponsible {
  id: string;
  name: string;
  registration: string;
  council: string;
  specialty: string;
  is_default: boolean;
}

const FILE_TYPE_OPTIONS = [
  { value: 'outros', label: 'Outros' },
  { value: 'foto_area_degradada', label: 'Foto da area degradada' },
  { value: 'poligono_imovel', label: 'Poligono do imovel' },
  { value: 'area_prad', label: 'Area do PRAD' },
  { value: 'relatorio_fotografico_completo', label: 'Relatorio fotografico completo' },
  { value: 'geolocalizacao_kml', label: 'Geolocalizacao KML/KMZ' },
  { value: 'mapa_localizacao', label: 'Mapa de localizacao' },
  { value: 'laudo_tecnico', label: 'Laudo tecnico' },
  { value: 'art_rrt', label: 'ART/RRT' },
] as const;

export default function GenerateIADocumentModal({
  projectId,
  onClose,
  onSuccess
}: GenerateIADocumentModalProps) {
  const { user, session, isAuthenticated, loading: authLoading } = useAuth();
  const [step, setStep] = useState<'template' | 'intake' | 'briefing'>('template');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [intakeAnswers, setIntakeAnswers] = useState<IntakeAnswer>({});
  const [briefing, setBriefing] = useState('');
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [technicalResponsibles, setTechnicalResponsibles] = useState<TechnicalResponsible[]>([]);
  const [selectedResponsible, setSelectedResponsible] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[GenerateIADocumentModal] Auth state:', {
        isAuthenticated,
        hasUser: !!user,
        hasSession: !!session,
        userId: user?.id,
        authLoading,
        note: 'Sistema opera em modo publico - autenticacao opcional'
      });
    }
  }, [isAuthenticated, user, session, authLoading]);

  useEffect(() => {
    loadTemplates();
    loadTechnicalResponsibles();
  }, []);

  useEffect(() => {
    if (selectedResponsible && technicalResponsibles.length > 0) {
      const responsible = technicalResponsibles.find(r => r.id === selectedResponsible);
      if (responsible) {
        setIntakeAnswers(prev => {
          if (Object.keys(prev).length === 0) return prev;
          return {
            ...prev,
            responsavel_tecnico: responsible.name,
            registro_profissional: responsible.registration,
            conselho_classe: responsible.council,
            especialidade_tecnico: responsible.specialty,
          };
        });
      }
    }
  }, [selectedResponsible, technicalResponsibles]);

  const loadTechnicalResponsibles = useCallback(async () => {
    try {
      const { data: settingsData } = await supabase
        .from('company_settings')
        .select('technical_responsibles')
        .limit(1)
        .single();

      if (!isMountedRef.current) return;

      if (settingsData?.technical_responsibles) {
        const responsibles = settingsData.technical_responsibles as TechnicalResponsible[];
        setTechnicalResponsibles(responsibles);

        const defaultResponsible = responsibles.find(r => r.is_default);
        if (defaultResponsible) {
          setSelectedResponsible(defaultResponsible.id);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar responsaveis tecnicos:', error);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      setLoadingTemplates(true);
      const { data, error } = await supabase
        .from('ai_document_templates')
        .select('id, name, document_type, ia_doc_type, ia_intake_questions, ia_sections')
        .eq('ia_enabled', true)
        .order('name');

      if (!isMountedRef.current) return;

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      if (!isMountedRef.current) return;
      console.error('Erro ao carregar templates:', error);
      setError('Erro ao carregar templates: ' + error.message);
    } finally {
      if (isMountedRef.current) {
        setLoadingTemplates(false);
      }
    }
  }, []);

  const getQuestionId = useCallback((question: any) => question.key || question.id, []);

  const handleTemplateSelect = useCallback(async (template: Template) => {
    setSelectedTemplate(template);

    if (!template.ia_intake_questions || template.ia_intake_questions.length === 0) {
      setStep('briefing');
      return;
    }

    setStep('intake');

    const initialAnswers: IntakeAnswer = {};
    template.ia_intake_questions.forEach((q: any) => {
      const questionKey = q.key || q.id;
      if (q.type === 'boolean') {
        initialAnswers[questionKey] = false;
      } else if (q.type === 'multiple_choice' || q.type === 'file') {
        initialAnswers[questionKey] = [];
      } else {
        initialAnswers[questionKey] = '';
      }
    });

    if (template.document_type === 'prad') {
      try {
        const { data: prefilled, error } = await supabase
          .from('prad_prefilled_data')
          .select('*')
          .eq('project_id', projectId)
          .maybeSingle();

        if (!isMountedRef.current) return;

        if (!error && prefilled) {
          const responsible = technicalResponsibles.find(r => r.id === selectedResponsible) ||
                            technicalResponsibles.find(r => r.is_default);

          const prefilledAnswers: IntakeAnswer = {
            ...initialAnswers,
            empreendedor_nome: prefilled.customer_name || '',
            empreendedor_cpf_cnpj: prefilled.customer_document || '',
            empreendedor_telefone: prefilled.phone || '',
            empreendedor_email: prefilled.email || '',
            localizacao_imovel: prefilled.property_municipality && prefilled.property_state
              ? `${prefilled.property_name || ''}, ${prefilled.property_municipality}, ${prefilled.property_state}`
              : '',
            matricula_imovel: prefilled.registration_number || '',
            ccir: prefilled.ccir || '',
            car: prefilled.car_receipt_code || '',
            itr: prefilled.itr_cib || '',
            municipio: prefilled.property_municipality || '',
            responsavel_tecnico: responsible?.name || '',
            registro_profissional: responsible?.registration || '',
            conselho_classe: responsible?.council || '',
            especialidade_tecnico: responsible?.specialty || '',
            bioma: prefilled.bioma || '',
            estado: prefilled.property_state || '',
            legislacao_aplicavel: prefilled.state_with_legislation || '',
          };

          setIntakeAnswers(prefilledAnswers);
          return;
        }
      } catch (err) {
        console.error('Erro ao carregar dados pre-preenchidos:', err);
      }
    }

    if (isMountedRef.current) {
      setIntakeAnswers(initialAnswers);
    }
  }, [projectId, technicalResponsibles, selectedResponsible]);

  const handleIntakeChange = useCallback((questionId: string, value: any) => {
    setIntakeAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  }, []);

  const validateIntake = useCallback(() => {
    if (!selectedTemplate?.ia_intake_questions) return true;

    for (const question of selectedTemplate.ia_intake_questions) {
      if (question.required) {
        const questionId = getQuestionId(question);
        const answer = intakeAnswers[questionId];

        if (question.type === 'multiple_choice') {
          if (!Array.isArray(answer) || answer.length === 0) {
            setError(`A pergunta "${question.question}" e obrigatoria - selecione pelo menos uma opcao`);
            return false;
          }
        } else if (question.type === 'file') {
          if (!Array.isArray(answer) || answer.length === 0) {
            setError(`A pergunta "${question.question}" e obrigatoria - anexe pelo menos um arquivo`);
            return false;
          }
        } else {
          if (answer === undefined || answer === null || answer === '') {
            setError(`A pergunta "${question.question}" e obrigatoria`);
            return false;
          }
        }
      }
    }
    return true;
  }, [selectedTemplate, intakeAnswers, getQuestionId]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    if (files.length + selectedFiles.length > 10) {
      setError('Maximo de 10 arquivos permitidos');
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    const invalidFiles = selectedFiles.filter(f => f.size > maxSize);
    if (invalidFiles.length > 0) {
      setError('Alguns arquivos excedem 10MB');
      return;
    }

    const filesWithMetadata: FileWithMetadata[] = selectedFiles.map(file => ({
      file,
      type: 'outros',
      description: '',
      latitude: '',
      longitude: ''
    }));

    setFiles(prev => [...prev, ...filesWithMetadata]);
    setError(null);
  }, [files.length]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateFileMetadata = useCallback((index: number, field: keyof FileWithMetadata, value: string) => {
    setFiles(prev => prev.map((f, i) =>
      i === index ? { ...f, [field]: value } : f
    ));
  }, []);

  const uploadFileParallel = useCallback(async (
    jobId: string,
    file: File,
    fileType: string,
    description: string | null,
    coordinates: { latitude: number; longitude: number } | null,
    orderIndex: number
  ): Promise<boolean> => {
    const fileName = `${jobId}/${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('ia-files')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Erro ao fazer upload do arquivo:', uploadError);
        return false;
      }

      const { error: dbError } = await supabase
        .from('project_ia_job_files')
        .insert({
          job_id: jobId,
          storage_path: fileName,
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          file_type: fileType,
          description: description,
          coordinates: coordinates,
          order_index: orderIndex
        });

      if (dbError) {
        console.error('Erro ao registrar arquivo:', dbError);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Erro no upload:', err);
      return false;
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedTemplate) {
      setError('Nenhum template selecionado');
      return;
    }

    if (!briefing.trim()) {
      setError('O briefing e obrigatorio');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setUploadProgress('Criando documento...');

      abortControllerRef.current = new AbortController();

      const { data: jobId, error: jobError } = await supabase
        .rpc('create_project_ia_job', {
          p_project_id: projectId,
          p_template_id: selectedTemplate.id,
          p_briefing: briefing,
          p_intake_answers: intakeAnswers
        });

      if (!isMountedRef.current) return;

      if (jobError) throw jobError;
      if (!jobId) throw new Error('Erro ao criar job');

      const uploadPromises: Promise<boolean>[] = [];
      let fileOrderIndex = 0;

      if (selectedTemplate?.ia_intake_questions) {
        for (const question of selectedTemplate.ia_intake_questions) {
          if (question.type === 'file') {
            const questionId = getQuestionId(question);
            const filesAnswer = intakeAnswers[questionId];

            if (Array.isArray(filesAnswer) && filesAnswer.length > 0) {
              for (const file of filesAnswer) {
                uploadPromises.push(
                  uploadFileParallel(
                    jobId,
                    file,
                    questionId,
                    `Pergunta: ${question.question}`,
                    null,
                    fileOrderIndex++
                  )
                );
              }
            }
          }
        }
      }

      if (files.length > 0) {
        for (const fileData of files) {
          let coordinates = null;
          if (fileData.latitude && fileData.longitude) {
            const lat = parseFloat(fileData.latitude);
            const lng = parseFloat(fileData.longitude);
            if (!isNaN(lat) && !isNaN(lng)) {
              coordinates = { latitude: lat, longitude: lng };
            }
          }

          uploadPromises.push(
            uploadFileParallel(
              jobId,
              fileData.file,
              fileData.type,
              fileData.description || null,
              coordinates,
              fileOrderIndex++
            )
          );
        }
      }

      if (uploadPromises.length > 0) {
        setUploadProgress(`Enviando ${uploadPromises.length} arquivo(s)...`);

        const results = await Promise.all(uploadPromises);
        const successCount = results.filter(Boolean).length;

        if (!isMountedRef.current) return;

        if (successCount < uploadPromises.length) {
          console.warn(`${uploadPromises.length - successCount} arquivo(s) falharam no upload`);
        }
      }

      setUploadProgress('Iniciando processamento...');

      try {
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-project-document`;

        fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ job_id: jobId })
        }).catch(err => {
          console.error('Erro ao invocar Edge Function:', err);
        });
      } catch (invokeError) {
        console.error('Erro ao invocar Edge Function:', invokeError);
      }

      if (isMountedRef.current) {
        onSuccess(jobId);
      }

    } catch (error: any) {
      if (!isMountedRef.current) return;
      console.error('Erro ao gerar documento:', error);
      setError('Erro ao gerar documento: ' + error.message);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setUploadProgress('');
      }
    }
  }, [selectedTemplate, briefing, projectId, intakeAnswers, files, getQuestionId, uploadFileParallel, onSuccess]);

  const fileTypeOptionsElements = useMemo(() => (
    FILE_TYPE_OPTIONS.map(opt => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))
  ), []);

  const renderTemplateStep = useCallback(() => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Selecione o Template</h3>

      {loadingTemplates ? (
        <div className="flex justify-center py-8">
          <Loader className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-2 text-gray-400" />
          <p>Nenhum template com IA disponivel</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleTemplateSelect(template)}
              className="text-left p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">{template.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{template.document_type}</p>
                  {template.ia_sections && (
                    <p className="text-xs text-gray-500 mt-2">
                      {template.ia_sections.length} secoes configuradas
                    </p>
                  )}
                </div>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                  {template.ia_doc_type}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  ), [loadingTemplates, templates, handleTemplateSelect]);

  const renderIntakeStep = useCallback(() => {
    if (!selectedTemplate?.ia_intake_questions) return null;

    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Perguntas de Intake</h3>
          <p className="text-sm text-gray-500 mt-1">
            Responda as perguntas para personalizar o documento
          </p>
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {selectedTemplate.ia_intake_questions.map((question: any, index: number) => {
            const questionId = getQuestionId(question);
            return (
            <div key={questionId} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {index + 1}. {question.question}
                {question.required && <span className="text-red-500 ml-1">*</span>}
              </label>

              {question.type === 'text' && (
                <input
                  type="text"
                  value={intakeAnswers[questionId] || ''}
                  onChange={(e) => handleIntakeChange(questionId, e.target.value)}
                  placeholder={question.placeholder}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}

              {question.type === 'textarea' && (
                <textarea
                  value={intakeAnswers[questionId] || ''}
                  onChange={(e) => handleIntakeChange(questionId, e.target.value)}
                  placeholder={question.placeholder}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}

              {question.type === 'select' && question.options && (
                <select
                  value={intakeAnswers[questionId] || ''}
                  onChange={(e) => handleIntakeChange(questionId, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione...</option>
                  {question.options.map((option: string) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              )}

              {question.type === 'boolean' && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={intakeAnswers[questionId] || false}
                    onChange={(e) => handleIntakeChange(questionId, e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Sim</span>
                </label>
              )}

              {question.type === 'date' && (
                <input
                  type="date"
                  value={intakeAnswers[questionId] || ''}
                  onChange={(e) => handleIntakeChange(questionId, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}

              {question.type === 'number' && (
                <input
                  type="number"
                  value={intakeAnswers[questionId] || ''}
                  onChange={(e) => handleIntakeChange(questionId, e.target.value)}
                  placeholder={question.placeholder}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}

              {question.type === 'multiple_choice' && question.options && (
                <div className="space-y-2">
                  {question.options.map((option: string) => {
                    const currentValues = intakeAnswers[questionId] || [];
                    const isChecked = Array.isArray(currentValues) && currentValues.includes(option);

                    return (
                      <label key={option} className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let newValues = Array.isArray(currentValues) ? [...currentValues] : [];
                            if (e.target.checked) {
                              if (!newValues.includes(option)) {
                                newValues.push(option);
                              }
                            } else {
                              newValues = newValues.filter(v => v !== option);
                            }
                            handleIntakeChange(questionId, newValues);
                          }}
                          className="mt-0.5 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{option}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {question.type === 'file' && (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                    <input
                      type="file"
                      id={`file-${questionId}`}
                      multiple={question.multiple !== false}
                      accept={question.accept || '*'}
                      onChange={(e) => {
                        const selectedFiles = Array.from(e.target.files || []);
                        if (selectedFiles.length > 0) {
                          const currentFiles = intakeAnswers[questionId] || [];
                          const newFiles = question.multiple !== false
                            ? [...(Array.isArray(currentFiles) ? currentFiles : []), ...selectedFiles]
                            : selectedFiles;
                          handleIntakeChange(questionId, newFiles);
                        }
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor={`file-${questionId}`}
                      className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Upload className="h-5 w-5" />
                      Selecionar Arquivo(s)
                    </label>
                    {question.accept && (
                      <p className="text-xs text-gray-500 mt-2">
                        Formatos aceitos: {question.accept}
                      </p>
                    )}
                  </div>

                  {intakeAnswers[questionId] && Array.isArray(intakeAnswers[questionId]) && intakeAnswers[questionId].length > 0 && (
                    <div className="space-y-2">
                      {(intakeAnswers[questionId] as File[]).map((file: File, fileIndex: number) => (
                        <div
                          key={fileIndex}
                          className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                            <span className="text-sm text-gray-700 truncate">{file.name}</span>
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const currentFiles = intakeAnswers[questionId] as File[];
                              const newFiles = currentFiles.filter((_: File, i: number) => i !== fileIndex);
                              handleIntakeChange(questionId, newFiles);
                            }}
                            className="ml-2 text-red-600 hover:text-red-800 flex-shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={() => setStep('template')}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Voltar
          </button>
          <button
            onClick={() => {
              if (validateIntake()) {
                setStep('briefing');
                setError(null);
              }
            }}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Continuar
          </button>
        </div>
      </div>
    );
  }, [selectedTemplate, intakeAnswers, getQuestionId, handleIntakeChange, validateIntake]);

  const renderBriefingStep = useCallback(() => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Briefing e Anexos</h3>
        <p className="text-sm text-gray-500 mt-1">
          Template: <strong>{selectedTemplate?.name}</strong>
        </p>
      </div>

      {technicalResponsibles.length > 0 && selectedTemplate?.document_type === 'prad' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Responsavel Tecnico <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedResponsible}
            onChange={(e) => setSelectedResponsible(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {technicalResponsibles.map((responsible) => (
              <option key={responsible.id} value={responsible.id}>
                {responsible.name} - {responsible.registration} ({responsible.council})
                {responsible.is_default ? ' - Padrao' : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Selecione o profissional responsavel por este documento
          </p>
        </div>
      )}

      {technicalResponsibles.length === 0 && selectedTemplate?.document_type === 'prad' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>Atencao:</strong> Nenhum responsavel tecnico cadastrado. Acesse "Configuracoes" - "Configuracoes da Empresa" para adicionar responsaveis tecnicos.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Briefing <span className="text-red-500">*</span>
        </label>
        <textarea
          value={briefing}
          onChange={(e) => setBriefing(e.target.value)}
          placeholder="Descreva o que voce precisa no documento. Ex: Laudo tecnico de vistoria estrutural completo, incluindo analise de patologias e recomendacoes..."
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">
          Quanto mais detalhado, melhor sera o resultado
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Anexos (opcional)
        </label>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
          <input
            type="file"
            id="file-upload"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <Upload className="h-5 w-5" />
            Selecionar Arquivos
          </label>
          <p className="text-xs text-gray-500 mt-2">
            Maximo 10 arquivos, 10MB cada (PDF, DOC, DOCX, JPG, PNG, XLSX)
          </p>
        </div>

        {files.length > 0 && (
          <div className="mt-3 space-y-3 max-h-96 overflow-y-auto">
            {files.map((fileData, index) => (
              <div
                key={index}
                className="p-3 bg-gray-50 rounded border border-gray-200 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700 truncate">{fileData.file.name}</span>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      ({(fileData.file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="ml-2 text-red-600 hover:text-red-800 flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Tipo de arquivo <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={fileData.type}
                      onChange={(e) => updateFileMetadata(index, 'type', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    >
                      {fileTypeOptionsElements}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Descricao/Observacao
                    </label>
                    <input
                      type="text"
                      value={fileData.description || ''}
                      onChange={(e) => updateFileMetadata(index, 'description', e.target.value)}
                      placeholder="Ex: Foto tirada no ponto 1, visao norte"
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {(fileData.type === 'foto_area_degradada' || fileData.file.type.startsWith('image/')) && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Latitude
                        </label>
                        <input
                          type="text"
                          value={fileData.latitude || ''}
                          onChange={(e) => updateFileMetadata(index, 'latitude', e.target.value)}
                          placeholder="-27.5949"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Longitude
                        </label>
                        <input
                          type="text"
                          value={fileData.longitude || ''}
                          onChange={(e) => updateFileMetadata(index, 'longitude', e.target.value)}
                          placeholder="-48.5482"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4 border-t">
        <button
          onClick={() => {
            if (selectedTemplate?.ia_intake_questions && selectedTemplate.ia_intake_questions.length > 0) {
              setStep('intake');
            } else {
              setStep('template');
            }
          }}
          disabled={loading}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Voltar
        </button>
        <button
          onClick={handleGenerate}
          disabled={loading || !briefing.trim()}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader className="h-5 w-5 animate-spin" />
              {uploadProgress || 'Processando...'}
            </>
          ) : (
            <>
              <FileText className="h-5 w-5" />
              Gerar Documento
            </>
          )}
        </button>
      </div>
    </div>
  ), [selectedTemplate, technicalResponsibles, selectedResponsible, briefing, files, loading, uploadProgress, handleFileSelect, removeFile, updateFileMetadata, fileTypeOptionsElements, handleGenerate]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Gerar Documento com IA
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {step === 'template' && renderTemplateStep()}
          {step === 'intake' && renderIntakeStep()}
          {step === 'briefing' && renderBriefingStep()}
        </div>
      </div>
    </div>
  );
}
