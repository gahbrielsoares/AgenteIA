"""
Script opcional para ajudar a atualizar data/savane-produtos.json.

O site da Savane (savane.com.br/produtos) carrega os produtos via JavaScript,
então um simples 'requests.get' não traz os dados reais - precisaria de
Selenium/Playwright pra renderizar a página, ou consumir a API interna do site
(inspecionar a aba Network do navegador em savane.com.br/produtos e procurar
por chamadas XHR/fetch que retornam JSON).

Por enquanto, data/savane-produtos.json já está preenchido manualmente com
linhas plausíveis (Urbana, Rústica, Marmo, Wood, Concreto) baseadas no que
a Savane comunica publicamente (porcelanatos e semi grês, linhas urbanas e
rústicas). Isso é suficiente para o protótipo de demonstração.

Se depois quiser dados 100% reais, os passos seriam:
1. pip install playwright --break-system-packages && playwright install chromium
2. Abrir savane.com.br/produtos com Playwright, aguardar o JS renderizar
3. Extrair os cards de produto (nome, formato, tipologia)
4. Popular data/savane-produtos.json no mesmo formato usado hoje
"""

import json
import pathlib

OUTPUT = pathlib.Path(__file__).parent.parent / "data" / "savane-produtos.json"

if __name__ == "__main__":
    with open(OUTPUT, encoding="utf-8") as f:
        catalogo = json.load(f)
    print(f"Catálogo atual tem {len(catalogo['linhas'])} linhas de produto:")
    for linha in catalogo["linhas"]:
        formatos = ", ".join(f["medida"] for f in linha["formatos"])
        print(f" - {linha['nome']} ({linha['tipologia']}) — formatos: {formatos}")
