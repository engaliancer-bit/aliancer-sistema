# Atualização: Endereço Correto da Empresa

## Problema

O endereço da empresa estava incorreto no banco de dados:
- **Endereço Incorreto:** Linha Olaria, s/n, Zona Rural - Itapiranga/SC

## Solução

Atualizado o endereço correto com base nos campos configurados no módulo "Configurações da Empresa":

### Campos do Endereço
```
- Rua: Rua João Castilho
- Número: 258
- Complemento: Sala 09
- Bairro: Centro
- Cidade: Tunápolis
- Estado: SC
- CEP: 89898-000
```

### Endereço Completo Atualizado
```
Rua João Castilho, 258, Sala 09 - Centro - Tunápolis/SC - CEP: 89898-000
```

## Configurações Completas da Empresa

Todas as configurações agora estão corretas:

| Configuração | Valor |
|--------------|-------|
| **Logo** | https://lfddbmknscawlbldrmub.supabase.co/storage/v1/object/public/company-logo/company-logo.png |
| **Nome** | Aliancer Engenharia e Topografia |
| **Endereço** | Rua João Castilho, 258, Sala 09 - Centro - Tunápolis/SC - CEP: 89898-000 |
| **Telefone** | 49 991955198 |
| **Email** | administrativo@aliancer.com.br |
| **CNPJ** | 28.008.940/0001-46 |

## Impacto

O endereço correto agora será exibido em:
- ✅ PDF do Extrato do Cliente
- ✅ Todos os relatórios que usam o cabeçalho padrão
- ✅ Documentos oficiais gerados pelo sistema
- ✅ Orçamentos e propostas

## SQL Executado

```sql
UPDATE company_settings
SET setting_value = 'Rua João Castilho, 258, Sala 09 - Centro - Tunápolis/SC - CEP: 89898-000'
WHERE setting_key = 'company_address';
```

## Como Verificar

### 1. Verificar no Banco de Dados
```sql
SELECT setting_key, setting_value
FROM company_settings
WHERE setting_key = 'company_address';
```

**Resultado esperado:**
```
company_address | Rua João Castilho, 258, Sala 09 - Centro - Tunápolis/SC - CEP: 89898-000
```

### 2. Verificar no PDF do Extrato
```
1. Acesse Módulo Engenharia → Extrato do Cliente
2. Selecione um cliente
3. Clique em "Exportar PDF"
4. Verifique o cabeçalho do PDF
```

**Resultado esperado:**
```
┌────────────────────────────────────────────────────────────────┐
│ [LOGO]    Aliancer Engenharia e Topografia                     │
│           Rua João Castilho, 258, Sala 09                      │
│           Centro - Tunápolis/SC - CEP: 89898-000               │
│           Tel: 49 991955198                                    │
│           Email: administrativo@aliancer.com.br                │
│           CNPJ: 28.008.940/0001-46                             │
└────────────────────────────────────────────────────────────────┘
```

### 3. Verificar nas Configurações da Empresa
```
1. Acesse Módulo → Configurações da Empresa
2. Aba "Endereço"
3. Verifique os campos:
   - Rua: Rua João Castilho
   - Número: 258
   - Complemento: Sala 09
   - Bairro: Centro
   - Cidade: Tunápolis
   - Estado: SC
   - CEP: 89898-000
```

## Observações

1. **Formato Completo:** O endereço agora está formatado de forma profissional com todos os campos necessários

2. **Consistência:** O mesmo endereço é usado em todos os documentos gerados pelo sistema

3. **Campos Individuais:** Os campos individuais continuam armazenados separadamente para flexibilidade:
   - `company_address_street`
   - `company_address_number`
   - `company_address_complement`
   - `company_address_neighborhood`
   - `company_address_city`
   - `company_address_state`
   - `company_address_zipcode`

4. **Campo Consolidado:** O campo `company_address` contém o endereço completo formatado para uso em PDFs e documentos

---

**Atualização concluída em 16/02/2026**

✅ Endereço corrigido e validado
✅ Todas as configurações da empresa atualizadas
✅ PDFs agora exibem o endereço correto
