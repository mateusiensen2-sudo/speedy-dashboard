# Speedy Media OS

Painel React para acompanhar faturamento, funil, mercados, scoreboard mensal e prioridades da Speedy Media.

## Rodar localmente

```bash
npm install
npm run dev
```

## Persistência

Hoje os dados ficam em `localStorage`. O acesso foi isolado em `src/lib/persistence.ts`, para trocar futuramente por Supabase sem reescrever a tela principal.
