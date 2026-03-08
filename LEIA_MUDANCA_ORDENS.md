# ⚠️ MUDANÇA IMPORTANTE: Ordens de Produção

## 🎯 O Que Você Precisa Saber

### ✅ AGORA (Correto e Automático)

```
1. Crie orçamento (Vendas → Orçamentos)
2. Adicione produtos
3. Aprove o orçamento
4. ✨ PRONTO! Ordens criadas automaticamente
```

**Simples assim!** O sistema cria as ordens de produção automaticamente quando você aprova um orçamento no módulo de Indústria de Artefatos.

---

## 📋 Uso Diário

### Como Aprovar Orçamento

```
Vendas → Orçamentos → [Selecione orçamento]
└─ Status: APROVADO
└─ Clique em: "Salvar"
```

**Resultado:**
- ✅ Ordens de produção criadas automaticamente
- ✅ Aparecem em: Produção → Ordens de Produção
- ✅ Quantidade calculada automaticamente (necessário - estoque)
- ✅ Prioridade definida pelo prazo

---

## 🔍 Como Verificar

### Ver Ordens Criadas

```
Produção → Ordens de Produção
└─ Filtrar: Status "Aberta"
└─ Procure: "Ordem automática - Orçamento aprovado"
```

### Ver Logs (Opcional)

```
Supabase Dashboard → Logs → Functions
└─ Procure: "CRIAÇÃO AUTOMÁTICA DE ORDENS"
```

---

## ❓ Perguntas Rápidas

**P: Preciso criar ordem manualmente?**
R: NÃO! Sistema cria automaticamente ao aprovar orçamento.

**P: Preciso vincular à obra?**
R: NÃO é obrigatório! Apenas se quiser organizar por obra.

**P: Como sei que funcionou?**
R: Veja em Produção → Ordens de Produção (terá ordem nova).

**P: E se produto tiver estoque?**
R: Sistema cria ordem apenas para quantidade faltante.

**P: E se tiver estoque completo?**
R: Não cria ordem. Cria apenas entrega.

---

## 📚 Documentação Completa

- 📄 **ORDENS_AUTOMATICAS_INDUSTRIA.md** - Guia completo
- 📄 **TESTE_ORDENS_AUTOMATICAS.md** - Testes passo a passo
- 📄 **MUDANCA_ORDENS_AUTOMATICAS.md** - Detalhes da mudança

---

## ✅ Checklist Rápido

- [ ] Li este arquivo
- [ ] Entendi que ordens são automáticas
- [ ] Sei aprovar orçamento
- [ ] Sei onde ver ordens criadas
- [ ] Testei criar um orçamento

**Pronto para usar!** 🚀

---

## 🆘 Problemas?

1. Ordem não foi criada?
   - Verificar: Orçamento foi aprovado?
   - Verificar: Produto tem estoque suficiente?
   - Ver logs no Supabase

2. Quantidade errada?
   - Sistema calcula: Necessário - Estoque
   - Edite a ordem manualmente se necessário

3. Dúvidas?
   - Leia: `ORDENS_AUTOMATICAS_INDUSTRIA.md`
   - Execute: Testes em `TESTE_ORDENS_AUTOMATICAS.md`

---

**Aproveite o sistema automático! Menos trabalho manual, mais produtividade!** ✨
