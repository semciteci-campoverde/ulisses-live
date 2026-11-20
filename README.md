# ULISSES LIVE — Presença, Interação e Memória Digital

*Sua presença. Seu olhar. Nossa história.*

Plataforma de presença e interação em tempo real da **Feira do Conhecimento 2026** da EECM Ulisses Guimarães (Campo Verde – MT), reutilizável em outros eventos da escola.

## Páginas

| Rota | Para quem |
| --- | --- |
| `#/participar` | Visitantes (aberta pelo QR Code) |
| `#/tv` | Televisões e telões (16:9, tela cheia com a tecla F) |
| `#/admin` | Equipe (login) |
| `#/qr` | QR Codes para impressão |
| `#/galeria` | Galeria pública dos conteúdos aprovados |
| `#/memorias` | Memória digital, publicada ao encerrar o evento |

Acrescente `?e=<evento>` para escolher o evento (ex.: `?e=teste` para o modo de teste). No telão, `&cena=fotos` (ou `mensagens`, `videos`, `contador`, `qr`, `instagram`, `convite`) fixa uma cena.

## Arquitetura

- React + TypeScript + Tailwind (Vite), hospedado no GitHub Pages.
- Supabase: PostgreSQL com regras de segurança (RLS), Realtime, Storage privado e Auth para a equipe.
- Toda escrita de visitantes passa por funções do banco (`register_presence`, `create_post`, `add_reaction`) que decidem o status, limitam envios e checam a presença.
- Arquivos ficam em armazenamento privado e só podem ser lidos depois que a publicação é aprovada.

## Automação (GitHub Actions)

- **Publicar site**: a cada push no `main`.
- **Banco de dados**: aplica `supabase/migrations` e cria a conta da equipe (segredos `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`).
- **Testes ponta a ponta**: Playwright no site publicado, usando o evento de teste; resultados e capturas de tela no ramo `test-results`.
