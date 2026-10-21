# Gerador de Cores

Usa o serviço quântico ANU Quantum Numbers para obter um único número `uint8`
(0–255) por ativação do botão «?». Não substitui os números quânticos por
números gerados localmente nem guarda números para reutilização.

## Acesso à ANU

1. Criar uma chave em https://quantumnumbers.anu.edu.au/.
2. Na página, abrir «Acesso ao ANU Quantum Numbers» e introduzir a chave.
3. Premir «?» para gerar uma cor.

A chave fica apenas na memória da página e é enviada diretamente à ANU através
do cabeçalho `x-api-key`. Não é guardada no repositório nem no armazenamento do
navegador. Ao recarregar a página, é necessário introduzi-la novamente.
As quotas e condições são definidas pela ANU.

## Cálculos

Somam-se os algarismos decimais do número recebido, repetindo a soma enquanto
o resultado for superior a 9. Mantém-se a correspondência original:

| Resultado | Cor |
| --- | --- |
| 0 | Azul |
| 1, 2 | Vermelho |
| 3, 5, 6 | Cinzento |
| 4, 7 | Amarelo |
| 8, 9 | Verde |

Os pedidos têm um prazo de 10 segundos. Respostas inválidas, falhas de rede,
recusas de acesso e limites de utilização apresentam uma mensagem e não geram
uma nova cor. A última cor válida permanece visível.

## Verificação

Executar `node --test tests/generator.test.cjs`. Os testes verificam os 256
valores possíveis, os pedidos repetidos, as falhas do serviço e a troca de imagens.

Documentação do serviço: https://quantumnumbers.anu.edu.au/documentation
