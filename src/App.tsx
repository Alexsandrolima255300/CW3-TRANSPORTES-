import { useMemo, useState } from 'react';
import { ArrowRight, Calculator, CheckCircle2, ChevronDown, Clock3, Download, MapPin, Menu, MessageCircle, Package, Ruler, Search, ShieldCheck, Truck, X } from 'lucide-react';
import { cities, type CityRate } from './data/cities';
import './styles.css';

const WHATSAPP = '5534998552390';
const RURAL_RATE = 8;
const ORIGIN_COMPANY = 'BRASIL ENGRANAGENS E CORRENTES IMPORTADORA LTDA';
const ORIGIN_CNPJ = '39860057000104';

type Quote = {
  destination: CityRate; nf: number; weight: number; volumes: number; cargoType: string;
  height: number; width: number; length: number; cubedWeight: number; usedWeight: number;
  nfeCharge: number; grisCharge: number; tda: number; ruralCharge: number; ruralDetected: boolean;
  ruralKm: number; freight: number; recipientName: string; recipientCnpj: string; destinationCep: string;
  destinationAddress: string; originCep: string; originAddress: string;
};

type AddressInfo = { logradouro?: string; bairro?: string; localidade?: string; uf?: string; complemento?: string; numero?: string; cep?: string };
type CompanyInfo = { razao_social?: string; nome_fantasia?: string; cnpj?: string; cep?: string; logradouro?: string; numero?: string; complemento?: string; bairro?: string; municipio?: string; uf?: string };

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const onlyDigits = (value: string) => value.replace(/\D/g, '');
const formatCep = (value: string) => { const d = onlyDigits(value).slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };
const formatCnpj = (value: string) => { const d = onlyDigits(value).slice(0, 14); return d.length > 12 ? `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}` : d; };

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [destination, setDestination] = useState('');
  const [originCep, setOriginCep] = useState('');
  const [destinationCep, setDestinationCep] = useState('');
  const [originCepLoading, setOriginCepLoading] = useState(false);
  const [destinationCepLoading, setDestinationCepLoading] = useState(false);
  const [destinationCnpj, setDestinationCnpj] = useState('');
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [originCepMessage, setOriginCepMessage] = useState('');
  const [destinationCepMessage, setDestinationCepMessage] = useState('');
  const [cnpjMessage, setCnpjMessage] = useState('');
  const [originAddress, setOriginAddress] = useState<AddressInfo | null>(null);
  const [address, setAddress] = useState<AddressInfo | null>(null);
  const [recipientName, setRecipientName] = useState('');
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
  const selectedCity = useMemo(() => cities.find(c => c.cidade === normalize(destination) && c.uf === normalize(address?.uf || '')), [destination, address?.uf]);
  const selectedCityFallback = useMemo(() => cities.find(c => c.cidade === normalize(destination)), [destination]);
  const cityRate = selectedCity || selectedCityFallback;

  function findCityRate(city?: string, uf?: string) {
    if (!city) return undefined;
    const normalizedCity = normalize(city);
    const normalizedUf = normalize(uf || '');
    return cities.find(c => c.cidade === normalizedCity && (!normalizedUf || c.uf === normalizedUf));
  }

  function addressText(info: AddressInfo | null) {
    if (!info) return '';
    return [info.logradouro, info.numero, info.complemento, info.bairro, info.localidade, info.uf].filter(Boolean).join(', ');
  }

  async function lookupCep(target: 'origin' | 'destination', value?: string) {
    const raw = value ?? (target === 'origin' ? originCep : destinationCep);
    const clean = onlyDigits(raw);
    const setLoading = target === 'origin' ? setOriginCepLoading : setDestinationCepLoading;
    const setMessage = target === 'origin' ? setOriginCepMessage : setDestinationCepMessage;
    setLoading(true); setMessage('');
    if (target === 'destination') setAddress(null);
    else setOriginAddress(null);
    if (clean.length !== 8) { setMessage('Digite um CEP válido com 8 números.'); setLoading(false); return; }
    try {
      const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      if (!response.ok) throw new Error('CEP indisponível');
      const data = await response.json();
      if (data.erro) { setMessage('CEP não encontrado.'); return; }
      const info: AddressInfo = { logradouro:data.logradouro, bairro:data.bairro, localidade:data.localidade, uf:data.uf, complemento:data.complemento, cep:data.cep };
      const rate = findCityRate(data.localidade, data.uf);
      if (target === 'origin') {
        setOriginAddress(info);
        setMessage(rate && normalize(data.localidade) === 'UBERABA' && normalize(data.uf) === 'MG' ? `${addressText(info)} — origem dentro da negociação CW3.` : `${addressText(info)} — a negociação desta proposta tem origem em Uberaba/MG.`);
      } else {
        setAddress(info);
        if (rate) setDestination(rate.cidade);
        setDestinationCep(formatCep(data.cep || clean));
        setDestinationCepMessage(rate ? `${addressText(info)} — destino atendido pela tabela CW3.` : `${addressText(info)} — esta cidade não está cadastrada na tabela CW3.`);
      }
    } catch {
      setMessage('Não foi possível consultar o CEP agora.');
    } finally { setLoading(false); }
  }

  async function lookupCnpj(value?: string) {
    const raw = value ?? destinationCnpj;
    const clean = onlyDigits(raw);
    setCnpjMessage('');
    if (clean.length !== 14) { setCnpjMessage('Digite um CNPJ válido com 14 números.'); return; }
    setCnpjLoading(true); setCnpjMessage(''); setAddress(null);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
      if (!response.ok) throw new Error('CNPJ não encontrado');
      const data: CompanyInfo = await response.json();
      const company = data.nome_fantasia || data.razao_social || 'Empresa identificada';
      setRecipientName(company);
      const info: AddressInfo = { logradouro:data.logradouro, bairro:data.bairro, localidade:data.municipio, uf:data.uf, complemento:data.complemento, numero:data.numero, cep:data.cep };
      setAddress(info);
      const rate = findCityRate(data.municipio, data.uf);
      if (data.cep) setDestinationCep(formatCep(data.cep));
      if (rate) {
        setDestination(rate.cidade);
        setCnpjMessage(`${company} — CNPJ localizado. Destino atendido pela tabela CW3.`);
      } else {
        setDestination('');
        setCnpjMessage(`${company} — CNPJ localizado, mas ${data.municipio || 'a cidade informada'}/${data.uf || ''} não está cadastrada na tabela CW3.`);
      }
    } catch {
      setRecipientName('');
      setCnpjMessage('CNPJ não encontrado na BrasilAPI. Confira os números e tente novamente.');
    } finally { setCnpjLoading(false); }
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
    if (!cityRate) return setError('Selecione um destino presente na tabela CW3.');
    if (originCep && (!originAddress || normalize(originAddress.localidade || '') !== 'UBERABA' || normalize(originAddress.uf || '') !== 'MG')) return setError('O CEP de origem informado não corresponde à origem negociada: Uberaba/MG.');
    if (!nfValue || nfValue <= 0) return setError('Informe o valor da NF-e.');
    if (!weightValue || weightValue <= 0) return setError('Informe o peso total da mercadoria.');
    if (!h || !w || !l || h <= 0 || w <= 0 || l <= 0) return setError('Informe altura, largura e comprimento em centímetros para registrar a cubagem.');

    const cubedWeight = (h / 100) * (w / 100) * (l / 100) * volumeValue;
    const usedWeight = weightValue;
    const nfeCharge = nfValue * (cityRate.percentualNfe / 100);
    const grisCharge = nfValue * (cityRate.gris / 100);
    const ruralDetected = isRuralAddress();
    const ruralKm = ruralDetected ? await getRuralDistanceKm() : 0;
    const ruralCharge = ruralDetected && ruralKm > 0 ? ruralKm * 2 * RURAL_RATE : 0;
    const calculatedFreight = nfeCharge + cityRate.tda + ruralCharge;
    const minimumFreight = weightValue * (cityRate.garantia / 1000);
    const freight = Math.max(calculatedFreight, minimumFreight);
    setQuote({ destination:cityRate, nf:nfValue, weight:weightValue, volumes:volumeValue, cargoType, height:h, width:w, length:l, cubedWeight, usedWeight, nfeCharge, grisCharge, tda:cityRate.tda, ruralCharge, ruralDetected, ruralKm, freight, recipientName, recipientCnpj:onlyDigits(destinationCnpj), destinationCep, destinationAddress:addressText(address), originCep, originAddress:addressText(originAddress) });
    setTimeout(() => document.getElementById('resultado')?.scrollIntoView({behavior:'smooth',block:'start'}), 50);
  }

  function whatsapp() {
    if (!quote) return;
    const text = `Olá! Gostaria de confirmar uma cotação com a CW3 Transportes & Logística.\n\nOrigem: ${ORIGIN_COMPANY} — CNPJ ${ORIGIN_CNPJ}\nCEP de origem: ${quote.originCep || 'não informado'}\nEndereço de origem: ${quote.originAddress || 'Uberaba/MG'}\nDestinatário: ${quote.recipientName || 'não informado'}\nCNPJ destinatário: ${quote.recipientCnpj || 'não informado'}\nDestino: ${quote.destination.cidade}/${quote.destination.uf}\nCEP de destino: ${quote.destinationCep || 'não informado'}\nEndereço de destino: ${quote.destinationAddress || 'não informado'}\nTipo de carga: ${quote.cargoType}\nValor da NF-e: ${money(quote.nf)}\nPeso real: ${quote.weight.toFixed(2)} kg\nVolumes: ${quote.volumes}\nCubagem: ${quote.cubedWeight.toFixed(4)} m³\nDimensões por volume: ${quote.height.toFixed(2)} x ${quote.width.toFixed(2)} x ${quote.length.toFixed(2)} cm\nPrazo: até ${quote.destination.prazo} dias\nValor estimado: ${money(quote.freight)}`;
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
        <div className="form-section"><div className="form-title"><span>01</span><div><h3>Origem e destino</h3><p>Brasil Engrenagens e Correntes é a sugestão padrão de origem da negociação.</p></div></div>
          <div className="field-grid two">
            <label>Empresa de origem<input value={ORIGIN_COMPANY} disabled/></label>
            <label>CNPJ de origem<input value={formatCnpj(ORIGIN_CNPJ)} disabled/></label>
            <label>CEP de origem<div className="input-action"><input value={originCep} onChange={e=>{const v=formatCep(e.target.value);setOriginCep(v);if(onlyDigits(v).length===8) lookupCep('origin',v)}} placeholder="00000-000" inputMode="numeric" maxLength={9}/><button type="button" onClick={()=>lookupCep('origin')} disabled={originCepLoading}>{originCepLoading?'...':<Search size={18}/>}</button></div></label>
            <label>CNPJ do destinatário<div className="input-action"><input value={destinationCnpj} onChange={e=>{const v=formatCnpj(e.target.value);setDestinationCnpj(v);if(onlyDigits(v).length===14) lookupCnpj(v)}} placeholder="00.000.000/0000-00" inputMode="numeric" maxLength={18}/><button type="button" onClick={()=>lookupCnpj()} disabled={cnpjLoading}>{cnpjLoading?'...':<Search size={18}/>}</button></div></label>
          </div>
          {originCepMessage&&<div className="helper">{originCepMessage}</div>}
          {cnpjMessage&&<div className="helper">{cnpjMessage}</div>}
          <label>Empresa destinatária<input value={recipientName} onChange={e=>setRecipientName(e.target.value)} placeholder="Preenchida automaticamente pela BrasilAPI"/></label>
          <div className="field-grid two" style={{marginTop:'15px'}}>
            <label>CEP de destino<div className="input-action"><input value={destinationCep} onChange={e=>{const v=formatCep(e.target.value);setDestinationCep(v);if(onlyDigits(v).length===8) lookupCep('destination',v)}} placeholder="00000-000" inputMode="numeric" maxLength={9}/><button type="button" onClick={()=>lookupCep('destination')} disabled={destinationCepLoading}>{destinationCepLoading?'...':<Search size={18}/>}</button></div></label>
            <label>Cidade de destino<div className="select-wrap"><select value={destination} onChange={e=>{setDestination(e.target.value);const rate=findCityRate(e.target.value);setDestinationCepMessage(rate?'Cidade encontrada na tabela CW3.':'Cidade não cadastrada na tabela CW3.')}}><option value="">Selecione uma cidade da tabela CW3</option>{destinationOptions.map(c=><option key={`${c.cidade}-${c.uf}`} value={c.cidade}>{c.cidade} / {c.uf}</option>)}</select><ChevronDown size={18}/></div></label>
          </div>
          {destinationCepMessage&&<div className="helper">{destinationCepMessage}</div>}
          {cityRate&&<div className="city-preview"><div><MapPin size={17}/><b>{cityRate.cidade}/{cityRate.uf}</b></div><span>ATENDIDO • {cityRate.prazo} dias • TDA {money(cityRate.tda)} • mínimo {money(cityRate.garantia / 1000)}/kg</span></div>}
          {(destinationCnpj && !cityRate && cnpjMessage)&&<div className="helper">DESTINO NÃO ATENDIDO: a cidade do destinatário não está cadastrada na tabela comercial CW3.</div>}
          {originAddress&&<div className="city-preview"><div><MapPin size={17}/><b>Origem: Uberaba/MG</b></div><span>{addressText(originAddress)}</span></div>}
          {address&&<div className="city-preview"><div><MapPin size={17}/><b>Destino localizado</b></div><span>{addressText(address)}</span></div>}
        </div>
        <div className="form-section"><div className="form-title"><span>02</span><div><h3>Mercadoria</h3><p>Informe os dados da nota e da carga.</p></div></div><div className="field-grid two"><label>Tipo de carga<div className="select-wrap"><select value={cargoType} onChange={e=>setCargoType(e.target.value)}><option>Caixa</option><option>Palete</option><option>Caixote</option></select><ChevronDown size={18}/></div></label><label>Valor da NF-e<input value={nf} onChange={e=>setNf(e.target.value)} placeholder="R$ 0,00" inputMode="decimal"/></label><label>Peso total (kg)<input value={weight} onChange={e=>setWeight(e.target.value)} placeholder="0,00" inputMode="decimal"/></label><label>Quantidade de volumes<input value={volumes} onChange={e=>setVolumes(e.target.value)} min="1" type="number"/></label></div></div>
        <div className="form-section"><div className="form-title"><span>03</span><div><h3>Dimensões da carga</h3><p>Informe as medidas de cada volume. A cubagem é apenas informativa e não altera o frete.</p></div></div><div className="dimension-grid"><label>Altura (cm)<input value={height} onChange={e=>setHeight(e.target.value)} placeholder="0,00" inputMode="decimal"/></label><label>Largura (cm)<input value={width} onChange={e=>setWidth(e.target.value)} placeholder="0,00" inputMode="decimal"/></label><label>Comprimento (cm)<input value={length} onChange={e=>setLength(e.target.value)} placeholder="0,00" inputMode="decimal"/></label></div><div className="cubing-preview"><Ruler size={17}/><span>Cubagem</span><strong>{height&&width&&length ? `${((Number(height.replace(',','.'))/100)*(Number(width.replace(',','.'))/100)*(Number(length.replace(',','.'))/100)*(Number(volumes)||1)).toFixed(4)} m³` : '—'}</strong></div></div>
        {error&&<div className="error-box">{error}</div>}<button className="calculate" onClick={calculate}><Calculator size={19}/> Calcular frete</button><p className="form-note">A cotação é uma estimativa e pode depender das condições operacionais aplicáveis à remessa.</p>
      </div><aside className="side-info"><div className="info-card"><Truck size={26}/><h3>Parâmetros da tabela</h3><div className="info-list"><div><span>% NF-e</span><b>3,00%</b></div><div><span>GRIS</span><b>0,30%</b></div><div><span>Cubagem</span><b>Informativa</b></div><div><span>Tipos de carga</span><b>Caixa / Palete / Caixote</b></div></div></div><div className="info-card light"><Clock3 size={23}/><h3>Prazo por cidade</h3><p>O prazo exibido é o prazo máximo informado para o destino selecionado na tabela comercial.</p></div></aside></div></section>
      {quote&&<section id="resultado" className="result-section"><div className="print-report-header"><img src="/cw3-logo.png" alt="CW3 Transporte & Logística"/><div><strong>RELATÓRIO DE COTAÇÃO</strong><span>CW3 Transporte & Logística</span><small>Documento gerado a partir da cotação online</small></div></div><div className="result-shell"><div className="result-head"><div><div className="eyebrow"><span/> RESULTADO DA COTAÇÃO</div><h2>Estimativa calculada</h2></div><div className="quote-number">CW3 • UBR → {quote.destination.uf}</div></div><div className="result-main"><div className="result-price"><span>VALOR ESTIMADO DO FRETE</span><strong>{money(quote.freight)}</strong><small>Prazo máximo: {quote.destination.prazo} dias</small></div><div className="result-actions"><button className="button whatsapp" onClick={whatsapp}><MessageCircle size={18}/> Confirmar pelo WhatsApp</button><button className="button print" onClick={()=>window.print()}><Download size={18}/> Imprimir / salvar PDF</button></div></div><div className="result-grid"><div><span>Destinatário</span><b>{quote.recipientName || 'Não informado'}</b></div><div><span>CNPJ</span><b>{quote.recipientCnpj ? formatCnpj(quote.recipientCnpj) : 'Não informado'}</b></div><div><span>Destino</span><b>{quote.destination.cidade}/{quote.destination.uf}</b></div><div><span>Tipo de carga</span><b>{quote.cargoType}</b></div><div><span>NF-e</span><b>{money(quote.nf)}</b></div><div><span>Peso real</span><b>{quote.weight.toFixed(2)} kg</b></div><div><span>Cubagem</span><b>{quote.cubedWeight.toFixed(4)} m³</b></div><div><span>Peso considerado</span><b>{quote.usedWeight.toFixed(2)} kg</b></div><div><span>Volumes</span><b>{quote.volumes}</b></div><div><span>Dimensões</span><b>{quote.height.toFixed(2)} × {quote.width.toFixed(2)} × {quote.length.toFixed(2)} cm</b></div></div><div className="breakdown"><h3>Composição da estimativa</h3><div><span>Percentual NF-e ({quote.destination.percentualNfe.toFixed(2)}%)</span><b>{money(quote.nfeCharge)}</b></div><div><span>GRIS ({quote.destination.gris.toFixed(2)}%)</span><b>{money(quote.grisCharge)}</b></div><div><span>TDA</span><b>{money(quote.tda)}</b></div>{quote.ruralCharge>0&&<div><span>Zona rural • {quote.ruralKm.toFixed(1)} km</span><b>{money(quote.ruralCharge)}</b></div>}<div className="minimum"><span>Garantia / mínimo da cidade</span><b>{money(quote.destination.garantia / 1000)}/kg</b></div></div><div className="result-warning"><ShieldCheck size={18}/><span>A cubagem é informativa. O frete considera exclusivamente o peso real e as taxas aplicáveis, respeitando o mínimo por kg da cidade.</span></div></div></section>}
      <section id="como-funciona" className="steps-section"><div className="section-heading centered"><div><div className="eyebrow dark"><span/> SIMPLES E RÁPIDO</div><h2>Como funciona</h2><p>Uma experiência direta para consultar seu transporte.</p></div></div><div className="steps"><div><span>01</span><MapPin size={24}/><h3>Informe o destino</h3><p>Digite o CNPJ ou CEP. O sistema consulta a empresa/endereço e confere a cidade na tabela CW3.</p></div><div><span>02</span><Package size={24}/><h3>Informe a carga</h3><p>NF-e, peso, volumes e dimensões.</p></div><div><span>03</span><Calculator size={24}/><h3>Receba a estimativa</h3><p>Confira o frete estimado e o prazo informado na tabela.</p></div></div></section>
      <section id="atendimento" className="contact-section"><div><div className="eyebrow"><span/> FALE COM A CW3</div><h2>Precisa confirmar uma cotação?</h2><p>Envie os dados da sua remessa e fale com a equipe da CW3 Transportes & Logística.</p></div><button className="button whatsapp" onClick={()=>window.open(`https://wa.me/${WHATSAPP}`,'_blank','noopener,noreferrer')}><MessageCircle size={18}/> Entrar em contato</button></section>
    </main>
    <footer><div className="footer-brand"><img src="/cw3-logo.png" alt="CW3"/><p>CW3 Transportes & Logística<br/>Uberaba / MG • Origem UBR</p></div><div className="footer-copy">Tabela CW3_000152-1 • 2026/2027</div></footer>
    <style>{`@media screen{.print-report-header{display:none}}@media print{.print-report-header{display:flex!important;align-items:center;justify-content:space-between;gap:24px;border-bottom:2px solid #171719;padding:0 0 14px;margin:0 0 22px}.print-report-header img{display:block;width:190px;height:auto;max-height:90px;object-fit:contain;object-position:left center}.print-report-header>div{flex:1;text-align:right}.print-report-header strong{display:block;font-size:21px;letter-spacing:.04em;color:#b9141e}.print-report-header span{display:block;margin-top:4px;font-size:13px;font-weight:800;color:#171719}.print-report-header small{display:block;margin-top:4px;font-size:9px;color:#777}.result-section{padding-top:18px!important}.result-shell{max-width:none!important}}`}</style>
  </div>;
}
