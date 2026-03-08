#!/bin/bash

# Script de Verificação Pré-Deploy
# Verifica se tudo está pronto para deploy no Netlify

echo "🔍 Verificando configuração para deploy no Netlify..."
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Função para verificar
check_ok() {
    echo -e "${GREEN}✓${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

check_error() {
    echo -e "${RED}✗${NC} $1"
    ERRORS=$((ERRORS + 1))
}

echo "📦 1. Verificando arquivos essenciais..."

# Verificar package.json
if [ -f "package.json" ]; then
    check_ok "package.json existe"
else
    check_error "package.json não encontrado"
fi

# Verificar package-lock.json
if [ -f "package-lock.json" ]; then
    check_ok "package-lock.json existe"
else
    check_warn "package-lock.json não encontrado (recomendado)"
fi

# Verificar netlify.toml
if [ -f "netlify.toml" ]; then
    check_ok "netlify.toml existe"
else
    check_error "netlify.toml não encontrado"
fi

# Verificar index.html
if [ -f "index.html" ]; then
    check_ok "index.html existe"
else
    check_error "index.html não encontrado"
fi

# Verificar vite.config.ts
if [ -f "vite.config.ts" ]; then
    check_ok "vite.config.ts existe"
else
    check_error "vite.config.ts não encontrado"
fi

echo ""
echo "🔧 2. Verificando configurações..."

# Verificar NODE_VERSION no netlify.toml
if grep -q "NODE_VERSION.*20" netlify.toml; then
    check_ok "NODE_VERSION=20 configurado"
else
    check_warn "NODE_VERSION não está como 20"
fi

# Verificar build command
if grep -q "command.*npm run build" netlify.toml; then
    check_ok "Build command correto"
else
    check_error "Build command não encontrado"
fi

# Verificar publish directory
if grep -q "publish.*dist" netlify.toml; then
    check_ok "Publish directory = dist"
else
    check_error "Publish directory não é 'dist'"
fi

echo ""
echo "🌍 3. Verificando variáveis de ambiente..."

# Verificar .env.example
if [ -f ".env.example" ]; then
    check_ok ".env.example existe"
else
    check_warn ".env.example não encontrado"
fi

# Verificar .env (deve existir localmente)
if [ -f ".env" ]; then
    check_ok ".env existe localmente"

    # Verificar VITE_SUPABASE_URL
    if grep -q "VITE_SUPABASE_URL=" .env; then
        if grep -q "VITE_SUPABASE_URL=your_" .env; then
            check_warn "VITE_SUPABASE_URL ainda é placeholder"
        else
            check_ok "VITE_SUPABASE_URL configurado"
        fi
    else
        check_error "VITE_SUPABASE_URL não encontrado no .env"
    fi

    # Verificar VITE_SUPABASE_ANON_KEY
    if grep -q "VITE_SUPABASE_ANON_KEY=" .env; then
        if grep -q "VITE_SUPABASE_ANON_KEY=your_" .env; then
            check_warn "VITE_SUPABASE_ANON_KEY ainda é placeholder"
        else
            check_ok "VITE_SUPABASE_ANON_KEY configurado"
        fi
    else
        check_error "VITE_SUPABASE_ANON_KEY não encontrado no .env"
    fi
else
    check_warn ".env não existe (OK se variáveis estão no Netlify)"
fi

echo ""
echo "🔒 4. Verificando segurança..."

# Verificar se .env está no .gitignore
if grep -q "^\.env$" .gitignore 2>/dev/null; then
    check_ok ".env está no .gitignore"
else
    check_error ".env NÃO está no .gitignore (PERIGO!)"
fi

# Verificar se node_modules está no .gitignore
if grep -q "node_modules" .gitignore 2>/dev/null; then
    check_ok "node_modules está no .gitignore"
else
    check_warn "node_modules não está no .gitignore"
fi

echo ""
echo "📚 5. Verificando dependências..."

# Verificar se node_modules existe
if [ -d "node_modules" ]; then
    check_ok "node_modules instalado"
else
    check_warn "node_modules não encontrado - execute npm install"
fi

# Verificar dependências principais
if grep -q "@supabase/supabase-js" package.json; then
    check_ok "Supabase JS instalado"
else
    check_error "Supabase JS não encontrado"
fi

if grep -q "react" package.json; then
    check_ok "React instalado"
else
    check_error "React não encontrado"
fi

if grep -q "vite" package.json; then
    check_ok "Vite instalado"
else
    check_error "Vite não encontrado"
fi

echo ""
echo "🏗️  6. Testando build..."

# Tentar fazer build
echo "   Executando 'npm run build'..."
if npm run build > /tmp/build-check.log 2>&1; then
    check_ok "Build executado com sucesso"

    # Verificar se dist foi criado
    if [ -d "dist" ]; then
        check_ok "Pasta 'dist' criada"

        # Verificar se index.html está em dist
        if [ -f "dist/index.html" ]; then
            check_ok "dist/index.html gerado"
        else
            check_error "dist/index.html não foi gerado"
        fi

        # Verificar se há arquivos JS
        if ls dist/assets/*.js >/dev/null 2>&1; then
            check_ok "Arquivos JS gerados"
        else
            check_error "Nenhum arquivo JS encontrado"
        fi

        # Verificar se há arquivos CSS
        if ls dist/assets/*.css >/dev/null 2>&1; then
            check_ok "Arquivos CSS gerados"
        else
            check_error "Nenhum arquivo CSS encontrado"
        fi

    else
        check_error "Pasta 'dist' não foi criada"
    fi
else
    check_error "Build falhou - verifique /tmp/build-check.log"
    cat /tmp/build-check.log
fi

echo ""
echo "📊 7. Verificando tamanho do build..."

if [ -d "dist" ]; then
    DIST_SIZE=$(du -sh dist | cut -f1)
    echo "   Tamanho do dist: $DIST_SIZE"

    # Verificar se é muito grande (> 50MB)
    DIST_SIZE_MB=$(du -sm dist | cut -f1)
    if [ "$DIST_SIZE_MB" -gt 50 ]; then
        check_warn "Build muito grande ($DIST_SIZE) - considere otimizar"
    else
        check_ok "Tamanho adequado ($DIST_SIZE)"
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo ""

# Resumo final
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}🎉 TUDO OK!${NC} Pronto para deploy no Netlify!"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS aviso(s)${NC} - Deploy pode funcionar mas verifique os avisos"
    exit 0
else
    echo -e "${RED}❌ $ERRORS erro(s)${NC} encontrado(s) - corrija antes de fazer deploy"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $WARNINGS aviso(s)${NC} também encontrado(s)"
    fi
    exit 1
fi
