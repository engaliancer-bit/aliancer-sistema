# Sistema de Cobrança Semi-Automática via WhatsApp

## Resumo

Sistema integrado ao módulo de Projetos de Engenharia e Topografia que permite enviar mensagens de cobrança formatadas automaticamente via WhatsApp para clientes com saldo devedor.

---

## Funcionalidades

### 1. Botão de Cobrança WhatsApp

**Localização:** Módulo Engenharia → Projetos → Aba "À Cobrar"

**Características:**
- Botão verde do WhatsApp (MessageCircle) na coluna "Ações"
- Primeiro botão da coluna de ações
- Visível em todos os projetos da aba "À Cobrar"
- Ao lado dos botões de "Ver Projeto" e "Ver Financeiro"

**Condições:**
- Aparece apenas na aba "À Cobrar"
- Projetos nesta aba já têm saldo devedor garantido
- Cliente deve ter telefone cadastrado

### 2. Modal de Preview

Ao clicar no botão WhatsApp, abre um modal com:

#### Informações Exibidas:
- **Destinatário:** Nome e telefone do cliente
- **Preview da mensagem:** Visualização completa da mensagem formatada
- **Saldo devedor:** Destacado em vermelho

#### Ações Disponíveis:
1. **Copiar Mensagem** - Copia o texto para área de transferência
2. **Cancelar** - Fecha o modal sem enviar
3. **Abrir WhatsApp** - Abre WhatsApp Web com mensagem pré-formatada

---

## Formato da Mensagem de Cobrança

A mensagem é gerada automaticamente com as seguintes seções:

### 1. Cabeçalho
```
🏢 *NOME DA EMPRESA*

Olá, [Nome do Cliente]! 👋

Segue o extrato detalhado do projeto:
```

### 2. Identificação do Projeto
```
📋 *PROJETO:* Nome do Projeto
🏠 *IMÓVEL:* Nome do Imóvel
```

### 3. Discriminação de Valores
```
━━━━━━━━━━━━━━━━━━━━
💰 *DISCRIMINAÇÃO DE VALORES*
━━━━━━━━━━━━━━━━━━━━

• *Valor Negociado:*
  R$ 4.500,00

• *Custos Adicionais:*
  - Material: GPS Geodésico
    R$ 1.200,00
  - Viagem/Deslocamento: Visita técnica
    R$ 300,00
  - Serviço: Topografia
    R$ 800,00
```

### 4. Resumo Financeiro
```
━━━━━━━━━━━━━━━━━━━━

💵 *RESUMO FINANCEIRO*

*Valor Total:* R$ 6.800,00
*Total Recebido:* R$ 3.000,00

🔴 *SALDO A RECEBER: R$ 3.800,00*
```

### 5. Formas de Pagamento
```
━━━━━━━━━━━━━━━━━━━━

💳 *FORMAS DE PAGAMENTO*

Por favor, selecione uma opção:

1️⃣ *Transferência Bancária*
   [Dados bancários da empresa]

2️⃣ *PIX*
   Chave: [Chave PIX cadastrada]

3️⃣ *Dinheiro*

4️⃣ *Cartão de Crédito*
   (Consulte parcelamento)

5️⃣ *Cartão de Débito*

6️⃣ *Cheque*
   (Consulte parcelamento)

7️⃣ *Falar com a Aliancer*
```

### 6. Rodapé
```
━━━━━━━━━━━━━━━━━━━━

Estamos à disposição para esclarecer qualquer dúvida! 😊

📞 *Contato:* [Telefone da empresa]

_Mensagem gerada automaticamente pelo Sistema de Gestão_
```

---

## Configuração Necessária

### 1. Configurações da Empresa

Acesse: **Módulo Fábrica → Configurações da Empresa**

Configure os seguintes campos:

#### Campos Obrigatórios:
- **Nome da Empresa** - Aparece no cabeçalho da mensagem
- **Telefone** - Aparece no rodapé como contato

#### Campos Opcionais:
- **Chave PIX** - Exibida na opção de pagamento PIX
- **Dados Bancários** - Exibidos na opção de transferência bancária

**Exemplo de preenchimento:**
```
Nome: Aliancer Engenharia e Topografia
Telefone: (65) 99999-9999
Chave PIX: 12.345.678/0001-90 (CNPJ)
Dados Bancários: Banco do Brasil - Ag: 1234-5 / Conta: 12345-6
```

### 2. Cadastro de Clientes

**Módulo Engenharia → Clientes**

#### Campo Obrigatório:
- **Telefone** - Necessário para envio via WhatsApp

**Formato aceito:**
- (65) 99999-9999
- 65 99999-9999
- 65999999999

O sistema formata automaticamente para o padrão do WhatsApp.

### 3. Estrutura do Projeto

Para a mensagem ser gerada corretamente, o projeto deve ter:

#### Obrigatórios:
- **Cliente vinculado** (com telefone)
- **Valor negociado** (`total_actual_value`)
- **Saldo devedor** (`balance > 0`)

#### Opcionais:
- **Custos adicionais** - São listados na discriminação
- **Imóvel vinculado** - Nome do imóvel aparece na mensagem

---

## Como Usar

### Passo a Passo

#### 1. Verificar Pré-requisitos
```
✓ Cliente tem telefone cadastrado
✓ Projeto tem saldo devedor
✓ Configurações da empresa preenchidas
```

#### 2. Acessar Aba "À Cobrar"
```
Módulo Engenharia → Projetos de Engenharia e Topografia → Aba "À Cobrar"
```

#### 3. Identificar o Projeto
- Veja a lista de projetos com saldo devedor
- Verifique cliente, valor e saldo na tabela
- Todos os projetos desta aba possuem saldo a receber

#### 4. Abrir Modal de Cobrança
- Na coluna "Ações", clique no botão verde do WhatsApp (primeiro botão)
- Revise as informações exibidas no modal

#### 5. Revisar Mensagem
- Leia o preview completo
- Verifique valores e informações de pagamento
- Confirme dados do cliente

#### 6. Enviar
Duas opções:

**A) Copiar e colar:**
1. Clique em "Copiar Mensagem"
2. Abra o WhatsApp manualmente
3. Cole a mensagem na conversa do cliente

**B) Abrir WhatsApp Web:**
1. Clique em "Abrir WhatsApp"
2. WhatsApp Web abrirá automaticamente
3. Mensagem aparecerá pré-formatada
4. Basta pressionar Enter para enviar

---

## Validações e Alertas

O sistema faz as seguintes validações:

### 1. Cliente Não Encontrado
```
❌ Alerta: "Cliente não encontrado"
```
**Solução:** Verifique se o projeto está vinculado a um cliente válido.

### 2. Telefone Não Cadastrado
```
❌ Alerta: "Cliente não possui telefone cadastrado"
```
**Solução:** Edite o cliente e adicione o telefone.

### 3. Sem Saldo Devedor
```
❌ Alerta: "Este projeto não possui saldo devedor"
```
**Informação:** Todos os projetos na aba "À Cobrar" têm saldo devedor. Se este erro aparecer, há uma inconsistência nos dados.

### 4. Erro ao Carregar Dados
```
❌ Alerta: "Erro ao carregar dados do projeto"
```
**Solução:** Verifique a conexão com o banco de dados.

---

## Tipos de Custos Adicionais

Os custos são categorizados e exibidos com rótulos apropriados:

| Tipo no Sistema | Como Aparece na Mensagem |
|-----------------|---------------------------|
| `material` | Material |
| `travel` | Viagem/Deslocamento |
| `service` | Serviço |
| `honorarios_servicos_adicionais` | Honorários - Serviços Adicionais |
| `marco_concreto` | Marco de Concreto |
| `outros` | Outros |

---

## Exemplo Completo de Uso

### Cenário:
- **Cliente:** João Silva
- **Telefone:** (65) 99123-4567
- **Projeto:** Georreferenciamento - Fazenda Santa Clara
- **Valor Negociado:** R$ 4.500,00
- **Custos Adicionais:** R$ 2.300,00
- **Total:** R$ 6.800,00
- **Recebido:** R$ 3.000,00
- **Saldo:** R$ 3.800,00

### Fluxo:

1. **Acesso:**
   - Módulo Engenharia → Projetos → Aba "À Cobrar"
   - Localizar projeto "Georreferenciamento - Fazenda Santa Clara" na tabela

2. **Verificação:**
   - ✓ Cliente: João Silva (com telefone visível)
   - ✓ Saldo Devedor: R$ 3.800,00 (em vermelho)
   - ✓ Botões de ação disponíveis

3. **Ação:**
   - Clique no botão verde do WhatsApp (primeiro botão da coluna Ações)
   - Modal abre com preview da mensagem

4. **Revisão:**
   ```
   🏢 *Aliancer Engenharia e Topografia*

   Olá, João Silva! 👋

   ...

   🔴 *SALDO A RECEBER: R$ 3.800,00*
   ```

5. **Envio:**
   - Clique em "Abrir WhatsApp"
   - WhatsApp Web abre com mensagem formatada
   - Pressione Enter para enviar

6. **Resultado:**
   - Cliente recebe mensagem profissional
   - Com todas as informações de pagamento
   - Pode responder diretamente escolhendo forma de pagamento

---

## Vantagens do Sistema

### 1. Automatização
- Geração automática da mensagem
- Cálculos automáticos de valores
- Formatação profissional

### 2. Profissionalismo
- Mensagem padronizada
- Visual organizado
- Informações completas

### 3. Agilidade
- Não precisa digitar manualmente
- Evita erros de digitação
- Valores sempre corretos

### 4. Transparência
- Cliente vê discriminação detalhada
- Todas as opções de pagamento
- Histórico completo do projeto

### 5. Facilidade
- Um clique para gerar
- Preview antes de enviar
- Integração direta com WhatsApp

---

## Boas Práticas

### 1. Manutenção das Configurações
- Mantenha dados bancários atualizados
- Verifique chave PIX regularmente
- Atualize telefone da empresa

### 2. Cadastro de Clientes
- Sempre cadastre telefones com DDD
- Verifique número antes de enviar
- Mantenha cadastro atualizado

### 3. Projetos
- Registre custos adicionais detalhadamente
- Mantenha valores sempre atualizados
- Confirme recebimentos no sistema

### 4. Comunicação
- Revise mensagem antes de enviar
- Personalize se necessário (copie e edite)
- Acompanhe resposta do cliente

### 5. Acompanhamento
- Registre pagamentos recebidos no sistema
- Atualize status do projeto
- Mantenha histórico de comunicações

---

## Troubleshooting

### Problema: Projeto não aparece na aba "À Cobrar"

**Verificar:**
1. Projeto tem saldo devedor? (balance > 0)
2. Status do projeto está como "finalizado", "entregue" ou "registrado"?
3. Valores estão atualizados no banco?

**Solução:**
- Confirme recebimentos no sistema
- Verifique o status do projeto
- Recalcule valores do projeto
- Atualize a página

### Problema: WhatsApp não abre

**Verificar:**
1. WhatsApp Web está funcionando?
2. Telefone está formatado corretamente?
3. Navegador permite pop-ups?

**Solução:**
- Use a opção "Copiar Mensagem"
- Habilite pop-ups no navegador
- Tente outro navegador

### Problema: Dados bancários não aparecem

**Verificar:**
1. Campos estão preenchidos em Configurações?
2. Salvou as alterações?

**Solução:**
- Acesse Configurações da Empresa
- Preencha PIX Key e Dados Bancários
- Salve as alterações

### Problema: Valores incorretos na mensagem

**Verificar:**
1. Custos adicionais estão registrados?
2. Pagamentos estão lançados?
3. Valor negociado está correto?

**Solução:**
- Revise custos adicionais do projeto
- Confirme pagamentos recebidos
- Atualize valor negociado se necessário

---

## Suporte Técnico

### Campos na Tabela company_settings

```sql
-- Verificar configurações
SELECT name, phone, pix_key, bank_account
FROM company_settings;
```

### Campos na Tabela customers

```sql
-- Verificar telefone do cliente
SELECT id, name, phone
FROM customers
WHERE id = '[customer_id]';
```

### Campos na Tabela engineering_projects

```sql
-- Verificar valores do projeto
SELECT
  name,
  total_actual_value,
  grand_total,
  total_received,
  balance
FROM engineering_projects
WHERE id = '[project_id]';
```

---

## Migration Aplicada

**Arquivo:** `add_whatsapp_billing_fields_company_settings.sql`

**Campos adicionados:**
- `pix_key` (text, nullable) - Chave PIX da empresa
- `bank_account` (text, nullable) - Dados bancários da empresa

**Comando:**
```sql
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS pix_key text,
ADD COLUMN IF NOT EXISTS bank_account text;
```

---

## Arquivos Criados/Modificados

### Novos Arquivos

1. **`src/components/engineering/WhatsAppBillingModal.tsx`**
   - Componente do modal de cobrança
   - Geração da mensagem formatada
   - Interface de preview e envio

### Arquivos Modificados

2. **`src/components/EngineeringProjectsManager.tsx`**
   - Importação do componente WhatsAppBillingModal
   - Importação do ícone MessageCircle
   - Estados para controle do modal
   - Função handleOpenWhatsAppBilling
   - Botão de cobrança na listagem de projetos
   - Renderização do modal
   - Adição de campo phone na interface Customer
   - Atualização da query de clientes

### Migrations

3. **`supabase/migrations/[timestamp]_add_whatsapp_billing_fields_company_settings.sql`**
   - Adição dos campos pix_key e bank_account

---

## Roadmap Futuro

Possíveis melhorias para versões futuras:

### Fase 2
- [ ] Histórico de mensagens enviadas
- [ ] Templates customizáveis
- [ ] Agendamento de envio
- [ ] Lembretes automáticos

### Fase 3
- [ ] Integração com API oficial do WhatsApp Business
- [ ] Disparo em lote
- [ ] Análise de respostas
- [ ] Estatísticas de cobrança

### Fase 4
- [ ] Geração de link de pagamento
- [ ] QR Code PIX na mensagem
- [ ] Confirmação automática de pagamento
- [ ] Integração com gateway de pagamento

---

## Conclusão

O Sistema de Cobrança Semi-Automática via WhatsApp oferece:

- **Automatização** do processo de cobrança
- **Padronização** da comunicação com clientes
- **Agilidade** no envio de cobranças
- **Profissionalismo** nas mensagens
- **Transparência** nas informações
- **Facilidade** de uso

Sistema pronto para uso imediato após configuração inicial.

---

**Implementado em:** 16/02/2026

**Atualizado em:** 16/02/2026 (Correções e melhorias)

**Alterações da Atualização:**
- ✅ Corrigido erro ao carregar dados do projeto (queries separadas e maybeSingle)
- ✅ Botão movido para aba "À Cobrar" (melhor localização contextual)
- ✅ Removido da listagem principal de projetos
- ✅ Botão agora é o primeiro da coluna "Ações" (verde)
- ✅ Corrigido carregamento de configurações (formato chave-valor)
- ✅ Adicionados logs detalhados para debug
- ✅ Melhorado tratamento de erros

**Build:** ✓ Sucesso (25.28s)

**Status:** ✅ Pronto para produção

**Nota Técnica:** A tabela `company_settings` usa formato chave-valor (setting_key/setting_value). As chaves são:
- `company_name` → Nome da empresa
- `company_phone` → Telefone da empresa
- `bank_pix` → Chave PIX
- `bank_account` → Conta bancária
