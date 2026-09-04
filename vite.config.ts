import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const cw3Defaults: Plugin = {
  name: 'cw3-default-origin-cep',
  enforce: 'pre',
  transform(code, id) {
    if (!id.endsWith('/src/App.tsx')) return null;

    let next = code.replace(
      "const [originCep, setOriginCep] = useState('');",
      "const [originCep, setOriginCep] = useState('38064700');"
    );

    next = next.replace(
      /<div className="field-grid two">\s*<label>Empresa de origem[\s\S]*?\{address&&<div className="city-preview"><div><MapPin size=\{17\}\/\><b>Destino localizado<\/b><\/div><span>\{addressText\(address\)\}<\/span><\/div>/,
      String.raw`<div className="route-parties">
          <div className="party-card origin-party">
            <div className="party-heading"><span className="party-number">01</span><div><strong>ORIGEM</strong><small>Local de coleta</small></div></div>
            <div className="field-grid two">
              <label>Empresa de origem<input value={ORIGIN_COMPANY} disabled/></label>
              <label>CNPJ de origem<input value={formatCnpj(ORIGIN_CNPJ)} disabled/></label>
              <label className="party-full">CEP de origem<div className="input-action"><input value={originCep} onChange={e=>{const v=formatCep(e.target.value);setOriginCep(v);if(onlyDigits(v).length===8) lookupCep('origin',v)}} placeholder="00000-000" inputMode="numeric" maxLength={9}/><button type="button" onClick={()=>lookupCep('origin')} disabled={originCepLoading}>{originCepLoading?'...':<Search size={18}/>}</button></div></label>
            </div>
            {originCepMessage&&<div className="helper">{originCepMessage}</div>}
            {originAddress&&<div className="city-preview"><div><MapPin size={17}/><b>Origem: Uberaba/MG</b></div><span>{addressText(originAddress)}</span></div>}
          </div>

          <div className="party-card destination-party">
            <div className="party-heading"><span className="party-number">02</span><div><strong>DESTINO</strong><small>Local de entrega</small></div></div>
            <div className="field-grid two">
              <label>CNPJ do destinatário<div className="input-action"><input value={destinationCnpj} onChange={e=>{const v=formatCnpj(e.target.value);setDestinationCnpj(v);if(onlyDigits(v).length===14) lookupCnpj(v)}} placeholder="00.000.000/0000-00" inputMode="numeric" maxLength={18}/><button type="button" onClick={()=>lookupCnpj()} disabled={cnpjLoading}>{cnpjLoading?'...':<Search size={18}/>}</button></div></label>
              <label>Empresa destinatária<input value={recipientName} onChange={e=>setRecipientName(e.target.value)} placeholder="Preenchida automaticamente pela BrasilAPI"/></label>
              <label>CEP de destino<div className="input-action"><input value={destinationCep} onChange={e=>{const v=formatCep(e.target.value);setDestinationCep(v);if(onlyDigits(v).length===8) lookupCep('destination',v)}} placeholder="00000-000" inputMode="numeric" maxLength={9}/><button type="button" onClick={()=>lookupCep('destination')} disabled={destinationCepLoading}>{destinationCepLoading?'...':<Search size={18}/>}</button></div></label>
              <label>Cidade de destino<div className="select-wrap"><select value={destination} onChange={e=>{setDestination(e.target.value);const rate=findCityRate(e.target.value);setDestinationCepMessage(rate?'Cidade encontrada na tabela CW3.':'Cidade não cadastrada na tabela CW3.')}}><option value="">Selecione uma cidade da tabela CW3</option>{destinationOptions.map(c=><option key={c.cidade + '-' + c.uf} value={c.cidade}>{c.cidade} / {c.uf}</option>)}</select><ChevronDown size={18}/></div></label>
            </div>
            {cnpjMessage&&<div className="helper">{cnpjMessage}</div>}
            {destinationCepMessage&&<div className="helper">{destinationCepMessage}</div>}
            {cityRate&&<div className="city-preview"><div><MapPin size={17}/><b>{cityRate.cidade}/{cityRate.uf}</b></div><span>ATENDIDO • {cityRate.prazo} dias • TDA {money(cityRate.tda)} • mínimo {money(cityRate.garantia / 1000)}/kg</span></div>}
            {(destinationCnpj && !cityRate && cnpjMessage)&&<div className="helper">DESTINO NÃO ATENDIDO: a cidade do destinatário não está cadastrada na tabela comercial CW3.</div>}
            {address&&<div className="city-preview"><div><MapPin size={17}/><b>Destino localizado</b></div><span>{addressText(address)}</span></div>}
          </div>
        </div>`
    );

    // CW3: cubagem apenas informativa; o frete usa exclusivamente o peso real.
    next = next.replace('const CUBIC_FACTOR = 300;\n', '');
    next = next.replace(
      'const cubedWeight = h * w * l * CUBIC_FACTOR * volumeValue;\n    const usedWeight = Math.max(weightValue, cubedWeight);',
      'const cubedWeight = (h / 100) * (w / 100) * (l / 100) * volumeValue;\n    const usedWeight = weightValue;'
    );

    // Garantia 590/600/650 da tabela = R$ 0,59/R$ 0,60/R$ 0,65 por kg.
    // O frete peso nunca fica abaixo da garantia: usa o maior entre o frete calculado e o mínimo pelo peso real.
    next = next.replace(
      'const beforeMinimum = nfeCharge + grisCharge + cityRate.tda + ruralCharge;\n    const freight = Math.max(beforeMinimum, cityRate.garantia);',
      'const calculatedFreight = nfeCharge + cityRate.tda + ruralCharge;\n    const minimumFreight = weightValue * (cityRate.garantia / 1000);\n    const freight = Math.max(calculatedFreight, minimumFreight);'
    );

    next = next.replace("setError('Informe altura, largura e comprimento para calcular a cubagem.')", "setError('Informe altura, largura e comprimento em centímetros para calcular a cubagem.')");
    next = next.replace(/const CUBIC_FACTOR = 300;\s*/g, '');
    next = next.replace(/Fator 300/g, '');
    next = next.replace(/>Altura<\/label>/g, '>Altura (cm)</label>');
    next = next.replace(/>Largura<\/label>/g, '>Largura (cm)</label>');
    next = next.replace(/>Comprimento<\/label>/g, '>Comprimento (cm)</label>');
    next = next.replace(/placeholder="0\.00 m"/g, 'placeholder="0,00 cm"');
    next = next.replace("import './styles.css';", "import './styles.css';\nimport './route-parties.css';");

    return next;
  },
};

export default defineConfig({
  plugins: [cw3Defaults, react()],
});
