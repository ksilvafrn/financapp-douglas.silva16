let dadosCaixinha = null;
let temporizadorCaixinha = null;
let chaveCaixinha = null;
let relatorioMensalGerado = false;

function chaveArmazenamentoCaixinha(usuarioId) {
  return `financapp_caixinha_${usuarioId}`;
}

function saldoCaixinhaProjetado() {
  if (!dadosCaixinha) {
    return 0;
  }

  const tempoDecorrido = Math.max(0, Date.now() - Date.parse(dadosCaixinha.atualizadoEm));
  const anos = tempoDecorrido / (365.25 * 24 * 60 * 60 * 1000);
  return dadosCaixinha.saldoBase * ((1 + dadosCaixinha.taxaAnual / 100) ** anos);
}

function projetarSaldoCaixinha(meses) {
  return saldoCaixinhaProjetado() * ((1 + dadosCaixinha.taxaAnual / 100) ** (meses / 12));
}

function saldoDisponivel() {
  return (window.lancamentosAtuais || []).reduce((saldo, lancamento) => {
    const valor = Number(lancamento.valor);
    if (!Number.isFinite(valor)) {
      return saldo;
    }
    return saldo + (lancamento.tipo === 'receita' ? valor : -valor);
  }, 0);
}

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function arredondarCentavos(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function salvarDadosCaixinha() {
  localStorage.setItem(chaveCaixinha, JSON.stringify(dadosCaixinha));
}

function atualizarVisualCaixinha() {
  if (!dadosCaixinha) {
    return;
  }

  const saldoAtual = saldoCaixinhaProjetado();
  const prazoMeses = dadosCaixinha.prazoMeses;
  const saldoProjetado = projetarSaldoCaixinha(prazoMeses);
  const rendimento = saldoProjetado - saldoAtual;
  const atualizadoEm = new Date(dadosCaixinha.atualizadoEm);

  document.getElementById('caixinhaSaldo').textContent = formatarMoeda(saldoProjetado);
  document.getElementById('caixinhaSaldoAtual').textContent = formatarMoeda(saldoAtual);
  document.getElementById('caixinhaAportado').textContent = formatarMoeda(dadosCaixinha.totalAportado);
  document.getElementById('caixinhaRendimento').textContent = formatarMoeda(rendimento);
  document.getElementById('caixinhaTaxa').value = dadosCaixinha.taxaAnual;
  document.getElementById('caixinhaPrazo').value = String(prazoMeses);
  document.getElementById('caixinhaPrazoLabel').textContent =
    `${prazoMeses} ${prazoMeses === 1 ? 'mês' : 'meses'}`;
  document.getElementById('caixinhaDisponivel').textContent =
    `Saldo disponível para investir: ${formatarMoeda(saldoDisponivel())}`;
  document.getElementById('caixinhaAtualizado').textContent =
    `Taxa simulada de ${dadosCaixinha.taxaAnual}% ao ano · cálculo bruto estimado`;
}

function inicializarCaixinha(usuarioId) {
  pararAtualizacaoCaixinha();
  chaveCaixinha = chaveArmazenamentoCaixinha(usuarioId);
  const mensagem = document.getElementById('caixinhaMsg');
  mensagem.textContent = '';

  try {
    const salvo = localStorage.getItem(chaveCaixinha);
    if (salvo) {
      const dados = JSON.parse(salvo);
      const camposNumericosValidos = [
        dados.taxaAnual,
        dados.saldoBase,
        dados.totalAportado,
        dados.totalResgatado,
      ].every((valor) => Number.isFinite(valor) && valor >= 0);
      dados.prazoMeses ??= 12;
      if (
        !camposNumericosValidos ||
        dados.taxaAnual > 100 ||
        ![3, 6, 12, 24, 36].includes(dados.prazoMeses) ||
        !Number.isFinite(Date.parse(dados.atualizadoEm))
      ) {
        throw new Error('Os dados salvos da caixinha são inválidos.');
      }
      dadosCaixinha = dados;
    } else {
      dadosCaixinha = {
        taxaAnual: 10,
        saldoBase: 0,
        totalAportado: 0,
        totalResgatado: 0,
        prazoMeses: 12,
        atualizadoEm: new Date().toISOString(),
      };
      salvarDadosCaixinha();
    }

    atualizarVisualCaixinha();
    temporizadorCaixinha = window.setInterval(atualizarVisualCaixinha, 60000);
  } catch (error) {
    console.error('Não foi possível carregar ou salvar os dados da caixinha.', error);
    dadosCaixinha = null;
    mensagem.textContent = 'Não foi possível acessar os dados locais da caixinha neste navegador.';
  }
}

function pararAtualizacaoCaixinha() {
  if (temporizadorCaixinha !== null) {
    window.clearInterval(temporizadorCaixinha);
    temporizadorCaixinha = null;
  }
  dadosCaixinha = null;
  chaveCaixinha = null;
}

document.getElementById('caixinhaTaxa').addEventListener('change', function (e) {
  if (!dadosCaixinha) {
    return;
  }

  const taxa = Number(e.currentTarget.value);
  const mensagem = document.getElementById('caixinhaMsg');
  if (!Number.isFinite(taxa) || taxa < 0 || taxa > 100) {
    mensagem.textContent = 'Informe uma taxa entre 0% e 100% ao ano.';
    e.currentTarget.value = dadosCaixinha.taxaAnual;
    return;
  }

  mensagem.textContent = '';
  dadosCaixinha.saldoBase = arredondarCentavos(saldoCaixinhaProjetado());
  dadosCaixinha.atualizadoEm = new Date().toISOString();
  dadosCaixinha.taxaAnual = taxa;

  try {
    salvarDadosCaixinha();
    atualizarVisualCaixinha();
  } catch (error) {
    console.error('Não foi possível salvar a taxa da caixinha.', error);
    mensagem.textContent = 'Não foi possível salvar a taxa simulada neste navegador.';
  }
});

document.getElementById('caixinhaPrazo').addEventListener('change', function (e) {
  if (!dadosCaixinha) {
    return;
  }

  const prazo = Number(e.currentTarget.value);
  const mensagem = document.getElementById('caixinhaMsg');
  if (![3, 6, 12, 24, 36].includes(prazo)) {
    mensagem.textContent = 'Selecione um prazo disponível para a simulação.';
    e.currentTarget.value = String(dadosCaixinha.prazoMeses);
    return;
  }

  const prazoAnterior = dadosCaixinha.prazoMeses;
  dadosCaixinha.prazoMeses = prazo;
  try {
    salvarDadosCaixinha();
    atualizarVisualCaixinha();
    mensagem.textContent = '';
  } catch (error) {
    dadosCaixinha.prazoMeses = prazoAnterior;
    e.currentTarget.value = String(prazoAnterior);
    console.error('Não foi possível salvar o prazo da simulação.', error);
    mensagem.textContent = 'Não foi possível salvar o prazo neste navegador.';
  }
});

document.getElementById('caixinhaOperacao').addEventListener('change', function (e) {
  document.getElementById('caixinhaBotao').textContent =
    e.currentTarget.value === 'resgate' ? 'Resgatar da caixinha' : 'Investir na caixinha';
});

document.getElementById('formCaixinha').addEventListener('submit', async function (e) {
  e.preventDefault();
  const operacao = document.getElementById('caixinhaOperacao').value;
  const valor = Number(document.getElementById('caixinhaValor').value);
  const mensagem = document.getElementById('caixinhaMsg');
  const botao = document.getElementById('caixinhaBotao');

  if (!dadosCaixinha || !chaveCaixinha) {
    mensagem.textContent = 'Entre novamente para acessar sua caixinha.';
    return;
  }
  if (!Number.isFinite(valor) || valor <= 0) {
    mensagem.textContent = 'Informe um valor maior que zero.';
    return;
  }
  if (!['aporte', 'resgate'].includes(operacao)) {
    mensagem.textContent = 'Selecione uma operação válida.';
    return;
  }
  if (!usuarioLogado) {
    mensagem.textContent = 'Entre novamente para registrar uma operação.';
    return;
  }

  const saldoAtual = saldoCaixinhaProjetado();
  if (operacao === 'resgate' && valor > saldoAtual) {
    mensagem.textContent = 'O valor do resgate não pode ser maior que o saldo da caixinha.';
    return;
  }

  const disponivel = saldoDisponivel();
  if (operacao === 'aporte' && valor > disponivel) {
    mensagem.textContent = `Saldo insuficiente. Você tem ${formatarMoeda(Math.max(0, disponivel))} disponível.`;
    return;
  }

  const estadoAnterior = { ...dadosCaixinha };
  const saldoBaseNovo = arredondarCentavos(
    operacao === 'aporte' ? saldoAtual + valor : saldoAtual - valor,
  );
  const agora = new Date().toISOString();
  const tipoLancamento = operacao === 'aporte' ? 'despesa' : 'receita';
  const descricaoLancamento = operacao === 'aporte'
    ? 'Aporte na caixinha'
    : 'Resgate da caixinha';

  dadosCaixinha.saldoBase = saldoBaseNovo;
  dadosCaixinha.atualizadoEm = agora;
  if (operacao === 'aporte') {
    dadosCaixinha.totalAportado = arredondarCentavos(dadosCaixinha.totalAportado + valor);
  } else {
    dadosCaixinha.totalResgatado = arredondarCentavos(dadosCaixinha.totalResgatado + valor);
  }

  botao.disabled = true;
  mensagem.textContent = '';
  try {
    salvarDadosCaixinha();
    const resultado = await criarLancamento(
      usuarioLogado.id,
      descricaoLancamento,
      valor,
      tipoLancamento,
    );
    if (resultado.error) {
      dadosCaixinha = estadoAnterior;
      salvarDadosCaixinha();
      mensagem.textContent = resultado.error.message || 'Não foi possível registrar a movimentação.';
      return;
    }

    e.currentTarget.reset();
    document.getElementById('caixinhaOperacao').dispatchEvent(new Event('change'));
    await atualizarExtrato();
    atualizarVisualCaixinha();
    mensagem.textContent = operacao === 'aporte'
      ? 'Investimento registrado: o valor foi descontado do seu saldo.'
      : 'Resgate registrado: o valor foi adicionado ao seu saldo.';
  } catch (error) {
    dadosCaixinha = estadoAnterior;
    try {
      salvarDadosCaixinha();
    } catch (erroArmazenamento) {
      console.error('Também não foi possível reverter os dados locais da caixinha.', erroArmazenamento);
    }
    console.error('Não foi possível registrar a operação da caixinha.', error);
    mensagem.textContent = 'Não foi possível registrar esta operação. Verifique sua conexão e tente novamente.';
  } finally {
    botao.disabled = false;
  }
});

document.getElementById('formLogin').addEventListener('submit', async function (e) {
  e.preventDefault();
  const usuario = document.getElementById('loginUsuario').value.trim();
  const senha = document.getElementById('loginSenha').value;
  const msg = document.getElementById('loginMsg');
  const botao = e.currentTarget.querySelector('button[type="submit"]');
  msg.textContent = '';
  botao.disabled = true;

  try {
    const resultado = await fazerLogin(usuario, senha);
    if (resultado.error) {
      msg.textContent = resultado.error.message === 'Usuário ou senha incorretos.'
        ? resultado.error.message
        : `Não foi possível entrar: ${resultado.error.message}`;
      return;
    }

    usuarioLogado = resultado.data;
    sessionStorage.setItem('financapp_usuario', JSON.stringify(usuarioLogado));
    document.getElementById('telaAuth').hidden = true;
    document.getElementById('telaApp').hidden = false;
    document.getElementById('btnSair').hidden = false;
    mostrarPerfil(usuarioLogado);
    reiniciarRelatorioMensal();
    inicializarCaixinha(usuarioLogado.id);
    await atualizarExtrato();
  } catch (error) {
    console.error('Falha ao tentar entrar.', error);
    msg.textContent = 'Não foi possível conectar. Verifique sua conexão e tente novamente.';
  } finally {
    botao.disabled = false;
  }
});

document.getElementById('formCadastro').addEventListener('submit', async function (e) {
  e.preventDefault();
  const nome = document.getElementById('cadNome').value.trim();
  const turma = document.getElementById('cadTurma').value.trim();
  const usuario = document.getElementById('cadUsuario').value.trim();
  const senha = document.getElementById('cadSenha').value;
  const msg = document.getElementById('cadMsg');

  if (!nome || !turma || !usuario || !senha) {
    msg.textContent = 'Preencha todos os campos.';
    return;
  }

  const resultado = await cadastrarUsuario(nome, turma, usuario, senha);
  if (resultado.error) {
    msg.textContent = resultado.error.message || 'Erro ao cadastrar a conta.';
    return;
  }

  msg.textContent = 'Conta criada! Faça login abaixo.';
  e.target.reset();
});

async function atualizarExtrato() {
  if (!usuarioLogado) {
    return;
  }

  const resultado = await carregarLancamentos(usuarioLogado.id);
  const extratoContainer = document.getElementById('extratoContainer');
  const saldoValor = document.getElementById('saldoValor');
  extratoContainer.replaceChildren();

  if (resultado.error) {
    extratoContainer.textContent = resultado.error.message || 'Erro ao carregar o extrato.';
    return;
  }

  window.lancamentosAtuais = resultado.data;
  atualizarVisualCaixinha();
  if (relatorioMensalGerado) {
    gerarRelatorioMensal();
  }

  let saldo = 0;
  if (resultado.data.length === 0) {
    const vazio = document.createElement('div');
    vazio.className = 'empty-state';
    const mensagem = document.createElement('p');
    mensagem.textContent = 'Seus lançamentos aparecerão aqui assim que você adicionar o primeiro.';
    vazio.appendChild(mensagem);
    extratoContainer.appendChild(vazio);
  }

  resultado.data.forEach(function (lancamento) {
    extratoContainer.appendChild(renderLancamento(lancamento));
    const valor = Number(lancamento.valor);
    saldo += lancamento.tipo === 'receita' ? valor : -valor;
  });

  saldoValor.textContent = saldo.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  saldoValor.classList.toggle('positivo', saldo >= 0);
  saldoValor.classList.toggle('negativo', saldo < 0);
}

function obterLancamentosDoMes(mesSelecionado, tipo) {
  const correspondencia = /^(\d{4})-(\d{2})$/.exec(mesSelecionado);
  if (!correspondencia) {
    return [];
  }

  const anoSelecionado = Number(correspondencia[1]);
  const mesSelecionadoNumero = Number(correspondencia[2]) - 1;
  return (window.lancamentosAtuais || []).filter(function (lancamento) {
    const dataLancamento = new Date(lancamento.criado_em);
    return (
      Number.isFinite(dataLancamento.getTime()) &&
      dataLancamento.getFullYear() === anoSelecionado &&
      dataLancamento.getMonth() === mesSelecionadoNumero &&
      lancamento.tipo === tipo
    );
  });
}

function reiniciarRelatorioMensal() {
  relatorioMensalGerado = false;
  document.getElementById('relatorioTotais').hidden = true;
  document.getElementById('relatorioMensagem').textContent =
    'Selecione um mês e clique em “Gerar relatório”.';
}

function gerarRelatorioMensal() {
  const mesSelecionado = document.getElementById('relatorioMes').value;
  const correspondencia = /^(\d{4})-(\d{2})$/.exec(mesSelecionado);
  const mensagem = document.getElementById('relatorioMensagem');
  if (!correspondencia) {
    mensagem.textContent = 'Selecione um mês válido para gerar o relatório.';
    return;
  }

  const entradas = obterLancamentosDoMes(mesSelecionado, 'receita');
  const saidas = obterLancamentosDoMes(mesSelecionado, 'despesa');
  const totalEntradas = entradas.reduce((total, lancamento) => total + Number(lancamento.valor), 0);
  const totalSaidas = saidas.reduce((total, lancamento) => total + Number(lancamento.valor), 0);
  const resultado = totalEntradas - totalSaidas;
  const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  document.getElementById('relatorioEntradas').querySelector('.monthly-total-value').textContent =
    formatarMoeda(totalEntradas);
  document.getElementById('relatorioSaidas').querySelector('.monthly-total-value').textContent =
    formatarMoeda(totalSaidas);
  const resultadoElement = document.getElementById('relatorioResultado');
  resultadoElement.textContent = formatarMoeda(resultado);
  resultadoElement.classList.toggle('positivo', resultado >= 0);
  resultadoElement.classList.toggle('negativo', resultado < 0);

  const habilitarEntradas = entradas.length > 0;
  const habilitarSaidas = saidas.length > 0;
  document.getElementById('relatorioEntradas').disabled = !habilitarEntradas;
  document.getElementById('relatorioSaidas').disabled = !habilitarSaidas;
  document.getElementById('relatorioTotais').hidden = false;
  mensagem.textContent = habilitarEntradas || habilitarSaidas
    ? 'Clique em entradas ou saídas para ver as movimentações do mês.'
    : 'Nenhuma entrada ou saída foi registrada neste mês.';
  relatorioMensalGerado = true;
}

function mostrarDetalhesRelatorio(tipo) {
  const mesSelecionado = document.getElementById('relatorioMes').value;
  const correspondencia = /^(\d{4})-(\d{2})$/.exec(mesSelecionado);
  if (!correspondencia) {
    return;
  }

  const tituloTipo = tipo === 'receita' ? 'Entradas' : 'Saídas';
  const ano = Number(correspondencia[1]);
  const mes = Number(correspondencia[2]);
  const nomeMes = new Date(ano, mes - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const lancamentos = obterLancamentosDoMes(mesSelecionado, tipo);
  const lista = document.getElementById('relatorioDetalhesLista');
  lista.replaceChildren();
  document.getElementById('relatorioDetalhesTitulo').textContent = `${tituloTipo} de ${nomeMes}`;
  document.getElementById('relatorioDetalhesSubtitulo').textContent =
    `${lancamentos.length} ${lancamentos.length === 1 ? 'movimentação' : 'movimentações'}`;

  lancamentos.forEach(function (lancamento) {
    const linha = document.createElement('article');
    linha.className = `report-detail-row ${tipo}`;
    const descricao = document.createElement('span');
    descricao.className = 'report-detail-description';
    descricao.textContent = lancamento.descricao;

    const data = document.createElement('time');
    data.className = 'report-detail-date';
    const dataLancamento = new Date(lancamento.criado_em);
    data.dateTime = dataLancamento.toISOString();
    data.textContent = dataLancamento.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

    const valor = document.createElement('span');
    valor.className = 'report-detail-value';
    const sinal = tipo === 'receita' ? '+' : '−';
    valor.textContent = `${sinal} ${Number(lancamento.valor).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })}`;
    linha.append(descricao, data, valor);

    if (lancamento.tags?.length) {
      const tags = document.createElement('div');
      tags.className = 'report-detail-tags';
      lancamento.tags.forEach(function (nomeTag) {
        const tag = document.createElement('span');
        tag.className = 'tag-badge';
        tag.textContent = nomeTag;
        tags.appendChild(tag);
      });
      linha.appendChild(tags);
    }
    lista.appendChild(linha);
  });

  document.getElementById('relatorioDetalhes').showModal();
}

document.getElementById('gerarRelatorio').addEventListener('click', gerarRelatorioMensal);
document.getElementById('relatorioEntradas').addEventListener('click', function () {
  mostrarDetalhesRelatorio('receita');
});
document.getElementById('relatorioSaidas').addEventListener('click', function () {
  mostrarDetalhesRelatorio('despesa');
});
document.getElementById('fecharRelatorioDetalhes').addEventListener('click', function () {
  document.getElementById('relatorioDetalhes').close();
});
document.getElementById('fecharRelatorioDetalhesBotao').addEventListener('click', function () {
  document.getElementById('relatorioDetalhes').close();
});

function renderLancamento(lancamento) {
  const card = document.createElement('article');
  card.className = `lancamento-card ${lancamento.tipo}`;

  const descricao = document.createElement('p');
  descricao.className = 'lancamento-desc';
  descricao.textContent = lancamento.descricao;

  const data = document.createElement('time');
  data.className = 'lancamento-data';
  const dataLancamento = new Date(lancamento.criado_em);
  data.dateTime = dataLancamento.toISOString();
  data.textContent = dataLancamento.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const valor = document.createElement('span');
  valor.className = 'lancamento-valor';
  const sinal = lancamento.tipo === 'receita' ? '+' : '−';
  valor.textContent = `${sinal} ${Number(lancamento.valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })}`;

  const tagsDiv = document.createElement('div');
  tagsDiv.className = 'lancamento-tags';
  (lancamento.tags || []).forEach(function (tag) {
    const badge = document.createElement('span');
    badge.className = 'tag-badge';
    badge.textContent = tag;
    tagsDiv.appendChild(badge);
  });

  const movimentoCaixinha = ['Aporte na caixinha', 'Resgate da caixinha']
    .includes(lancamento.descricao);
  if (movimentoCaixinha) {
    const nota = document.createElement('span');
    nota.className = 'lancamento-protected-note';
    nota.textContent = 'Movimentação vinculada à caixinha';
    card.append(descricao, data, valor, tagsDiv, nota);
  } else {
    const actions = document.createElement('div');
    actions.className = 'lancamento-actions';

    const editar = document.createElement('button');
    editar.className = 'action-button';
    editar.type = 'button';
    editar.textContent = 'Editar';
    editar.setAttribute('aria-label', `Editar ${lancamento.descricao}`);
    editar.addEventListener('click', function () {
      document.getElementById('editarId').value = lancamento.id;
      document.getElementById('editarDescricao').value = lancamento.descricao;
      document.getElementById('editarValor').value = lancamento.valor;
      document.getElementById('editarTipo').value = lancamento.tipo;
      document.getElementById('editarMsg').textContent = '';
      document.getElementById('editarDialog').showModal();
      document.getElementById('editarDescricao').focus();
    });

    const apagar = document.createElement('button');
    apagar.className = 'action-button action-button-delete';
    apagar.type = 'button';
    apagar.textContent = 'Apagar';
    apagar.setAttribute('aria-label', `Apagar ${lancamento.descricao}`);
    apagar.addEventListener('click', async function () {
      const confirmado = window.confirm(`Apagar o lançamento "${lancamento.descricao}"?`);
      if (!confirmado) {
        return;
      }

      const mensagem = document.getElementById('extratoMsg');
      mensagem.textContent = '';
      apagar.disabled = true;
      try {
        const resultado = await apagarLancamento(lancamento.id, usuarioLogado.id);
        if (resultado.error) {
          mensagem.textContent = resultado.error.message || 'Não foi possível apagar o lançamento.';
          return;
        }
        await atualizarExtrato();
      } catch (error) {
        console.error('Falha ao apagar o lançamento.', error);
        mensagem.textContent = 'Não foi possível conectar para apagar o lançamento.';
      } finally {
        apagar.disabled = false;
      }
    });

    actions.append(editar, apagar);
    card.append(descricao, data, valor, tagsDiv, actions);
  }
  return card;
}

document.getElementById('formEditarLancamento').addEventListener('submit', async function (e) {
  e.preventDefault();
  const id = document.getElementById('editarId').value;
  const descricao = document.getElementById('editarDescricao').value.trim();
  const valor = Number(document.getElementById('editarValor').value);
  const tipo = document.getElementById('editarTipo').value;
  const mensagem = document.getElementById('editarMsg');
  const botao = e.currentTarget.querySelector('button[type="submit"]');

  if (!descricao || !Number.isFinite(valor) || valor <= 0) {
    mensagem.textContent = 'Informe uma descrição e um valor maior que zero.';
    return;
  }

  if (!usuarioLogado) {
    mensagem.textContent = 'Faça login novamente para editar lançamentos.';
    return;
  }

  botao.disabled = true;
  mensagem.textContent = '';
  try {
    const resultado = await editarLancamento(id, usuarioLogado.id, descricao, valor, tipo);
    if (resultado.error) {
      mensagem.textContent = resultado.error.message || 'Não foi possível editar o lançamento.';
      return;
    }

    document.getElementById('editarDialog').close();
    document.getElementById('extratoMsg').textContent = '';
    await atualizarExtrato();
  } catch (error) {
    console.error('Falha ao editar o lançamento.', error);
    mensagem.textContent = 'Não foi possível conectar para salvar as alterações.';
  } finally {
    botao.disabled = false;
  }
});

function fecharDialogEdicao() {
  document.getElementById('editarDialog').close();
}

document.getElementById('fecharEditar').addEventListener('click', fecharDialogEdicao);
document.getElementById('cancelarEditar').addEventListener('click', fecharDialogEdicao);

document.getElementById('formLancamento').addEventListener('submit', async function (e) {
  e.preventDefault();
  const descricao = document.getElementById('lancDescricao').value.trim();
  const valor = Number(document.getElementById('lancValor').value);
  const tipo = document.getElementById('lancTipo').value;
  const tagsTexto = document.getElementById('lancTags').value;
  const msg = document.getElementById('lancMsg');

  if (!descricao || !Number.isFinite(valor) || valor <= 0) {
    msg.textContent = 'Informe uma descrição e um valor maior que zero.';
    return;
  }

  if (!usuarioLogado) {
    msg.textContent = 'Faça login para adicionar um lançamento.';
    return;
  }

  const resultado = await criarLancamento(usuarioLogado.id, descricao, valor, tipo);
  if (resultado.error) {
    msg.textContent = resultado.error.message || 'Erro ao criar o lançamento.';
    return;
  }

  e.target.reset();
  const tags = tagsTexto.split(',').map((tag) => tag.trim()).filter(Boolean);
  const errosTag = [];
  for (const tag of tags) {
    const resultadoTag = await adicionarTag(resultado.data.id, tag);
    if (resultadoTag.error) {
      errosTag.push(`${tag}: ${resultadoTag.error.message || 'erro ao adicionar'}`);
    }
  }

  msg.textContent = errosTag.length
    ? `Lançamento salvo, mas houve erro nas tags: ${errosTag.join('; ')}`
    : '';
  await atualizarExtrato();
});

const usuarioSalvo = sessionStorage.getItem('financapp_usuario');
if (usuarioSalvo) {
  try {
    usuarioLogado = JSON.parse(usuarioSalvo);
    if (!usuarioLogado?.id) {
      throw new Error('Sessão salva sem identificador de usuário.');
    }
    document.getElementById('telaAuth').hidden = true;
    document.getElementById('telaApp').hidden = false;
    document.getElementById('btnSair').hidden = false;
    mostrarPerfil(usuarioLogado);
    reiniciarRelatorioMensal();
    inicializarCaixinha(usuarioLogado.id);
    atualizarExtrato();
  } catch (error) {
    console.error('Não foi possível restaurar a sessão salva.', error);
    sessionStorage.removeItem('financapp_usuario');
  }
}
