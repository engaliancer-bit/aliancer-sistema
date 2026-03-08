# Guia Rápido - Documentos Técnicos com IA

## 🚀 Início Rápido (5 minutos)

### 1. Acesse o Módulo
1. Entre no sistema Aliancer
2. Clique em **"Escritório de Engenharia e Topografia"**
3. Clique na aba **"Documentos IA"**

### 2. Crie seu Primeiro Documento
1. Clique em **"Novo Documento"**
2. Selecione um template (ex: "Laudo de Avaliação de Imóvel")
3. Escolha o projeto relacionado
4. Dê um título (ou deixe o padrão)
5. Clique em **"Criar Documento"**

### 3. Gere o Conteúdo
1. No card do documento, clique em **"Gerar com IA"**
2. Aguarde a geração (alguns segundos)
3. Clique em **"Visualizar"** para ver o resultado

### 4. Revise e Exporte
1. Expanda cada seção para revisar
2. Edite manualmente se necessário
3. Clique em **"Aprovar"**
4. Clique em **"Exportar PDF"**

## ⚡ Funcionalidades Principais

### Templates Disponíveis

| Template | Descrição | Seções |
|----------|-----------|--------|
| **Avaliação de Imóvel** | Laudo técnico NBR 14653 | 6 seções |
| **Georreferenciamento** | Memorial descritivo | 5 seções |
| **PRAD** | Plano de Recuperação | 5 seções |
| **Realocação Reserva Legal** | Projeto técnico | Em configuração |
| **Terraplanagem** | Memorial de cálculo | Em configuração |

### Status dos Documentos

- 🔵 **Rascunho** - Documento criado, aguardando geração
- ⏳ **Gerando** - IA está gerando o conteúdo
- ✅ **Gerado** - Conteúdo criado, pronto para revisão
- 👁️ **Em Revisão** - Em processo de revisão
- ✔️ **Aprovado** - Revisado e aprovado
- 📄 **Finalizado** - Pronto para uso

## 🔑 Recursos Importantes

### Geração Individual vs Completa

**Gerar Documento Completo:**
- Gera todas as seções de uma vez
- Mais rápido para documentos padrão
- Usa contexto do projeto automaticamente

**Gerar Seção Individual:**
- Permite controle fino
- Útil para regenerar seções específicas
- Pode customizar o contexto por seção

### Edição Manual

1. Clique em "Visualizar" no documento
2. Expanda a seção desejada
3. Clique em "Editar"
4. Faça suas alterações
5. Clique em "Salvar"

**Nota:** Edições manuais ficam marcadas e são preservadas em novas gerações.

### Versionamento

- Cada alteração cria uma nova versão
- Histórico completo de revisões
- Possibilidade de reverter mudanças

## 📊 Dados Contextuais

O sistema usa dados do projeto automaticamente:

### Dados do Projeto
- Nome do projeto
- Cliente associado
- Imóvel vinculado
- Datas e prazos

### Dados do Imóvel
- Localização completa
- Área total
- Tipo (rural/urbano)
- Características específicas

### Dados Técnicos (Personalizáveis)
- Valores de avaliação
- Coordenadas geográficas
- Métodos utilizados
- Cálculos e resultados

## 🎯 Dicas de Uso

### ✨ Melhores Práticas

1. **Sempre Revise**
   - IA pode cometer erros
   - Verifique valores e cálculos
   - Ajuste para o contexto específico

2. **Complete o Contexto**
   - Quanto mais dados no projeto, melhor o resultado
   - Preencha informações técnicas relevantes
   - Use a seção de "dados técnicos" do projeto

3. **Use Templates**
   - Templates foram otimizados para resultados profissionais
   - Seções seguem normas técnicas
   - Linguagem apropriada para cada tipo

4. **Economize em Custos**
   - Não regenere desnecessariamente
   - Edite manualmente pequenas correções
   - Use a geração individual para seções específicas

### 🚫 O Que Evitar

- ❌ Não confie cegamente na IA
- ❌ Não use sem revisão humana
- ❌ Não inclua dados sensíveis sem conferir
- ❌ Não exporte sem aprovar

## 🔧 Configuração (Administradores)

### Integração com OpenAI (Necessária)

**⚠️ O sistema está pronto, mas precisa da API key do OpenAI para funcionar.**

1. Crie conta em [platform.openai.com](https://platform.openai.com)
2. Gere uma API key
3. Configure no Supabase:
   - Dashboard → Project Settings → Edge Functions
   - Adicione: `OPENAI_API_KEY = sua-chave-aqui`
4. Deploy da edge function (ver documentação completa)

### Criar Templates Personalizados

Você pode criar novos templates diretamente no banco:

```sql
-- 1. Criar template
INSERT INTO ai_document_templates (
  name,
  document_type,
  description,
  ai_model,
  temperature
) VALUES (
  'Meu Template',
  'laudo_tecnico',
  'Descrição',
  'gpt-4',
  0.7
);

-- 2. Adicionar seções
INSERT INTO ai_document_sections (
  template_id,
  section_title,
  section_number,
  order_index,
  content_type,
  ai_prompt,
  generation_instructions
) VALUES (
  'uuid-do-template',
  'Introdução',
  '1',
  1,
  'texto',
  'Elabore uma introdução para {{document_type}} sobre {{property_name}}',
  'Use linguagem formal e técnica'
);
```

## 💰 Custos Estimados

### Preços OpenAI (GPT-4)

| Uso | Custo Aproximado |
|-----|------------------|
| Documento curto (5 páginas) | R$ 1,50 - R$ 2,50 |
| Documento médio (10 páginas) | R$ 2,50 - R$ 4,00 |
| Documento longo (20+ páginas) | R$ 5,00 - R$ 8,00 |

**Obs:** Valores variam conforme complexidade e dados contextuais.

### Como Reduzir Custos

1. **Use modelos menores:** GPT-3.5 é mais barato
2. **Limite tokens:** Configure `max_tokens` adequado
3. **Não regenere:** Edite manualmente quando possível
4. **Cache respostas:** Sistema já faz isso automaticamente

## 📞 Suporte

### Problemas Comuns

**❓ "Botão Gerar não funciona"**
- Verifique se a API key do OpenAI está configurada
- Confirme se a edge function foi deployada

**❓ "Conteúdo está em inglês"**
- Adicione "em português" nas instruções do template
- Edite o prompt da seção específica

**❓ "Resultado não está bom"**
- Ajuste a temperatura (menor = mais conservador)
- Melhore o prompt com mais detalhes
- Adicione exemplo de saída esperada

**❓ "Erro ao gerar"**
- Verifique logs no Supabase
- Confirme que há créditos na conta OpenAI
- Revise se os dados do projeto estão completos

### Documentação Completa

Para mais detalhes, consulte:
- `SISTEMA_IA_DOCUMENTOS_TECNICOS.md` - Documentação técnica completa
- `README_MODULO_ENGENHARIA.md` - Visão geral do módulo

## 🎓 Tutorial em Vídeo

(A ser criado após integração com API)

## 📝 Checklist de Implementação

Para ativar completamente o sistema:

- [x] ✅ Criar estrutura do banco de dados
- [x] ✅ Criar interface de usuário
- [x] ✅ Configurar templates pré-definidos
- [ ] ⏳ Configurar API key do OpenAI
- [ ] ⏳ Fazer deploy da edge function
- [ ] ⏳ Testar geração de documentos
- [ ] ⏳ Implementar exportação PDF
- [ ] ⏳ Treinar usuários

## 🚦 Próximos Passos

1. **Configure a API** (5 minutos)
   - Crie conta OpenAI
   - Adicione API key no Supabase

2. **Deploy da Edge Function** (10 minutos)
   - Copie código da documentação
   - Faça deploy via Supabase CLI

3. **Teste o Sistema** (15 minutos)
   - Crie um documento de teste
   - Gere com IA
   - Revise e exporte

4. **Treine a Equipe** (30 minutos)
   - Demonstre o fluxo completo
   - Mostre boas práticas
   - Responda dúvidas

---

**Pronto para começar? Acesse o módulo e crie seu primeiro documento!** 🚀

**Precisa de ajuda? Consulte a documentação completa ou entre em contato com o suporte.**
