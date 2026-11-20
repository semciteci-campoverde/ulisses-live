# Moderação v2 — tabela de testes (classify_post no Supabase de produção)

**89/89 corretos.**
Executado em 20/11/2026 contra a função publicada. Envio real (create_post) no evento de demonstração: 43/43 conferem; os recusados não foram gravados.

| # | Texto | Esperado | Resultado | Motivo |
|---|---|---|---|---|
| 1 | Viva o Ulisses! | Publica | Publica | positive |
| 2 | Ciência que transforma! | Publica | Publica | positive |
| 3 | Parabéns aos alunos | Publica | Publica | positive |
| 4 | Que orgulho! | Publica | Publica | positive |
| 5 | Show! | Publica | Publica | positive |
| 6 | Top demais | Publica | Publica | positive |
| 7 | Muito bom | Publica | Publica | positive |
| 8 | Arrasaram | Publica | Publica | positive |
| 9 | Sucesso! | Publica | Publica | positive |
| 10 | Lindo trabalho | Publica | Publica | positive |
| 11 | Amei a feira | Publica | Publica | positive |
| 12 | Nota 10 | Publica | Publica | positive |
| 13 | Incrível | Publica | Publica | positive |
| 14 | Que projeto massa | Publica | Publica | positive |
| 15 | ❤️👏👏 | Publica | Publica | positive |
| 16 | Deus abençoe | Publica | Publica | positive |
| 17 | Orgulho de ser Ulisses | Publica | Publica | positive |
| 18 | Educação transforma | Publica | Publica | positive |
| 19 | ameiiii | Publica | Publica | positive |
| 20 | parabens | Publica | Publica | positive |
| 21 | MUITO LEGAL | Publica | Publica | positive |
| 22 | Shoooow de bola | Publica | Publica | positive |
| 23 | Parabéns professores pela dedicação | Publica | Publica | positive |
| 24 | Disciplina e civismo constroem o futuro | Publica | Publica | positive |
| 25 | Feira linda, parabéns equipe! | Publica | Publica | positive |
| 26 | Que alegria ver a comunidade reunida | Publica | Publica | positive |
| 27 | Mandaram bem demais | Publica | Publica | positive |
| 28 | Inovação e conhecimento! | Publica | Publica | positive |
| 29 | 🎉🎉🚀 | Publica | Publica | positive |
| 30 | Obrigada pela acolhida | Publica | Publica | positive |
| 31 | A feira começa às 9h | Revisão/equipe | Revisão/equipe | neutral |
| 32 | Cheguei agora | Revisão/equipe | Revisão/equipe | neutral |
| 33 | Onde fica o banheiro? | Revisão/equipe | Revisão/equipe | neutral |
| 34 | kkkkk | Revisão/equipe | Revisão/equipe | neutral |
| 35 | Parabéns, só que não | Revisão/equipe | Revisão/equipe | neutral |
| 36 | Bom mas péssimo | Revisão/equipe | Revisão/equipe | neutral |
| 37 | Não foi legal | Revisão/equipe | Revisão/equipe | neutral |
| 38 | Lindo mas faltou cadeira | Revisão/equipe | Revisão/equipe | neutral |
| 39 | Não gostei da organização | Revisão/equipe | Revisão/equipe | criticism (só equipe) |
| 40 | Fila enorme na entrada | Revisão/equipe | Revisão/equipe | criticism (só equipe) |
| 41 | Poderia melhorar o som | Revisão/equipe | Revisão/equipe | criticism (só equipe) |
| 42 | Que porra é essa | Recusada (não grava) | Recusada (não grava) | swear |
| 43 | p o r r a | Recusada (não grava) | Recusada (não grava) | swear |
| 44 | m3rda de feira | Recusada (não grava) | Recusada (não grava) | swear |
| 45 | vai tomar no c* | Recusada (não grava) | Recusada (não grava) | demeaning |
| 46 | fdp | Recusada (não grava) | Recusada (não grava) | swear |
| 47 | f.d.p | Recusada (não grava) | Recusada (não grava) | swear |
| 48 | Parabéns seus burros | Recusada (não grava) | Recusada (não grava) | demeaning |
| 49 | Amei, caralho! | Recusada (não grava) | Recusada (não grava) | swear |
| 50 | Show, mas o professor é um idiota | Recusada (não grava) | Recusada (não grava) | demeaning |
| 51 | O Pedro é gordo e feio kkk | Recusada (não grava) | Recusada (não grava) | demeaning |
| 52 | Volta pra cozinha mulher | Recusada (não grava) | Recusada (não grava) | demeaning |
| 53 | cabelo ruim | Recusada (não grava) | Recusada (não grava) | demeaning |
| 54 | seu macaco | Recusada (não grava) | Recusada (não grava) | demeaning |
| 55 | viado | Recusada (não grava) | Recusada (não grava) | demeaning |
| 56 | Vote Lula 13 | Recusada (não grava) | Recusada (não grava) | politics |
| 57 | Bolsonaro 2026 | Recusada (não grava) | Recusada (não grava) | politics |
| 58 | Eleição está chegando, vote no candidato | Recusada (não grava) | Recusada (não grava) | politics |
| 59 | Bora tomar uma cerveja depois | Recusada (não grava) | Recusada (não grava) | drugs |
| 60 | maconha liberada | Recusada (não grava) | Recusada (não grava) | drugs |
| 61 | Vou te matar | Recusada (não grava) | Recusada (não grava) | violence |
| 62 | Quero morrer | Recusada (não grava) | Recusada (não grava) | violence |
| 63 | Arma na escola | Recusada (não grava) | Recusada (não grava) | violence |
| 64 | macumbeiro | Recusada (não grava) | Recusada (não grava) | religion |
| 65 | Que sexy | Recusada (não grava) | Recusada (não grava) | sexual |
| 66 | Tragédia na escola | Recusada (não grava) | Recusada (não grava) | violence |
| 67 | Parabéns 🖕 | Recusada (não grava) | Recusada (não grava) | emoji |
| 68 | Me chama no zap 65 99999-1234 | Recusada (não grava) | Recusada (não grava) | personal_data |
| 69 | Siga meu insta @fulano | Recusada (não grava) | Recusada (não grava) | personal_data |
| 70 | Ganhe dinheiro em www.site.com | Recusada (não grava) | Recusada (não grava) | spam |
| 71 | meu email ana@gmail.com | Recusada (não grava) | Recusada (não grava) | personal_data |
| 72 | Amei a feira | Recusada (não grava) | Recusada (não grava) | swear |
| 73 | Parabéns | Recusada (não grava) | Recusada (não grava) | politics |
| 74 | Parabéns pelo projeto | Publica | Publica | positive |
| 75 | Parabéns à Polícia Militar e à escola! | Publica | Publica | positive |
| 76 | Projeto de reciclagem do lixo incrível | Publica | Publica | positive |
| 77 | A cadeia alimentar ficou linda | Publica | Publica | positive |
| 78 | Mata Atlântica preservada, lindo projeto | Publica | Publica | positive |
| 79 | Vire à direita para os banheiros | Revisão/equipe | Revisão/equipe | neutral |
| 80 | Bom dia | Revisão/equipe | Revisão/equipe | neutral |
| 81 | Os alunos chegaram | Revisão/equipe | Revisão/equipe | neutral |
| 82 | que lindo kkk | Revisão/equipe | Revisão/equipe | neutral |
| 83 | c a r a l h o | Recusada (não grava) | Recusada (não grava) | swear |
| 84 | pu7a | Recusada (não grava) | Recusada (não grava) | swear |
| 85 | P.Q.P que feira top | Recusada (não grava) | Recusada (não grava) | swear |
| 86 | Se mata | Recusada (não grava) | Recusada (não grava) | violence |
| 87 | Professora Maria é uma bruxa | Recusada (não grava) | Recusada (não grava) | demeaning |
| 88 | Bebi pinga | Recusada (não grava) | Recusada (não grava) | drugs |
| 89 | Amei 💩 | Recusada (não grava) | Recusada (não grava) | emoji |
