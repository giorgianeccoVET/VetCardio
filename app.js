const cfg=window.VETCARDIO_CONFIG;
const app=document.getElementById('app');
const nav=document.getElementById('nav');
const logout=document.getElementById('logout');

let sb;
let session;
let route={name:'home'};
let patients=[];
const ecgUi={};

const ECG_DRAFT_PREFIX='vetcardio_ecg_draft_';

function ecgDraftKey(examId){
  return `${ECG_DRAFT_PREFIX}${examId}`;
}

function ecgDraftPayload(state){
  const excluded=new Set([
    'openStep','saving','saved',
    'draftSavedAt','draftRestored','draftError'
  ]);

  return Object.fromEntries(
    Object.entries(state)
      .filter(([key])=>!excluded.has(key))
  );
}

function saveEcgDraft(examId,state){
  try{
    const savedAt=new Date().toISOString();
    localStorage.setItem(
      ecgDraftKey(examId),
      JSON.stringify({
        version:1,
        savedAt,
        data:ecgDraftPayload(state)
      })
    );
    state.draftSavedAt=savedAt;
    state.draftError='';
  }catch(error){
    state.draftError='Impossibile salvare la bozza locale.';
  }
}

function readEcgDraft(examId){
  try{
    const raw=localStorage.getItem(ecgDraftKey(examId));
    if(!raw) return null;
    const parsed=JSON.parse(raw);
    if(!parsed||!parsed.data) return null;
    return parsed;
  }catch{
    return null;
  }
}

function removeEcgDraft(examId){
  try{
    localStorage.removeItem(ecgDraftKey(examId));
  }catch{}
}

function ecgDraftTimeLabel(value){
  if(!value) return '';
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('it-IT',{
    hour:'2-digit',
    minute:'2-digit',
    second:'2-digit'
  });
}

setInterval(()=>{
  Object.entries(ecgUi).forEach(([examId,state])=>{
    if(state&&!state.saved&&!state.saving){
      saveEcgDraft(examId,state);
      const status=document.querySelector(`[data-ecg-draft-status="${examId}"]`);
      if(status){
        status.textContent=state.draftError
          ?state.draftError
          :`Bozza salvata sul dispositivo alle ${ecgDraftTimeLabel(state.draftSavedAt)}.`;
        status.className=state.draftError?'notice':'notice success';
      }
    }
  });
},900);

window.addEventListener('beforeunload',event=>{
  const hasUnsaved=Object.values(ecgUi).some(state=>state&&!state.saved&&!state.saving);
  if(!hasUnsaved) return;
  event.preventDefault();
  event.returnValue='';
});

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
    const databaseSaved=exam?.report_data||{};
    const localDraft=readEcgDraft(examId);
    const saved=localDraft
      ? {...databaseSaved,...localDraft.data}
      : databaseSaved;

    ecgUi[examId]={
      openStep:null,
      symptomMode:saved.symptomMode||'',
      symptomPattern:saved.symptomPattern||'',
      symptoms:Array.isArray(saved.symptoms)?saved.symptoms:[],
      symptomFrequency:saved.symptomFrequency||'',
      symptomContext:saved.symptomContext||'',
      symptomDuration:saved.symptomDuration||'',
      symptomRecovery:saved.symptomRecovery||'',
      symptomNotes:saved.symptomNotes||'',
      pToQrs:saved.pToQrs||'',
      qrsToP:saved.qrsToP||'',
      heartRate:saved.heartRate||'',
      heartRateAssessment:saved.heartRateAssessment||'',
      heartRateContexts:Array.isArray(saved.heartRateContexts)
        ? saved.heartRateContexts
        : saved.heartRateContext
          ? [saved.heartRateContext]
          : [],
      heartRateDecision:saved.heartRateDecision||'',
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
      conductionNotes:saved.conductionNotes||'',
      bav2Subtype:saved.bav2Subtype||'',
      bav2Decision:saved.bav2Decision||'',
      ectopyMode:saved.ectopyMode||'',
      ectopyOrigin:saved.ectopyOrigin||'',
      ectopyPatterns:Array.isArray(saved.ectopyPatterns)?saved.ectopyPatterns:[],
      ectopyMorphology:saved.ectopyMorphology||'',
      ectopyCount:saved.ectopyCount||'',
      ectopyFrequency:saved.ectopyFrequency||'',
      ectopyPause:saved.ectopyPause||'',
      ectopyRonT:saved.ectopyRonT||'',
      ectopyNotes:saved.ectopyNotes||'',
      ectopyDecision:saved.ectopyDecision||'',
      stSegment:saved.stSegment||'',
      stDeviation:saved.stDeviation||'',
      tWaveMorphology:saved.tWaveMorphology||(saved.tWaveMode==='normal'?'regular':saved.tWaveMode==='detail'?'altered':''),
      tWavePolarity:saved.tWavePolarity||'',
      tWaveFindings:Array.isArray(saved.tWaveFindings)?saved.tWaveFindings:[],
      tWaveAmplitude:saved.tWaveAmplitude||'',
      qtMode:saved.qtMode||'',
      qtValue:saved.qtValue||'',
      qtcValue:saved.qtcValue||'',
      qtcFormula:saved.qtcFormula||'fridericia',
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
      recommendationApplyMessage:'',
      conclusionsText:saved.conclusionsText||'',
      conclusionsEdited:Boolean(saved.conclusionsEdited),
      reportUpdatedAt:saved.reportUpdatedAt||'',
      description:exam?.description||saved.description||'',
      interpretation:exam?.interpretation||saved.interpretation||'',
      recommendations:exam?.recommendations||saved.recommendations||'',
      saved:false,
      saving:false,
      draftSavedAt:localDraft?.savedAt||'',
      draftRestored:Boolean(localDraft),
      draftError:''
    };
  }
  return ecgUi[examId];
}


function symptomLabel(value){
  return ({
    weakness:'episodi di debolezza',
    syncope:'sincope',
    collapse:'collasso',
    exercise_intolerance:'intolleranza all’esercizio',
    dyspnea:'dispnea',
    cyanosis:'cianosi',
    restlessness:'irrequietezza',
    ataxia:'atassia',
    reduced_activity:'riduzione dell’attività',
    behavioral_change:'alterazioni comportamentali',
    persistent_weakness:'debolezza persistente',
    other:'altri episodi'
  })[value]||value;
}


function symptomPatternLabel(value){
  return ({
    paroxysmal:'episodici/parossistici',
    recurrent:'ricorrenti',
    persistent:'persistenti',
    mixed:'misti',
    uncertain:'non chiaramente classificabili'
  })[value]||'';
}

function heartRateAssessmentLabel(value){
  return ({
    low:'frequenza cardiaca ridotta',
    appropriate:'frequenza cardiaca adeguata al contesto',
    high:'frequenza cardiaca aumentata',
    not_assessed:'frequenza cardiaca non classificata'
  })[value]||'';
}

function heartRateContextLabel(value){
  return ({
    resting:'a riposo',
    awake:'da sveglio',
    stressed:'in corso di stress o agitazione',
    sedated:'in sedazione',
    anesthetized:'in anestesia',
    exercise:'durante o subito dopo esercizio',
    unknown:'in contesto non definito'
  })[value]||'';
}

function heartRateProposal(state){
  if(!state.heartRateAssessment||state.heartRateAssessment==='not_assessed') return '';
  const assessment=heartRateAssessmentLabel(state.heartRateAssessment);
  const context=heartRateContextPhrase(state.heartRateContexts);
  return `${assessment.charAt(0).toUpperCase()+assessment.slice(1)}${context?` ${context}`:''}.`;
}

function heartRateInterpretationText(state){
  if(state.heartRateDecision!=='confirm') return '';
  const context=heartRateContextPhrase(state.heartRateContexts);
  const contextText=context?` nel paziente ${context}`:' rispetto al contesto di registrazione';

  if(state.heartRateAssessment==='low'){
    return `Frequenza cardiaca ridotta${contextText}, da interpretare con il ritmo sottostante e il quadro clinico.`;
  }
  if(state.heartRateAssessment==='high'){
    return `Frequenza cardiaca aumentata${contextText}, da interpretare distinguendo risposta fisiologica e tachiaritmia.`;
  }
  if(state.heartRateAssessment==='appropriate'){
    return `Frequenza cardiaca adeguata${contextText}.`;
  }
  return '';
}


function heartRateContextLabels(values){
  const list=Array.isArray(values)?values:[];
  return list.map(heartRateContextLabel).filter(Boolean);
}

function heartRateContextPhrase(values){
  const list=Array.isArray(values)?values:[];
  if(list.includes('awake')&&list.includes('resting')){
    return 'sveglio e a riposo';
  }

  const labels=heartRateContextLabels(list);
  if(!labels.length) return '';
  if(labels.length===1) return labels[0];
  if(labels.length===2) return `${labels[0]} e ${labels[1]}`;
  return `${labels.slice(0,-1).join(', ')} e ${labels.at(-1)}`;
}

function calculateQtc(qtMs,heartRate,formula='fridericia'){
  const qt=Number(String(qtMs||'').replace(',','.'));
  const hr=Number(String(heartRate||'').replace(',','.'));
  if(!Number.isFinite(qt)||qt<=0||!Number.isFinite(hr)||hr<=0) return '';
  const rr=60/hr;
  const corrected=formula==='bazett'
    ? qt/Math.sqrt(rr)
    : qt/Math.cbrt(rr);
  return String(Math.round(corrected));
}

function refreshAutomaticQtc(state){
  if(!state.qtValue||!state.heartRate){
    state.qtcValue='';
    return;
  }
  const formula=state.qtcFormula||'fridericia';
  state.qtcFormula=formula;
  state.qtcValue=calculateQtc(state.qtValue,state.heartRate,formula);
}

function formatClinicalNumber(value){
  return normalizeDisplayedRange(value);
}

function symptomDot(state){
  if(state.symptomMode==='none') return '🟢';
  if(state.symptomMode==='present'&&state.symptoms.length) return '🟠';
  if(state.symptomMode==='present') return '🟡';
  return '⚪';
}

function hasConcerningSymptoms(state){
  const symptoms=new Set(Array.isArray(state.symptoms)?state.symptoms:[]);
  return ['weakness','syncope','collapse','exercise_intolerance','dyspnea','cyanosis']
    .some(code=>symptoms.has(code));
}

function buildEcgHistoryText(state){
  if(state.symptomMode==='none'){
    return 'Non vengono riferiti sintomi o episodi di possibile rilievo cardiovascolare.';
  }
  if(state.symptomMode!=='present') return '';

  const freeText=String(state.symptomNotes||'').trim();
  if(freeText){
    return freeText.replace(/[.]+$/, '')+'.';
  }

  const symptoms=(Array.isArray(state.symptoms)?state.symptoms:[])
    .map(symptomLabel)
    .filter(Boolean);

  const parts=[];
  const pattern=symptomPatternLabel(state.symptomPattern);

  if(symptoms.length){
    const joined=symptoms.length===1
      ? symptoms[0]
      : symptoms.length===2
        ? `${symptoms[0]} e ${symptoms[1]}`
        : `${symptoms.slice(0,-1).join(', ')} e ${symptoms[symptoms.length-1]}`;
    parts.push(`Sono riferiti ${joined}${pattern?`, descritti come ${pattern}`:''}.`);
  }else{
    parts.push(`Sono riferiti sintomi clinici${pattern?` ${pattern}`:''} non ancora caratterizzati.`);
  }

  if(state.symptomFrequency) parts.push(`La frequenza riferita è ${String(state.symptomFrequency).trim()}.`);
  if(state.symptomContext) parts.push(`I sintomi sono osservati ${String(state.symptomContext).trim()}.`);
  if(state.symptomDuration) parts.push(`La durata indicativa è ${String(state.symptomDuration).trim()}.`);
  if(state.symptomRecovery) parts.push(`Il recupero viene descritto come ${String(state.symptomRecovery).trim()}.`);

  return parts.join(' ');
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
    parts.push(`Frequenza cardiaca di ${formatClinicalNumber(state.heartRate)} bpm.`);
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
  if(state.pWaveAmplitude) measures.push(`ampiezza ${normalizeDisplayedRange(state.pWaveAmplitude)} mV`);
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
  if(state.qrsAmplitude) qrsMeasures.push(`ampiezza ${normalizeDisplayedRange(state.qrsAmplitude)} mV`);
  if(qrsMeasures.length) parts.push(`Misure del QRS: ${qrsMeasures.join(', ')}.`);

  if(state.prMode){
    const label=prLabel(state.prMode);
    if(state.prMode==='not_evaluable'){
      parts.push('Intervallo PR non valutabile.');
    }else if(state.prValue){
      parts.push(`Intervallo PR ${label}, pari a ${normalizeDisplayedRange(state.prValue)} ms.`);
    }else{
      parts.push(`Intervallo PR ${label}.`);
    }
  }else if(state.prValue){
    parts.push(`Intervallo PR pari a ${normalizeDisplayedRange(state.prValue)} ms.`);
  }

  if(state.conductionNotes){
    const note=String(state.conductionNotes).trim();
    if(note) parts.push(note.endsWith('.')?note:`${note}.`);
  }

  if(state.ectopyMode==='none'){
    parts.push('Non si rilevano battiti ectopici nel tracciato registrato.');
  }else if(state.ectopyMode==='present'){
    const origin=ectopyOriginLabel(state.ectopyOrigin);
    const patterns=(state.ectopyPatterns||[]).map(ectopyPatternLabel);
    const morphology=ectopyMorphologyLabel(state.ectopyMorphology);
    const frequency=ectopyFrequencyLabel(state.ectopyFrequency);
    const pause=ectopyPauseLabel(state.ectopyPause);
    const ronT=ectopyRonTLabel(state.ectopyRonT);

    let sentence='Si rilevano extrasistoli';
    if(origin) sentence+=` ${origin}`;
    if(morphology) sentence+=` ${morphology}`;
    if(patterns.length) sentence+=` ${patterns.join(', ')}`;
    if(frequency&&state.ectopyFrequency!=='not_assessed') sentence+=`, ${frequency}`;
    if(state.ectopyCount) sentence+=` (n. ${state.ectopyCount})`;
    if(pause&&state.ectopyPause!=='not_assessed') sentence+=`, ${pause}`;
    if(ronT&&state.ectopyRonT!=='not_assessed') sentence+=`, con ${ronT}`;
    parts.push(sentence+'.');

    if(state.ectopyNotes){
      const note=String(state.ectopyNotes).trim();
      if(note) parts.push(note.endsWith('.')?note:`${note}.`);
    }
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
    const rawFindings=Array.isArray(state.tWaveFindings)?state.tWaveFindings:[];
    const findingCodes=[...new Set(rawFindings)];

    // La morfologia bifasica prevale sulla singola polarità positiva/negativa.
    const isBiphasic=state.tWavePolarity==='biphasic'||findingCodes.includes('biphasic');
    const isVariable=state.tWavePolarity==='variable'||findingCodes.includes('variable');
    const hasSpecificAlteration=findingCodes.some(code=>!['biphasic','variable'].includes(code));
    const descriptors=[];

    if(isBiphasic){
      descriptors.push('bifasica');
    }else if(isVariable){
      descriptors.push('a polarità variabile');
    }else{
      const polarity=tWavePolarityLabel(state.tWavePolarity);
      if(polarity) descriptors.push(polarity);
    }

    findingCodes.forEach(code=>{
      if(code==='biphasic'||code==='variable') return;
      if(code==='tall'){
        descriptors.push('di ampiezza aumentata');
        return;
      }
      const label=tWaveFindingLabel(code);
      if(label&&!descriptors.includes(label)) descriptors.push(label);
    });

    let sentence='Onda T';

    // “Regolare” non viene associato a reperti morfologici alterati o bifasici.
    if(state.tWaveMorphology==='regular'&&!hasSpecificAlteration&&!isBiphasic&&!isVariable){
      sentence+=' di morfologia regolare';
    }else if(state.tWaveMorphology==='altered'&&!descriptors.length){
      sentence+=' di morfologia alterata';
    }

    if(descriptors.length){
      sentence+=`${sentence==='Onda T'?' ':', '}${descriptors.join(', ')}`;
    }

    if(state.tWaveAmplitude){
      const rawAmplitude=String(state.tWaveAmplitude).trim();
      const displayedAmplitude=formatClinicalNumber(rawAmplitude).replace('.',',');

      if(isBiphasic&&rawAmplitude.startsWith('-')){
        const absoluteAmplitude=displayedAmplitude.replace(/^-/, '');
        sentence+=`, con componente negativa di ampiezza pari a ${absoluteAmplitude} mV`;
      }else{
        sentence+=` (ampiezza ${displayedAmplitude} mV)`;
      }
    }

    parts.push(sentence+'.');
  }

  if(state.qtMode){
    const label=qtLabel(state.qtMode);
    if(state.qtMode==='not_evaluable'){
      parts.push('Intervallo QT non valutabile.');
    }else if(state.qtValue){
      parts.push(`Intervallo QT ${label}, pari a ${normalizeDisplayedRange(state.qtValue).replace('.',',')} ms.`);
    }else{
      parts.push(`Intervallo QT ${label}.`);
    }
  }else if(state.qtValue){
    parts.push(`Intervallo QT pari a ${normalizeDisplayedRange(state.qtValue).replace('.',',')} ms.`);
  }

  if(state.qtcValue){
    const formula=qtcFormulaLabel(state.qtcFormula);
    parts.push(`QT corretto pari a ${normalizeDisplayedRange(state.qtcValue).replace('.',',')} ms${formula?` secondo ${formula}`:''}.`);
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
  if(!state.heartRate) return '⚪';
  if(state.heartRateAssessment==='appropriate'&&state.heartRateDecision==='confirm') return '🟢';
  if(state.heartRateAssessment) return '🟠';
  return '🟡';
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

function bav2DiagnosisPhrase(value){
  return ({
    mobitz1:'blocco atrioventricolare di II grado tipo Mobitz I (Wenckebach)',
    mobitz2:'blocco atrioventricolare di II grado tipo Mobitz II',
    two_to_one:'blocco atrioventricolare di II grado con conduzione 2:1',
    high_grade:'blocco atrioventricolare di II grado ad alto grado',
    unclassified:'blocco atrioventricolare di II grado non classificabile'
  })[value]||'blocco atrioventricolare di II grado';
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


function ectopyFrequencyLabel(value){
  return ({
    occasional:'occasionali',
    frequent:'frequenti',
    very_frequent:'molto frequenti',
    not_assessed:'frequenza non quantificata'
  })[value]||'';
}

function ectopyPauseLabel(value){
  return ({
    complete:'seguite da pausa compensatoria completa',
    incomplete:'seguite da pausa compensatoria incompleta',
    absent:'non seguite da pausa compensatoria',
    not_assessed:'pausa compensatoria non valutata'
  })[value]||'';
}

function ectopyRonTLabel(value){
  return ({
    absent:'assenza di fenomeno R-on-T',
    present:'presenza di fenomeno R-on-T',
    not_assessed:'fenomeno R-on-T non valutato'
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
    tall:'alta',
    biphasic:'bifasica',
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
      label:'Asse elettrico del QRS nei limiti della norma',
      sentence:'Asse elettrico del QRS nei limiti della norma.',
      range:`Intervallo di riferimento orientativo per ${position}: ${min>0?'+':''}${min}° a +${max}°.${suffix}`
    };
  }

  if(angle<min){
    return {
      code:'left',
      label:'Deviazione assiale sinistra',
      sentence:'Deviazione assiale sinistra.',
      range:`Valore esterno all’intervallo orientativo per ${position}: ${min>0?'+':''}${min}° a +${max}°.${suffix}`
    };
  }

  return {
    code:'right',
    label:'Deviazione assiale destra',
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
  if(state.ectopyMode!=='present'||state.ectopyDecision==='reject') return '';

  const origin=({
    supraventricular:'extrasistoli sopraventricolari',
    ventricular:'extrasistoli ventricolari',
    uncertain:'extrasistoli di origine non determinabile'
  })[state.ectopyOrigin]||'extrasistoli';

  const morphology=({
    monomorphic:'monomorfe',
    polymorphic:'polimorfe'
  })[state.ectopyMorphology]||'';

  const patterns=(state.ectopyPatterns||[]).map(value=>({
    isolated:'isolate',
    couplets:'in coppie',
    triplets:'in triplette',
    runs:'in salve',
    bigeminy:'con bigeminismo',
    trigeminy:'con trigeminismo'
  })[value]).filter(Boolean);

  let result=origin;
  if(morphology) result+=` ${morphology}`;
  if(patterns.length) result+=` ${patterns.join(', ')}`;
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
      `${bav2DiagnosisPhrase(state.bav2Subtype)[0].toUpperCase()}${bav2DiagnosisPhrase(state.bav2Subtype).slice(1)}.`,
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
  }else if(state.ectopyMode==='none'){
    add('no_ectopy','ectopy','Assenza di battiti ectopici',
      'Assenza di battiti ectopici nel tracciato registrato.',false);
  }

  const axis=axisProposal(state,species);
  if(axis&&state.axisDecision==='confirm'){
    if(axis.code==='normal'){
      add('normal_axis','axis','Asse elettrico nei limiti',
        'Asse elettrico del QRS nei limiti della norma.',false);
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
  const codes=new Set(findings.map(f=>f.code));
  const complete=['rhythm','conduction','ectopy','axis','qt'].every(category=>findings.some(f=>f.category===category));
  if(!abnormal.length&&complete) return {summary:'Esame elettrocardiografico nei limiti della norma.',findings,abnormal,normal};
  if(!abnormal.length) return {summary:'',findings,abnormal,normal};
  const join=items=>items.length<2?(items[0]||''):items.length===2?`${items[0]} e ${items[1]}`:`${items.slice(0,-1).join(', ')} e ${items.at(-1)}`;
  let rhythm='';
  if(codes.has('atrial_fibrillation')) rhythm='Fibrillazione atriale';
  else if(codes.has('atrial_flutter')) rhythm='Flutter atriale';
  else if(codes.has('ventricular_rhythm')) rhythm='Ritmo ventricolare';
  else if(codes.has('junctional_rhythm')) rhythm='Ritmo giunzionale';
  else if(codes.has('atrial_rhythm')) rhythm='Ritmo atriale';
  else if(codes.has('wandering_pacemaker')) rhythm='Ritmo sinusale con pacemaker migrante';
  else if(codes.has('sinus_rhythm')) rhythm='Ritmo sinusale';
  let conduction='';
  const b2=findings.find(f=>f.code==='av_block_2');
  if(codes.has('complete_av_block')) conduction='blocco atrioventricolare completo';
  else if(codes.has('advanced_av_block')) conduction='blocco atrioventricolare avanzato';
  else if(b2){ conduction=bav2DiagnosisPhrase(b2.subtype||''); }
  else if(codes.has('av_block_1')) conduction='blocco atrioventricolare di I grado';
  const assoc=[];
  const ect=findings.find(f=>['ventricular_ectopy','supraventricular_ectopy','ectopy_uncertain'].includes(f.code));
  if(ect) assoc.push(ect.diagnosticText.replace(/\.$/,'').replace(/^Extrasistolia/,'extrasistolia'));
  if(codes.has('left_axis_deviation')) assoc.push('deviazione assiale sinistra');
  if(codes.has('right_axis_deviation')) assoc.push('deviazione assiale destra');
  if(codes.has('prolonged_qt')) assoc.push('allungamento dell’intervallo QT');
  if(codes.has('short_qt')) assoc.push('accorciamento dell’intervallo QT');
  if(state.stSegment==='elevated'||state.stSegment==='depressed'||state.tWaveMorphology==='altered') assoc.push('alterazioni della ripolarizzazione ventricolare');
  let summary=rhythm&&conduction?`${rhythm} complicato da ${conduction}`:conduction?conduction[0].toUpperCase()+conduction.slice(1):rhythm;
  if(assoc.length) summary=summary?`${summary} associato a ${join(assoc)}`:join(assoc);
  if(!summary) summary=join(abnormal.map(f=>f.diagnosticText.replace(/\.$/,'')));
  if(summary&&!summary.endsWith('.')) summary+='.';
  return {summary,findings,abnormal,normal};
}

function automaticDiagnosisText(state,species=''){
  return buildAutomaticDiagnosis(state,species).summary||'';
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

  if(
    state.bav2Decision==='confirm'&&
    state.bav2Subtype==='mobitz2'&&
    state.prMode==='progressive'
  ){
    add(
      'error',
      'Mobitz II con progressivo allungamento del PR',
      'Il progressivo allungamento dell’intervallo PR è più coerente con Mobitz I/Wenckebach. Ricontrollare il sottotipo selezionato.',
      ['Intervallo PR','Conduzione']
    );
  }

  if(
    state.bav2Decision==='confirm'&&
    state.bav2Subtype==='mobitz1'&&
    ['normal_constant','variable_nonprogressive'].includes(state.prMode)
  ){
    add(
      'warning',
      'Mobitz I senza progressivo allungamento del PR',
      'Nel Mobitz I è atteso un progressivo allungamento del PR prima dell’onda P non condotta.',
      ['Intervallo PR','Conduzione']
    );
  }

  if(
    state.bav2Decision==='confirm'&&
    state.bav2Subtype==='mobitz2'&&
    state.prMode==='normal_constant'&&
    state.pToQrs==='no'
  ){
    // Configurazione coerente: nessun avviso.
  }

  if(qrsWide&&state.conductionMode==='none'&&state.ectopyMode==='absent'){
    add(
      'warning',
      'QRS largo senza causa indicata',
      'Valutare la presenza di un blocco di branca o di un’origine ventricolare.',
      ['QRS','Conduzione','Extrasistoli']
    );
  }

  if(
    state.ectopyMode==='present'&&
    state.ectopyOrigin!=='ventricular'&&
    state.ectopyRonT==='present'
  ){
    add(
      'warning',
      'R-on-T selezionato per extrasistoli non ventricolari',
      'Il fenomeno R-on-T è una caratteristica da riferire ai complessi ventricolari prematuri.',
      ['Extrasistoli']
    );
  }

  if(
    state.ectopyMode==='present'&&
    state.ectopyPatterns?.includes('runs')&&
    !['ventricular','supraventricular'].includes(state.ectopyOrigin)
  ){
    add(
      'info',
      'Salve con origine non determinata',
      'Quando possibile, specificare se la sequenza è ventricolare o sopraventricolare.',
      ['Extrasistoli']
    );
  }

  if(state.symptomPattern==='persistent'&&(state.symptomDuration||state.symptomRecovery)){
    add(
      'info',
      'Sintomi persistenti con durata o recupero compilati',
      'Per un’alterazione persistente, durata del singolo episodio e recupero possono non essere applicabili.',
      ['Sintomi ed episodi riferiti']
    );
  }

  if(state.heartRateAssessment==='low'&&state.heartRateDecision==='confirm'&&state.rhythmOrigin==='sinusale'&&(state.heartRateContexts||[]).includes('stressed')){
    add(
      'warning',
      'Frequenza ridotta durante stress',
      'Una frequenza cardiaca ridotta in corso di stress o agitazione merita verifica clinica e correlazione con il ritmo.',
      ['Frequenza cardiaca','Ritmo']
    );
  }

  if((state.heartRateAssessment==='low'||state.heartRateAssessment==='high')&&!(state.heartRateContexts||[]).length){
    add(
      'info',
      'Contesto della frequenza non indicato',
      'Specificare il contesto di registrazione prima di confermare una frequenza cardiaca ridotta o aumentata.',
      ['Frequenza cardiaca']
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
    complete_blood_count:'Emocromo completo',
    biochemistry:'Profilo biochimico',
    nt_probnp:'NT-proBNP',
    urinalysis:'Esame urine completo',
    upc_ratio:'Rapporto PU/CU',
    urine_culture:'Urinocoltura',
    abdominal_ultrasound:'Ecografia addominale',
    blood_pressure:'Pressione arteriosa',
    thoracic_xrays:'Radiografie toraciche',
    cardiology_consult:'Consulenza cardiologica',
    internal_medicine_assessment:'Valutazione internistica',
    neurologic_assessment:'Valutazione neurologica',
    hospitalization:'Ricovero e monitoraggio',
    none:'Nessun ulteriore approfondimento'
  })[code]||code;
}

function buildAutomaticRecommendations(state,species=''){
  const codes=clinicalFindingCodes(state,species);
  const suggested=new Set();
  const symptoms=new Set(Array.isArray(state.symptoms)?state.symptoms:[]);

  if(state.symptomMode==='present'){
    if(
      symptoms.has('weakness')||
      symptoms.has('persistent_weakness')||
      symptoms.has('exercise_intolerance')||
      symptoms.has('reduced_activity')
    ){
      suggested.add('blood_pressure');
      suggested.add('biochemistry');
      suggested.add('electrolytes');
    }

    if(
      (state.symptomPattern==='paroxysmal'||state.symptomPattern==='recurrent')&&
      (symptoms.has('weakness')||symptoms.has('exercise_intolerance'))
    ){
      suggested.add('ecg_control');
    }

    if(symptoms.has('syncope')||symptoms.has('collapse')){
      suggested.add('blood_pressure');
      suggested.add('holter');
      suggested.add('echocardiography');
    }

    if(symptoms.has('dyspnea')||symptoms.has('cyanosis')){
      suggested.add('echocardiography');
      suggested.add('thoracic_xrays');
    }

    if(symptoms.has('ataxia')||symptoms.has('behavioral_change')){
      suggested.add('neurologic_assessment');
      suggested.add('internal_medicine_assessment');
    }

    if(
      state.symptomPattern==='persistent'&&
      (symptoms.has('persistent_weakness')||symptoms.has('reduced_activity')||symptoms.has('restlessness'))
    ){
      suggested.add('internal_medicine_assessment');
    }
  }

  if(state.heartRateDecision==='confirm'&&state.heartRateAssessment==='low'){
    suggested.add('ecg_control');
    if(hasConcerningSymptoms(state)) suggested.add('holter');
  }

  if(state.heartRateDecision==='confirm'&&state.heartRateAssessment==='high'){
    suggested.add('ecg_control');
    if(state.rhythmRegularity==='irregolare') suggested.add('holter');
  }

  if(codes.has('av_block_1')){
    suggested.add('ecg_control');
  }

  if(codes.has('av_block_2')){
    suggested.add('echocardiography');
    suggested.add('atropine_test');
    suggested.add('ecg_control');
    suggested.add('electrolytes');

    if(
      hasConcerningSymptoms(state)||
      ['mobitz2','high_grade','unclassified'].includes(state.bav2Subtype)
    ){
      suggested.add('holter');
    }
  }

  if(codes.has('complete_av_block')||codes.has('advanced_av_block')){
    suggested.add('echocardiography');
    suggested.add('hospitalization');
    suggested.add('continuous_ecg');
  }

  if(codes.has('ventricular_ectopy')){
    suggested.add('ecg_control');
    suggested.add('echocardiography');
    suggested.add('holter');
    suggested.add('biochemistry');
    suggested.add('electrolytes');
    suggested.add('troponin');

    const patterns=Array.isArray(state.ectopyPatterns)?state.ectopyPatterns:[];
    const complexPattern=
      patterns.includes('couplets') ||
      patterns.includes('triplets') ||
      patterns.includes('runs') ||
      patterns.includes('bigeminy') ||
      patterns.includes('trigeminy') ||
      state.ectopyMorphology==='polymorphic' ||
      state.ectopyRonT==='present';

    if(complexPattern){
      suggested.add('continuous_ecg');
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
  if(autoDiagnosis.summary==='Esame elettrocardiografico nei limiti della norma.'&&!hasConcerningSymptoms(state)){
    suggested.add('none');
  }

  if((suggested.size>1||hasConcerningSymptoms(state))&&suggested.has('none')){
    suggested.delete('none');
  }

  return [...suggested];
}

function recommendationGroups(){
  return [
    {
      title:'Cardiologia',
      codes:[
        'ecg_control',
        'holter',
        'continuous_ecg',
        'echocardiography',
        'atropine_test',
        'cardiology_consult',
        'hospitalization'
      ]
    },
    {
      title:'Diagnostica complementare',
      codes:[
        'blood_pressure',
        'thoracic_xrays',
        'abdominal_ultrasound'
      ]
    },
    {
      title:'Laboratorio',
      codes:[
        'complete_blood_count',
        'biochemistry',
        'electrolytes',
        'troponin',
        'nt_probnp',
        'blood_gas'
      ]
    },
    {
      title:'Valutazioni cliniche',
      codes:[
        'internal_medicine_assessment',
        'neurologic_assessment'
      ]
    },
    {
      title:'Urine',
      codes:[
        'urinalysis',
        'upc_ratio',
        'urine_culture'
      ]
    }
  ];
}

function groupedRecommendations(selections){
  const selected=new Set(
    (Array.isArray(selections)?selections:[]).filter(code=>code&&code!=='none')
  );

  return recommendationGroups()
    .map(group=>({
      title:group.title,
      items:group.codes
        .filter(code=>selected.has(code))
        .map(code=>({code,label:recommendationLabel(code)}))
    }))
    .filter(group=>group.items.length);
}

function buildRecommendationText(selections){
  const selected=[...new Set(
    (Array.isArray(selections)?selections:[]).filter(Boolean)
  )];

  if(!selected.length) return '';

  if(selected.includes('none')){
    return 'Sulla base del solo esame elettrocardiografico non si ritengono necessari ulteriori approfondimenti.';
  }

  const groups=groupedRecommendations(selected);
  if(!groups.length) return '';

  return groups.map(group=>{
    const items=group.items.map(item=>`• ${item.label}`).join('\n');
    return `${group.title}\n${items}`;
  }).join('\n\n');
}

function recommendationsDot(state,species=''){
  const auto=buildAutomaticRecommendations(state,species);
  const selected=Array.isArray(state.recommendationSelections)?state.recommendationSelections:[];
  if(selected.length) return '🟢';
  if(auto.length) return '🟠';
  return '⚪';
}

function buildAutomaticConclusions(state,species=''){
  const findings=buildClinicalFindings(state,species);
  const codes=new Set(findings.map(f=>f.code));
  const abnormal=findings.filter(f=>f.abnormal);

  if(buildAutomaticDiagnosis(state,species).summary==='Esame elettrocardiografico nei limiti della norma.'){
    return 'Non si evidenziano alterazioni elettrocardiografiche di rilievo clinico.';
  }

  const parts=[];

  if(codes.has('wandering_pacemaker')){
    parts.push('Il pacemaker migrante rappresenta generalmente una variante fisiologica nel cane.');
  }
  if(codes.has('av_block_1')){
    parts.push('È presente un ritardo della conduzione atrioventricolare, da correlare alla frequenza cardiaca e al quadro clinico.');
  }
  if(codes.has('av_block_2')){
    parts.push('Il blocco atrioventricolare di II grado richiede caratterizzazione clinica e valutazione della risposta cronotropa.');
  }
  if(codes.has('advanced_av_block')){
    parts.push('È presente un disturbo avanzato della conduzione atrioventricolare, potenzialmente clinicamente rilevante.');
  }
  if(codes.has('complete_av_block')){
    parts.push('È presente un blocco atrioventricolare completo, reperto clinicamente rilevante.');
  }
  if(codes.has('ventricular_ectopy')){
    parts.push('Le extrasistoli ventricolari richiedono inquadramento cardiologico e, in funzione della complessità, quantificazione mediante Holter.');
  }
  if(codes.has('supraventricular_ectopy')){
    parts.push('Le extrasistoli sopraventricolari devono essere correlate alla loro frequenza e al quadro cardiologico complessivo.');
  }
  if(codes.has('atrial_fibrillation')){
    parts.push('La fibrillazione atriale richiede valutazione cardiologica e caratterizzazione della risposta ventricolare.');
  }
  if(codes.has('atrial_flutter')){
    parts.push('Il flutter atriale richiede valutazione cardiologica e caratterizzazione della conduzione atrioventricolare.');
  }
  if(codes.has('prolonged_qt')){
    parts.push('L’allungamento del QT deve essere correlato a frequenza cardiaca, elettroliti e farmaci assunti.');
  }
  if(codes.has('short_qt')){
    parts.push('L’accorciamento del QT deve essere interpretato nel contesto clinico e metabolico.');
  }
  if(codes.has('left_axis_deviation')||codes.has('right_axis_deviation')){
    parts.push('La deviazione assiale deve essere correlata alla morfologia dei QRS e agli eventuali reperti cardiaci strutturali.');
  }
  if(state.stSegment==='elevated'||state.stSegment==='depressed'||state.tWaveMorphology==='altered'){
    parts.push('Le alterazioni della ripolarizzazione sono aspecifiche e richiedono correlazione clinica, metabolica e cardiologica.');
  }

  if(hasConcerningSymptoms(state)){
    if(codes.has('wandering_pacemaker')){
      parts.push('Il reperto ECG non giustifica da solo i sintomi riferiti, che richiedono un inquadramento clinico indipendente.');
    }else{
      parts.push('I sintomi riferiti devono essere correlati ai reperti ECG senza presumerne automaticamente un’origine aritmica.');
    }
  }

  if(
    state.symptomMode==='present'&&
    (state.symptoms||[]).some(code=>['ataxia','behavioral_change'].includes(code))
  ){
    parts.push('In presenza di atassia o alterazioni comportamentali, considerare anche cause extracardiologiche.');
  }

  if(!parts.length&&abnormal.length){
    parts.push('I reperti elettrocardiografici devono essere interpretati nel contesto clinico complessivo.');
  }

  return [...new Set(parts)].join(' ');
}

function conclusionsDot(state,species=''){
  const generated=buildAutomaticConclusions(state,species);
  if(state.conclusionsText&&state.conclusionsText.trim()) return '🟢';
  if(generated) return '🟠';
  return '⚪';
}

function buildReportCompleteness(state){
  const checks=[
    ['Relazione P–QRS', Boolean(state.pToQrs&&state.qrsToP)],
    ['Frequenza cardiaca', Boolean(String(state.heartRate||'').trim()&&state.heartRateAssessment)],
    ['Ritmo', Boolean(state.rhythmOrigin&&state.rhythmRegularity)],
    ['Onda P', Boolean(state.pWaveMode)],
    ['QRS', Boolean(state.qrsMode)],
    ['Intervallo PR', Boolean(state.prMode)],
    ['Conduzione', Boolean(state.conductionMode)],
    ['Extrasistoli', Boolean(state.ectopyMode)],
    ['ST–T', Boolean(state.stSegment&&state.tWaveMorphology)],
    ['QT', Boolean(state.qtMode)],
    ['Asse elettrico', Boolean(state.axisEvaluability)],
    ['Interpretazione', Boolean(String(state.interpretation||'').trim())],
    ['Conclusioni', Boolean(String(state.conclusionsText||'').trim())],
    ['Raccomandazioni', Boolean(String(state.recommendationText||'').trim() || (state.recommendationSelections||[]).length)]
  ];

  const completed=checks.filter(([,ok])=>ok).length;
  const total=checks.length;
  const percent=Math.round((completed/total)*100);
  const missing=checks.filter(([,ok])=>!ok).map(([label])=>label);

  return {completed,total,percent,missing};
}

function buildFinalReport(state,species=''){
  return {
    clinicalHistory: buildEcgHistoryText(state),
    description: buildEcgDescription(state),
    interpretation: buildEcgInterpretation(state,species),
    conclusions: buildAutomaticConclusions(state,species),
    recommendations: buildRecommendationText(state.recommendationSelections)
  };
}


function loadExternalScript(src){
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector(`script[data-vetcardio-src="${src}"]`);
    if(existing){
      if(existing.dataset.loaded==='true') return resolve();
      existing.addEventListener('load',resolve,{once:true});
      existing.addEventListener('error',()=>reject(new Error('Impossibile caricare il generatore PDF.')),{once:true});
      return;
    }

    const script=document.createElement('script');
    script.src=src;
    script.async=true;
    script.dataset.vetcardioSrc=src;
    script.onload=()=>{
      script.dataset.loaded='true';
      resolve();
    };
    script.onerror=()=>reject(new Error('Impossibile caricare il generatore PDF.'));
    document.head.appendChild(script);
  });
}

function safePdfFilename(value){
  return String(value||'referto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Z0-9_-]+/g,'_')
    .replace(/^_+|_+$/g,'')
    .slice(0,80)||'referto';
}

function normalizeDisplayedRange(value){
  const raw=String(value??'').trim();
  const match=raw.match(/^\s*([+-]?\d+(?:[.,]\d+)?)\s*[-–—]\s*([+-]?\d+(?:[.,]\d+)?)\s*$/);
  if(!match) return raw;

  const first=Number(match[1].replace(',','.'));
  const second=Number(match[2].replace(',','.'));
  if(!Number.isFinite(first)||!Number.isFinite(second)) return raw;

  const format=n=>String(n).replace('.',',');
  const min=Math.min(first,second);
  const max=Math.max(first,second);
  return `${format(min)}–${format(max)}`;
}


async function generateEcgPdf(examId){
  const p=patients.find(patient=>(patient.visits||[]).some(visit=>(visit.exams||[]).some(exam=>exam.id===examId)));
  const v=p?.visits?.find(visit=>(visit.exams||[]).some(exam=>exam.id===examId));
  const e=v?.exams?.find(exam=>exam.id===examId);
  if(!p||!v||!e) throw new Error('Impossibile recuperare i dati del referto ECG.');

  const state=getEcgState(examId,e);
  const automaticDiagnosis=buildAutomaticDiagnosis(state,p.species).summary||'';
  const report={
    clinicalHistory:buildEcgHistoryText(state).trim(),
    description:String(state.description||buildEcgDescription(state)||'').trim(),
    diagnosis:String(state.diagnosisFinal||automaticDiagnosis||'').trim(),
    interpretation:String(state.interpretation||buildEcgInterpretation(state,p.species)||'').trim(),
    conclusions:String(state.conclusionsText||buildAutomaticConclusions(state,p.species)||'').trim(),
    recommendations:String(state.recommendationText||buildRecommendationText(state.recommendationSelections)||'').trim()
  };

  const missing=[];
  if(!report.description) missing.push('descrizione elettrocardiografica');
  if(!report.diagnosis) missing.push('diagnosi elettrocardiografica');
  if(!report.interpretation) missing.push('interpretazione elettrocardiografica');

  if(missing.length){
    throw new Error(`Prima di generare il PDF completa: ${missing.join(', ')}.`);
  }

  await loadExternalScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
  const jsPDF=window.jspdf?.jsPDF;
  if(!jsPDF) throw new Error('Generatore PDF non disponibile.');

  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const pageWidth=210;
  const pageHeight=297;
  const margin=13;
  const contentWidth=pageWidth-(margin*2);
  const contentBottom=282;
  const footerLineY=286;
  const footerTextY=292;
  let y=14;

  const owner=p.owners||{};
  const patientName=p.name||'Paziente';
  const ownerName=[owner.surname,owner.name].filter(Boolean).join(' ');
  const sex=[p.sex,p.neutered===true?'sterilizzato':p.neutered===false?'intero':''].filter(Boolean).join(', ');
  const weight=v.weight_kg!=null?`${String(v.weight_kg).replace('.',',')} kg`:'';

  const drawHeader=()=>{
    doc.setTextColor(15,91,107);
    doc.setFont('helvetica','bold');
    doc.setFontSize(16);
    doc.text('VetCardio',margin,y);

    doc.setFontSize(7.4);
    doc.setTextColor(90,107,117);
    doc.text('ARCHIVIO CLINICO VETERINARIO',margin,y+4.5);

    doc.setDrawColor(15,91,107);
    doc.setLineWidth(0.5);
    doc.line(margin,y+7.5,pageWidth-margin,y+7.5);
    y+=13;
  };

  const addNewPage=()=>{
    doc.addPage();
    y=14;
    drawHeader();
  };

  const ensureSpace=needed=>{
    if(y+needed>contentBottom) addNewPage();
  };

  const splitLines=(value,width=contentWidth)=>{
    return doc.splitTextToSize(String(value||'—'),width);
  };

  const addInfoRow=(label,value,labelWidth=38)=>{
    const lines=splitLines(value,contentWidth-labelWidth);
    const rowHeight=Math.max(4.8,lines.length*4);
    ensureSpace(rowHeight+1);

    doc.setFont('helvetica','bold');
    doc.setFontSize(8.6);
    doc.setTextColor(44,61,70);
    doc.text(label,margin,y);

    doc.setFont('helvetica','normal');
    doc.setTextColor(30,39,44);
    doc.text(lines,margin+labelWidth,y);
    y+=rowHeight;
  };

  const addSectionTitle=title=>{
    ensureSpace(15);
    doc.setFont('helvetica','bold');
    doc.setFontSize(10.3);
    doc.setTextColor(15,91,107);
    doc.text(title,margin,y);
    y+=5;
  };

  const addSection=(title,text)=>{
    const clean=String(text||'').trim()||'—';
    const paragraphs=clean.split(/\n+/).map(item=>item.trim()).filter(Boolean);
    const prepared=paragraphs.map(paragraph=>splitLines(paragraph));

    // Evita che il titolo resti isolato a fondo pagina.
    const firstParagraphHeight=(prepared[0]?.length||1)*4.1;
    ensureSpace(Math.min(11+firstParagraphHeight,36));
    addSectionTitle(title);

    doc.setFont('helvetica','normal');
    doc.setFontSize(9.1);
    doc.setTextColor(28,39,44);

    prepared.forEach((lines,index)=>{
      lines.forEach(line=>{
        if(y+4.2>contentBottom) addNewPage();
        doc.setFont('helvetica','normal');
        doc.setFontSize(9.1);
        doc.setTextColor(28,39,44);
        doc.text(line,margin,y);
        y+=4;
      });
      if(index<prepared.length-1) y+=1;
    });

    y+=2.2;
  };


  const addRecommendationsSection=(selections,fallbackText='')=>{
    const groups=groupedRecommendations(selections);

    if(!groups.length){
      addSection('Raccomandazioni',fallbackText||'—');
      return;
    }

    const columnGap=5;
    const columnWidth=(contentWidth-columnGap)/2;
    const leftX=margin;
    const rightX=margin+columnWidth+columnGap;

    const preparedGroups=groups.map(group=>{
      const itemLines=group.items.map(item=>splitLines(`• ${item.label}`,columnWidth));
      const height=4.2+itemLines.reduce((sum,lines)=>sum+(lines.length*3.45),0)+1.2;
      return {...group,itemLines,height};
    });

    const columns=[[],[]];
    const heights=[0,0];

    preparedGroups.forEach(group=>{
      const target=heights[0]<=heights[1]?0:1;
      columns[target].push(group);
      heights[target]+=group.height;
    });

    const blockHeight=5+Math.max(...heights)+14; // include firma compatta
    if(y+blockHeight>contentBottom&&contentBottom-y<24) addNewPage();

    addSectionTitle('Raccomandazioni');
    const startY=y;

    const drawColumn=(groupsInColumn,x)=>{
      let columnY=startY;

      groupsInColumn.forEach(group=>{
        doc.setFont('helvetica','bold');
        doc.setFontSize(8.2);
        doc.setTextColor(15,91,107);
        doc.text(group.title,x,columnY);
        columnY+=3.7;

        group.itemLines.forEach(lines=>{
          doc.setFont('helvetica','normal');
          doc.setFontSize(7.1);
          doc.setTextColor(28,39,44);
          lines.forEach(line=>{
            doc.text(line,x,columnY);
            columnY+=3.4;
          });
        });

        columnY+=1.1;
      });

      return columnY;
    };

    const leftEnd=drawColumn(columns[0],leftX);
    const rightEnd=drawColumn(columns[1],rightX);
    y=Math.max(leftEnd,rightEnd)+2;
  };

  drawHeader();

  doc.setFont('helvetica','bold');
  doc.setFontSize(13.5);
  doc.setTextColor(20,45,52);
  doc.text('Referto elettrocardiografico',margin,y);
  y+=8;

  const identityRows=[
    ['Proprietario',ownerName||'—'],
    ['Paziente',[patientName,p.species,p.breed].filter(Boolean).join(' - ')||'—'],
    ...(p.age_text?[['Età',p.age_text]]:[]),
    ...(sex?[['Sesso',sex]]:[]),
    ...(weight?[['Peso',weight]]:[]),
    ...(p.microchip?[['Microchip',p.microchip]]:[])
  ];

  const identityBoxHeight=identityRows.reduce((sum,[,value])=>{
    const lines=splitLines(value,contentWidth-38);
    return sum+Math.max(4.8,lines.length*4);
  },6);

  ensureSpace(identityBoxHeight+8);
  doc.setFillColor(246,250,251);
  doc.setDrawColor(211,223,227);
  doc.roundedRect(margin,y-4,contentWidth,identityBoxHeight,3,3,'FD');
  y+=3;
  identityRows.forEach(([label,value])=>addInfoRow(label,value));
  y+=2.5;

  const examRows=[
    ['Data esame',fmt(v.visit_date)],
    ...(v.clinic?[['Clinica',v.clinic]]:[]),
    ...(v.reason?[['Motivo',v.reason]]:[])
  ];
  examRows.forEach(([label,value])=>addInfoRow(label,value));
  y+=2.5;

  if(report.clinicalHistory) addSection('Sintomi ed episodi riferiti',report.clinicalHistory);
  addSection('Descrizione elettrocardiografica',report.description);
  addSection('Diagnosi elettrocardiografica',report.diagnosis);
  addSection('Interpretazione elettrocardiografica',report.interpretation);
  addSection('Conclusioni',report.conclusions);
  addRecommendationsSection(state.recommendationSelections,report.recommendations);

  // Firma mantenuta insieme al blocco finale quando lo spazio è disponibile.
  const veterinarianName=String(cfg.VETERINARIAN_NAME||'').trim();
  const veterinarianQualification=String(cfg.VETERINARIAN_QUALIFICATION||'Medico veterinario').trim();
  const signatureSpace=13;

  if(y+signatureSpace>contentBottom){
    addNewPage();
  }

  {
    doc.setDrawColor(205,218,222);
    doc.line(margin,y,pageWidth-margin,y);
    y+=3.5;

    doc.setFont('helvetica','normal');
    doc.setFontSize(7.8);
    doc.setTextColor(90,107,117);
    doc.text('Referto validato dal medico veterinario responsabile.',margin,y);

    doc.setFont('helvetica','bold');
    doc.setFontSize(8);
    doc.setTextColor(44,61,70);
    doc.text(veterinarianName||veterinarianQualification,margin,y+6);

    if(veterinarianName&&veterinarianQualification){
      doc.setFont('helvetica','normal');
      doc.setFontSize(7.1);
      doc.setTextColor(90,107,117);
      doc.text(veterinarianQualification,margin,y+10);
    }

    doc.setDrawColor(120,135,142);
    doc.line(pageWidth-72,y+7,pageWidth-margin,y+7);
    doc.setFont('helvetica','normal');
    doc.setFontSize(7.5);
    doc.setTextColor(90,107,117);
    doc.text('Firma',pageWidth-45,y+11,{align:'center'});
  }

  // Footer definitivo su tutte le pagine, con numero totale.
  const totalPages=doc.getNumberOfPages();
  for(let page=1;page<=totalPages;page+=1){
    doc.setPage(page);
    doc.setDrawColor(205,218,222);
    doc.setLineWidth(0.2);
    doc.line(margin,footerLineY,pageWidth-margin,footerLineY);

    doc.setFont('helvetica','normal');
    doc.setFontSize(8);
    doc.setTextColor(90,107,117);
    doc.text('VetCardio - Referto elettrocardiografico',margin,footerTextY);
    doc.text(`Pagina ${page} di ${totalPages}`,pageWidth-46,footerTextY,{align:'left'});
  }

  const filename=`VetCardio_ECG_${v.visit_date||'data'}_${safePdfFilename(owner.surname||'proprietario')}_${safePdfFilename(patientName)}.pdf`;
  doc.save(filename);
}

function diagnosisDot(state,species=''){
  const items=buildDiagnosisItems(state,species);
  if(state.diagnosisReviewed==='confirmed') return '🟢';
  if(items.length||state.diagnosisFinal||state.diagnosisManual) return '🟠';
  return '⚪';
}

function buildEcgInterpretation(state,species=''){
  const auto=buildAutomaticDiagnosis(state,species);
  if(auto.summary==='Esame elettrocardiografico nei limiti della norma.') return auto.summary;
  const parts=[];
  if(wanderingSuggested(state)&&state.wanderingDecision==='confirm') parts.push('Il tracciato è compatibile con ritmo sinusale caratterizzato da pacemaker migrante.');
  if(bav1Suggested(state)&&state.bav1Decision==='confirm') parts.push('L’allungamento costante dell’intervallo PR con conduzione 1:1 è compatibile con blocco atrioventricolare di I grado.');
  if(bav2Suggested(state)&&state.bav2Decision==='confirm'){
    parts.push(`La presenza di onde P non condotte è compatibile con ${bav2DiagnosisPhrase(state.bav2Subtype)}.`);
  }

  if(state.ectopyMode==='present'&&state.ectopyDecision!=='reject'){
    const origin=ectopyOriginLabel(state.ectopyOrigin);
    const morphology=ectopyMorphologyLabel(state.ectopyMorphology);
    const patterns=(state.ectopyPatterns||[]).map(ectopyPatternLabel);
    const frequency=ectopyFrequencyLabel(state.ectopyFrequency);

    let ectopySentence='Il tracciato evidenzia extrasistoli';
    if(origin) ectopySentence+=` ${origin}`;
    if(morphology) ectopySentence+=` ${morphology}`;
    if(patterns.length) ectopySentence+=` ${patterns.join(', ')}`;
    if(frequency&&state.ectopyFrequency!=='not_assessed') ectopySentence+=`, ${frequency}`;
    ectopySentence+=' nel tratto registrato.';
    parts.push(ectopySentence);

    const absentComplex=[];
    if(!(state.ectopyPatterns||[]).includes('couplets')) absentComplex.push('coppie');
    if(!(state.ectopyPatterns||[]).includes('triplets')) absentComplex.push('triplette');
    if(!(state.ectopyPatterns||[]).includes('runs')) absentComplex.push('salve');
    if(absentComplex.length===3){
      parts.push('Non si osservano coppie, triplette o salve nel tracciato registrato.');
    }
  }

  const hrInterpretation=heartRateInterpretationText(state);
  if(hrInterpretation) parts.push(hrInterpretation);

  const axis=axisProposal(state,species);
  if(axis&&state.axisDecision==='confirm') parts.push(axis.sentence);
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

function heartRateContextButton(examId,value,label,current){
  const selected=Array.isArray(current)&&current.includes(value);
  return `<button type="button"
    class="exam ${selected?'active':''}"
    aria-pressed="${selected?'true':'false'}"
    data-heart-rate-context-toggle="${examId}"
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

  if(!state.conclusionsEdited&&!state.conclusionsText){
    state.conclusionsText=buildAutomaticConclusions(state,p.species);
  }

  const steps=[
    ['Anamnesi','Sintomi ed episodi riferiti',symptomDot(state),'anamnesi-ecg'],
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
    ['Conclusioni','Sintesi clinica del reperto ECG',conclusionsDot(state,p.species),'conclusioni'],
    ['Coerenza','Controllo di coerenza ECG',consistencyDot(state,p.species),'coerenza'],
    ['Raccomandazioni','Approfondimenti consigliati',recommendationsDot(state,p.species),'raccomandazioni']
  ];

  return `<section class="card">
    <div class="meta">${fmt(v.visit_date)} · ${esc(p.owners.surname)} – ${esc(p.name)}</div>
    <h2>ECG</h2>
    <p class="meta">Compila anamnesi e tracciato: VetCardio integra reperti ECG e sintomi riferiti.</p>
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

      ${state.openStep===key&&key==='anamnesi-ecg'?`
        <div class="card" style="margin:12px 0">
          <h3>Sintomi ed episodi riferiti</h3>
          <p class="meta">I dati strutturati orientano le raccomandazioni. Se compili le note libere, queste diventano la sintesi anamnestica principale.</p>

          <div class="exam-grid">
            ${optionButton(examId,'symptomMode','none','Nessun episodio riferito',state.symptomMode)}
            ${optionButton(examId,'symptomMode','present','Episodi presenti',state.symptomMode)}
          </div>

          ${state.symptomMode==='present'?`
            <p><b>Andamento</b></p>
            <div class="exam-grid">
              ${optionButton(examId,'symptomPattern','paroxysmal','Episodici / parossistici',state.symptomPattern)}
              ${optionButton(examId,'symptomPattern','recurrent','Ricorrenti',state.symptomPattern)}
              ${optionButton(examId,'symptomPattern','persistent','Persistenti',state.symptomPattern)}
              ${optionButton(examId,'symptomPattern','mixed','Misti',state.symptomPattern)}
              ${optionButton(examId,'symptomPattern','uncertain','Non classificabili',state.symptomPattern)}
            </div>

            <p><b>Segni riferiti</b></p>
            <div class="exam-grid">
              ${toggleButton(examId,'symptoms','weakness','Debolezza',state.symptoms)}
              ${toggleButton(examId,'symptoms','syncope','Sincope',state.symptoms)}
              ${toggleButton(examId,'symptoms','collapse','Collasso',state.symptoms)}
              ${toggleButton(examId,'symptoms','exercise_intolerance','Intolleranza all’esercizio',state.symptoms)}
              ${toggleButton(examId,'symptoms','dyspnea','Dispnea',state.symptoms)}
              ${toggleButton(examId,'symptoms','cyanosis','Cianosi',state.symptoms)}
              ${toggleButton(examId,'symptoms','restlessness','Irrequietezza',state.symptoms)}
              ${toggleButton(examId,'symptoms','ataxia','Atassia',state.symptoms)}
              ${toggleButton(examId,'symptoms','reduced_activity','Riduzione dell’attività',state.symptoms)}
              ${toggleButton(examId,'symptoms','behavioral_change','Alterazioni comportamentali',state.symptoms)}
              ${toggleButton(examId,'symptoms','persistent_weakness','Debolezza persistente',state.symptoms)}
              ${toggleButton(examId,'symptoms','other','Altro',state.symptoms)}
            </div>

            <div class="grid" style="margin-top:16px">
              <label>Frequenza degli episodi
                <input value="${esc(state.symptomFrequency)}"
                  data-ecg-input="${examId}" data-field="symptomFrequency"
                  placeholder="es. 2 volte al mese">
              </label>
              <label>Contesto
                <input value="${esc(state.symptomContext)}"
                  data-ecg-input="${examId}" data-field="symptomContext"
                  placeholder="es. a riposo, durante esercizio">
              </label>
              <label>Durata
                <input value="${esc(state.symptomDuration)}"
                  data-ecg-input="${examId}" data-field="symptomDuration"
                  placeholder="es. pochi secondi">
              </label>
              <label>Recupero
                <input value="${esc(state.symptomRecovery)}"
                  data-ecg-input="${examId}" data-field="symptomRecovery"
                  placeholder="es. rapido e completo">
              </label>
            </div>

            <label style="display:block;margin-top:14px">Note sull’episodio
              <textarea rows="4" data-ecg-text="${examId}" data-field="symptomNotes"
                placeholder="Descrizione libera degli episodi...">${esc(state.symptomNotes)}</textarea>
            </label>
          `:''}

          ${buildEcgHistoryText(state)?`
            <div class="notice" style="margin-top:14px">
              <b>Sintesi anamnestica</b><br>${esc(buildEcgHistoryText(state))}
            </div>
          `:''}
        </div>
      `:''}

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

          <p><b>Valutazione rispetto al contesto</b></p>
          <div class="exam-grid">
            ${optionButton(examId,'heartRateAssessment','low','Ridotta',state.heartRateAssessment)}
            ${optionButton(examId,'heartRateAssessment','appropriate','Adeguata',state.heartRateAssessment)}
            ${optionButton(examId,'heartRateAssessment','high','Aumentata',state.heartRateAssessment)}
            ${optionButton(examId,'heartRateAssessment','not_assessed','Non classificata',state.heartRateAssessment)}
          </div>

          <p><b>Contesto di registrazione</b></p>
          <div class="exam-grid">
            ${heartRateContextButton(examId,'awake','Da sveglio',state.heartRateContexts)}
            ${heartRateContextButton(examId,'resting','A riposo',state.heartRateContexts)}
            ${heartRateContextButton(examId,'stressed','Stress / agitazione',state.heartRateContexts)}
            ${heartRateContextButton(examId,'sedated','Sedazione',state.heartRateContexts)}
            ${heartRateContextButton(examId,'anesthetized','Anestesia',state.heartRateContexts)}
            ${heartRateContextButton(examId,'exercise','Dopo esercizio',state.heartRateContexts)}
            ${heartRateContextButton(examId,'unknown','Non definito',state.heartRateContexts)}
          </div>
          <p class="meta">Puoi associare, per esempio, “Da sveglio” e “A riposo”. Sedazione e anestesia restano alternative allo stato di veglia.</p>

          ${heartRateProposal(state)?`
            <div class="notice" style="margin-top:14px">
              <b>Valutazione proposta</b><br>
              ${esc(heartRateProposal(state))}
              <p><b>Confermi questa interpretazione?</b></p>
              <div class="exam-grid">
                ${optionButton(examId,'heartRateDecision','confirm','Confermo',state.heartRateDecision)}
                ${optionButton(examId,'heartRateDecision','reject','Non confermo',state.heartRateDecision)}
                ${optionButton(examId,'heartRateDecision','inconclusive','Non conclusivo',state.heartRateDecision)}
              </div>
            </div>
          `:''}

          <div class="notice" style="margin-top:14px">
            VetCardio non assegna automaticamente bradicardia o tachicardia dal solo valore numerico: specie, stato di coscienza, stress, sedazione e ritmo devono essere considerati insieme.
          </div>
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

            <label style="margin-top:16px">Descrizione libera della conduzione
              <textarea data-ecg-text="${examId}" data-field="conductionNotes"
                placeholder="Es. Periodica mancata conduzione di onde P, con intervallo PR stabile nei battiti condotti...">${esc(state.conductionNotes)}</textarea>
            </label>

            <div class="notice" style="margin-top:14px">
              <b>Conferma diagnostica</b><br>
              ${state.bav2Subtype
                ?`BAV di II grado — ${esc(bav2SubtypeLabel(state.bav2Subtype))}.`
                :'Seleziona il sottotipo, quindi conferma il reperto.'
              }
              <div class="exam-grid" style="margin-top:10px">
                ${optionButton(examId,'bav2Decision','confirm','Confermo',state.bav2Decision)}
                ${optionButton(examId,'bav2Decision','reject','Non confermo',state.bav2Decision)}
                ${optionButton(examId,'bav2Decision','inconclusive','Non conclusivo',state.bav2Decision)}
              </div>
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

            <p><b>Frequenza nel tracciato</b></p>
            <div class="exam-grid">
              ${optionButton(examId,'ectopyFrequency','occasional','Occasionali',state.ectopyFrequency)}
              ${optionButton(examId,'ectopyFrequency','frequent','Frequenti',state.ectopyFrequency)}
              ${optionButton(examId,'ectopyFrequency','very_frequent','Molto frequenti',state.ectopyFrequency)}
              ${optionButton(examId,'ectopyFrequency','not_assessed','Non quantificata',state.ectopyFrequency)}
            </div>

            ${state.ectopyOrigin==='ventricular'?`
              <p><b>Pausa compensatoria</b></p>
              <div class="exam-grid">
                ${optionButton(examId,'ectopyPause','complete','Completa',state.ectopyPause)}
                ${optionButton(examId,'ectopyPause','incomplete','Incompleta',state.ectopyPause)}
                ${optionButton(examId,'ectopyPause','absent','Assente',state.ectopyPause)}
                ${optionButton(examId,'ectopyPause','not_assessed','Non valutata',state.ectopyPause)}
              </div>

              <p><b>Fenomeno R-on-T</b></p>
              <div class="exam-grid">
                ${optionButton(examId,'ectopyRonT','absent','Assente',state.ectopyRonT)}
                ${optionButton(examId,'ectopyRonT','present','Presente',state.ectopyRonT)}
                ${optionButton(examId,'ectopyRonT','not_assessed','Non valutabile',state.ectopyRonT)}
              </div>
            `:''}

            <label style="margin-top:16px">Descrizione libera delle extrasistoli
              <textarea data-ecg-text="${examId}" data-field="ectopyNotes"
                placeholder="Es. Complessi ventricolari prematuri non preceduti da onda P e seguiti da pausa compensatoria completa.">${esc(state.ectopyNotes)}</textarea>
            </label>

            <div class="notice" style="margin-top:14px">
              <b>Conferma diagnostica</b>
              <div class="exam-grid" style="margin-top:10px">
                ${optionButton(examId,'ectopyDecision','confirm','Confermo',state.ectopyDecision)}
                ${optionButton(examId,'ectopyDecision','reject','Non confermo',state.ectopyDecision)}
                ${optionButton(examId,'ectopyDecision','inconclusive','Non conclusivo',state.ectopyDecision)}
              </div>
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

            <label>QT corretto / QTc (ms)
              <input inputmode="decimal"
                value="${esc(state.qtcValue)}"
                data-ecg-input="${examId}"
                data-field="qtcValue"
                placeholder="calcolato automaticamente">
            </label>
          </div>

          <p><b>Formula QTc</b></p>
          <div class="exam-grid">
            ${optionButton(examId,'qtcFormula','bazett','Bazett',state.qtcFormula)}
            ${optionButton(examId,'qtcFormula','fridericia','Fridericia',state.qtcFormula)}
            ${optionButton(examId,'qtcFormula','other','Altra / manuale',state.qtcFormula)}
          </div>
          ${state.qtValue&&state.heartRate&&state.qtcFormula!=='other'?`
            <div class="notice success">
              QTc calcolato automaticamente da QT e frequenza cardiaca: <b>${esc(state.qtcValue||'—')} ms</b>.
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

      ${state.openStep===key&&key==='conclusioni'?`
        <div class="card" style="margin:12px 0">
          <h3>Conclusioni</h3>
          <p class="meta">VetCardio genera una sintesi clinica dei reperti ECG. Il testo resta sempre modificabile.</p>

          ${(()=>{
            const generated=buildAutomaticConclusions(state,p.species);
            if(!generated){
              return `<div class="notice">
                Non sono ancora presenti elementi sufficienti per generare le conclusioni.
              </div>`;
            }
            return `<div class="notice">
              <b>Conclusioni automatiche proposte</b>
              <div style="margin-top:10px">${esc(generated)}</div>
            </div>`;
          })()}

          <div style="margin-top:16px">
            <button type="button" class="secondary" data-update-conclusions="${examId}">
              Aggiorna conclusioni
            </button>
          </div>

          <label style="display:block;margin-top:16px">
            Conclusioni finali
            <textarea rows="6"
              data-ecg-text="${examId}"
              data-field="conclusionsText"
              placeholder="Le conclusioni verranno generate automaticamente...">${esc(state.conclusionsText||buildAutomaticConclusions(state,p.species))}</textarea>
          </label>

          <div class="notice" style="margin-top:14px">
            Le conclusioni rappresentano una sintesi clinica del reperto elettrocardiografico e non sostituiscono l’inquadramento complessivo del paziente.
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
                ${groupedRecommendations(auto).map(group=>`
                  <div style="margin:12px 0">
                    <b>${esc(group.title)}</b>
                    ${group.items.map(item=>`<div style="margin:7px 0">• ${esc(item.label)}</div>`).join('')}
                  </div>
                `).join('')}
              </div>
              <button type="button" class="secondary" style="margin-top:12px"
                data-apply-auto-recommendations="${examId}">
                Applica i suggerimenti
              </button>
              ${state.recommendationApplyMessage
                ?`<div class="notice success" style="margin-top:12px">${esc(state.recommendationApplyMessage)}</div>`
                :''
              }
            </div>`;
          })()}

          <p><b>Cardiologia</b></p>
          <div class="exam-grid">
            ${toggleButton(examId,'recommendationSelections','echocardiography','Ecocardiografia',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
            ${toggleButton(examId,'recommendationSelections','ecg_control','ECG di controllo',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
            ${toggleButton(examId,'recommendationSelections','holter','Holter 24 ore',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
            ${toggleButton(examId,'recommendationSelections','atropine_test','Test all’atropina',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
            ${toggleButton(examId,'recommendationSelections','continuous_ecg','Monitoraggio ECG continuo',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
          </div>

          <p><b>Laboratorio</b></p>
          <div class="exam-grid">
            ${toggleButton(examId,'recommendationSelections','complete_blood_count','Emocromo completo',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
            ${toggleButton(examId,'recommendationSelections','biochemistry','Profilo biochimico',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
            ${toggleButton(examId,'recommendationSelections','electrolytes','Elettroliti',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
            ${toggleButton(examId,'recommendationSelections','troponin','Troponina cardiaca',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
            ${toggleButton(examId,'recommendationSelections','nt_probnp','NT-proBNP',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
            ${toggleButton(examId,'recommendationSelections','blood_gas','Emogasanalisi',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
          </div>

          <p><b>Urine</b></p>
          <div class="exam-grid">
            ${toggleButton(examId,'recommendationSelections','urinalysis','Esame urine completo',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
            ${toggleButton(examId,'recommendationSelections','upc_ratio','Rapporto PU/CU',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
            ${toggleButton(examId,'recommendationSelections','urine_culture','Urinocoltura',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
          </div>

          <p><b>Diagnostica complementare</b></p>
          <div class="exam-grid">
            ${toggleButton(examId,'recommendationSelections','blood_pressure','Pressione arteriosa',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
            ${toggleButton(examId,'recommendationSelections','thoracic_xrays','Radiografie toraciche',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
            ${toggleButton(examId,'recommendationSelections','abdominal_ultrasound','Ecografia addominale',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
          </div>

          <div class="exam-grid" style="margin-top:10px">
            ${toggleButton(examId,'recommendationSelections','cardiology_consult','Consulenza cardiologica',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
            ${toggleButton(examId,'recommendationSelections','internal_medicine_assessment','Valutazione internistica',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
            ${toggleButton(examId,'recommendationSelections','neurologic_assessment','Valutazione neurologica',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
            ${toggleButton(examId,'recommendationSelections','hospitalization','Ricovero e monitoraggio',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
          </div>

          <p><b>Esito</b></p>
          <div class="exam-grid">
            ${toggleButton(examId,'recommendationSelections','none','Nessun ulteriore approfondimento',state.recommendationSelections).replace('data-ecg-toggle','data-recommendation-toggle')}
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
    ${(()=>{
      const completeness=buildReportCompleteness(state);
      const status=completeness.percent===100
        ? '🟢 Referto completo'
        : completeness.percent>=75
          ? '🟡 Referto quasi completo'
          : '🟠 Referto incompleto';

      return `<div class="card" style="margin:18px 0">
        <h2 style="margin-top:0">Refertazione ECG</h2>
        <div class="notice">
          <b>${status}</b>
          <div style="margin-top:6px">${completeness.percent}% completato</div>
          ${completeness.missing.length?`
            <div class="meta" style="margin-top:8px">
              Mancano: ${completeness.missing.map(esc).join(' · ')}
            </div>
          `:''}
        </div>

        <button type="button"
          class="primary"
          style="width:100%;margin-top:14px"
          data-update-full-report="${examId}">
          ✨ Aggiorna referto ECG
        </button>

        ${state.reportUpdatedAt?`
          <div class="meta" style="margin-top:8px">
            Ultimo aggiornamento: ${esc(new Date(state.reportUpdatedAt).toLocaleString('it-IT'))}
          </div>
        `:''}
      </div>`;
    })()}

    <h3>Descrizione elettrocardiografica</h3>
    <p class="meta">Il testo si aggiorna mentre compili.</p>
    <textarea id="ecgDescription" data-ecg-text="${examId}" data-field="description" placeholder="Descrizione elettrocardiografica">${esc(state.description)}</textarea>

    <h3>Interpretazione elettrocardiografica</h3>
    <textarea data-ecg-text="${examId}" data-field="interpretation" placeholder="Diagnosi elettrocardiografica">${esc(state.interpretation)}</textarea>

    <h3>Conclusioni</h3>
    <textarea data-ecg-text="${examId}" data-field="conclusionsText" placeholder="Conclusioni ECG">${esc(state.conclusionsText||buildAutomaticConclusions(state,p.species))}</textarea>

    <h3>Raccomandazioni</h3>
    <textarea data-ecg-text="${examId}" data-field="recommendationText" placeholder="Approfondimenti consigliati">${esc(state.recommendationText||buildRecommendationText(state.recommendationSelections))}</textarea>

    ${state.saved?'<div class="notice success">ECG salvato correttamente.</div>':''}

    <div
      data-ecg-draft-status="${examId}"
      class="${state.draftError?'notice':state.draftSavedAt||state.draftRestored?'notice success':'meta'}"
      style="margin-top:12px">
      ${state.draftError
        ?esc(state.draftError)
        :state.draftRestored
          ?`Bozza locale ripristinata${state.draftSavedAt?` delle ${esc(ecgDraftTimeLabel(state.draftSavedAt))}`:''}.`
          :state.draftSavedAt
            ?`Bozza salvata sul dispositivo alle ${esc(ecgDraftTimeLabel(state.draftSavedAt))}.`
            :'Le modifiche vengono salvate automaticamente sul dispositivo.'
      }
    </div>
  </section>

  <button class="btn fixed" data-save-ecg="${examId}">${state.saving?'Salvataggio…':'Salva ECG'}</button>
  <button class="btn secondary" data-generate-ecg-pdf="${examId}">Esporta referto PDF</button>
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

      if(b.dataset.field==='symptomMode'&&b.dataset.value==='none'){
        state.symptomPattern='';
        state.symptoms=[];
        state.symptomFrequency='';
        state.symptomContext='';
        state.symptomDuration='';
        state.symptomRecovery='';
        state.symptomNotes='';
      }

      if(b.dataset.field==='pWaveMode'&&b.dataset.value==='normal'){
        state.pWaveFindings=[];
      }

      if(b.dataset.field==='heartRateAssessment'){
        state.heartRateDecision='';
      }
      if(b.dataset.field==='qtcFormula'){
        refreshAutomaticQtc(state);
      }
      if(b.dataset.field==='bav2Subtype'){
        state.bav2Decision='';
      }
      if([
        'ectopyMode','ectopyOrigin','ectopyMorphology',
        'ectopyFrequency','ectopyPause','ectopyRonT'
      ].includes(b.dataset.field)){
        state.ectopyDecision='';
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

  document.querySelectorAll('[data-heart-rate-context-toggle]').forEach(b=>{
    b.onclick=()=>{
      const examId=b.dataset.heartRateContextToggle;
      const state=getEcgState(examId);
      const value=b.dataset.value;
      let list=Array.isArray(state.heartRateContexts)
        ? [...state.heartRateContexts]
        : [];

      if(list.includes(value)){
        list=list.filter(item=>item!==value);
      }else{
        if(value==='unknown'){
          list=['unknown'];
        }else{
          list=list.filter(item=>item!=='unknown');

          // Stato di coscienza: una sola scelta.
          if(['awake','sedated','anesthetized'].includes(value)){
            list=list.filter(item=>!['awake','sedated','anesthetized'].includes(item));
          }

          // Condizione del paziente: una sola scelta.
          if(['resting','stressed','exercise'].includes(value)){
            list=list.filter(item=>!['resting','stressed','exercise'].includes(item));
          }

          list.push(value);
        }
      }

      state.heartRateContexts=list;
      state.heartRateDecision='';
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

      if(field==='ectopyPatterns'){
        state.ectopyDecision='';
      }

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
      if(t.dataset.field==='conclusionsText'){
        state.conclusionsEdited=true;
      }
      if(t.dataset.field==='conductionNotes'||t.dataset.field==='ectopyNotes'){
        state.description=buildEcgDescription(state);
      }
      state.saved=false;
    };
  });

  document.querySelectorAll('[data-ecg-input]').forEach(t=>{
    t.oninput=()=>{
      const state=getEcgState(t.dataset.ecgInput);
      state[t.dataset.field]=t.value;
      if(t.dataset.field==='axisValue') state.axisDecision='';
      if(['qtValue','heartRate'].includes(t.dataset.field)&&state.qtcFormula!=='other'){
        refreshAutomaticQtc(state);
      }
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





  document.querySelectorAll('[data-update-full-report]').forEach(button=>{
    button.onclick=()=>{
      const examId=button.dataset.updateFullReport;
      const state=getEcgState(examId);
      const species=speciesForExam(examId);
      const report=buildFinalReport(state,species);

      state.description=report.description;
      state.interpretation=report.interpretation;
      state.conclusionsText=report.conclusions;
      state.conclusionsEdited=false;

      if(report.recommendations){
        state.recommendationText=report.recommendations;
      }

      state.reportUpdatedAt=new Date().toISOString();
      state.saved=false;
      render();
    };
  });

  document.querySelectorAll('[data-update-conclusions]').forEach(button=>{
    button.onclick=()=>{
      const examId=button.dataset.updateConclusions;
      const state=getEcgState(examId);
      state.conclusionsText=buildAutomaticConclusions(state,speciesForExam(examId));
      state.conclusionsEdited=false;
      state.saved=false;
      render();
    };
  });

  document.querySelectorAll('[data-recommendation-toggle]').forEach(button=>{
    button.onclick=()=>{
      const examId=button.dataset.recommendationToggle;
      const value=button.dataset.value;
      const state=getEcgState(examId);

      let list=Array.isArray(state.recommendationSelections)
        ? [...state.recommendationSelections]
        : [];

      if(list.includes(value)){
        list=list.filter(item=>item!==value);
      }else{
        list.push(value);
      }

      if(value==='none'&&list.includes('none')){
        list=['none'];
      }else if(value!=='none'&&list.includes(value)){
        list=list.filter(item=>item!=='none');
      }

      state.recommendationSelections=list;
      state.recommendationText=buildRecommendationText(list);
      state.recommendationApplyMessage='';
      if(!state.conclusionsEdited){
        state.conclusionsText=buildAutomaticConclusions(state,speciesForExam(examId));
      }
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
      state.recommendationApplyMessage=`${auto.length} ${auto.length===1?'raccomandazione applicata':'raccomandazioni applicate'}.`;
      if(!state.conclusionsEdited){
        state.conclusionsText=buildAutomaticConclusions(state,speciesForExam(examId));
      }
      state.saved=false;
      render();
    };
  });

  document.querySelectorAll('[data-generate-ecg-pdf]').forEach(button=>{
    button.onclick=async()=>{
      const original=button.textContent;
      button.disabled=true;
      button.textContent='Generazione PDF…';
      try{
        await generateEcgPdf(button.dataset.generateEcgPdf);
      }catch(error){
        alert(error?.message||'Errore durante la generazione del PDF.');
      }finally{
        button.disabled=false;
        button.textContent=original;
      }
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
          symptomMode:state.symptomMode,
          symptomPattern:state.symptomPattern,
          symptoms:state.symptoms,
          symptomFrequency:state.symptomFrequency,
          symptomContext:state.symptomContext,
          symptomDuration:state.symptomDuration,
          symptomRecovery:state.symptomRecovery,
          symptomNotes:state.symptomNotes,
          pToQrs:state.pToQrs,
          qrsToP:state.qrsToP,
          heartRate:state.heartRate,
          heartRateAssessment:state.heartRateAssessment,
          heartRateContexts:state.heartRateContexts,
          heartRateDecision:state.heartRateDecision,
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
          conductionNotes:state.conductionNotes,
          bav2Subtype:state.bav2Subtype,
          bav2Decision:state.bav2Decision,
          ectopyMode:state.ectopyMode,
          ectopyOrigin:state.ectopyOrigin,
          ectopyPatterns:state.ectopyPatterns,
          ectopyMorphology:state.ectopyMorphology,
          ectopyCount:state.ectopyCount,
          ectopyFrequency:state.ectopyFrequency,
          ectopyPause:state.ectopyPause,
          ectopyRonT:state.ectopyRonT,
          ectopyNotes:state.ectopyNotes,
          ectopyDecision:state.ectopyDecision,
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
          recommendationText:state.recommendationText,
          conclusionsText:state.conclusionsText,
          conclusionsEdited:state.conclusionsEdited,
          reportUpdatedAt:state.reportUpdatedAt
        },
        description:state.description||null,
        interpretation:state.interpretation||null,
        recommendations:state.recommendationText||state.recommendations||null
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

      removeEcgDraft(examId);
      state.draftSavedAt='';
      state.draftRestored=false;
      state.draftError='';
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
