import { useState, useEffect, useCallback } from 'react'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

// ─── Config ──────────────────────────────────────────────────────
const API = import.meta.env.DEV ? '/api' : 'https://meu-guarda-roupa.onrender.com'

const OCASIOES = [
  { id: 'trabalho', label: 'Trabalho', emoji: '🏢', color: 'bg-roxo-500' },
  { id: 'beach_tennis', label: 'Beach Tennis', emoji: '🎾', color: 'bg-lilas-500' },
  { id: 'correr', label: 'Correr', emoji: '🏃', color: 'bg-green-500' },
  { id: 'lazer', label: 'Lazer', emoji: '🛋️', color: 'bg-amber-500' },
  { id: 'noite', label: 'Noite', emoji: '🌙', color: 'bg-indigo-500' },
]

const PERIODOS = [
  { id: 'manha', label: 'Manhã', emoji: '☀️' },
  { id: 'tarde', label: 'Tarde', emoji: '🌤️' },
  { id: 'noite', label: 'Noite', emoji: '🌙' },
]

// ─── Helpers ─────────────────────────────────────────────────────
const hoje = () => new Date().toISOString().split('T')[0]
const formatarData = (d) => {
  const [ano, mes, dia] = d.split('-')
  return `${dia}/${mes}/${ano}`
}
const nomeOcasiao = (id) => OCASIOES.find(o => o.id === id) || { label: id, emoji: '❓' }
const nomePeriodo = (id) => PERIODOS.find(p => p.id === id) || { label: id, emoji: '' }

// ─── Componente principal ────────────────────────────────────────
export default function App() {
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(true)
  const [dataCalendario, setDataCalendario] = useState(new Date())
  const [aba, setAba] = useState('calendario') // calendario | registrar | buscar | estatisticas
  const [busca, setBusca] = useState('')
  const [resultadosBusca, setResultadosBusca] = useState([])
  const [estatisticas, setEstatisticas] = useState(null)

  // Formulário
  const [form, setForm] = useState({
    data: hoje(),
    periodo: 'manha',
    ocasiao: 'trabalho',
    descricao: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  // ─── Carregar registros ──────────────────────────────────────
  const carregarRegistros = useCallback(async (mes) => {
    try {
      const params = mes ? `?mes=${mes}` : ''
      const r = await fetch(`${API}/registros${params}`)
      if (r.ok) {
        const data = await r.json()
        setRegistros(data)
      }
    } catch (e) {
      console.error('Erro ao carregar:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const mes = dataCalendario.toISOString().slice(0, 7)
    carregarRegistros(mes)
  }, [dataCalendario, carregarRegistros])

  // ─── Carregar estatísticas ────────────────────────────────────
  const carregarEstatisticas = useCallback(async () => {
    try {
      const r = await fetch(`${API}/estatisticas`)
      if (r.ok) setEstatisticas(await r.json())
    } catch (e) {
      console.error('Erro estatísticas:', e)
    }
  }, [])

  useEffect(() => {
    if (aba === 'estatisticas') carregarEstatisticas()
  }, [aba, carregarEstatisticas])

  // ─── Buscar ──────────────────────────────────────────────────
  const handleBusca = useCallback(async () => {
    if (!busca.trim()) return
    try {
      const r = await fetch(`${API}/registros?q=${encodeURIComponent(busca)}`)
      if (r.ok) setResultadosBusca(await r.json())
    } catch (e) {
      console.error('Erro busca:', e)
    }
  }, [busca])

  // ─── Salvar registro ─────────────────────────────────────────
  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    setMensagem('')
    try {
      const r = await fetch(`${API}/registros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (r.ok) {
        setMensagem('✅ Registrado com sucesso!')
        setForm(f => ({ ...f, descricao: '' }))
        const mes = dataCalendario.toISOString().slice(0, 7)
        await carregarRegistros(mes)
      } else {
        const err = await r.json()
        setMensagem(`❌ Erro: ${err.detail?.[0]?.msg || 'Desconhecido'}`)
      }
    } catch (e) {
      setMensagem('❌ Erro de conexão')
    }
    setSalvando(false)
    setTimeout(() => setMensagem(''), 3000)
  }

  // ─── Dias com registros no calendário ────────────────────────
  const diasComRegistro = {}
  registros.forEach(r => {
    if (!diasComRegistro[r.data]) diasComRegistro[r.data] = []
    diasComRegistro[r.data].push(r)
  })

  const registrosDoDiaSelecionado = diasComRegistro[hoje()] || []
  const dataSelecionada = dataCalendario.toISOString().slice(0, 10)
  const registrosDataSelecionada = diasComRegistro[dataSelecionada] || []

  // ─── Tile do calendário ─────────────────────────────────────
  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null
    const key = date.toISOString().split('T')[0]
    const dia = diasComRegistro[key]
    if (!dia) return null

    const ocasiãoUnica = [...new Set(dia.map(r => r.ocasiao))].slice(0, 2)
    return (
      <div className="flex gap-0.5 mt-1 justify-center">
        {ocasiãoUnica.map(o => (
          <span key={o} className="text-[8px]">{nomeOcasiao(o).emoji}</span>
        ))}
        {dia.length > 2 && <span className="text-[8px] text-roxo-400">+{dia.length - 2}</span>}
      </div>
    )
  }

  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return ''
    const key = date.toISOString().split('T')[0]
    return diasComRegistro[key] ? 'bg-lilas-50 font-semibold' : ''
  }

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-roxo-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">👗</span>
            <h1 className="text-xl font-bold text-roxo-800">Meu Guarda-Roupa</h1>
          </div>
        </div>
      </header>

      {/* Navegação */}
      <nav className="max-w-5xl mx-auto px-4 mt-4">
        <div className="flex gap-2 bg-white rounded-xl p-1.5 shadow-sm border border-roxo-100">
          {[
            { id: 'calendario', label: '📅 Calendário' },
            { id: 'registrar', label: '✏️ Registrar' },
            { id: 'buscar', label: '🔍 Buscar' },
            { id: 'estatisticas', label: '📊 Stats' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setAba(tab.id)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                aba === tab.id
                  ? 'bg-gradient-to-r from-roxo-500 to-lilas-500 text-white shadow-md'
                  : 'text-roxo-600 hover:bg-roxo-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* ─── CALENDÁRIO ─────────────────────────────────────── */}
        {aba === 'calendario' && (
          <div className="animate-fade-in space-y-4">
            <Calendar
              onChange={setDataCalendario}
              value={dataCalendario}
              tileContent={tileContent}
              tileClassName={tileClassName}
              locale="pt-BR"
            />

            {/* Registros do dia selecionado */}
            {registrosDataSelecionada.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-roxo-100">
                <h3 className="font-semibold text-roxo-800 mb-3">
                  📅 {formatarData(dataSelecionada)} — {registrosDataSelecionada.length} registro(s)
                </h3>
                <div className="space-y-2">
                  {registrosDataSelecionada.map(r => (
                    <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl bg-roxo-50/50 border border-roxo-100">
                      <span className="text-lg mt-0.5">{nomeOcasiao(r.ocasiao).emoji}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs text-white font-medium ${nomeOcasiao(r.ocasiao).color}`}>
                            {nomeOcasiao(r.ocasiao).label}
                          </span>
                          <span className="text-xs text-roxo-400">{nomePeriodo(r.periodo).emoji} {nomePeriodo(r.periodo).label}</span>
                        </div>
                        <p className="text-gray-700 mt-1">{r.descricao}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {registrosDataSelecionada.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center border border-roxo-100">
                <p className="text-4xl mb-2">👗</p>
                <p className="text-roxo-400 font-medium">Nenhum registro nesse dia</p>
                <p className="text-sm text-roxo-300 mt-1">Clique em "Registrar" pra adicionar</p>
              </div>
            )}
          </div>
        )}

        {/* ─── REGISTRAR ──────────────────────────────────────── */}
        {aba === 'registrar' && (
          <div className="animate-fade-in">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-roxo-100">
              <h2 className="text-lg font-semibold text-roxo-800 mb-4">✏️ Novo Registro</h2>

              {mensagem && (
                <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${mensagem.includes('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {mensagem}
                </div>
              )}

              <form onSubmit={salvar} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Data */}
                  <div>
                    <label className="block text-sm font-medium text-roxo-600 mb-1">Data</label>
                    <input
                      type="date"
                      value={form.data}
                      onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-roxo-200 focus:border-roxo-500 focus:ring-2 focus:ring-roxo-200 outline-none transition-all"
                      required
                    />
                  </div>

                  {/* Período */}
                  <div>
                    <label className="block text-sm font-medium text-roxo-600 mb-1">Período</label>
                    <select
                      value={form.periodo}
                      onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-roxo-200 focus:border-roxo-500 focus:ring-2 focus:ring-roxo-200 outline-none transition-all"
                    >
                      {PERIODOS.map(p => (
                        <option key={p.id} value={p.id}>{p.emoji} {p.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Ocasião */}
                  <div>
                    <label className="block text-sm font-medium text-roxo-600 mb-1">Ocasião</label>
                    <select
                      value={form.ocasiao}
                      onChange={e => setForm(f => ({ ...f, ocasiao: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-roxo-200 focus:border-roxo-500 focus:ring-2 focus:ring-roxo-200 outline-none transition-all"
                    >
                      {OCASIOES.map(o => (
                        <option key={o.id} value={o.id}>{o.emoji} {o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-sm font-medium text-roxo-600 mb-1">
                    O que você vestiu?
                  </label>
                  <textarea
                    value={form.descricao}
                    onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                    placeholder="Ex: Blusa rosa, calça jeans preta, tênis branco..."
                    className="w-full px-3 py-3 rounded-xl border border-roxo-200 focus:border-roxo-500 focus:ring-2 focus:ring-roxo-200 outline-none transition-all resize-none"
                    rows={3}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={salvando}
                  className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-roxo-500 to-lilas-500 hover:from-roxo-600 hover:to-lilas-600 transition-all disabled:opacity-50 shadow-md"
                >
                  {salvando ? 'Salvando...' : '💾 Salvar'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ─── BUSCAR ─────────────────────────────────────────── */}
        {aba === 'buscar' && (
          <div className="animate-fade-in">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-roxo-100">
              <h2 className="text-lg font-semibold text-roxo-800 mb-4">🔍 Buscar Peça</h2>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleBusca()}
                  placeholder="Ex: blusa rosa, tênis, jeans..."
                  className="flex-1 px-4 py-3 rounded-xl border border-roxo-200 focus:border-roxo-500 focus:ring-2 focus:ring-roxo-200 outline-none transition-all"
                />
                <button
                  onClick={handleBusca}
                  className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-roxo-500 to-lilas-500 hover:from-roxo-600 hover:to-lilas-600 transition-all shadow-md"
                >
                  Buscar
                </button>
              </div>

              {resultadosBusca.length > 0 && (
                <div className="mt-6 space-y-2">
                  <p className="text-sm text-roxo-400 font-medium">{resultadosBusca.length} resultado(s):</p>
                  {resultadosBusca.map(r => (
                    <div key={r.id} className="p-3 rounded-xl bg-roxo-50/50 border border-roxo-100">
                      <div className="flex items-center gap-2 text-sm text-roxo-500">
                        <span>{formatarData(r.data)}</span>
                        <span>·</span>
                        <span>{nomeOcasiao(r.ocasiao).emoji} {nomeOcasiao(r.ocasiao).label}</span>
                        <span>·</span>
                        <span>{nomePeriodo(r.periodo).emoji} {nomePeriodo(r.periodo).label}</span>
                      </div>
                      <p className="text-gray-700 mt-1">{r.descricao}</p>
                    </div>
                  ))}
                </div>
              )}

              {busca && resultadosBusca.length === 0 && (
                <div className="mt-6 text-center p-6 bg-roxo-50 rounded-xl">
                  <p className="text-roxo-400">Nenhum resultado encontrado</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── ESTATÍSTICAS ───────────────────────────────────── */}
        {aba === 'estatisticas' && (
          <div className="animate-fade-in">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-roxo-100">
              <h2 className="text-lg font-semibold text-roxo-800 mb-4">📊 Estatísticas</h2>

              {!estatisticas ? (
                <p className="text-roxo-400">Carregando...</p>
              ) : (
                <div className="space-y-6">
                  {/* Total */}
                  <div className="text-center">
                    <span className="text-4xl font-bold text-roxo-600">{estatisticas.total_registros}</span>
                    <p className="text-roxo-400 text-sm mt-1">total de registros</p>
                  </div>

                  {/* Por ocasião */}
                  <div>
                    <h3 className="text-sm font-semibold text-roxo-600 mb-2">Por Ocasião</h3>
                    <div className="space-y-2">
                      {Object.entries(estatisticas.por_ocasiao || {}).map(([oc, count]) => {
                        const total = estatisticas.total_registros || 1
                        const pct = Math.round((count / total) * 100)
                        return (
                          <div key={oc}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-roxo-700">{nomeOcasiao(oc).emoji} {nomeOcasiao(oc).label}</span>
                              <span className="text-roxo-400 font-medium">{count}x</span>
                            </div>
                            <div className="h-2 bg-roxo-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${nomeOcasiao(oc).color} transition-all duration-500`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Por período */}
                  <div>
                    <h3 className="text-sm font-semibold text-roxo-600 mb-2">Por Período</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {PERIODOS.map(p => (
                        <div key={p.id} className="text-center p-3 rounded-xl bg-roxo-50 border border-roxo-100">
                          <span className="text-xl">{p.emoji}</span>
                          <p className="text-lg font-bold text-roxo-600 mt-1">
                            {estatisticas.por_periodo?.[p.id] || 0}
                          </p>
                          <p className="text-xs text-roxo-400">{p.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Últimos 7 dias */}
                  {estatisticas.ultimos_7_dias?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-roxo-600 mb-2">Últimos 7 Dias</h3>
                      <div className="flex gap-2 items-end h-20">
                        {estatisticas.ultimos_7_dias.map(d => (
                          <div key={d.data} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-xs text-roxo-400 font-medium">{d.count}</span>
                            <div
                              className="w-full bg-gradient-to-t from-roxo-500 to-lilas-500 rounded-t-md transition-all"
                              style={{ height: `${Math.max(d.count * 20, 8)}px` }}
                            />
                            <span className="text-[10px] text-roxo-300">
                              {new Date(d.data).toLocaleDateString('pt-BR', { weekday: 'short' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
