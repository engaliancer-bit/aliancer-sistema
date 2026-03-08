#!/bin/bash

# Script para corrigir memory leaks críticos que causam travamento após 3-4 minutos
# Data: 17 de Fevereiro de 2026

echo "🔍 Audit

ando memory leaks críticos..."

# 1. Encontrar setInterval/setTimeout sem cleanup
echo ""
echo "📍 Componentes com timers potencialmente sem cleanup:"
grep -rn "setInterval\|setTimeout" src/components/*.tsx src/hooks/*.ts | \
  grep -v "clearInterval\|clearTimeout" | \
  cut -d: -f1 | sort | uniq -c | sort -rn | head -20

# 2. Encontrar useEffect sem return (cleanup)
echo ""
echo "📍 useEffect sem função de cleanup:"
grep -rn "useEffect" src/components/*.tsx | wc -l
echo "Total de useEffect encontrados"

# 3. Encontrar event listeners sem remoção
echo ""
echo "📍 Event listeners potencialmente sem remoção:"
grep -rn "addEventListener" src/ | grep -v "removeEventListener" | wc -l
echo "Listeners sem removeEventListener"

# 4. Verificar subscriptions do Supabase
echo ""
echo "📍 Supabase subscriptions:"
grep -rn "\.subscribe\|\.on(" src/ | wc -l
echo "Total de subscriptions (verificar se têm .unsubscribe)"

# 5. Componentes com mais potencial de leak
echo ""
echo "📍 TOP 10 componentes com mais risco de memory leak:"
{
  grep -rn "setInterval\|setTimeout\|addEventListener\|subscribe" src/components/*.tsx 2>/dev/null | \
    cut -d: -f1 | sort | uniq -c | sort -rn | head -10
} || echo "Nenhum encontrado em src/components/*.tsx"

echo ""
echo "✅ Auditoria concluída. Verifique os arquivos listados acima."
