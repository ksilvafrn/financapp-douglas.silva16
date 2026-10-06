const supabaseUrl = 'https://sftihiwaudotivfejlrr.supabase.co';
const supabaseKey = 'sb_publishable_FTblQagsuphcr60CFqha6Q_Pwlxspnl';
const supabaseConfigurado =
  window.supabase &&
  /^https:\/\/.+\.supabase\.co$/.test(supabaseUrl) &&
  supabaseKey !== 'SUA_PUBLISHABLE_KEY';
const supabaseClient = supabaseConfigurado
  ? window.supabase.createClient(supabaseUrl, supabaseKey)
  : null;
let usuarioLogado = null;

function erroConfiguracaoSupabase() {
  return { message: 'Configure a URL e a chave pública do Supabase em app.js.' };
}

async function cadastrarUsuario(nome, turma, usuario, senha) {
  if (!supabaseClient) {
    return { data: null, error: erroConfiguracaoSupabase() };
  }

  const { data, error } = await supabaseClient
    .from('usuarios')
    .insert([{ nome, turma, usuario, senha }])
    .select()
    .single();

  if (error) {
    console.error(error);
    return { data: null, error };
  }

  return { data, error: null };
}

async function fazerLogin(usuario, senha) {
  if (!supabaseClient) {
    return { data: null, error: erroConfiguracaoSupabase() };
  }

  const { data, error } = await supabaseClient
    .from('usuarios')
    .select('id, nome, turma, usuario, foto_url')
    .eq('usuario', usuario)
    .eq('senha', senha)
    .maybeSingle();

  if (error) {
    console.error(error);
    return { data: null, error };
  }

  if (!data) {
    return { data: null, error: { message: 'Usuário ou senha incorretos.' } };
  }

  console.log('Login ok:', data);
  return { data, error: null };
}

async function criarLancamento(autorId, descricao, valor, tipo) {
  if (!supabaseClient) {
    return { data: null, error: erroConfiguracaoSupabase() };
  }

  const { data, error } = await supabaseClient
    .from('lancamentos')
    .insert([{ autor_id: autorId, descricao, valor: Number(valor), tipo }])
    .select()
    .single();

  if (error) {
    console.error(error);
    return { data: null, error };
  }

  return { data, error: null };
}

async function editarLancamento(lancamentoId, autorId, descricao, valor, tipo) {
  if (!supabaseClient) {
    return { data: null, error: erroConfiguracaoSupabase() };
  }

  const { data, error } = await supabaseClient
    .from('lancamentos')
    .update({ descricao, valor: Number(valor), tipo })
    .eq('id', lancamentoId)
    .eq('autor_id', autorId)
    .select()
    .maybeSingle();

  if (error) {
    console.error(error);
    return { data: null, error };
  }

  if (!data) {
    return {
      data: null,
      error: { message: 'Lançamento não encontrado ou sem permissão para editar.' },
    };
  }

  return { data, error: null };
}

async function apagarLancamento(lancamentoId, autorId) {
  if (!supabaseClient) {
    return { data: null, error: erroConfiguracaoSupabase() };
  }

  const { data, error } = await supabaseClient
    .from('lancamentos')
    .delete()
    .eq('id', lancamentoId)
    .eq('autor_id', autorId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error(error);
    return { data: null, error };
  }

  if (!data) {
    return {
      data: null,
      error: { message: 'Lançamento não encontrado ou sem permissão para apagar.' },
    };
  }

  return { data, error: null };
}

async function carregarLancamentos(autorId) {
  if (!supabaseClient) {
    return { data: [], error: erroConfiguracaoSupabase() };
  }

  const { data, error } = await supabaseClient
    .from('lancamentos')
    .select('*, lancamento_tags (tags (nome))')
    .eq('autor_id', autorId)
    .order('criado_em', { ascending: false });

  if (error) {
    console.error(error);
    return { data: [], error };
  }

  const lancamentos = data.map((lancamento) => ({
    ...lancamento,
    tags: (lancamento.lancamento_tags || [])
      .map((relacao) => relacao.tags?.nome)
      .filter(Boolean),
  }));

  return { data: lancamentos, error: null };
}

async function adicionarTag(lancamentoId, nomeTag) {
  if (!supabaseClient) {
    return { data: null, error: erroConfiguracaoSupabase() };
  }

  const nome = nomeTag.trim().toLowerCase();
  if (!nome) {
    return { data: null, error: { message: 'Tag vazia.' } };
  }

  const busca = await supabaseClient
    .from('tags')
    .select('id')
    .eq('nome', nome)
    .maybeSingle();

  if (busca.error) {
    console.error(busca.error);
    return { data: null, error: busca.error };
  }

  let tag = busca.data;
  if (!tag) {
    const criacao = await supabaseClient
      .from('tags')
      .insert([{ nome }])
      .select('id')
      .single();

    if (criacao.error) {
      console.error(criacao.error);
      return { data: null, error: criacao.error };
    }

    tag = criacao.data;
  }

  const { data, error } = await supabaseClient
    .from('lancamento_tags')
    .insert([{ lancamento_id: lancamentoId, tag_id: tag.id }])
    .select();

  if (error) {
    if (error.code === '23505') {
      return { data: null, error: null };
    }
    console.error(error);
    return { data: null, error };
  }

  return { data, error: null };
}

function mostrarPerfil(usuario) {
  document.getElementById('perfilNome').textContent = usuario.nome || '';
  document.getElementById('perfilTurma').textContent = usuario.turma || '';

  if (usuario.foto_url) {
    const foto = document.getElementById('perfilFoto');
    foto.src = usuario.foto_url;
    foto.hidden = false;
  }
}

document.getElementById('btnSair').addEventListener('click', function () {
  usuarioLogado = null;
  sessionStorage.removeItem('financapp_usuario');
  pararAtualizacaoCaixinha();
  document.getElementById('telaApp').hidden = true;
  document.getElementById('telaAuth').hidden = false;
  document.getElementById('btnSair').hidden = true;
});
