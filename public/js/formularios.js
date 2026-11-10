// Monta os campos específicos de cada categoria (vindos do banco)
// e lê as respostas. Usado no cadastro e no painel do prestador.

function htmlCamposCategoria(campos, valores = {}) {
  return campos.map((c) => {
    const valor = valores[c.chave];
    const obrig = c.obrigatorio ? '' : ' <span class="dica">(opcional)</span>';

    if (c.tipo === 'multipla') {
      const marcados = Array.isArray(valor) ? valor : [];
      return `
        <fieldset class="campo" style="border:0;padding:0;margin:0 0 18px">
          <legend style="margin-bottom:8px">${esc(c.rotulo)}${obrig}</legend>
          <div class="opcoes-multipla">
            ${c.opcoes.map((o) => `
              <label class="opcao-check">
                <input type="checkbox" name="esp_${esc(c.chave)}" value="${esc(o)}" ${marcados.includes(o) ? 'checked' : ''}>
                <span>${esc(o)}</span>
              </label>`).join('')}
          </div>
        </fieldset>`;
    }
    if (c.tipo === 'select') {
      return `
        <div class="campo">
          <label for="esp_${esc(c.chave)}">${esc(c.rotulo)}${obrig}</label>
          <select class="entrada" id="esp_${esc(c.chave)}" name="esp_${esc(c.chave)}">
            <option value="">Selecione…</option>
            ${c.opcoes.map((o) => `<option ${o === valor ? 'selected' : ''}>${esc(o)}</option>`).join('')}
          </select>
        </div>`;
    }
    return `
      <div class="campo">
        <label for="esp_${esc(c.chave)}">${esc(c.rotulo)}${obrig}</label>
        <input class="entrada" id="esp_${esc(c.chave)}" name="esp_${esc(c.chave)}" value="${esc(valor || '')}">
      </div>`;
  }).join('');
}

function lerCamposCategoria(form, campos) {
  const respostas = {};
  for (const c of campos) {
    const nome = `esp_${c.chave}`;
    respostas[c.chave] = c.tipo === 'multipla'
      ? [...form.querySelectorAll(`input[name="${nome}"]:checked`)].map((i) => i.value)
      : form.elements[nome]?.value || null;
  }
  return respostas;
}

// Lê um arquivo de imagem e devolve um data URL (base64), reduzindo se for grande
function lerImagem(arquivo, ladoMax = 1400) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(arquivo.type)) return reject(new Error('Use imagens PNG, JPG ou WEBP.'));
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    leitor.onload = () => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Imagem inválida.'));
      img.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  });
}
