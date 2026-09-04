import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const cw3Defaults: Plugin = {
  name: 'cw3-default-origin-cep',
  enforce: 'pre',
  transform(code, id) {
    if (id.endsWith('/src/App.tsx')) {
      let next = code.replace(
        "const [originCep, setOriginCep] = useState('');",
        "const [originCep, setOriginCep] = useState('38064700');"
      );

      next = next.replace(
        /<div className="field-grid two">\s*<label>Empresa de origem[\s\S]*?\{address&&<div className="city-preview"><div><MapPin size=\{17\}/><b>Destino localizado<\/b><\/div><span>\{addressText\(address\)\}<\/span><\/div>/,
        `<div className="route-parties">
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

      next = next.replace(
        'const beforeMinimum = nfeCharge + grisCharge + cityRate.tda + ruralCharge;\n    const freight = Math.max(beforeMinimum, cityRate.garantia);',
        'const beforeMinimum = nfeCharge + cityRate.tda + ruralCharge;\n    const minimumPerKg = cityRate.garantia / 1000;\n    const minimumFreightByWeight = usedWeight * minimumPerKg;\n    const freight = Math.max(beforeMinimum, minimumFreightByWeight);'
      );

      next = next.replace(
        '\\nValor estimado: ${money(quote.freight)}`;',
        '\\nFrete e valor: ${money(quote.freight)}\\nGRIS - Ressarcimento de Risco da Carga: ${money(quote.grisCharge)}\\nTotal da cotação: ${money(quote.freight + quote.grisCharge)}`;'
      );

      next = next.replace(
        '<div className="result-price"><span>VALOR ESTIMADO DO FRETE</span><strong>{money(quote.freight)}</strong><small>Prazo máximo: {quote.destination.prazo} dias</small></div>',
        '<div className="result-price"><span>VALOR TOTAL DA COTAÇÃO</span><strong>{money(quote.freight + quote.grisCharge)}</strong><small>Frete e valor: {money(quote.freight)} • GRIS: {money(quote.grisCharge)} • Prazo máximo: {quote.destination.prazo} dias</small></div>'
      );

      next = next.replace(
        '<div className="breakdown"><h3>Composição da estimativa</h3><div><span>Percentual NF-e ({quote.destination.percentualNfe.toFixed(2)}%)</span><b>{money(quote.nfeCharge)}</b></div><div><span>GRIS ({quote.destination.gris.toFixed(2)}%)</span><b>{money(quote.grisCharge)}</b></div><div><span>TDA</span><b>{money(quote.tda)}</b></div>{quote.ruralCharge>0&&<div><span>Zona rural • {quote.ruralKm.toFixed(1)} km</span><b>{money(quote.ruralCharge)}</b></div>}<div className="minimum"><span>Garantia / mínimo da cidade</span><b>{money(quote.destination.garantia)}</b></div></div>',
        '<div className="breakdown"><h3>Detalhamento da cobrança</h3><div><span>Frete e valor</span><b>{money(quote.freight)}</b></div><div><span>GRIS — Ressarcimento de Risco da Carga ({quote.destination.gris.toFixed(2)}%)</span><b>{money(quote.grisCharge)}</b></div><div className="minimum"><span>Total da cotação</span><b>{money(quote.freight + quote.grisCharge)}</b></div><div><span>Composição do frete: NF-e ({quote.destination.percentualNfe.toFixed(2)}%)</span><b>{money(quote.nfeCharge)}</b></div><div><span>TDA</span><b>{money(quote.tda)}</b></div>{quote.ruralCharge>0&&<div><span>Zona rural • {quote.ruralKm.toFixed(1)} km</span><b>{money(quote.ruralCharge)}</b></div>}<div><span>Mínimo por peso</span><b>{money(quote.destination.garantia / 1000)}/kg</b></div></div>'
      );

      next = next.replace(
        '<div className="result-warning"><ShieldCheck size={18}/><span>A proposta comercial informa os componentes da cobrança, mas não apresenta uma fórmula textual única para a combinação final. Esta versão usa o valor de garantia como mínimo da estimativa.</span></div>',
        '<div className="result-warning"><ShieldCheck size={18}/><span>O Frete e Valor é calculado pelo maior valor entre o cálculo comercial e o mínimo por peso. O GRIS é o ressarcimento de risco da carga, calculado à parte em 0,30% do valor da NF-e e somado ao total.</span></div>'
      );

      // Dimensões são informadas em centímetros apenas para exibir a cubagem estimada.
      // A CW3 considera somente o peso real no cálculo do frete; a cubagem não altera o valor.
      next = next.replace('const cubedWeight = h * w * l * CUBIC_FACTOR * volumeValue;\n    const usedWeight = Math.max(weightValue, cubedWeight);', 'const cubedWeight = (h / 100) * (w / 100) * (l / 100) * CUBIC_FACTOR * volumeValue;\n    const usedWeight = weightValue;');
      next = next.replace("setError('Informe altura, largura e comprimento para calcular a cubagem.')", "setError('Informe altura, largura e comprimento em centímetros para exibir a cubagem estimada.')");
      next = next.replace('const freight = Math.max(beforeMinimum, minimumFreightByWeight);', 'const freight = Math.max(beforeMinimum, minimumFreightByWeight);');
      // O cálculo acima mantém a variável de mínimo por peso disponível para exibição, mas não usa cubagem.
      next = next.replace('const minimumFreightByWeight = usedWeight * minimumPerKg;', 'const minimumFreightByWeight = weightValue * minimumPerKg;');

      next = next.replace(
        'next = next.replace(\'\\nValor estimado: ${money(quote.freight)}`;\',',
        'next = next.replace(\'\\nValor estimado: ${money(quote.freight)}`;\','
      );

      // Mantém a estética e apenas esclarece a unidade dos campos de dimensão.
      next = next.replace(/>Altura<\/label>/g, '>Altura (cm)<\/label>');
      next = next.replace(/>Largura<\/label>/g, '>Largura (cm)<\/label>');
      next = next.replace(/>Comprimento<\/label>/g, '>Comprimento (cm)<\/label>');
      next = next.replace(/placeholder="0\.00 m"/g, 'placeholder="0,00 cm"');
      next = next.replace(/placeholder="0\.00"/g, 'placeholder="0,00"');
      next = next.replace(/Dimensões por volume: \$\{quote\.height\.toFixed\(2\)\} x \$\{quote\.width\.toFixed\(2\)\} x \$\{quote\.length\.toFixed\(2\)\} m/g, 'Dimensões por volume: ${quote.height.toFixed(2)} x ${quote.width.toFixed(2)} x ${quote.length.toFixed(2)} cm');

      next = next.replace("import './styles.css';", "import './styles.css';\nimport './route-parties.css';");
      return next;
    }
    return null;
  },
};

export default defineConfig({
  plugins: [cw3Defaults, react()],
});
