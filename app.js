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
  if(generated&&!state.description) state.description=generated;

  const steps=[
    ['P-QRS','Relazione tra onde P e complessi QRS',pqrsDot(state),'pqrs'],
    ['FC','Frequenza cardiaca',fcDot(state),'fc'],
    ['Ritmo','Origine e regolarità',rhythmDot(state),'ritmo'],
    ['Onda P','Morfologia e misure',pWaveDot(state),'onda-p'],
    ['QRS','Morfologia, durata e ampiezza','⚪','qrs'],
    ['PR','Intervallo PR','⚪','pr'],
    ['Conduzione','Disturbi della conduzione','⚪','conduzione'],
    ['Extrasistoli','Battiti ectopici','⚪','extrasistoli'],
    ['Onda T','Morfologia dell’onda T','⚪','onda-t'],
    ['QT','Intervallo QT','⚪','qt'],
    ['Asse','Asse elettrico','⚪','asse'],
    ['Diagnosi','Interpretazione elettrocardiografica','⚪','diagnosi'],
    ['Raccomandazioni','Approfondimenti consigliati','⚪','raccomandazioni']
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
    `).join('')}
  </section>

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
      state.description=buildEcgDescription(state);
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
      state[field]=list;
      state.description=buildEcgDescription(state);
      state.saved=false;
      render();
    };
  });

  document.querySelectorAll('[data-ecg-text]').forEach(t=>{
    t.oninput=()=>{
      const state=getEcgState(t.dataset.ecgText);
      state[t.dataset.field]=t.value;
      state.saved=false;
    };
  });

  document.querySelectorAll('[data-ecg-input]').forEach(t=>{
    t.oninput=()=>{
      const state=getEcgState(t.dataset.ecgInput);
      state[t.dataset.field]=t.value;
      state.description=buildEcgDescription(state);
      state.saved=false;
      const description=document.getElementById('ecgDescription');
      if(description) description.value=state.description;
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
          pWaveAmplitude:state.pWaveAmplitude
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
