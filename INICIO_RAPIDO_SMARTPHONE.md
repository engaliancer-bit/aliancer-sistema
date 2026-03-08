# 🚀 Início Rápido - Teste no Smartphone

## ⚡ 5 Passos para Testar (2 minutos)

### 1️⃣ No Computador
Abra o sistema e vá em: **Escritório de Engenharia → Portal do Cliente**

### 2️⃣ Gere um Token
- Escolha qualquer cliente da lista
- Clique em **"Gerar Token de Acesso"**
- Aguarde mensagem de sucesso

### 3️⃣ Envie pelo WhatsApp
- Clique no botão verde **"Enviar pelo WhatsApp"**
- WhatsApp abre automaticamente
- Envie para seu próprio número (teste)

### 4️⃣ No Smartphone
- Pegue seu celular
- Abra o WhatsApp
- **Clique no link azul**

### 5️⃣ Pronto!
Portal abre automaticamente:
- Tela azul (1-2s)
- Portal carrega
- Veja seus imóveis

---

## ✅ Sucesso

Link deve ter este formato:
```
https://seusite.com/portal.html?token=ABC123...
```

Portal deve abrir mostrando:
```
[Início] [Imóveis] [Projetos] [Serviços]
```

---

## 🐛 Se Não Funcionar

Execute no Supabase para habilitar imóveis:

```sql
UPDATE properties
SET client_access_enabled = true,
    share_documents = true
WHERE customer_id = (
  SELECT id FROM customers
  WHERE name ILIKE '%NOME_DO_CLIENTE%'
);
```

---

**Documentação completa:** `SOLUCAO_ANDROID_PORTAL.md`
