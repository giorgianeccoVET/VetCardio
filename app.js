const cfg=window.VETCARDIO_CONFIG;
const app=document.getElementById('app');
const nav=document.getElementById('nav');
const logout=document.getElementById('logout');

let sb;
let session;
let route={name:'home'};
let patients=[];
const ecgUi={};

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#39;'
}[c]));

const fmt=d=>d?new Date(d+'T12:00:00').toLocaleDateString('it-IT'):'—';

function go(name,id){
  route={name,id};
  render();
}

async function load(){
  const {data,error}=await sb
    .from('patients')
    .select('*,owners(*),visits(*,exams(*))')
    .order('created_at',{ascending:false});

  if(error) throw error;

  patients=(data||[]).map(p=>({
    ...p,
    visits:(p.visits||[]).sort((a,b)=>b.visit_date.localeCompare(a.visit_date))
  }));
}

function latestWeight(p){
  const v=(p.visits||[]).find(x=>x.weight_kg!=null);
  return v?`${v.weight_kg} kg`:'—';
}

function row(p){
  return `<div class="row" data-patient="${p.id}">
    <div>
      <div class="title">${esc(p.owners.surname)} – ${esc(p.name)}</div>
      <div class="meta">${esc(p.species)}${p.breed?' · '+esc(p.breed):''} · ${latestWeight(p)}</div>
    </div>
    <span>›</span>
  </div>`;
}

function login(){
  return `<section class="card">
    <h2>Accedi</h2>
    <p class="meta">Riceverai un link via email.</p>
    <form id="loginForm">
      <label>Email<input name="email" type="email" required></label>
      <button class="btn fixed">Invia link</button>
    </form>
    <div id="loginStatus"></div>
  </section>`;
}

function home(){
  return `<section class="card">
    <h2>Cerca paziente</h2>
    <input id="search" placeholder="Cognome o nome paziente">
    <div id="results"></div>
  </section>
  <section class="card">
    <h2>Ultimi pazienti</h2>
    ${patients.slice(0,5).map(row).join('')||'<p class="meta">Nessun paziente</p>'}
  </section>
  <button class="btn fixed" data-go="new-patient">+ Nuovo paziente</button>`;
}

function list(){
  return `<section class="card">
    <h2>Pazienti</h2>
    ${patients.map(row).join('')||'<p class="meta">Nessun paziente</p>'}
  </section>`;
}

function newPatient(){
  return `<form id="patientForm">
    <section class="card">
      <h2>Nuovo paziente</h2>

      <h3>Proprietario</h3>
      <div class="grid">
        <label>Cognome *<input name="ownerSurname" required></label>
        <label>Nome<input name="ownerName"></label>
        <label>Telefono<input name="phone"></label>
        <label>Email<input name="ownerEmail"></label>
      </div>

      <h3>Paziente</h3>
      <div class="grid">
        <label>Nome *<input name="patientName" required></label>
        <label>Specie *
          <select name="species" required>
            <option value="">Seleziona</option>
            <option>Cane</option>
            <option>Gatto</option>
            <option>Furetto</option>
            <option>Altro</option>
          </select>
        </label>
        <label>Razza<input name="breed" placeholder="Nome completo"></label>
        <label>Età<input name="ageText" placeholder="es. 10 anni"></label>
        <label>Sesso
          <select name="sex">
            <option value="">—</option>
            <option>Maschio</option>
            <option>Femmina</option>
          </select>
        </label>
        <label>Sterilizzato
          <select name="neutered">
            <option value="">—</option>
            <option value="true">Sì</option>
            <option value="false">No</option>
          </select>
        </label>
        <label>Microchip<input name="microchip"></label>
      </div>
    </section>
    <button class="btn fixed">Crea paziente</button>
  </form>`;
}

function patient(id){
  const p=patients.find(x=>x.id===id);
  const v=p?.visits?.[0];

  if(!p) return '<section class="card">Paziente non trovato</section>';

  return `<section class="card">
    <h2>${esc(p.owners.surname)} – ${esc(p.name)}</h2>

    <div class="chips">
      <span class="chip">${esc(p.species)}</span>
      ${p.breed?`<span class="chip">${esc(p.breed)}</span>`:''}
      <span class="chip">${latestWeight(p)}</span>
      ${p.age_text?`<span class="chip">${esc(p.age_text)}</span>`:''}
    </div>

    <div class="stats">
      <div class="stat">Diagnosi<b>${esc(p.main_diagnosis||'—')}</b></div>
      <div class="stat">Terapia<b>${esc(p.current_therapy||'—')}</b></div>
      <div class="stat">Ultima visita<b>${v?fmt(v.visit_date):'—'}</b></div>
      <div class="stat">Prossimo controllo<b>${esc(p.next_control||'—')}</b></div>
    </div>
  </section>

  <section class="card">
    <h2>Visite</h2>
    ${(p.visits||[]).map(x=>`
      <div class="row" data-visit="${x.id}">
        <div>
          <div class="title">${fmt(x.visit_date)}</div>
          <div class="meta">${esc(x.reason||'Visita')} · ${esc(x.clinic||'Clinica non indicata')}</div>
        </div>
        <span>›</span>
      </div>
    `).join('')||'<p class="meta">Nessuna visita</p>'}
  </section>

  <button class="btn fixed" data-new-visit="${p.id}">+ Nuova visita</button>`;
}

function visitDetail(id){
  const p=patients.find(p=>(p.visits||[]).some(v=>v.id===id));
  const v=p?.visits?.find(v=>v.id===id);

  if(!p||!v) return '<section class="card">Visita non trovata</section>';

  const exams=(v.exams||[]);

  return `<section class="card">
    <h2>${fmt(v.visit_date)} · ${esc(p.owners.surname)} – ${esc(p.name)}</h2>
    <div class="meta">${esc(v.reason||'Visita')} · ${esc(v.clinic||'Clinica non indicata')}</div>
  </section>

  <section class="card">
    <h3>Peso</h3>
    <p>${v.weight_kg!=null?esc(v.weight_kg)+' kg':'—'}</p>

    <h3>Anamnesi</h3>
    <p>${esc(v.anamnesis||'—').replace(/\n/g,'<br>')}</p>

    <h3>Esame clinico</h3>
    <p>${esc(v.clinical_exam||'—').replace(/\n/g,'<br>')}</p>

    <h3>Esami</h3>
    ${exams.length?exams.map(e=>`
      <div class="row" ${e.exam_type==='ECG'?`data-open-ecg="${e.id}"`:''}>
        <div>
          <div class="title">${esc(e.exam_type)}</div>
          <div class="meta">${e.exam_type==='ECG'?'Apri il modulo ECG':'Modulo in preparazione'}</div>
        </div>
        ${e.exam_type==='ECG'?'<span>›</span>':''}
      </div>
    `).join(''):'<p class="meta">Nessun esame registrato</p>'}

    <h3>Conclusioni</h3>
    <p>${esc(v.conclusions||'—').replace(/\n/g,'<br>')}</p>

    <h3>Note private</h3>
    <p>${esc(v.notes_private||'—').replace(/\n/g,'<br>')}</p>
  </section>

  <button class="btn" data-edit-visit="${v.id}">Modifica visita</button>
  <button class="btn secondary" data-back-patient="${p.id}">Torna al paziente</button>`;
}

function normalizePWaveDurationMs(value){
  if(value===null||value===undefined||value==='') return '';
  const raw=String(value).trim();
  const numeric=Number(raw.replace(',','.'));
  if(Number.isFinite(numeric) && numeric>0 && numeric<1){
    return String(Math.round(numeric*1000));
  }
  return raw;
}

function normalizePrMode(value){
  return ({
    normal:'normal_constant',
    prolonged:'prolonged_constant',
    shortened:'shortened_constant',
    variable:'variable_nonprogressive'
  })[value]||value||'';
}

function getEcgState(examId,exam=null){
  if(!ecgUi[examId]){
    const saved=exam?.report_data||{};
    ecgUi[examId]={
      openStep:null,
      pToQrs:saved.pToQrs||'',
      qrsToP:saved.qrsToP||'',
      heartRate:saved.heartRate||'',
      rhythmOrigin:saved.rhythmOrigin||'',
      rhythmRegularity:saved.rhythmRegularity||'',
      pWaveMode:saved.pWaveMode||'',
      pWaveFindings:Array.isArray(saved.pWaveFindings)?saved.pWaveFindings:[],
      pWaveDuration:normalizePWaveDurationMs(saved.pWaveDuration),
      pWaveAmplitude:saved.pWaveAmplitude||'',
      qrsMode:saved.qrsMode||'',
      qrsFindings:Array.isArray(saved.qrsFindings)?saved.qrsFindings:[],
      qrsDuration:saved.qrsDuration||'',
      qrsAmplitude:saved.qrsAmplitude||'',
      prMode:normalizePrMode(saved.prMode),
      prValue:saved.prValue||'',
      wanderingDecision:saved.wanderingDecision||'',
      bav1Decision:saved.bav1Decision||'',
      conductionMode:saved.conductionMode||'',
      bav2Subtype:saved.bav2Subtype||'',
      bav2Decision:saved.bav2Decision||'',
      ectopyMode:saved.ectopyMode||'',
      ectopyOrigin:saved.ectopyOrigin||'',
      ectopyPatterns:Array.isArray(saved.ectopyPatterns)?saved.ectopyPatterns:[],
      ectopyMorphology:saved.ectopyMorphology||'',
      ectopyCount:saved.ectopyCount||'',
      stSegment:saved.stSegment||'',
      stDeviation:saved.stDeviation||'',
      tWaveMorphology:saved.tWaveMorphology||(saved.tWaveMode==='normal'?'regular':saved.tWaveMode==='detail'?'altered':''),
      tWavePolarity:saved.tWavePolarity||'',
      tWaveFindings:Array.isArray(saved.tWaveFindings)?saved.tWaveFindings:[],
      tWaveAmplitude:saved.tWaveAmplitude||'',
      qtMode:saved.qtMode||'',
      qtValue:saved.qtValue||'',
      qtcValue:saved.qtcValue||'',
      qtcFormula:saved.qtcFormula||'',
      axisEvaluability:saved.axisEvaluability||'',
      axisPosition:saved.axisPosition||'right_lateral',
      axisMethod:saved.axisMethod||'',
      axisValue:saved.axisValue||'',
      axisDecision:saved.axisDecision||'',
      diagnosisManual:saved.diagnosisManual||'',
      diagnosisFinal:saved.diagnosisFinal||saved.diagnosisManual||'',
      diagnosisType:saved.diagnosisType||'',
      diagnosisReviewed:saved.diagnosisReviewed||'',
      recommendationSelections:Array.isArray(saved.recommendationSelections)?saved.recommendationSelections:[],
      recommendationText:saved.recommendationText||'',
      description:exam?.description||saved.description||'',
      interpretation:exam?.interpretation||saved.interpretation||'',
      recommendations:exam?.recommendations||saved.recommendations||'',
      saved:false,
      saving:false
    };
  }
  return ecgUi[examId];
}

function pqrsDot(state){
  if(!state.pToQrs||!state.qrsToP) return '⚪';
  if(state.pToQrs==='yes'&&state.qrsToP==='yes') return '🟢';
  return '🟠';
}

function pqrsDescription(state){
  if(!state.pToQrs&&!state.qrsToP) return '';
  if(state.pToQrs==='yes'&&state.qrsToP==='yes'){
    return 'Ogni onda P è seguita da un complesso QRS e ogni complesso QRS è preceduto da un’onda P.';
  }
  const parts=[];
  if(state.pToQrs==='no') parts.push('non tutte le onde P sono seguite da un complesso QRS');
  if(state.qrsToP==='no') parts.push('non tutti i complessi QRS sono preceduti da un’onda P');
  return parts.length?`Si osserva che ${parts.join(' e ')}.`:'';
}

function rhythmLabel(value){
  return ({
    sinusale:'sinusale',
    atriale:'atriale',
    giunzionale:'giunzionale',
    ventricolare:'ventricolare',
    fibrillazione_atriale:'da fibrillazione atriale',
    flutter_atriale:'da flutter atriale',
    altro:'non classificato'
  })[value]||'';
}

function regularityLabel(value){
  return ({
    regolare:'regolare',
    regolarmente_irregolare:'regolarmente irregolare',
    irregolare:'irregolare'
  })[value]||'';
}

function buildEcgDescription(state){
  const parts=[];
  const pq=pqrsDescription(state);
  if(pq) parts.push(pq);

  if(state.heartRate){
    parts.push(`Frequenza cardiaca di ${state.heartRate} bpm.`);
  }

  if(state.rhythmOrigin||state.rhythmRegularity){
    const origin=rhythmLabel(state.rhythmOrigin);
    const reg=regularityLabel(state.rhythmRegularity);
    if(origin&&reg) parts.push(`Ritmo ${origin} ${reg}.`);
    else if(origin) parts.push(`Ritmo ${origin}.`);
    else if(reg) parts.push(`Ritmo ${reg}.`);
  }

  if(state.pWaveMode==='normal'){
    parts.push('Onda P nei limiti della norma.');
  }else if(state.pWaveMode==='detail'){
    if(state.pWaveFindings.length){
      parts.push(`Onda P ${state.pWaveFindings.map(pWaveFindingLabel).join(', ')}.`);
    }else{
      parts.push('Onda P da approfondire.');
    }
  }

  const measures=[];
  if(state.pWaveDuration) measures.push(`durata ${state.pWaveDuration} ms`);
  if(state.pWaveAmplitude) measures.push(`ampiezza ${state.pWaveAmplitude} mV`);
  if(measures.length) parts.push(`Misure dell’onda P: ${measures.join(', ')}.`);

  if(state.qrsMode==='normal'){
    parts.push('Complessi QRS nei limiti della norma.');
  }else if(state.qrsMode==='detail'){
    if(state.qrsFindings.length){
      parts.push(`Complessi QRS ${state.qrsFindings.map(qrsFindingLabel).join(', ')}.`);
    }else{
      parts.push('Complessi QRS da approfondire.');
    }
  }

  const qrsMeasures=[];
  if(state.qrsDuration) qrsMeasures.push(`durata ${state.qrsDuration} ms`);
  if(state.qrsAmplitude) qrsMeasures.push(`ampiezza ${state.qrsAmplitude} mV`);
  if(qrsMeasures.length) parts.push(`Misure del QRS: ${qrsMeasures.join(', ')}.`);

  if(state.prMode){
    const label=prLabel(state.prMode);
    if(state.prMode==='not_evaluable'){
      parts.push('Intervallo PR non valutabile.');
    }else if(state.prValue){
      parts.push(`Intervallo PR ${label}, pari a ${state.prValue} ms.`);
    }else{
      parts.push(`Intervallo PR ${label}.`);
    }
  }else if(state.prValue){
    parts.push(`Intervallo PR pari a ${state.prValue} ms.`);
  }

  if(state.ectopyMode==='none'){
    parts.push('Non si rilevano battiti ectopici nel tracciato registrato.');
  }else if(state.ectopyMode==='present'){
    const origin=ectopyOriginLabel(state.ectopyOrigin);
    const patterns=state.ectopyPatterns.map(ectopyPatternLabel);
    const morphology=ectopyMorphologyLabel(state.ectopyMorphology);

    let sentence='Si rilevano extrasistoli';
    if(origin) sentence+=` ${origin}`;
    if(patterns.length) sentence+=` ${patterns.join(', ')}`;
    if(morphology) sentence+=`, ${morphology}`;
    if(state.ectopyCount) sentence+=` (n. ${state.ectopyCount})`;
    parts.push(sentence+'.');
  }

  if(state.stSegment){
    const st=stSegmentLabel(state.stSegment);
    if((state.stSegment==='elevated'||state.stSegment==='depressed')&&state.stDeviation){
      parts.push(`Segmento ST ${st}, con deviazione di ${String(state.stDeviation).replace('.',',')} mV rispetto alla linea isoelettrica.`);
    }else{
      parts.push(`Segmento ST ${st}.`);
    }
  }

  if(state.tWaveMorphology||state.tWavePolarity||state.tWaveFindings.length||state.tWaveAmplitude){
    const polarity=tWavePolarityLabel(state.tWavePolarity);
    const findings=state.tWaveFindings.map(tWaveFindingLabel);
    let sentence='Onda T';
    if(state.tWaveMorphology==='regular') sentence+=' di morfologia regolare';
    if(state.tWaveMorphology==='altered') sentence+=' di morfologia alterata';
    if(polarity) sentence+=`${state.tWaveMorphology?', ': ' '}${polarity}`;
    if(findings.length) sentence+=`${state.tWaveMorphology||polarity?', ': ' '}${findings.join(', ')}`;
    if(state.tWaveAmplitude) sentence+=` (ampiezza ${String(state.tWaveAmplitude).replace('.',',')} mV)`;
    parts.push(sentence+'.');
  }

  if(state.qtMode){
    const label=qtLabel(state.qtMode);
    if(state.qtMode==='not_evaluable'){
      parts.push('Intervallo QT non valutabile.');
    }else if(state.qtValue){
      parts.push(`Intervallo QT ${label}, pari a ${String(state.qtValue).replace('.',',')} ms.`);
    }else{
      parts.push(`Intervallo QT ${label}.`);
    }
  }else if(state.qtValue){
    parts.push(`Intervallo QT pari a ${String(state.qtValue).replace('.',',')} ms.`);
  }

  if(state.qtcValue){
    const formula=qtcFormulaLabel(state.qtcFormula);
    parts.push(`QT corretto pari a ${String(state.qtcValue).replace('.',',')} ms${formula?` secondo ${formula}`:''}.`);
  }

  if(state.axisEvaluability==='not_evaluable'){
    parts.push('Asse elettrico medio del QRS non valutabile.');
  }else if(state.axisEvaluability==='evaluable'){
    const formatted=formatAxisValue(state.axisValue);
    const method=axisMethodLabel(state.axisMethod);
    if(formatted){
      const position=axisPositionLabel(state.axisPosition);
      parts.push(`Asse elettrico medio del QRS pari a ${formatted}${method?`, determinato mediante ${method}`:''}${position?`, con paziente in ${position}`:''}.`);
    }else if(method){
      parts.push(`Asse elettrico medio del QRS valutabile mediante ${method}.`);
    }
  }

  return parts.join(' ');
}

function fcDot(state){
  return state.heartRate?'🟢':'⚪';
}

function rhythmDot(state){
  if(state.rhythmOrigin&&state.rhythmRegularity) return '🟢';
  if(state.rhythmOrigin||state.rhythmRegularity) return '🟠';
  return '⚪';
}

function pWaveFindingLabel(value){
  return ({
    ampiezza_aumentata:'aumentata in ampiezza',
    durata_aumentata:'aumentata in durata',
    bifida:'bifida',
    negativa:'negativa',
    assente:'assente',
    variabile:'variabile',
    altro:'con altra alterazione'
  })[value]||value;
}

function pWaveDot(state){
  if(state.pWaveMode==='normal') return '🟢';
  if(state.pWaveMode==='detail'&&state.pWaveFindings.length) return '🟠';
  if(state.pWaveMode==='detail') return '🟠';
  return '⚪';
}

function qrsFindingLabel(value){
  return ({
    durata_aumentata:'aumentato in durata',
    ampiezza_aumentata:'aumentato in ampiezza',
    bassa_ampiezza:'di bassa ampiezza',
    morfologia_aberrante:'di morfologia aberrante',
    blocco_branca_destra:'compatibile con blocco di branca destra',
    blocco_branca_sinistra:'compatibile con blocco di branca sinistra',
    variabile:'variabile',
    altro:'con altra alterazione'
  })[value]||value;
}

function qrsDot(state){
  if(state.qrsMode==='normal') return '🟢';
  if(state.qrsMode==='detail') return '🟠';
  return '⚪';
}

function prLabel(value){
  return ({
    normal_constant:'normale e costante nei battiti condotti',
    prolonged_constant:'allungato e costante nei battiti condotti',
    shortened_constant:'accorciato e costante nei battiti condotti',
    progressive:'progressivamente allungato nei battiti condotti',
    variable_nonprogressive:'variabile senza andamento progressivo nei battiti condotti',
    not_evaluable:'non valutabile'
  })[value]||'';
}

function prDot(state){
  if(state.prMode==='normal_constant') return '🟢';
  if(state.prMode) return '🟠';
  return '⚪';
}

function wanderingSuggested(state){
  return state.rhythmOrigin==='sinusale'
    && state.rhythmRegularity==='regolarmente_irregolare'
    && state.pWaveMode==='detail'
    && Array.isArray(state.pWaveFindings)
    && state.pWaveFindings.includes('variabile');
}

function bav1Suggested(state){
  return state.pToQrs==='yes'
    && state.qrsToP==='yes'
    && state.prMode==='prolonged_constant';
}

function bav2Suggested(state){
  return state.pToQrs==='no'
    && state.qrsToP==='yes';
}

function bav2SubtypeLabel(value){
  return ({
    mobitz1:'Mobitz I (Wenckebach)',
    mobitz2:'Mobitz II',
    two_to_one:'2:1',
    high_grade:'alto grado',
    unclassified:'non classificabile'
  })[value]||'';
}

function conductionDot(state){
  if(state.conductionMode==='none') return '🟢';
  if(state.conductionMode) return '🟠';
  if(bav2Suggested(state)) return '🟠';
  return '⚪';
}

function ectopyOriginLabel(value){
  return ({
    supraventricular:'sopraventricolari',
    ventricular:'ventricolari',
    uncertain:'di origine non determinabile'
  })[value]||'';
}

function ectopyPatternLabel(value){
  return ({
    isolated:'isolate',
    couplets:'in coppie',
    triplets:'in triplette',
    runs:'in salve',
    bigeminy:'con pattern di bigeminismo',
    trigeminy:'con pattern di trigeminismo'
  })[value]||value;
}

function ectopyMorphologyLabel(value){
  return ({
    monomorphic:'monomorfe',
    polymorphic:'polimorfe'
  })[value]||'';
}

function ectopyDot(state){
  if(state.ectopyMode==='none') return '🟢';
  if(state.ectopyMode==='present') return '🟠';
  return '⚪';
}

function tWaveFindingLabel(value){
  return ({
    flattened:'appiattita',
    notched:'incisurata',
    asymmetric:'asimmetrica',
    variable:'variabile',
    other:'con altra alterazione'
  })[value]||value;
}

function tWavePolarityLabel(value){
  return ({
    positive:'positiva',
    negative:'negativa',
    biphasic:'bifasica',
    variable:'variabile'
  })[value]||'';
}

function stSegmentLabel(value){
  return ({
    isoelectric:'isoelettrico',
    elevated:'sopraslivellato',
    depressed:'sottoslivellato',
    not_evaluable:'non valutabile'
  })[value]||'';
}

function tWaveDot(state){
  if(!state.stSegment&&!state.tWaveMorphology&&!state.tWavePolarity) return '⚪';
  if(state.stSegment==='elevated'||state.stSegment==='depressed'||state.tWaveMorphology==='altered') return '🟠';
  if(state.stSegment==='isoelectric'&&state.tWaveMorphology==='regular') return '🟢';
  return '🟠';
}

function qtLabel(value){
  return ({
    normal:'nei limiti della norma',
    prolonged:'allungato',
    shortened:'accorciato',
    not_evaluable:'non valutabile'
  })[value]||'';
}

function qtcFormulaLabel(value){
  return ({
    bazett:'Bazett',
    fridericia:'Fridericia',
    other:'altra formula'
  })[value]||'';
}

function qtDot(state){
  if(state.qtMode==='normal') return '🟢';
  if(state.qtMode) return '🟠';
  if(state.qtValue||state.qtcValue) return '🟠';
  return '⚪';
}

function normalizeAxisValue(value){
  if(value===null||value===undefined||String(value).trim()==='') return null;
  const numeric=Number(String(value).trim().replace(',','.').replace('°','').replace('+',''));
  if(!Number.isFinite(numeric)) return null;
  let angle=((numeric+180)%360+360)%360-180;
  if(angle===-180) angle=180;
  return Math.round(angle);
}

function formatAxisValue(value){
  const angle=normalizeAxisValue(value);
  if(angle===null) return '';
  return `${angle>0?'+':''}${angle}°`;
}

function axisMethodLabel(value){
  return ({
    quadrants:'metodo dei quadranti (DI/aVF)',
    leads:'calcolo mediante le derivazioni periferiche',
    ruler:'righello/diagramma esassiale',
    other:'altro metodo'
  })[value]||'';
}

function axisPositionLabel(value){
  return ({
    right_lateral:'decubito laterale destro',
    standing:'in stazione quadrupedale',
    sitting:'seduto'
  })[value]||'';
}

function axisReferenceRange(state,species){
  const s=String(species||'').toLowerCase();
  if(!s.includes('can')) return null;

  // Range in piedi/seduto inserito provvisoriamente e da verificare sul testo di riferimento.
  if(state.axisPosition==='standing'||state.axisPosition==='sitting'){
    return {min:0,max:100,provisional:true};
  }
  return {min:40,max:100,provisional:false};
}

function axisProposal(state,species){
  if(state.axisEvaluability!=='evaluable') return null;
  const angle=normalizeAxisValue(state.axisValue);
  if(angle===null) return null;

  const range=axisReferenceRange(state,species);
  if(!range) return {
    code:'unclassified',
    label:'Asse elettrico da interpretare',
    sentence:`Asse elettrico medio del QRS pari a ${formatAxisValue(angle)}.`,
    range:'Nessun intervallo orientativo automatico disponibile per questa specie.'
  };

  const {min,max,provisional}=range;
  const position=axisPositionLabel(state.axisPosition);
  const suffix=provisional?' Range provvisorio da verificare sulla fonte bibliografica.':'';

  if(angle>=min&&angle<=max){
    return {
      code:'normal',
      label:'Asse elettrico nei limiti orientativi',
      sentence:'Asse elettrico medio del QRS nei limiti orientativi per la posizione di registrazione.',
      range:`Intervallo di riferimento orientativo per ${position}: ${min>0?'+':''}${min}° a +${max}°.${suffix}`
    };
  }

  if(angle<min){
    return {
      code:'left',
      label:'Possibile deviazione assiale sinistra',
      sentence:'Deviazione assiale sinistra.',
      range:`Valore esterno all’intervallo orientativo per ${position}: ${min>0?'+':''}${min}° a +${max}°.${suffix}`
    };
  }

  return {
    code:'right',
    label:'Possibile deviazione assiale destra',
    sentence:'Deviazione assiale destra.',
    range:`Valore esterno all’intervallo orientativo per ${position}: ${min>0?'+':''}${min}° a +${max}°.${suffix}`
  };
}

function axisDot(state,species){
  if(state.axisEvaluability==='not_evaluable') return '🟠';
  const proposal=axisProposal(state,species);
  if(!proposal) return state.axisEvaluability==='evaluable'?'🟠':'⚪';
  if(state.axisDecision==='confirm'&&proposal.code==='normal') return '🟢';
  return '🟠';
}

function axisDiagram(state,examId,species){
  const angle=normalizeAxisValue(state.axisValue);
  const radians=(angle===null?0:angle)*Math.PI/180;
  const cx=160,cy=160,r=118;
  const x=angle===null?cx:cx+Math.cos(radians)*r;
  const y=angle===null?cy:cy+Math.sin(radians)*r;

  const axes=[
    [0,'0° I'],[30,'30°'],[60,'60° II'],[90,'90° aVF'],
    [120,'120° III'],[150,'150°'],[180,'180°'],
    [-150,'-150° aVR'],[-120,'-120°'],[-90,'-90°'],
    [-60,'-60°'],[-30,'-30° aVL']
  ];

  const lines=axes.map(([deg,label])=>{
    const rad=deg*Math.PI/180;
    const x1=cx-Math.cos(rad)*106;
    const y1=cy-Math.sin(rad)*106;
    const x2=cx+Math.cos(rad)*106;
    const y2=cy+Math.sin(rad)*106;
    const lx=cx+Math.cos(rad)*132;
    const ly=cy+Math.sin(rad)*132;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
      stroke="#b9ccd3" stroke-width="${deg%90===0?1.8:1}"/>
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle"
        font-size="10" fill="#536b7a">${label}</text>`;
  }).join('');

  const range=axisReferenceRange(state,species);
  let sector='';
  if(range){
    const start=range.min*Math.PI/180;
    const end=range.max*Math.PI/180;
    const sr=113;
    const sx=cx+Math.cos(start)*sr;
    const sy=cy+Math.sin(start)*sr;
    const ex=cx+Math.cos(end)*sr;
    const ey=cy+Math.sin(end)*sr;
    const largeArc=(range.max-range.min)>180?1:0;
    sector=`<path d="M ${cx} ${cy} L ${sx.toFixed(1)} ${sy.toFixed(1)}
      A ${sr} ${sr} 0 ${largeArc} 1 ${ex.toFixed(1)} ${ey.toFixed(1)} Z"
      fill="#63b77a" opacity="0.20"/>`;
  }

  return `<div style="display:flex;justify-content:center;margin:14px 0">
    <svg viewBox="0 0 320 320" width="100%" style="max-width:460px;touch-action:none;user-select:none"
      data-axis-pad="${examId}" role="img" aria-label="Diagramma interattivo dell’asse elettrico">
      <circle cx="160" cy="160" r="116" fill="#f7fbfc" stroke="#0f5b6b" stroke-width="2"/>
      ${sector}
      ${lines}

      <path d="M160 121
               C146 103 118 108 118 134
               C118 161 145 182 160 199
               C175 182 202 161 202 134
               C202 108 174 103 160 121Z"
        fill="#f3a18d" stroke="#b85d54" stroke-width="2" opacity="0.92"/>
      <path d="M160 125 C152 116 139 117 136 130 C133 145 147 159 160 173"
        fill="none" stroke="#fff4ef" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M160 125 C168 116 181 117 184 130 C187 145 173 159 160 173"
        fill="none" stroke="#fff4ef" stroke-width="4.5" stroke-linecap="round"/>

      ${angle!==null?`
        <defs>
          <marker id="axisArrow-${examId}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L7,3 z" fill="#c0392b"/>
          </marker>
        </defs>
        <line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"
          stroke="#c0392b" stroke-width="4" stroke-linecap="round"
          marker-end="url(#axisArrow-${examId})"/>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="#c0392b" stroke="white" stroke-width="2"/>
      `:''}
      <circle cx="160" cy="160" r="4" fill="#0f5b6b"/>
    </svg>
  </div>`;
}

function decisionLabel(value){
  return ({
    confirm:'Confermo',
    reject:'Non confermo',
    inconclusive:'Non conclusivo'
  })[value]||'';
}

function ectopyDiagnosis(state){
  if(state.ectopyMode!=='present') return '';
  const origin=({
    supraventricular:'Extrasistolia sopraventricolare',
    ventricular:'Extrasistolia ventricolare',
    uncertain:'Extrasistolia di origine non determinabile'
  })[state.ectopyOrigin]||'Extrasistolia';

  const patterns=(state.ectopyPatterns||[]).map(value=>({
    isolated:'isolata',
    couplets:'in coppie',
    triplets:'in triplette',
    runs:'in salve',
    bigeminy:'con bigeminismo',
    trigeminy:'con trigeminismo'
  })[value]).filter(Boolean);

  const morphology=({
    monomorphic:'monomorfa',
    polymorphic:'polimorfa'
  })[state.ectopyMorphology]||'';

  let result=origin;
  if(morphology) result+=` ${morphology}`;
  if(patterns.length) result+=`, ${patterns.join(', ')}`;
  if(state.ectopyCount) result+=` (${state.ectopyCount} complessi osservati)`;
  return result+'.';
}

function buildClinicalFindings(state,species=''){
  const findings=[];
  const add=(code,category,label,diagnosticText,abnormal=true,meta={})=>{
    findings.push({code,category,label,diagnosticText,abnormal,...meta});
  };

  if(state.rhythmOrigin==='sinusale'){
    if(wanderingSuggested(state)&&state.wanderingDecision==='confirm'){
      add('wandering_pacemaker','rhythm','Pacemaker migrante',
        'Ritmo sinusale con pacemaker migrante (wandering pacemaker).',true);
    }else{
      add('sinus_rhythm','rhythm','Ritmo sinusale','Ritmo sinusale.',false);
    }
  }else if(state.rhythmOrigin==='fibrillazione_atriale'){
    add('atrial_fibrillation','rhythm','Fibrillazione atriale','Fibrillazione atriale.',true);
  }else if(state.rhythmOrigin==='flutter_atriale'){
    add('atrial_flutter','rhythm','Flutter atriale','Flutter atriale.',true);
  }else if(state.rhythmOrigin==='atriale'){
    add('atrial_rhythm','rhythm','Ritmo atriale','Ritmo atriale.',true);
  }else if(state.rhythmOrigin==='giunzionale'){
    add('junctional_rhythm','rhythm','Ritmo giunzionale','Ritmo giunzionale.',true);
  }else if(state.rhythmOrigin==='ventricolare'){
    add('ventricular_rhythm','rhythm','Ritmo ventricolare','Ritmo ventricolare.',true);
  }

  if(state.bav1Decision==='confirm'){
    add('av_block_1','conduction','BAV I grado','Blocco atrioventricolare di I grado.',true);
  }
  if(state.bav2Decision==='confirm'){
    const subtype=bav2SubtypeLabel(state.bav2Subtype);
    add('av_block_2','conduction',subtype?`BAV II grado — ${subtype}`:'BAV II grado',
      subtype?`Blocco atrioventricolare di II grado, ${subtype}.`:'Blocco atrioventricolare di II grado.',
      true,{subtype:state.bav2Subtype||''});
  }else if(state.conductionMode==='advanced'){
    add('advanced_av_block','conduction','BAV avanzato','Blocco atrioventricolare avanzato.',true);
  }else if(state.conductionMode==='complete'){
    add('complete_av_block','conduction','BAV completo','Blocco atrioventricolare completo.',true);
  }else if(state.conductionMode==='none'){
    add('normal_av_conduction','conduction','Conduzione AV nei limiti',
      'Assenza di disturbi della conduzione atrioventricolare.',false);
  }

  if(state.ectopyMode==='present'){
    const ectopyText=ectopyDiagnosis(state);
    add(
      state.ectopyOrigin==='ventricular'?'ventricular_ectopy':
      state.ectopyOrigin==='supraventricular'?'supraventricular_ectopy':'ectopy_uncertain',
      'ectopy',ectopyText.replace(/\.$/,''),ectopyText,true,
      {origin:state.ectopyOrigin||'',morphology:state.ectopyMorphology||'',
       patterns:Array.isArray(state.ectopyPatterns)?state.ectopyPatterns:[],
       count:state.ectopyCount||''}
    );
  }else if(state.ectopyMode==='absent'){
    add('no_ectopy','ectopy','Assenza di battiti ectopici',
      'Assenza di battiti ectopici nel tracciato registrato.',false);
  }

  const axis=axisProposal(state,species);
  if(axis&&state.axisDecision==='confirm'){
    if(axis.code==='normal'){
      add('normal_axis','axis','Asse elettrico nei limiti',
        'Asse elettrico medio del QRS nei limiti orientativi per la posizione di registrazione.',false);
    }else{
      add(axis.code==='left'?'left_axis_deviation':'right_axis_deviation',
        'axis',axis.label,axis.sentence,true);
    }
  }

  if(state.qtMode==='normal'){
    add('normal_qt','qt','QT nei limiti','Intervallo QT nei limiti della norma.',false);
  }else if(state.qtMode==='prolonged'){
    add('prolonged_qt','qt','QT allungato','Intervallo QT allungato.',true);
  }else if(state.qtMode==='shortened'){
    add('short_qt','qt','QT accorciato','Intervallo QT accorciato.',true);
  }else if(state.qtMode==='not_evaluable'){
    add('qt_not_evaluable','qt','QT non valutabile','Intervallo QT non valutabile.',true);
  }

  return findings;
}

function buildDiagnosisItems(state,species=''){
  return buildClinicalFindings(state,species)
    .filter(f=>f.abnormal)
    .map(f=>f.diagnosticText);
}

function buildAutomaticDiagnosis(state,species=''){
  const findings=buildClinicalFindings(state,species);
  const abnormal=findings.filter(f=>f.abnormal);
  const normal=findings.filter(f=>!f.abnormal);

  const hasEnoughNormalData =
    findings.some(f=>f.category==='rhythm') &&
    findings.some(f=>f.category==='conduction') &&
    findings.some(f=>f.category==='ectopy') &&
    findings.some(f=>f.category==='axis') &&
    findings.some(f=>f.category==='qt');

  if(!abnormal.length&&hasEnoughNormalData){
    return {summary:'ECG nei limiti della norma.',findings,abnormal,normal};
  }
  if(!abnormal.length){
    return {summary:'',findings,abnormal,normal};
  }

  const phrases=abnormal.map(f=>f.diagnosticText.replace(/\.$/,''));
  const summary=phrases.length===1
    ? phrases[0]+'.'
    : phrases.slice(0,-1).join(', ')+' e '+phrases[phrases.length-1]+'.';

  return {summary,findings,abnormal,normal};
}

function automaticDiagnosisText(state,species=''){
  const auto=buildAutomaticDiagnosis(state,species);
  return auto.summary||auto.items.join(' ');
}

function clinicalFindingCodes(state,species=''){
  return new Set(buildClinicalFindings(state,species).map(f=>f.code));
}

function buildConsistencyChecks(state,species=''){
  const checks=[];
  const add=(level,title,message,modules=[])=>{
    checks.push({level,title,message,modules});
  };

  const pAbsent =
    state.pWaveMode==='detail' &&
    Array.isArray(state.pWaveFindings) &&
    state.pWaveFindings.includes('assente');

  const pNormal = state.pWaveMode==='normal';

  const prMeasured = Boolean(String(state.prValue||'').trim());

  const qrsWide =
    state.qrsMode==='detail' &&
    Array.isArray(state.qrsFindings) &&
    state.qrsFindings.includes('durata_aumentata');

  const ventricularEctopy =
    state.ectopyMode==='present' &&
    state.ectopyOrigin==='ventricular';

  const allPConducted = state.pToQrs==='yes';

  if(state.rhythmOrigin==='sinusale'&&pAbsent){
    add(
      'error',
      'Ritmo sinusale senza onde P',
      'Il ritmo sinusale richiede onde P riconoscibili.',
      ['Ritmo','Onda P']
    );
  }

  if(state.rhythmOrigin==='fibrillazione_atriale'&&prMeasured){
    add(
      'error',
      'PR misurato in fibrillazione atriale',
      'In fibrillazione atriale l’intervallo PR non è misurabile.',
      ['Ritmo','Intervallo PR']
    );
  }

  if(state.rhythmOrigin==='flutter_atriale'&&prMeasured){
    add(
      'error',
      'PR misurato nel flutter atriale',
      'Nel flutter atriale l’intervallo PR generalmente non è valutabile.',
      ['Ritmo','Intervallo PR']
    );
  }

  if(state.conductionMode==='complete'&&allPConducted){
    add(
      'error',
      'BAV completo con conduzione 1:1',
      'Nel blocco atrioventricolare completo deve essere presente dissociazione atrio-ventricolare.',
      ['Relazione P–QRS','Conduzione']
    );
  }

  if(state.wanderingDecision==='confirm'&&pNormal){
    add(
      'error',
      'Wandering pacemaker con onda P normale',
      'Il pacemaker migrante richiede variazioni della morfologia dell’onda P.',
      ['Ritmo','Onda P']
    );
  }

  if(state.bav1Decision==='confirm'&&state.prMode!=='prolonged_constant'){
    add(
      'error',
      'BAV I con PR non allungato',
      'Il blocco atrioventricolare di I grado richiede un intervallo PR allungato e costante.',
      ['Intervallo PR','Conduzione']
    );
  }

  if(state.bav2Decision==='confirm'&&state.prMode==='normal_constant'){
    add(
      'info',
      'Verificare il sottotipo di BAV II',
      'Nel BAV II il PR può essere normale e costante nei battiti condotti, come nel Mobitz II; verificare che il sottotipo selezionato sia coerente.',
      ['Intervallo PR','Conduzione']
    );
  }

  if(qrsWide&&state.conductionMode==='none'&&state.ectopyMode==='absent'){
    add(
      'warning',
      'QRS largo senza causa indicata',
      'Valutare la presenza di un blocco di branca o di un’origine ventricolare.',
      ['QRS','Conduzione','Extrasistoli']
    );
  }

  if(ventricularEctopy&&state.qrsMode==='normal'){
    add(
      'info',
      'Extrasistolia ventricolare con QRS descritto come normale',
      'Verificare che la classificazione dell’extrasistole e la morfologia del QRS siano coerenti.',
      ['QRS','Extrasistoli']
    );
  }

  return checks;
}

function consistencyDot(state,species=''){
  const checks=buildConsistencyChecks(state,species);
  if(!checks.length) return '🟢';
  if(checks.some(c=>c.level==='error')) return '🟠';
  return '🟡';
}

function recommendationLabel(code){
  return ({
    echocardiography:'Ecocardiografia',
    ecg_control:'ECG di controllo',
    holter:'Holter 24 ore',
    atropine_test:'Test all’atropina',
    continuous_ecg:'Monitoraggio ECG continuo',
    electrolytes:'Elettroliti',
    troponin:'Troponina cardiaca',
    blood_gas:'Emogasanalisi',
    blood_pressure:'Pressione arteriosa',
    thoracic_xrays:'Radiografie toraciche',
    cardiology_consult:'Consulenza cardiologica',
    hospitalization:'Ricovero e monitoraggio',
    none:'Nessun ulteriore approfondimento'
  })[code]||code;
}

function buildAutomaticRecommendations(state,species=''){
  const codes=clinicalFindingCodes(state,species);
  const suggested=new Set();

  if(codes.has('av_block_1')){
    suggested.add('ecg_control');
  }

  if(codes.has('av_block_2')){
    suggested.add('echocardiography');
    suggested.add('atropine_test');
  }

  if(codes.has('complete_av_block')||codes.has('advanced_av_block')){
    suggested.add('echocardiography');
    suggested.add('hospitalization');
    suggested.add('continuous_ecg');
  }

  if(codes.has('ventricular_ectopy')){
    suggested.add('echocardiography');

    const patterns=Array.isArray(state.ectopyPatterns)?state.ectopyPatterns:[];
    const frequentPattern=
      patterns.includes('couplets') ||
      patterns.includes('triplets') ||
      patterns.includes('runs') ||
      patterns.includes('bigeminy') ||
      patterns.includes('trigeminy') ||
      state.ectopyMorphology==='polymorphic';

    if(frequentPattern){
      suggested.add('holter');
      suggested.add('electrolytes');
    }
  }

  if(codes.has('prolonged_qt')){
    suggested.add('electrolytes');
  }

  if(
    state.stSegment==='elevated' ||
    state.stSegment==='depressed' ||
    state.tWaveMorphology==='altered'
  ){
    suggested.add('echocardiography');
    suggested.add('troponin');
  }

  const autoDiagnosis=buildAutomaticDiagnosis(state,species);
  if(autoDiagnosis.summary==='ECG nei limiti della norma.'){
    suggested.add('none');
  }

  if(suggested.size>1&&suggested.has('none')){
    suggested.delete('none');
  }

  return [...suggested];
}

function buildRecommendationText(selections){
  const selected=(Array.isArray(selections)?selections:[])
    .filter(Boolean);

  if(!selected.length) return '';

  if(selected.includes('none')){
    return 'Sulla base del solo esame elettrocardiografico non si ritengono necessari ulteriori approfondimenti.';
  }

  const labels=selected.map(recommendationLabel);
  let joined='';
  if(labels.length===1){
    joined=labels[0];
  }else if(labels.length===2){
    joined=`${labels[0]} e ${labels[1]}`;
  }else{
    joined=`${labels.slice(0,-1).join(', ')} e ${labels[labels.length-1]}`;
  }

  return `Si consiglia l’esecuzione di ${joined} al fine di approfondire i reperti elettrocardiografici rilevati.`;
}

function recommendationsDot(state,species=''){
  const auto=buildAutomaticRecommendations(state,species);
  const selected=Array.isArray(state.recommendationSelections)?state.recommendationSelections:[];
  if(selected.length) return '🟢';
  if(auto.length) return '🟠';
  return '⚪';
}

function diagnosisDot(state,species=''){
  const items=buildDiagnosisItems(state,species);
  if(state.diagnosisReviewed==='confirmed') return '🟢';
  if(items.length||state.diagnosisFinal||state.diagnosisManual) return '🟠';
  return '⚪';
}

function buildEcgInterpretation(state,species=''){
  const parts=[];

  if(wanderingSuggested(state)){
    if(state.wanderingDecision==='confirm'){
      parts.push('Ritmo sinusale con pacemaker migrante (wandering pacemaker).');
    }else if(state.wanderingDecision==='inconclusive'){
      parts.push('Reperti suggestivi ma non conclusivi per pacemaker migrante (wandering pacemaker).');
    }
  }

  if(bav1Suggested(state)){
    if(state.bav1Decision==='confirm'){
      parts.push('Blocco atrioventricolare di I grado.');
    }else if(state.bav1Decision==='inconclusive'){
      parts.push('Intervallo PR prolungato, reperto non conclusivo per blocco atrioventricolare di I grado.');
    }
  }

  if(bav2Suggested(state)){
    const subtype=bav2SubtypeLabel(state.bav2Subtype);
    if(state.bav2Decision==='confirm'){
      parts.push(subtype
        ? `Blocco atrioventricolare di II grado, ${subtype}.`
        : 'Blocco atrioventricolare di II grado.');
    }else if(state.bav2Decision==='inconclusive'){
      parts.push(subtype
        ? `Disturbo della conduzione atrioventricolare suggestivo ma non conclusivo per BAV di II grado, ${subtype}.`
        : 'Disturbo della conduzione atrioventricolare suggestivo ma non conclusivo per BAV di II grado.');
    }
  }

  const axis=axisProposal(state,species);
  if(axis&&state.axisDecision==='confirm'){
    parts.push(axis.sentence);
  }else if(axis&&state.axisDecision==='inconclusive'){
    parts.push(`Valore dell’asse elettrico suggestivo ma non conclusivo: ${axis.sentence.charAt(0).toLowerCase()+axis.sentence.slice(1)}`);
  }

  return [...new Set(parts)].join(' ');
}

function speciesForExam(examId){
  const patient=patients.find(p=>(p.visits||[]).some(v=>(v.exams||[]).some(e=>e.id===examId)));
  return patient?.species||'';
}

function optionButton(examId,field,value,label,current){
  return `<button type="button"
    class="exam ${current===value?'active':''}"
    data-ecg-choice="${examId}"
    data-field="${field}"
    data-value="${value}">${esc(label)}</button>`;
}

function toggleButton(examId,field,value,label,current){
  return `<button type="button"
    class="exam ${current.includes(value)?'active':''}"
    data-ecg-toggle="${examId}"
    data-field="${field}"
    data-value="${value}">${esc(label)}</button>`;
}

function ecgView(examId){
  const p=patients.find(p=>(p.visits||[]).some(v=>(v.exams||[]).some(e=>e.id===examId)));
  const v=p?.visits?.find(v=>(v.exams||[]).some(e=>e.id===examId));
  const e=v?.exams?.find(e=>e.id===examId);

  if(!p||!v||!e) return '<section class="card">ECG non trovato</section>';

  const state=getEcgState(examId,e);
  const generated=buildEcgDescription(state);

  // Se esistono dati strutturati ECG, rigenera sempre la descrizione automatica.
  // Questo aggiorna anche i vecchi testi salvati in secondi, convertendoli in millisecondi.
  if(generated) state.description=generated;

  const steps=[
    ['P-QRS','Relazione tra onde P e complessi QRS',pqrsDot(state),'pqrs'],
    ['FC','Frequenza cardiaca',fcDot(state),'fc'],
    ['Ritmo','Origine e regolarità',rhythmDot(state),'ritmo'],
    ['Onda P','Morfologia e misure',pWaveDot(state),'onda-p'],
    ['QRS','Morfologia, durata e ampiezza',qrsDot(state),'qrs'],
    ['PR','Intervallo PR',prDot(state),'pr'],
    ['Conduzione','Disturbi della conduzione',conductionDot(state),'conduzione'],
    ['Extrasistoli','Battiti ectopici',ectopyDot(state),'extrasistoli'],
    ['ST–T','Segmento ST e onda T',tWaveDot(state),'onda-t'],
    ['QT','Intervallo QT',qtDot(state),'qt'],
    ['Asse','Asse elettrico',axisDot(state,p.species),'asse'],
    ['Diagnosi','Interpretazione elettrocardiografica',diagnosisDot(state,p.species),'diagnosi'],
    ['Coerenza','Controllo di coerenza ECG',consistencyDot(state,p.species),'coerenza'],
    ['Raccomandazioni','Approfondimenti consigliati',recommendationsDot(state,p.species),'raccomandazioni']
  ];

  return `<section class="card">
    <div class="meta">${fmt(v.visit_date)} · ${esc(p.owners.surname)} – ${esc(p.name)}</div>
    <h2>ECG</h2>
    <p class="meta">Il primo passaggio P–QRS è ora interattivo.</p>
  </section>

  <section class="card">
    <h3>Analisi del tracciato</h3>

    ${steps.map(([title,sub,dot,key])=>`
      <div class="row" data-ecg-step="${key}" data-exam-id="${examId}">
        <div style="display:flex;align-items:center;gap:12px">
          <span class="chip">${dot}</span>
          <div>
            <div class="title">${esc(title)}</div>
            <div class="meta">${esc(sub)}</div>
          </div>
        </div>
        <span>${state.openStep===key?'⌄':'›'}</span>
      </div>

      ${state.openStep===key&&key==='pqrs'?`
        <div class="card" style="margin:12px 0">
          <h3>Relazione P–QRS</h3>

          <p><b>Ogni onda P è seguita da un complesso QRS?</b></p>
          <div class="exam-grid">
            ${optionButton(examId,'pToQrs','yes','Sì',state.pToQrs)}
            ${optionButton(examId,'pToQrs','no','No',state.pToQrs)}
          </div>

          <p><b>Ogni complesso QRS è preceduto da un’onda P?</b></p>
          <div class="exam-grid">
            ${optionButton(examId,'qrsToP','yes','Sì',state.qrsToP)}
            ${optionButton(examId,'qrsToP','no','No',state.qrsToP)}
          </div>

          ${generated?`<div class="notice success">${esc(generated)}</div>`:''}
        </div>
      `:''}

      ${state.openStep===key&&key==='fc'?`
        <div class="card" style="margin:12px 0">
          <h3>Frequenza cardiaca</h3>
          <label>FC (bpm)
            <input type="number" min="1" max="400" inputmode="numeric"
              value="${esc(state.heartRate)}"
              data-ecg-input="${examId}"
              data-field="heartRate"
              placeholder="es. 92">
          </label>
        </div>
      `:''}

      ${state.openStep===key&&key==='ritmo'?`
        <div class="card" style="margin:12px 0">
          <h3>Ritmo</h3>

          <p><b>Origine</b></p>
          <div class="exam-grid">
            ${optionButton(examId,'rhythmOrigin','sinusale','Sinusale',state.rhythmOrigin)}
            ${optionButton(examId,'rhythmOrigin','atriale','Atriale',state.rhythmOrigin)}
            ${optionButton(examId,'rhythmOrigin','giunzionale','Giunzionale',state.rhythmOrigin)}
            ${optionButton(examId,'rhythmOrigin','ventricolare','Ventricolare',state.rhythmOrigin)}
            ${optionButton(examId,'rhythmOrigin','fibrillazione_atriale','Fibrillazione atriale',state.rhythmOrigin)}
            ${optionButton(examId,'rhythmOrigin','flutter_atriale','Flutter atriale',state.rhythmOrigin)}
            ${optionButton(examId,'rhythmOrigin','altro','Altro',state.rhythmOrigin)}
          </div>

          <p><b>Regolarità</b></p>
          <div class="exam-grid">
            ${optionButton(examId,'rhythmRegularity','regolare','Regolare',state.rhythmRegularity)}
            ${optionButton(examId,'rhythmRegularity','regolarmente_irregolare','Regolarmente irregolare',state.rhythmRegularity)}
            ${optionButton(examId,'rhythmRegularity','irregolare','Irregolare',state.rhythmRegularity)}
          </div>
        </div>
      `:''}

      ${state.openStep===key&&key==='onda-p'?`
        <div class="card" style="margin:12px 0">
          <h3>Onda P</h3>

          <div class="exam-grid">
            ${optionButton(examId,'pWaveMode','normal','Normale',state.pWaveMode)}
            ${optionButton(examId,'pWaveMode','detail','Approfondisci',state.pWaveMode)}
          </div>

          ${state.pWaveMode==='detail'?`
            <p><b>Alterazioni rilevate</b></p>
            <div class="exam-grid">
              ${toggleButton(examId,'pWaveFindings','ampiezza_aumentata','Aumentata in ampiezza',state.pWaveFindings)}
              ${toggleButton(examId,'pWaveFindings','durata_aumentata','Aumentata in durata',state.pWaveFindings)}
              ${toggleButton(examId,'pWaveFindings','bifida','Bifida',state.pWaveFindings)}
              ${toggleButton(examId,'pWaveFindings','negativa','Negativa',state.pWaveFindings)}
              ${toggleButton(examId,'pWaveFindings','assente','Assente',state.pWaveFindings)}
              ${toggleButton(examId,'pWaveFindings','variabile','Variabile',state.pWaveFindings)}
              ${toggleButton(examId,'pWaveFindings','altro','Altro',state.pWaveFindings)}
            </div>
          `:''}

          <div class="grid" style="margin-top:16px">
            <label>Durata P (ms)
              <input inputmode="decimal"
                value="${esc(state.pWaveDuration)}"
                data-ecg-input="${examId}"
                data-field="pWaveDuration"
                placeholder="es. 40">
            </label>
            <label>Ampiezza P (mV)
              <input inputmode="decimal"
                value="${esc(state.pWaveAmplitude)}"
                data-ecg-input="${examId}"
                data-field="pWaveAmplitude"
                placeholder="es. 0,3">
            </label>
          </div>
        </div>
      `:''}

      ${state.openStep===key&&key==='qrs'?`
        <div class="card" style="margin:12px 0">
          <h3>QRS</h3>

          <div class="exam-grid">
            ${optionButton(examId,'qrsMode','normal','Normale',state.qrsMode)}
            ${optionButton(examId,'qrsMode','detail','Approfondisci',state.qrsMode)}
          </div>

          ${state.qrsMode==='detail'?`
            <p><b>Alterazioni rilevate</b></p>
            <div class="exam-grid">
              ${toggleButton(examId,'qrsFindings','durata_aumentata','Aumentato in durata',state.qrsFindings)}
              ${toggleButton(examId,'qrsFindings','ampiezza_aumentata','Aumentato in ampiezza',state.qrsFindings)}
              ${toggleButton(examId,'qrsFindings','bassa_ampiezza','Bassa ampiezza',state.qrsFindings)}
              ${toggleButton(examId,'qrsFindings','morfologia_aberrante','Morfologia aberrante',state.qrsFindings)}
              ${toggleButton(examId,'qrsFindings','blocco_branca_destra','Blocco di branca destra',state.qrsFindings)}
              ${toggleButton(examId,'qrsFindings','blocco_branca_sinistra','Blocco di branca sinistra',state.qrsFindings)}
              ${toggleButton(examId,'qrsFindings','variabile','Variabile',state.qrsFindings)}
              ${toggleButton(examId,'qrsFindings','altro','Altro',state.qrsFindings)}
            </div>
          `:''}

          <div class="grid" style="margin-top:16px">
            <label>Durata QRS (ms)
              <input inputmode="decimal"
                value="${esc(state.qrsDuration)}"
                data-ecg-input="${examId}"
                data-field="qrsDuration"
                placeholder="es. 60">
            </label>
            <label>Ampiezza QRS (mV)
              <input inputmode="decimal"
                value="${esc(state.qrsAmplitude)}"
                data-ecg-input="${examId}"
                data-field="qrsAmplitude"
                placeholder="es. 2,5">
            </label>
          </div>
        </div>
      `:''}

      ${state.openStep===key&&key==='pr'?`
        <div class="card" style="margin:12px 0">
          <h3>Intervallo PR</h3>

          <p class="meta">Valuta l’intervallo PR esclusivamente nei battiti condotti.</p>

          <div class="exam-grid">
            ${optionButton(examId,'prMode','normal_constant','Normale e costante',state.prMode)}
            ${optionButton(examId,'prMode','prolonged_constant','Allungato e costante',state.prMode)}
            ${optionButton(examId,'prMode','shortened_constant','Accorciato e costante',state.prMode)}
            ${optionButton(examId,'prMode','progressive','Progressivamente allungato',state.prMode)}
            ${optionButton(examId,'prMode','variable_nonprogressive','Variabile non progressivo',state.prMode)}
            ${optionButton(examId,'prMode','not_evaluable','Non valutabile',state.prMode)}
          </div>

          <div class="grid" style="margin-top:16px">
            <label>PR nei battiti condotti (ms)
              <input inputmode="decimal"
                value="${esc(state.prValue)}"
                data-ecg-input="${examId}"
                data-field="prValue"
                placeholder="es. 100 oppure 80–120">
            </label>
          </div>

          ${state.prMode==='prolonged_constant'&&state.pToQrs==='yes'?`
            <div class="notice">
              PR costantemente allungato con conduzione 1:1: reperto compatibile con blocco atrioventricolare di I grado.
            </div>
          `:''}

          ${state.prMode==='progressive'&&state.pToQrs==='no'?`
            <div class="notice">
              Progressivo allungamento del PR prima di una P non condotta: reperto suggestivo per BAV di II grado Mobitz I.
            </div>
          `:''}

          ${(state.prMode==='normal_constant'||state.prMode==='prolonged_constant')&&state.pToQrs==='no'?`
            <div class="notice">
              PR costante nei battiti condotti con onde P non condotte: reperto compatibile con BAV di II grado; il sottotipo va confermato nel modulo Conduzione.
            </div>
          `:''}
        </div>
      `:''}

      ${state.openStep===key&&key==='conduzione'?`
        <div class="card" style="margin:12px 0">
          <h3>Conduzione atrioventricolare</h3>

          <div class="exam-grid">
            ${optionButton(examId,'conductionMode','none','Nessuna alterazione',state.conductionMode)}
            ${optionButton(examId,'conductionMode','bav1','BAV I grado',state.conductionMode)}
            ${optionButton(examId,'conductionMode','bav2','BAV II grado',state.conductionMode)}
            ${optionButton(examId,'conductionMode','advanced','BAV avanzato',state.conductionMode)}
            ${optionButton(examId,'conductionMode','complete','BAV completo',state.conductionMode)}
            ${optionButton(examId,'conductionMode','other','Altro',state.conductionMode)}
          </div>

          ${(state.conductionMode==='bav2'||bav2Suggested(state))?`
            <p><b>Tipo di BAV di II grado</b></p>
            <div class="exam-grid">
              ${optionButton(examId,'bav2Subtype','mobitz1','Mobitz I',state.bav2Subtype)}
              ${optionButton(examId,'bav2Subtype','mobitz2','Mobitz II',state.bav2Subtype)}
              ${optionButton(examId,'bav2Subtype','two_to_one','2:1',state.bav2Subtype)}
              ${optionButton(examId,'bav2Subtype','high_grade','Alto grado',state.bav2Subtype)}
              ${optionButton(examId,'bav2Subtype','unclassified','Non classificabile',state.bav2Subtype)}
            </div>
          `:''}
        </div>
      `:''}

      ${state.openStep===key&&key==='extrasistoli'?`
        <div class="card" style="margin:12px 0">
          <h3>Extrasistoli</h3>

          <div class="exam-grid">
            ${optionButton(examId,'ectopyMode','none','Assenti',state.ectopyMode)}
            ${optionButton(examId,'ectopyMode','present','Presenti',state.ectopyMode)}
          </div>

          ${state.ectopyMode==='present'?`
            <p><b>Origine</b></p>
            <div class="exam-grid">
              ${optionButton(examId,'ectopyOrigin','supraventricular','Sopraventricolari',state.ectopyOrigin)}
              ${optionButton(examId,'ectopyOrigin','ventricular','Ventricolari',state.ectopyOrigin)}
              ${optionButton(examId,'ectopyOrigin','uncertain','Non determinabile',state.ectopyOrigin)}
            </div>

            <p><b>Distribuzione</b></p>
            <div class="exam-grid">
              ${toggleButton(examId,'ectopyPatterns','isolated','Isolate',state.ectopyPatterns)}
              ${toggleButton(examId,'ectopyPatterns','couplets','Coppie',state.ectopyPatterns)}
              ${toggleButton(examId,'ectopyPatterns','triplets','Triplette',state.ectopyPatterns)}
              ${toggleButton(examId,'ectopyPatterns','runs','Salve',state.ectopyPatterns)}
              ${toggleButton(examId,'ectopyPatterns','bigeminy','Bigeminismo',state.ectopyPatterns)}
              ${toggleButton(examId,'ectopyPatterns','trigeminy','Trigeminismo',state.ectopyPatterns)}
            </div>

            ${state.ectopyOrigin==='ventricular'?`
              <p><b>Morfologia</b></p>
              <div class="exam-grid">
                ${optionButton(examId,'ectopyMorphology','monomorphic','Monomorfe',state.ectopyMorphology)}
                ${optionButton(examId,'ectopyMorphology','polymorphic','Polimorfe',state.ectopyMorphology)}
              </div>
            `:''}

            <div class="grid" style="margin-top:16px">
              <label>Numero osservato
                <input inputmode="numeric"
                  value="${esc(state.ectopyCount)}"
                  data-ecg-input="${examId}"
                  data-field="ectopyCount"
                  placeholder="es. 3">
              </label>
            </div>
          `:''}
        </div>
      `:''}

      ${state.openStep===key&&key==='onda-t'?`
        <div class="card" style="margin:12px 0">
          <h3>Segmento ST e onda T</h3>

          <p><b>Segmento ST</b></p>
          <div class="exam-grid">
            ${optionButton(examId,'stSegment','isoelectric','Isoelettrico',state.stSegment)}
            ${optionButton(examId,'stSegment','elevated','Sopraslivellato',state.stSegment)}
            ${optionButton(examId,'stSegment','depressed','Sottoslivellato',state.stSegment)}
            ${optionButton(examId,'stSegment','not_evaluable','Non valutabile',state.stSegment)}
          </div>

          ${(state.stSegment==='elevated'||state.stSegment==='depressed')?`
            <div class="grid" style="margin-top:16px">
              <label>Deviazione ST (mV)
                <input inputmode="decimal"
                  value="${esc(state.stDeviation)}"
                  data-ecg-input="${examId}"
                  data-field="stDeviation"
                  placeholder="es. 0,1">
              </label>
            </div>
            <p class="meta">Misura la deviazione rispetto alla linea isoelettrica di riferimento.</p>
          `:''}

          <p><b>Morfologia dell’onda T</b></p>
          <div class="exam-grid">
            ${optionButton(examId,'tWaveMorphology','regular','Regolare',state.tWaveMorphology)}
            ${optionButton(examId,'tWaveMorphology','altered','Alterata',state.tWaveMorphology)}
          </div>

          <p><b>Polarità</b></p>
          <div class="exam-grid">
            ${optionButton(examId,'tWavePolarity','positive','Positiva',state.tWavePolarity)}
            ${optionButton(examId,'tWavePolarity','negative','Negativa',state.tWavePolarity)}
            ${optionButton(examId,'tWavePolarity','biphasic','Bifasica',state.tWavePolarity)}
            ${optionButton(examId,'tWavePolarity','variable','Variabile',state.tWavePolarity)}
          </div>

          ${state.tWaveMorphology==='altered'?`
            <p><b>Alterazioni rilevate</b></p>
            <div class="exam-grid">
              ${toggleButton(examId,'tWaveFindings','flattened','Appiattita',state.tWaveFindings)}
              ${toggleButton(examId,'tWaveFindings','notched','Incisurata',state.tWaveFindings)}
              ${toggleButton(examId,'tWaveFindings','asymmetric','Asimmetrica',state.tWaveFindings)}
              ${toggleButton(examId,'tWaveFindings','variable','Variabile',state.tWaveFindings)}
              ${toggleButton(examId,'tWaveFindings','other','Altro',state.tWaveFindings)}
            </div>
          `:''}

          <div class="grid" style="margin-top:16px">
            <label>Ampiezza T (mV) — facoltativa
              <input inputmode="decimal"
                value="${esc(state.tWaveAmplitude)}"
                data-ecg-input="${examId}"
                data-field="tWaveAmplitude"
                placeholder="es. 0,5">
            </label>
          </div>

          <p class="meta">La polarità positiva, negativa o bifasica può essere fisiologica nel cane; il segmento ST e la morfologia complessiva hanno maggiore peso interpretativo.</p>
        </div>
      `:''}

      ${state.openStep===key&&key==='qt'?`
        <div class="card" style="margin:12px 0">
          <h3>Intervallo QT</h3>

          <div class="exam-grid">
            ${optionButton(examId,'qtMode','normal','Normale',state.qtMode)}
            ${optionButton(examId,'qtMode','prolonged','Allungato',state.qtMode)}
            ${optionButton(examId,'qtMode','shortened','Accorciato',state.qtMode)}
            ${optionButton(examId,'qtMode','not_evaluable','Non valutabile',state.qtMode)}
          </div>

          <div class="grid" style="margin-top:16px">
            <label>QT misurato (ms)
              <input inputmode="decimal"
                value="${esc(state.qtValue)}"
                data-ecg-input="${examId}"
                data-field="qtValue"
                placeholder="es. 220">
            </label>

            <label>QT corretto / QTc (ms) — facoltativo
              <input inputmode="decimal"
                value="${esc(state.qtcValue)}"
                data-ecg-input="${examId}"
                data-field="qtcValue"
                placeholder="es. 240">
            </label>
          </div>

          ${state.qtcValue?`
            <p><b>Formula QTc</b></p>
            <div class="exam-grid">
              ${optionButton(examId,'qtcFormula','bazett','Bazett',state.qtcFormula)}
              ${optionButton(examId,'qtcFormula','fridericia','Fridericia',state.qtcFormula)}
              ${optionButton(examId,'qtcFormula','other','Altra',state.qtcFormula)}
            </div>
          `:''}

          <div class="notice">
            L’interpretazione del QT dipende dalla frequenza cardiaca. VetCardio non assegna automaticamente normalità o alterazione in base al solo valore numerico.
          </div>
        </div>
      `:''}

      ${state.openStep===key&&key==='asse'?`
        <div class="card" style="margin:12px 0">
          <h3>Asse elettrico medio del QRS</h3>

          <p><b>Valutabilità</b></p>
          <div class="exam-grid">
            ${optionButton(examId,'axisEvaluability','evaluable','Valutabile',state.axisEvaluability)}
            ${optionButton(examId,'axisEvaluability','not_evaluable','Non valutabile',state.axisEvaluability)}
          </div>

          ${state.axisEvaluability==='evaluable'?`
            <p><b>Posizione del paziente durante la registrazione</b></p>
            <div class="exam-grid">
              ${optionButton(examId,'axisPosition','right_lateral','Decubito laterale destro',state.axisPosition)}
              ${optionButton(examId,'axisPosition','standing','In piedi',state.axisPosition)}
              ${optionButton(examId,'axisPosition','sitting','Seduto',state.axisPosition)}
            </div>

            <p><b>Metodo utilizzato</b></p>
            <div class="exam-grid">
              ${optionButton(examId,'axisMethod','quadrants','Quadranti DI/aVF',state.axisMethod)}
              ${optionButton(examId,'axisMethod','leads','Calcolo derivazioni',state.axisMethod)}
              ${optionButton(examId,'axisMethod','ruler','Righello/diagramma',state.axisMethod)}
              ${optionButton(examId,'axisMethod','other','Altro',state.axisMethod)}
            </div>

            <div class="grid" style="margin-top:16px">
              <label>Asse elettrico (°)
                <input inputmode="numeric"
                  value="${esc(state.axisValue)}"
                  data-ecg-input="${examId}"
                  data-field="axisValue"
                  placeholder="es. +75 oppure -40">
              </label>
            </div>

            <p class="meta">Tocca o trascina la freccia sul diagramma. Il valore numerico si aggiorna automaticamente.</p>
            ${axisDiagram(state,examId,p.species)}
            <p class="meta">L’asse elettrico deve essere interpretato nel contesto della posizione del paziente, della razza, dell’età e della conformazione toracica.</p>

            ${(()=>{
              const proposal=axisProposal(state,p.species);
              if(!proposal) return '';
              return `<div class="notice">
                <b>${esc(proposal.label)}</b><br>
                ${esc(proposal.range)}
                ${p.breed?`<br>Razza registrata: <b>${esc(p.breed)}</b>. Il dato va sempre interpretato nel contesto di razza, età e conformazione toracica.`:''}
                <p><b>Sei d’accordo con questa interpretazione?</b></p>
                <div class="exam-grid">
                  ${optionButton(examId,'axisDecision','confirm','Confermo',state.axisDecision)}
                  ${optionButton(examId,'axisDecision','reject','Non confermo',state.axisDecision)}
                  ${optionButton(examId,'axisDecision','inconclusive','Non conclusivo',state.axisDecision)}
                </div>
              </div>`;
            })()}
          `:''}

          ${state.axisEvaluability==='not_evaluable'?`
            <div class="notice">Nel referto verrà indicato che l’asse elettrico medio del QRS non è valutabile.</div>
          `:''}
        </div>
      `:''}

      ${state.openStep===key&&key==='diagnosi'?`
        <div class="card" style="margin:12px 0">
          <h3>Diagnosi ECG</h3>
          <p class="meta">VetCardio usa un motore clinico unico per riunire i reperti confermati. La formulazione finale resta sempre sotto il tuo controllo.</p>

          ${(()=>{
            const auto=buildAutomaticDiagnosis(state,p.species);
            if(!auto.summary&&!auto.findings.length){
              return `<div class="notice">
                Non sono ancora presenti elementi sufficienti per formulare una diagnosi automatica.
              </div>`;
            }
            return `<div class="notice">
              <b>Diagnosi automatica proposta</b>
              <div style="margin-top:10px;font-weight:600">${esc(auto.summary||'Diagnosi non ancora conclusiva.')}</div>
              ${auto.abnormal.length?`
                <div style="margin-top:14px">
                  <b>Alterazioni utilizzate</b>
                  ${auto.abnormal.map(item=>`<div style="margin:7px 0">• ${esc(item.label)}</div>`).join('')}
                </div>
              `:''}
            </div>`;
          })()}

          <div style="margin-top:16px">
            <button type="button" class="secondary" data-copy-auto-diagnosis="${examId}">
              Usa la proposta come diagnosi finale
            </button>
          </div>

          <label style="display:block;margin-top:16px">
            Diagnosi finale
            <textarea rows="5" data-ecg-text="${examId}" data-field="diagnosisFinal"
              placeholder="Scrivi o modifica qui la diagnosi ECG finale...">${esc(state.diagnosisFinal)}</textarea>
          </label>

          <p><b>Tipo di diagnosi</b></p>
          <div class="exam-grid">
            ${optionButton(examId,'diagnosisType','definitive','Definitiva',state.diagnosisType)}
            ${optionButton(examId,'diagnosisType','presumptive','Presuntiva',state.diagnosisType)}
            ${optionButton(examId,'diagnosisType','inconclusive','Non conclusiva',state.diagnosisType)}
          </div>

          <p><b>Stato</b></p>
          <div class="exam-grid">
            ${optionButton(examId,'diagnosisReviewed','confirmed','Confermata',state.diagnosisReviewed)}
            ${optionButton(examId,'diagnosisReviewed','to_review','Da rivedere',state.diagnosisReviewed)}
          </div>

          <div class="notice" style="margin-top:14px">
            Il motore clinico distingue i reperti normali dalle alterazioni e usa nella diagnosi solo gli elementi clinicamente rilevanti.
          </div>
        </div>
      `:''}

      ${state.openStep===key&&key==='coerenza'?`
        <div class="card" style="margin:12px 0">
          <h3>Controllo di coerenza ECG</h3>
          <p class="meta">VetCardio segnala eventuali dati incompatibili o elementi da ricontrollare, senza modificare automaticamente il referto.</p>

          ${(()=>{
            const checks=buildConsistencyChecks(state,p.species);
            if(!checks.length){
              return `<div class="notice">
                <b>🟢 Nessuna incongruenza rilevata.</b>
              </div>`;
            }

            return `<div>
              <div class="notice" style="margin-bottom:12px">
                <b>⚠️ Sono presenti alcuni dati che meritano una verifica.</b>
              </div>

              ${checks.map(check=>{
                const icon=check.level==='error'?'⚠️':check.level==='warning'?'🟠':'💡';
                const label=check.level==='error'?'Incongruenza':check.level==='warning'?'Attenzione':'Suggerimento';
                return `<div class="notice" style="margin:10px 0">
                  <b>${icon} ${label}: ${esc(check.title)}</b>
                  <div style="margin-top:7px">${esc(check.message)}</div>
                  ${check.modules.length?`
                    <div class="meta" style="margin-top:8px">
                      Controllare: ${check.modules.map(esc).join(' · ')}
                    </div>
                  `:''}
                </div>`;
              }).join('')}
            </div>`;
          })()}
        </div>
      `:''}

      ${state.openStep===key&&key==='raccomandazioni'?`
        <div class="card" style="margin:12px 0">
          <h3>Raccomandazioni</h3>
          <p class="meta">VetCardio propone gli approfondimenti sulla base dei reperti confermati. Puoi aggiungere o rimuovere liberamente qualsiasi voce.</p>

          ${(()=>{
            const auto=buildAutomaticRecommendations(state,p.species);
            if(!auto.length){
              return `<div class="notice">
                Nessuna raccomandazione automatica disponibile sulla base dei dati attualmente inseriti.
              </div>`;
            }
            return `<div class="notice">
              <b>VetCardio suggerisce</b>
              <div style="margin-top:10px">
                ${auto.map(code=>`<div style="margin:7px 0">• ${esc(recommendationLabel(code))}</div>`).join('')}
              </div>
              <button type="button" class="secondary" style="margin-top:12px"
                data-apply-auto-recommendations="${examId}">
                Applica i suggerimenti
              </button>
            </div>`;
          })()}

          <p><b>Cardiologia</b></p>
          <div class="exam-grid">
            ${toggleButton(examId,'recommendationSelections','echocardiography','Ecocardiografia',state.recommendationSelections)}
            ${toggleButton(examId,'recommendationSelections','ecg_control','ECG di controllo',state.recommendationSelections)}
            ${toggleButton(examId,'recommendationSelections','holter','Holter 24 ore',state.recommendationSelections)}
            ${toggleButton(examId,'recommendationSelections','atropine_test','Test all’atropina',state.recommendationSelections)}
            ${toggleButton(examId,'recommendationSelections','continuous_ecg','Monitoraggio ECG continuo',state.recommendationSelections)}
          </div>

          <p><b>Laboratorio</b></p>
          <div class="exam-grid">
            ${toggleButton(examId,'recommendationSelections','electrolytes','Elettroliti',state.recommendationSelections)}
            ${toggleButton(examId,'recommendationSelections','troponin','Troponina cardiaca',state.recommendationSelections)}
            ${toggleButton(examId,'recommendationSelections','blood_gas','Emogasanalisi',state.recommendationSelections)}
          </div>

          <p><b>Diagnostica</b></p>
          <div class="exam-grid">
            ${toggleButton(examId,'recommendationSelections','blood_pressure','Pressione arteriosa',state.recommendationSelections)}
            ${toggleButton(examId,'recommendationSelections','thoracic_xrays','Radiografie toraciche',state.recommendationSelections)}
          </div>

          <p><b>Gestione</b></p>
          <div class="exam-grid">
            ${toggleButton(examId,'recommendationSelections','cardiology_consult','Consulenza cardiologica',state.recommendationSelections)}
            ${toggleButton(examId,'recommendationSelections','hospitalization','Ricovero e monitoraggio',state.recommendationSelections)}
            ${toggleButton(examId,'recommendationSelections','none','Nessun ulteriore approfondimento',state.recommendationSelections)}
          </div>

          <label style="display:block;margin-top:16px">
            Testo delle raccomandazioni
            <textarea rows="5"
              data-ecg-text="${examId}"
              data-field="recommendationText"
              placeholder="Le raccomandazioni vengono generate automaticamente dalle selezioni...">${esc(state.recommendationText||buildRecommendationText(state.recommendationSelections))}</textarea>
          </label>

          <div class="notice" style="margin-top:14px">
            Le raccomandazioni sono suggerimenti clinici modificabili e non sostituiscono il giudizio del veterinario.
          </div>
        </div>
      `:''}
    `).join('')}
  </section>

  ${(wanderingSuggested(state)||bav1Suggested(state))?`
    <section class="card">
      <h3>Suggerimenti VetCardio</h3>
      <p class="meta">VetCardio propone un’interpretazione, ma la conferma resta sempre tua.</p>

      ${wanderingSuggested(state)?`
        <div class="notice">
          <b>Possibile wandering pacemaker</b><br>
          Ritmo sinusale regolarmente irregolare e morfologia dell’onda P variabile.
          <p><b>Sei d’accordo con questa interpretazione?</b></p>
          <div class="exam-grid">
            ${optionButton(examId,'wanderingDecision','confirm','Confermo',state.wanderingDecision)}
            ${optionButton(examId,'wanderingDecision','reject','Non confermo',state.wanderingDecision)}
            ${optionButton(examId,'wanderingDecision','inconclusive','Non conclusivo',state.wanderingDecision)}
          </div>
        </div>
      `:''}

      ${bav1Suggested(state)?`
        <div class="notice">
          <b>Possibile BAV di I grado</b><br>
          Tutte le onde P risultano condotte e l’intervallo PR è allungato.
          <p><b>Sei d’accordo con questa interpretazione?</b></p>
          <div class="exam-grid">
            ${optionButton(examId,'bav1Decision','confirm','Confermo',state.bav1Decision)}
            ${optionButton(examId,'bav1Decision','reject','Non confermo',state.bav1Decision)}
            ${optionButton(examId,'bav1Decision','inconclusive','Non conclusivo',state.bav1Decision)}
          </div>
        </div>
      `:''}

      ${bav2Suggested(state)?`
        <div class="notice">
          <b>Possibile BAV di II grado</b><br>
          Non tutte le onde P sono seguite da un QRS, mentre i QRS risultano preceduti da onda P.
          ${state.prMode?`<br>PR nei battiti condotti: <b>${esc(prLabel(state.prMode))}</b>${state.prValue?` (${esc(state.prValue)} ms)`:''}.`:''}
          ${state.prMode==='progressive'?'<br>Il comportamento del PR è suggestivo per Mobitz I.':''}
          ${(state.prMode==='normal_constant'||state.prMode==='prolonged_constant')?'<br>Il PR è costante nei battiti condotti; il reperto può essere compatibile con Mobitz II, da confermare sul tracciato.':''}
          ${state.bav2Subtype?`<br>Tipo selezionato: <b>${esc(bav2SubtypeLabel(state.bav2Subtype))}</b>.`:''}
          <p><b>Sei d’accordo con questa interpretazione?</b></p>
          <div class="exam-grid">
            ${optionButton(examId,'bav2Decision','confirm','Confermo',state.bav2Decision)}
            ${optionButton(examId,'bav2Decision','reject','Non confermo',state.bav2Decision)}
            ${optionButton(examId,'bav2Decision','inconclusive','Non conclusivo',state.bav2Decision)}
          </div>
        </div>
      `:''}
    </section>
  `:''}

  <section class="card">
    <h3>Descrizione</h3>
    <p class="meta">Il testo si aggiorna mentre compili.</p>
    <textarea id="ecgDescription" data-ecg-text="${examId}" data-field="description" placeholder="Descrizione ECG">${esc(state.description)}</textarea>

    <h3>Interpretazione</h3>
    <textarea data-ecg-text="${examId}" data-field="interpretation" placeholder="Diagnosi elettrocardiografica">${esc(state.interpretation)}</textarea>

    <h3>Conclusioni e raccomandazioni</h3>
    <textarea data-ecg-text="${examId}" data-field="recommendations" placeholder="Conclusioni e raccomandazioni">${esc(state.recommendations)}</textarea>

    ${state.saved?'<div class="notice success">ECG salvato correttamente.</div>':''}
  </section>

  <button class="btn fixed" data-save-ecg="${examId}">${state.saving?'Salvataggio…':'Salva ECG'}</button>
  <button class="btn secondary" data-back-visit="${v.id}">Torna alla visita</button>`;
}

function draftKey(patientId){
  return `vetcardio_visit_draft_${patientId}`;
}

function newVisit(id,existing=null){
  const p=patients.find(x=>x.id===id);
  const today=new Date().toISOString().slice(0,10);
  const savedDraft=!existing?JSON.parse(localStorage.getItem(draftKey(id))||'null'):null;
  const d=existing||savedDraft||{};

  const selected=(existing?.exams||[]).map(e=>e.exam_type);
  const hasExam=name=>existing?selected.includes(name):(d.exams||['Ecocardiografia']).includes(name);

  return `<form id="visitForm" data-id="${id}" ${existing?`data-visit-id="${existing.id}"`:''}>
    <section class="card">
      <h2>${existing?'Modifica visita':'Nuova visita'} · ${esc(p.owners.surname)} – ${esc(p.name)}</h2>

      <div id="draftStatus" class="meta"></div>

      <div class="grid">
        <label>Data
          <input name="date" type="date" value="${esc(d.visit_date||d.date||today)}">
        </label>

        <label>Clinica
          <input name="clinic" value="${esc(d.clinic||'')}">
        </label>

        <label>Peso (kg)
          <input name="weight" inputmode="decimal" value="${d.weight_kg??d.weight??''}">
        </label>

        <label>Motivo
          <select name="reason">
            ${[
              'Controllo',
              'Esame cardiologico completo',
              'Pre-anestesia',
              'Screening',
              'Soffio cardiaco',
              'Aritmia',
              'Sincope',
              'Dispnea',
              'Follow-up',
              'Altro'
            ].map(x=>`<option ${x===(d.reason||'Controllo')?'selected':''}>${x}</option>`).join('')}
          </select>
        </label>
      </div>

      <label>Anamnesi
        <textarea name="anamnesis">${esc(d.anamnesis||'')}</textarea>
      </label>

      <label>Esame clinico
        <textarea name="clinicalExam">${esc(d.clinical_exam||d.clinicalExam||'')}</textarea>
      </label>

      <h3>Esami</h3>
      <div class="exam-grid">
        <button type="button" class="exam ${hasExam('Ecocardiografia')?'active':''}" data-exam="Ecocardiografia">Ecocardiografia</button>
        <button type="button" class="exam ${hasExam('ECG')?'active':''}" data-exam="ECG">ECG</button>
        <button type="button" class="exam ${hasExam('Ecografia addominale')?'active':''}" data-exam="Ecografia addominale">Ecografia addominale</button>
      </div>

      <label>Conclusioni
        <textarea name="conclusions">${esc(d.conclusions||'')}</textarea>
      </label>

      <label>Note private
        <textarea name="notes">${esc(d.notes_private||d.notes||'')}</textarea>
      </label>
    </section>

    <button class="btn fixed">${existing?'Salva modifiche':'Crea visita'}</button>
  </form>`;
}

function collectDraft(form){
  const f=new FormData(form);
  return {
    date:f.get('date'),
    clinic:f.get('clinic'),
    weight:f.get('weight'),
    reason:f.get('reason'),
    anamnesis:f.get('anamnesis'),
    clinicalExam:f.get('clinicalExam'),
    conclusions:f.get('conclusions'),
    notes:f.get('notes'),
    exams:[...document.querySelectorAll('.exam.active')].map(b=>b.dataset.exam)
  };
}

function setupDraftAutosave(form){
  if(form.dataset.visitId) return;

  let timer;
  const saveDraft=()=>{
    const data=collectDraft(form);
    localStorage.setItem(draftKey(form.dataset.id),JSON.stringify(data));
    const status=document.getElementById('draftStatus');
    if(status){
      status.textContent='Bozza salvata sul dispositivo';
      setTimeout(()=>{status.textContent=''},1800);
    }
  };

  form.querySelectorAll('input,select,textarea').forEach(el=>{
    el.addEventListener('input',()=>{
      clearTimeout(timer);
      timer=setTimeout(saveDraft,500);
    });
    el.addEventListener('change',saveDraft);
  });

  document.querySelectorAll('.exam').forEach(b=>{
    b.addEventListener('click',()=>{
      setTimeout(saveDraft,0);
    });
  });
}

async function render(){
  if(!session){
    nav.hidden=true;
    logout.hidden=true;
    app.innerHTML=login();
    bind();
    return;
  }

  nav.hidden=false;
  logout.hidden=false;

  try{
    await load();
  }catch(e){
    app.innerHTML=`<div class="notice">Errore database: ${esc(e.message)}</div>`;
    return;
  }

  if(route.name==='home') app.innerHTML=home();
  else if(route.name==='patients') app.innerHTML=list();
  else if(route.name==='new-patient') app.innerHTML=newPatient();
  else if(route.name==='patient') app.innerHTML=patient(route.id);
  else if(route.name==='visit') app.innerHTML=visitDetail(route.id);
  else if(route.name==='ecg') app.innerHTML=ecgView(route.id);
  else if(route.name==='edit-visit'){
    const p=patients.find(p=>(p.visits||[]).some(v=>v.id===route.id));
    const v=p?.visits?.find(v=>v.id===route.id);
    app.innerHTML=newVisit(p.id,v);
  }
  else app.innerHTML=newVisit(route.id);

  bind();
}

function bind(){
  document.querySelectorAll('[data-route]').forEach(b=>{
    b.onclick=()=>go(b.dataset.route);
  });

  document.querySelectorAll('[data-go]').forEach(b=>{
    b.onclick=()=>go(b.dataset.go);
  });

  document.querySelectorAll('[data-patient]').forEach(b=>{
    b.onclick=()=>go('patient',b.dataset.patient);
  });

  document.querySelectorAll('[data-new-visit]').forEach(b=>{
    b.onclick=()=>go('new-visit',b.dataset.newVisit);
  });

  document.querySelectorAll('[data-visit]').forEach(b=>{
    b.onclick=()=>go('visit',b.dataset.visit);
  });

  document.querySelectorAll('[data-open-ecg]').forEach(b=>{
    b.onclick=()=>go('ecg',b.dataset.openEcg);
  });

  document.querySelectorAll('[data-back-visit]').forEach(b=>{
    b.onclick=()=>go('visit',b.dataset.backVisit);
  });

  document.querySelectorAll('[data-edit-visit]').forEach(b=>{
    b.onclick=()=>go('edit-visit',b.dataset.editVisit);
  });

  document.querySelectorAll('[data-back-patient]').forEach(b=>{
    b.onclick=()=>go('patient',b.dataset.backPatient);
  });

  document.querySelectorAll('[data-ecg-step]').forEach(b=>{
    b.onclick=()=>{
      const examId=b.dataset.examId;
      const state=getEcgState(examId);
      state.openStep=state.openStep===b.dataset.ecgStep?null:b.dataset.ecgStep;
      render();
    };
  });

  document.querySelectorAll('[data-ecg-choice]').forEach(b=>{
    b.onclick=()=>{
      const examId=b.dataset.ecgChoice;
      const state=getEcgState(examId);
      state[b.dataset.field]=b.dataset.value;

      if(
        b.dataset.field==='rhythmOrigin' ||
        b.dataset.field==='rhythmRegularity' ||
        b.dataset.field==='pWaveMode'
      ){
        if(!wanderingSuggested(state)){
          state.wanderingDecision='';
          state.diagnosisReviewed='to_review';
        }
      }

      if(b.dataset.field==='pWaveMode'&&b.dataset.value==='normal'){
        state.pWaveFindings=[];
      }

      if(b.dataset.field==='axisEvaluability'&&b.dataset.value==='not_evaluable'){
        state.axisDecision='';
      }
      if(b.dataset.field==='axisPosition'){
        state.axisDecision='';
      }
      state.description=buildEcgDescription(state);
      state.interpretation=buildEcgInterpretation(state,speciesForExam(examId));
      state.saved=false;
      render();
    };
  });

  document.querySelectorAll('[data-ecg-toggle]').forEach(b=>{
    b.onclick=()=>{
      const examId=b.dataset.ecgToggle;
      const state=getEcgState(examId);
      const field=b.dataset.field;
      const value=b.dataset.value;
      const list=Array.isArray(state[field])?[...state[field]]:[];
      const index=list.indexOf(value);
      if(index>=0) list.splice(index,1);
      else list.push(value);
      if(field==='recommendationSelections'){
        if(value==='none'&&list.includes('none')){
          list=['none'];
        }else if(value!=='none'&&list.includes(value)){
          list=list.filter(x=>x!=='none');
        }
      }

      state[field]=list;

      if(field==='recommendationSelections'){
        state.recommendationText=buildRecommendationText(state.recommendationSelections);
      }

      if(field==='pWaveFindings'&&!wanderingSuggested(state)){
        state.wanderingDecision='';
        state.diagnosisReviewed='to_review';
      }

      state.description=buildEcgDescription(state);
      state.interpretation=buildEcgInterpretation(state,speciesForExam(examId));
      state.saved=false;
      render();
    };
  });

  document.querySelectorAll('[data-ecg-text]').forEach(t=>{
    t.oninput=()=>{
      const state=getEcgState(t.dataset.ecgText);
      state[t.dataset.field]=t.value;
      if(t.dataset.field==='diagnosisFinal'){
        state.diagnosisReviewed='to_review';
        state.interpretation=buildEcgInterpretation(state,speciesForExam(t.dataset.ecgText));
      }
      state.saved=false;
    };
  });

  document.querySelectorAll('[data-ecg-input]').forEach(t=>{
    t.oninput=()=>{
      const state=getEcgState(t.dataset.ecgInput);
      state[t.dataset.field]=t.value;
      if(t.dataset.field==='axisValue') state.axisDecision='';
      state.description=buildEcgDescription(state);
      state.interpretation=buildEcgInterpretation(state,speciesForExam(t.dataset.ecgInput));
      state.saved=false;
      const description=document.getElementById('ecgDescription');
      if(description) description.value=state.description;
      const interpretation=document.querySelector('[data-ecg-text][data-field="interpretation"]');
      if(interpretation) interpretation.value=state.interpretation;
    };
  });


  document.querySelectorAll('[data-ecg-input][data-field="axisValue"]').forEach(input=>{
    input.onblur=()=>{
      const state=getEcgState(input.dataset.ecgInput);
      const angle=normalizeAxisValue(input.value);
      if(angle!==null) state.axisValue=String(angle);
      state.description=buildEcgDescription(state);
      state.interpretation=buildEcgInterpretation(state,speciesForExam(input.dataset.ecgInput));
      state.saved=false;
      render();
    };
  });

  document.querySelectorAll('[data-axis-pad]').forEach(svg=>{
    const examId=svg.dataset.axisPad;
    let dragging=false;

    const setAxisFromPointer=event=>{
      const rect=svg.getBoundingClientRect();
      const x=(event.clientX-rect.left)*(320/rect.width);
      const y=(event.clientY-rect.top)*(320/rect.height);
      let angle=Math.round(Math.atan2(y-160,x-160)*180/Math.PI);
      if(angle===-180) angle=180;

      const state=getEcgState(examId);
      state.axisEvaluability='evaluable';
      state.axisValue=String(angle);
      state.axisDecision='';
      state.description=buildEcgDescription(state);
      state.interpretation=buildEcgInterpretation(state,speciesForExam(examId));
      state.saved=false;
      render();
    };

    svg.onpointerdown=event=>{
      dragging=true;
      try{ svg.setPointerCapture(event.pointerId); }catch(_){}
      setAxisFromPointer(event);
    };
    svg.onpointermove=event=>{
      if(dragging) setAxisFromPointer(event);
    };
    svg.onpointerup=()=>{ dragging=false; };
    svg.onpointercancel=()=>{ dragging=false; };
  });


  document.querySelectorAll('[data-copy-auto-diagnosis]').forEach(button=>{
    button.onclick=()=>{
      const examId=button.dataset.copyAutoDiagnosis;
      const state=getEcgState(examId);
      const proposed=automaticDiagnosisText(state,speciesForExam(examId));
      if(!proposed) return;
      state.diagnosisFinal=proposed;
      state.diagnosisReviewed='to_review';
      state.interpretation=buildEcgInterpretation(state,speciesForExam(examId));
      state.saved=false;
      render();
    };
  });


  document.querySelectorAll('[data-apply-auto-recommendations]').forEach(button=>{
    button.onclick=()=>{
      const examId=button.dataset.applyAutoRecommendations;
      const state=getEcgState(examId);
      const auto=buildAutomaticRecommendations(state,speciesForExam(examId));
      state.recommendationSelections=[...auto];
      state.recommendationText=buildRecommendationText(state.recommendationSelections);
      state.saved=false;
      render();
    };
  });

  document.querySelectorAll('[data-save-ecg]').forEach(b=>{
    b.onclick=async()=>{
      const examId=b.dataset.saveEcg;
      const state=getEcgState(examId);
      state.saving=true;
      state.saved=false;
      render();

      const payload={
        report_data:{
          pToQrs:state.pToQrs,
          qrsToP:state.qrsToP,
          heartRate:state.heartRate,
          rhythmOrigin:state.rhythmOrigin,
          rhythmRegularity:state.rhythmRegularity,
          pWaveMode:state.pWaveMode,
          pWaveFindings:state.pWaveFindings,
          pWaveDuration:state.pWaveDuration,
          pWaveAmplitude:state.pWaveAmplitude,
          qrsMode:state.qrsMode,
          qrsFindings:state.qrsFindings,
          qrsDuration:state.qrsDuration,
          qrsAmplitude:state.qrsAmplitude,
          prMode:state.prMode,
          prValue:state.prValue,
          wanderingDecision:state.wanderingDecision,
          bav1Decision:state.bav1Decision,
          conductionMode:state.conductionMode,
          bav2Subtype:state.bav2Subtype,
          bav2Decision:state.bav2Decision,
          ectopyMode:state.ectopyMode,
          ectopyOrigin:state.ectopyOrigin,
          ectopyPatterns:state.ectopyPatterns,
          ectopyMorphology:state.ectopyMorphology,
          ectopyCount:state.ectopyCount,
          stSegment:state.stSegment,
          stDeviation:state.stDeviation,
          tWaveMorphology:state.tWaveMorphology,
          tWavePolarity:state.tWavePolarity,
          tWaveFindings:state.tWaveFindings,
          tWaveAmplitude:state.tWaveAmplitude,
          qtMode:state.qtMode,
          qtValue:state.qtValue,
          qtcValue:state.qtcValue,
          qtcFormula:state.qtcFormula,
          axisEvaluability:state.axisEvaluability,
          axisPosition:state.axisPosition,
          axisMethod:state.axisMethod,
          axisValue:state.axisValue,
          axisDecision:state.axisDecision,
          diagnosisManual:state.diagnosisManual,
          diagnosisFinal:state.diagnosisFinal,
          diagnosisType:state.diagnosisType,
          diagnosisReviewed:state.diagnosisReviewed,
          recommendationSelections:state.recommendationSelections,
          recommendationText:state.recommendationText
        },
        description:state.description||null,
        interpretation:state.interpretation||null,
        recommendations:state.recommendations||null
      };

      const {error}=await sb
        .from('exams')
        .update(payload)
        .eq('id',examId);

      state.saving=false;

      if(error){
        alert(error.message);
        render();
        return;
      }

      state.saved=true;
      render();
    };
  });

  logout.onclick=()=>sb.auth.signOut();

  const lf=document.getElementById('loginForm');
  if(lf){
    lf.onsubmit=async e=>{
      e.preventDefault();
      const email=new FormData(lf).get('email');
      const {error}=await sb.auth.signInWithOtp({
        email,
        options:{emailRedirectTo:location.origin}
      });
      document.getElementById('loginStatus').innerHTML=error
        ?`<div class="notice">${esc(error.message)}</div>`
        :'<div class="notice success">Link inviato.</div>';
    };
  }

  const s=document.getElementById('search');
  if(s){
    s.oninput=()=>{
      const q=s.value.toLowerCase();
      const r=document.getElementById('results');
      r.innerHTML=patients
        .filter(p=>`${p.owners.surname} ${p.name} ${p.breed||''}`.toLowerCase().includes(q))
        .map(row)
        .join('');

      document.querySelectorAll('[data-patient]').forEach(b=>{
        b.onclick=()=>go('patient',b.dataset.patient);
      });
    };
  }

  document.querySelectorAll('.exam[data-exam]').forEach(b=>{
    b.onclick=()=>b.classList.toggle('active');
  });

  const pf=document.getElementById('patientForm');
  if(pf){
    pf.onsubmit=async e=>{
      e.preventDefault();

      const f=new FormData(pf);
      const uid=session.user.id;

      const {data:o,error:oe}=await sb
        .from('owners')
        .insert({
          user_id:uid,
          surname:f.get('ownerSurname'),
          name:f.get('ownerName')||null,
          phone:f.get('phone')||null,
          email:f.get('ownerEmail')||null
        })
        .select()
        .single();

      if(oe) return alert(oe.message);

      const n=f.get('neutered');

      const {data:p,error:pe}=await sb
        .from('patients')
        .insert({
          user_id:uid,
          owner_id:o.id,
          name:f.get('patientName'),
          species:f.get('species'),
          breed:f.get('breed')||null,
          age_text:f.get('ageText')||null,
          sex:f.get('sex')||null,
          neutered:n===''?null:n==='true',
          microchip:f.get('microchip')||null
        })
        .select()
        .single();

      if(pe) return alert(pe.message);

      go('patient',p.id);
    };
  }

  const vf=document.getElementById('visitForm');
  if(vf){
    setupDraftAutosave(vf);

    vf.onsubmit=async e=>{
      e.preventDefault();

      const f=new FormData(vf);
      const uid=session.user.id;
      const exams=[...document.querySelectorAll('.exam.active')].map(b=>b.dataset.exam);

      const payload={
        user_id:uid,
        patient_id:vf.dataset.id,
        visit_date:f.get('date'),
        clinic:f.get('clinic')||null,
        weight_kg:f.get('weight')?Number(String(f.get('weight')).replace(',','.')):null,
        reason:f.get('reason'),
        anamnesis:f.get('anamnesis')||null,
        clinical_exam:f.get('clinicalExam')||null,
        conclusions:f.get('conclusions')||null,
        notes_private:f.get('notes')||null
      };

      let visitId=vf.dataset.visitId;

      if(visitId){
        const {error:ve}=await sb
          .from('visits')
          .update(payload)
          .eq('id',visitId);

        if(ve) return alert(ve.message);

        const {error:de}=await sb.from('exams').delete().eq('visit_id',visitId);
        if(de) return alert(de.message);
      }else{
        const {data:v,error:ve}=await sb
          .from('visits')
          .insert(payload)
          .select()
          .single();

        if(ve) return alert(ve.message);

        visitId=v.id;
      }

      if(exams.length){
        const {error:ee}=await sb
          .from('exams')
          .insert(exams.map(exam_type=>({
            user_id:uid,
            visit_id:visitId,
            exam_type
          })));

        if(ee) return alert(ee.message);
      }

      localStorage.removeItem(draftKey(vf.dataset.id));
      go('visit',visitId);
    };
  }
}

(async()=>{
  if(cfg.SUPABASE_URL.startsWith('INSERISCI')){
    app.innerHTML='<div class="notice">Completa config.js con URL e anon key di Supabase.</div>';
    return;
  }

  sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  session=(await sb.auth.getSession()).data.session;

  sb.auth.onAuthStateChange((_e,s)=>{
    session=s;
    render();
  });

  render();
})();
