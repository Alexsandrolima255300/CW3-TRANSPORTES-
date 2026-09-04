import { useMemo, useState } from 'react';
import { ArrowRight, Calculator, CheckCircle2, ChevronDown, Clock3, Download, MapPin, Menu, MessageCircle, Package, Ruler, Search, ShieldCheck, Truck, X } from 'lucide-react';
import { cities, type CityRate } from './data/cities';
import './styles.css';

const WHATSAPP = '5534998552390';
const CUBIC_FACTOR = 300;
const RURAL_RATE = 8;

type Quote = {
  destination: CityRate; nf: number; weight: number; volumes: number; cargoType: string;
  height: number; width: number; length: number; cubedWeight: number; usedWeight: number;
  nfeCharge: number; grisCharge: number; tda: number; ruralCharge: number; ruralDetected: boolean;
  ruralKm: number; freight: number;
};

type AddressInfo = { logradouro?: string; bairro?: string; localidade?: string; uf?: string; complemento?: string };
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [destination, setDestination] = useState('');
  const [cep, setCep] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState('');
  const [address, setAddress] = useState<AddressInfo | null>(null);
  const [nf, setNf] = useState('');
  const [weight, setWeight] = useState('');
  const [volumes, setVolumes] = useState('1');
  const [cargoType, setCargoType] = useState('Caixa');
  const [height, setHeight] = useState('');
  const [width, setWidth] = useState('');
  const [length, setLength] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState('');

  const destinationOptions = useMemo(() => [...cities].sort((a,b) => a.cidade.localeCompare(b.cidade, 'pt-BR')), []);
  const selectedCity = useMemo(() => cities.find(c => c.cidade === normalize(destination)), [destination]);

  async function lookupCep() {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return setCepMessage('Digite um CEP válido com 8 números.');
    setCepLoading(true); setCepMessage(''); setAddress(null);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await response.json();
      if (data.erro) return setCepMessage('CEP não encontrado.');
      const city = normalize(data.localidade);
      const exact = cities.find(c => c.cidade === city && c.uf === data.uf);
      setAddress({ logradouro:data.logradouro, bairro:data.bairro, localidade:data.localidade, uf:data.uf, complemento:data.complemento });
      if (exact) setDestination(exact.cidade);
      setCepMessage(exact ? `${data.logradouro || data.bairro || data.localidade} — destino conferido na tabela CW3.` : `${data.localidade}/${data.uf} não está cadastrada na tabela CW3.`);
    } catch {
      setCepMessage('Não foi possível consultar o CEP agora. Selecione a cidade manualmente.');
    } finally { setCepLoading(false); }
  }

  function isRuralAddress() {
    const text = normalize([address?.logradouro, address?.bairro, address?.complemento].filter(Boolean).join(' '));
    return /ZONA RURAL|AREA RURAL|RURAL/.test(text);
  }

  async function getRuralDistanceKm() {
    if (!address) return 0;
    const destinationQuery = encodeURIComponent([address.logradouro, address.bairro, address.localidade, address.uf, 'Brasil'].filter(Boolean).join(', '));
    try {
      const geo = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${destinationQuery}`);
      const places = await geo.json();
      if (!places?.[0]) return 0;
      const from = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent('Uberaba, MG, Brasil')}`);
      const origins = await from.json();
      if (!origins?.[0]) return 0;
      const coords = `${origins[0].lon},${origins[0].lat};${places[0].lon},${places[0].lat}`;
      const route = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`);
      const data = await route.json();
      return data?.routes?.[0]?.distance ? data.routes[0].distance / 1000 : 0;
    } catch { return 0; }
  }

  async function calculate() {
    setError(''); setQuote(null);
    const nfValue = Number(nf.replace(',', '.'));
    const weightValue = Number(weight.replace(',', '.'));
    const volumeValue = Math.max(1, Number(volumes) || 1);
    const h = Number(height.replace(',', '.'));
    const w = Number(width.replace(',', '.'));
    const l = Number(length.replace(',', '.'));
    if (!selectedCity) return setError('Selecione uma cidade de destino presente na tabela CW3.');
    if (!nfValue || nfValue <= 0) return setError('Informe o valor da NF-e.');
    if (!weightValue || weightValue <= 0) return setError('Informe o peso total da mercadoria.');
    if (!h || !w || !l || h <= 0 || w <= 0 || l <= 0) return setError('Informe altura, largura e comprimento para calcular a cubagem.');

    const cubedWeight = h * w * l * CUBIC_FACTOR * volumeValue;
    const usedWeight = Math.max(weightValue, cubedWeight);
    const nfeCharge = nfValue * (selectedCity.percentualNfe / 100);
    const grisCharge = nfValue * (selectedCity.gris / 100);
    const ruralDetected = isRuralAddress();
    const ruralKm = ruralDetected ? await getRuralDistanceKm() : 0;
    const ruralCharge = ruralDetected && ruralKm > 0 ? ruralKm * 2 * RURAL_RATE : 0;
    const beforeMinimum = nfeCharge + grisCharge + selectedCity.tda + ruralCharge;
    const freight = Math.max(beforeMinimum, selectedCity.garantia);
    setQuote({ destination:selectedCity, nf:nfValue, weight:weightValue, volumes:volumeValue, cargoType, height:h, width:w, length:l, cubedWeight, usedWeight, nfeCharge, grisCharge, tda:selectedCity.tda, ruralCharge, ruralDetected, ruralKm, freight });
    setTimeout(() => document.getElementById('resultado')?.scrollIntoView({behavior:'smooth',block:'start'}), 50);
  }

  function whatsapp() {
    if (!quote) return;
    const text = `Olá! Gostaria de confirmar uma cotação com a CW3 Transportes & Logística.\n\nOrigem: Uberaba/MG\nDestino: ${quote.destination.cidade}/${quote.destination.uf}\nCEP: ${cep || 'não informado'}\nTipo de carga: ${quote.cargoType}\nValor da NF-e: ${money(quote.nf)}\nPeso real: ${quote.weight.toFixed(2)} kg\nPeso cubado: ${quote.cubedWeight.toFixed(2)} kg\nPeso considerado: ${quote.usedWeight.toFixed(2)} kg\nVolumes: ${quote.volumes}\nDimensões por volume: ${quote.height.toFixed(2)} x ${quote.width.toFixed(2)} x ${quote.length.toFixed(2)} m\nPrazo: até ${quote.destination.prazo} dias\nValor estimado: ${money(quote.freight)}`;
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }

  return <div className="app">
    <header className="header">
      <a className="brand" href="#inicio" onClick={()=>setMenuOpen(false)}><img src="/cw3-logo.png" alt="CW3 Transporte & Logística" /></a>
      <button className="mobile-menu" onClick={()=>setMenuOpen(v=>!v)} aria-label="Abrir menu">{menuOpen?<X size={24}/>:<Menu size={24}/>}</button>
      <nav className={menuOpen?'nav open':'nav'}><a href="#inicio">Início</a><a href="#cotacao">Cotação</a><a href="#como-funciona">Como funciona</a><a href="#atendimento">Atendimento</a><a className="nav-cta" href="#cotacao">Calcular frete <ArrowRight size={17}/></a></nav>
    </header>
    <main>
      <section id="inicio" className="hero"><div className="hero-glow"/><div className="hero-copy"><div className="eyebrow"><span/> CW3 TRANSPORTES & LOGÍSTICA</div><h1>Seu transporte começa com uma <strong>cotação inteligente.</strong></h1><p>Calcule uma estimativa de frete com os parâmetros da tabela comercial CW3 e encontre seu prazo de entrega de forma rápida.</p><div className="hero-actions"><a href="#cotacao" className="button primary">Fazer cotação <ArrowRight size={18}/></a><a href="#como-funciona" className="button ghost">Como funciona</a></div><div className="hero-trust"><span><ShieldCheck size={17}/> Operação profissional</span><span><MapPin size={17}/> Origem UBR</span><span><Clock3 size={17}/> Prazo por destino</span></div></div>
      <div className="hero-card"><div className="mini-card-top"><div className="mini-icon"><Calculator size={22}/></div><div><span>ESTIMATIVA DE FRETE</span><strong>Pronta em poucos passos</strong></div></div><div className="route-line"><div><b>UBR</b><span>Uberaba / MG</span></div><ArrowRight size={20}/><div className="align-right"><b>GO</b><span>Destino selecionado</span></div></div><div className="mini-stats"><div><Package size={17}/><span>NF-e + peso + cubagem</span></div><div><CheckCircle2 size={17}/><span>Tabela CW3</span></div></div></div></section>
      <section id="cotacao" className="quote-section"><div className="section-heading"><div><div className="eyebrow dark"><span/> COTAÇÃO ONLINE</div><h2>Calcule seu frete</h2><p>Preencha os dados da remessa. O destino é conferido na tabela comercial da CW3.</p></div><div className="table-badge">Tabela CW3_000152-1<br/><small>Válida até 03/09/2027</small></div></div>
      <div className="quote-grid"><div className="form-card">
        <div className="form-section"><div className="form-title"><span>01</span><div><h3>Origem e destino</h3><p>Origem padrão da negociação: Uberaba/MG.</p></div></div><div className="field-grid two"><label>Origem<input value="Uberaba / MG" disabled/></label><label>CEP de destino<div className="input-action"><input value={cep} onChange={e=>setCep(e.target.value)} placeholder="00000-000" inputMode="numeric" maxLength={9}/><button type="button" onClick={lookupCep} disabled={cepLoading}>{cepLoading?'...':<Search size={18}/>}</button></div></label></div>{cepMessage&&<div className="helper">{cepMessage}</div>}<label>Cidade de destino<div className="select-wrap"><select value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Selecione uma cidade da tabela CW3</option>{destinationOptions.map(c=><option key={c.cidade} value={c.cidade}>{c.cidade} / {c.uf}</option>)}</select><ChevronDown size={18}/></div></label>{selectedCity&&<div className="city-preview"><div><MapPin size={17}/><b>{selectedCity.cidade}</b></div><span>{selectedCity.prazo} dias • TDA {money(selectedCity.tda)} • mínimo {money(selectedCity.garantia)}</span></div>}</div>
        <div className="form-section"><div className="form-title"><span>02</span><div><h3>Mercadoria</h3><p>Informe os dados da nota e da carga.</p></div></div><div className="field-grid two"><label>Tipo de carga<div className="select-wrap"><select value={cargoType} onChange={e=>setCargoType(e.target.value)}><option>Caixa</option><option>Palete</option><option>Caixote</option></select><ChevronDown size={18}/></div></label><label>Valor da NF-e<input value={nf} onChange={e=>setNf(e.target.value)} placeholder="R$ 0,00" inputMode="decimal"/></label><label>Peso total (kg)<input value={weight} onChange={e=>setWeight(e.target.value)} placeholder="0,00" inputMode="decimal"/></label><label>Quantidade de volumes<input value={volumes} onChange={e=>setVolumes(e.target.value)} min="1" type="number"/></label></div></div>
        <div className="form-section"><div className="form-title"><span>03</span><div><h3>Dimensões da carga</h3><p>Informe as medidas de cada volume. O peso cubado será calculado automaticamente.</p></div></div><div className="dimension-grid"><label>Altura (m)<input value={height} onChange={e=>setHeight(e.target.value)} placeholder="0,00" inputMode="decimal"/></label><label>Largura (m)<input value={width} onChange={e=>setWidth(e.target.value)} placeholder="0,00" inputMode="decimal"/></label><label>Comprimento (m)<input value={length} onChange={e=>setLength(e.target.value)} placeholder="0,00" inputMode="decimal"/></label></div><div className="cubing-preview"><Ruler size={17}/><span>Peso cubado estimado</span><strong>{height&&width&&length ? `${(Number(height.replace(',','.'))*Number(width.replace(',','.'))*Number(length.replace(',','.'))*CUBIC_FACTOR*(Number(volumes)||1)).toFixed(2)} kg` : '—'}</strong></div></div>
        {error&&<div className="error-box">{error}</div>}<button className="calculate" onClick={calculate}><Calculator size={19}/> Calcular frete</button><p className="form-note">A cotação é uma estimativa e pode depender das condições operacionais aplicáveis à remessa.</p>
      </div><aside className="side-info"><div className="info-card"><Truck size={26}/><h3>Parâmetros da tabela</h3><div className="info-list"><div><span>% NF-e</span><b>3,00%</b></div><div><span>GRIS</span><b>0,30%</b></div><div><span>Cubagem</span><b>Fator 300</b></div><div><span>Tipos de carga</span><b>Caixa / Palete / Caixote</b></div></div></div><div className="info-card light"><Clock3 size={23}/><h3>Prazo por cidade</h3><p>O prazo exibido é o prazo máximo informado para o destino selecionado na tabela comercial.</p></div></aside></div></section>
      {quote&&<section id="resultado" className="result-section"><div className="result-shell"><div className="result-head"><div><div className="eyebrow"><span/> RESULTADO DA COTAÇÃO</div><h2>Estimativa calculada</h2></div><div className="quote-number">CW3 • UBR → {quote.destination.uf}</div></div><div className="result-main"><div className="result-price"><span>VALOR ESTIMADO DO FRETE</span><strong>{money(quote.freight)}</strong><small>Prazo máximo: {quote.destination.prazo} dias</small></div><div className="result-actions"><button className="button whatsapp" onClick={whatsapp}><MessageCircle size={18}/> Confirmar pelo WhatsApp</button><button className="button print" onClick={()=>window.print()}><Download size={18}/> Imprimir / salvar PDF</button></div></div><div className="result-grid"><div><span>Destino</span><b>{quote.destination.cidade}/{quote.destination.uf}</b></div><div><span>Tipo de carga</span><b>{quote.cargoType}</b></div><div><span>NF-e</span><b>{money(quote.nf)}</b></div><div><span>Peso real</span><b>{quote.weight.toFixed(2)} kg</b></div><div><span>Peso cubado</span><b>{quote.cubedWeight.toFixed(2)} kg</b></div><div><span>Peso considerado</span><b>{quote.usedWeight.toFixed(2)} kg</b></div><div><span>Volumes</span><b>{quote.volumes}</b></div><div><span>Dimensões</span><b>{quote.height.toFixed(2)} × {quote.width.toFixed(2)} × {quote.length.toFixed(2)} m</b></div></div><div className="breakdown"><h3>Composição da estimativa</h3><div><span>Percentual NF-e ({quote.destination.percentualNfe.toFixed(2)}%)</span><b>{money(quote.nfeCharge)}</b></div><div><span>GRIS ({quote.destination.gris.toFixed(2)}%)</span><b>{money(quote.grisCharge)}</b></div><div><span>TDA</span><b>{money(quote.tda)}</b></div>{quote.ruralCharge>0&&<div><span>Zona rural • {quote.ruralKm.toFixed(1)} km</span><b>{money(quote.ruralCharge)}</b></div>}<div className="minimum"><span>Garantia / mínimo da cidade</span><b>{money(quote.destination.garantia)}</b></div></div><div className="result-warning"><ShieldCheck size={18}/><span>A proposta comercial informa os componentes da cobrança, mas não apresenta uma fórmula textual única para a combinação final. Esta versão usa o valor de garantia como mínimo da estimativa.</span></div></div></section>}
      <section id="como-funciona" className="steps-section"><div className="section-heading centered"><div><div className="eyebrow dark"><span/> SIMPLES E RÁPIDO</div><h2>Como funciona</h2><p>Uma experiência direta para consultar seu transporte.</p></div></div><div className="steps"><div><span>01</span><MapPin size={24}/><h3>Informe o destino</h3><p>Selecione uma cidade atendida pela tabela CW3.</p></div><div><span>02</span><Package size={24}/><h3>Informe a carga</h3><p>NF-e, peso, volumes e dimensões.</p></div><div><span>03</span><Calculator size={24}/><h3>Receba a estimativa</h3><p>Confira o frete estimado e o prazo informado na tabela.</p></div></div></section>
      <section id="atendimento" className="contact-section"><div><div className="eyebrow"><span/> FALE COM A CW3</div><h2>Precisa confirmar uma cotação?</h2><p>Envie os dados da sua remessa e fale com a equipe da CW3 Transportes & Logística.</p></div><button className="button whatsapp" onClick={()=>window.open(`https://wa.me/${WHATSAPP}`,'_blank','noopener,noreferrer')}><MessageCircle size={18}/> Entrar em contato</button></section>
    </main>
    <footer><div className="footer-brand"><img src="/cw3-logo.png" alt="CW3"/><p>CW3 Transportes & Logística<br/>Uberaba / MG • Origem UBR</p></div><div className="footer-copy">Tabela CW3_000152-1 • 2026/2027</div></footer>
  </div>;
}
