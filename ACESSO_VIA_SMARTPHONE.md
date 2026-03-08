# Como Acessar o Sistema via Smartphone

## Problema Resolvido

O sistema agora permite configurar o URL correto para acesso via smartphone na mesma rede!

---

## Passo a Passo Completo

### 1. Descubra o IP do seu Computador

#### No Windows:
1. Pressione `Windows + R`
2. Digite `cmd` e pressione Enter
3. Digite: `ipconfig`
4. Procure por **"Endereço IPv4"** - será algo como: `192.168.1.100`

#### No Mac:
1. Abra o Terminal (Aplicativos > Utilitários > Terminal)
2. Digite: `ifconfig | grep "inet "`
3. Procure o IP que começa com `192.168.` ou `10.`

#### No Linux:
1. Abra o Terminal
2. Digite: `ifconfig` ou `ip addr show`
3. Procure o IP da interface que começa com `192.168.` ou `10.`

---

### 2. Configure o Vite para Aceitar Conexões Externas

Execute o sistema com este comando:

```bash
npm run dev -- --host
```

Você verá algo assim:
```
VITE v5.4.8  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.100:5173/
```

**IMPORTANTE:** Use o endereço da linha "Network"!

---

### 3. Configure o URL no Sistema

1. No computador, acesse: `http://localhost:5173`
2. Vá em **"Compartilhar Módulos"**
3. Selecione os módulos que deseja compartilhar
4. Na seção **"Configure o URL para Acesso via Smartphone"**:
   - No campo "URL Base", digite: `http://SEU_IP:5173`
   - Exemplo: `http://192.168.1.100:5173`
5. O link e QR Code serão atualizados automaticamente!

---

### 4. Acesse via Smartphone

Agora você tem 3 opções:

#### Opção 1: QR Code (Mais Rápido)
1. No computador, veja o QR Code gerado
2. No smartphone, abra a câmera
3. Aponte para o QR Code
4. Toque na notificação que aparecer

#### Opção 2: Copiar Link
1. Copie o link gerado
2. Envie por WhatsApp, Email, etc. para você mesmo
3. No smartphone, abra o link

#### Opção 3: Digitar Manualmente
1. No smartphone, abra o navegador
2. Digite: `http://192.168.1.100:5173/?shared_modules=products,customers,sales`
3. (Use o IP correto do seu computador)

---

## Exemplo Visual

```
┌─────────────────────────────────────────────┐
│  Configure o URL para Acesso via Smartphone│
├─────────────────────────────────────────────┤
│                                             │
│  URL Base:                                  │
│  ┌────────────────────────────────────────┐│
│  │ http://192.168.1.100:5173              ││
│  └────────────────────────────────────────┘│
│                                             │
│  [Localhost] [Exemplo: 192.168.1.100:5173] │
│                                             │
│  Como descobrir seu IP:                     │
│  • Windows: ipconfig                        │
│  • Mac/Linux: ifconfig                      │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Link Gerado:                               │
│  ┌────────────────────────────────────────┐│
│  │ http://192.168.1.100:5173/             ││
│  │ ?shared_modules=products,customers     ││
│  └────────────────────────────────────────┘│
│                        [Copiar]             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│          QR Code para Acesso Rápido         │
│                                             │
│              ███████████████                │
│              ███ ▄▄▄▄▄ █▀█ ███              │
│              ███ █   █ ███ ███              │
│              ███ █▄▄▄█ █ ▄ ███              │
│              ███████████████                │
│                                             │
│      [Baixar QR Code]  [Compartilhar]       │
└─────────────────────────────────────────────┘
```

---

## Teste de Conectividade

### Antes de gerar o link, teste se o smartphone consegue acessar:

1. No smartphone, abra o navegador
2. Digite: `http://SEU_IP:5173`
3. Se abrir a tela inicial do sistema, está funcionando!
4. Se não funcionar, veja a seção "Troubleshooting" abaixo

---

## Troubleshooting

### Problema: Smartphone não consegue acessar

**Causa 1: Dispositivos em redes diferentes**
- ✅ **Solução:** Conecte o smartphone e computador na MESMA rede Wi-Fi

**Causa 2: Firewall bloqueando**
- ✅ **Solução Windows:**
  - Abra "Windows Defender Firewall"
  - Clique em "Permitir um aplicativo..."
  - Adicione Node.js à lista

- ✅ **Solução Mac:**
  - Vá em Preferências > Segurança > Firewall
  - Clique em "Opções do Firewall"
  - Adicione Node à lista de apps permitidos

**Causa 3: Vite não está aceitando conexões externas**
- ✅ **Solução:** Execute com `npm run dev -- --host`

**Causa 4: IP errado**
- ✅ **Solução:** Verifique novamente o IP com `ipconfig` ou `ifconfig`
- ✅ Use o IP da rede local (192.168.x.x ou 10.x.x.x), NÃO use 127.0.0.1

---

## Cenários de Uso

### Cenário 1: Demonstração para Cliente no Celular
```
1. Configure IP: http://192.168.1.100:5173
2. Selecione módulos: Produtos, Orçamentos, Clientes
3. Gere QR Code
4. Cliente escaneia e acessa apenas esses módulos
```

### Cenário 2: Vendedor Externo
```
1. Configure IP: http://192.168.1.100:5173
2. Selecione: Clientes, Vendas, Produtos
3. Envie link por WhatsApp
4. Vendedor acessa no smartphone
```

### Cenário 3: Engenheiro em Campo
```
1. Configure IP: http://192.168.1.100:5173
2. Selecione: Projetos, Imóveis
3. Baixe QR Code e imprima
4. Engenheiro escaneia no local da obra
```

---

## Configuração Permanente do Vite

Para não precisar usar `--host` sempre, edite `vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    host: true, // Adicione esta linha
    port: 5173,
  },
  // ... resto da config
});
```

Depois, apenas use `npm run dev` normalmente.

---

## IPs Comuns por Tipo de Rede

### Rede Residencial (Roteador Wi-Fi):
- Faixa: `192.168.0.x` ou `192.168.1.x`
- Exemplo: `192.168.1.100:5173`

### Rede Empresarial:
- Faixa: `10.x.x.x` ou `172.16.x.x`
- Exemplo: `10.0.5.42:5173`

### Hotspot do Celular:
- Faixa: `192.168.43.x` (Android) ou `172.20.10.x` (iOS)
- Exemplo: `192.168.43.1:5173`

---

## URLs de Teste Rápido

### Teste 1: Acesso Básico
```
http://192.168.1.100:5173
```

### Teste 2: Com Módulos Compartilhados
```
http://192.168.1.100:5173/?shared_modules=products,customers,sales
```

### Teste 3: Engenharia
```
http://192.168.1.100:5173/?shared_modules=eng-projects,eng-properties
```

---

## Checklist Final

Antes de testar no smartphone:

- [ ] Descobri o IP do meu computador
- [ ] Executei `npm run dev -- --host`
- [ ] Vi a linha "Network" no terminal com o IP
- [ ] Computador e smartphone estão na mesma Wi-Fi
- [ ] Testei `http://MEU_IP:5173` no navegador do smartphone
- [ ] Configurei o URL correto no campo "URL Base"
- [ ] Link e QR Code foram gerados com o IP correto
- [ ] Consegui acessar os módulos selecionados no smartphone

---

## Comandos Úteis

### Descobrir IP:
```bash
# Windows
ipconfig

# Mac/Linux
ifconfig
# ou
ip addr show
```

### Iniciar com acesso externo:
```bash
npm run dev -- --host
```

### Ver todas as interfaces de rede:
```bash
# Windows
ipconfig /all

# Mac/Linux
ifconfig -a
```

---

## Diferenças entre localhost e IP da Rede

| URL | Onde Funciona | Quando Usar |
|-----|---------------|-------------|
| `http://localhost:5173` | Apenas no computador local | Desenvolvimento local |
| `http://127.0.0.1:5173` | Apenas no computador local | Desenvolvimento local |
| `http://192.168.1.100:5173` | Qualquer dispositivo na rede | Acesso via smartphone/tablet |

---

## Segurança

### Pontos Importantes:
1. O IP da rede local só funciona na sua rede Wi-Fi
2. Pessoas fora da sua rede NÃO podem acessar
3. Para acesso pela internet, você precisaria:
   - Configurar port forwarding no roteador
   - Usar um serviço como ngrok
   - Fazer deploy em um servidor

### Boas Práticas:
- Use apenas em redes confiáveis (sua casa/empresa)
- Não abra portas no roteador sem conhecimento técnico
- Para acesso externo, faça deploy em produção

---

## Próximos Passos

Após configurar:
1. Teste todos os módulos compartilhados
2. Verifique se o filtro está funcionando
3. Salve seus IPs mais usados
4. Considere fazer deploy para acesso permanente

---

## Suporte Adicional

### Ainda não funciona?

1. Verifique o console do navegador (F12) por erros
2. Confirme que o Vite está rodando com `--host`
3. Tente desabilitar temporariamente o firewall
4. Use `ping 192.168.1.100` no smartphone para testar conectividade
5. Reinicie o roteador Wi-Fi

### Exemplo de configuração correta:

```bash
# Terminal do computador
$ npm run dev -- --host

VITE v5.4.8  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.100:5173/  ← USE ESTE!
```

```
# No sistema
URL Base: http://192.168.1.100:5173  ← COLE ESTE!
```

```
# No smartphone
Acesse: http://192.168.1.100:5173/?shared_modules=products
```

---

## Conclusão

Agora você pode:
✅ Descobrir o IP do seu computador
✅ Configurar o URL correto no sistema
✅ Gerar links e QR Codes funcionais
✅ Acessar o sistema via smartphone na mesma rede
✅ Compartilhar módulos específicos com outros dispositivos

**Sistema pronto para acesso móvel!**
