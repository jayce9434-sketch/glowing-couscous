(() => {
  'use strict';

  const $ = (q, root=document) => root.querySelector(q);
  const $$ = (q, root=document) => [...root.querySelectorAll(q)];
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const rand = (a,b) => Math.random()*(b-a)+a;
  const randi = (a,b) => Math.floor(rand(a,b+1));
  const pick = arr => arr[Math.floor(Math.random()*arr.length)];
  const fmt = n => n >= 1000000 ? (n/1000000).toFixed(1)+'m' : n >= 1000 ? (n/1000).toFixed(1)+'k' : Math.floor(n).toString();
  const key = (x,y) => `${x},${y}`;

  const speciesDefs = {
    Ant: {
      color:'#b65f49',
      desc:'Balanced expansionists with disciplined armies and cheap roads.',
      bonus:'+18% expansion, +10% army recovery',
      growth:1.00, build:1.00, military:1.08, economy:1.00, expansion:0.82, defense:1.00,
      unit:'Legion', trait:'Pheromone Roads'
    },
    Termite: {
      color:'#c9ad6b',
      desc:'Fortress builders. Slow expansion, unmatched construction and defense.',
      bonus:'+35% building strength, +30% local defense',
      growth:1.02, build:0.72, military:0.92, economy:1.04, expansion:1.18, defense:1.30,
      unit:'Guard Caste', trait:'Reinforced Mounds'
    },
    Bee: {
      color:'#e2bd49',
      desc:'Fast traders and aerial raiders with strong economy and mobility.',
      bonus:'+25% trade income, +18% attack mobility',
      growth:0.92, build:0.95, military:1.03, economy:1.22, expansion:0.94, defense:0.95,
      unit:'Wing Guard', trait:'Flight Lanes'
    },
    Fly: {
      color:'#6f9c69',
      desc:'Explosive population growth, cheap swarms, rapid colonization.',
      bonus:'+35% population growth, +22% claim speed',
      growth:1.35, build:1.08, military:0.86, economy:1.06, expansion:0.78, defense:0.82,
      unit:'Swarm', trait:'Rapid Broods'
    },
    Spider: {
      color:'#8f6cb5',
      desc:'Low population predators that dominate choke points and defensive wars.',
      bonus:'+45% defense, +25% battle efficiency',
      growth:0.72, build:1.05, military:1.25, economy:0.92, expansion:1.12, defense:1.45,
      unit:'Hunt Pack', trait:'Web Networks'
    }
  };

  const structureDefs = {
    nursery:{name:'Nursery', cost:{food:55,fiber:35}, desc:'Raises brood production and population growth.', color:'#7c9665', pop:0, effect:'growth'},
    farm:{name:'Food Chamber', cost:{fiber:45}, desc:'Steady food production from cultivated stores.', color:'#617a48', effect:'food'},
    barracks:{name:'Barracks', cost:{food:60,fiber:70}, desc:'Trains and houses military castes.', color:'#87574c', effect:'army'},
    wall:{name:'Reinforced Wall', cost:{fiber:55}, desc:'Increases colony and capital defense.', color:'#8a7658', effect:'defense'},
    storage:{name:'Storage', cost:{fiber:40}, desc:'Improves resource efficiency and trade capacity.', color:'#716e55', effect:'economy'},
    tunnel:{name:'Transit Tunnel', cost:{fiber:30}, desc:'Improves movement, expansion and army recovery.', color:'#4d5a46', effect:'mobility'},
    clinic:{name:'Recovery Chamber', cost:{food:40,fiber:55}, desc:'Reduces battle losses and restores armies faster.', color:'#668277', effect:'recovery'},
    watch:{name:'Watch Post', cost:{food:20,fiber:60}, desc:'Adds border defense and intelligence.', color:'#736579', effect:'intel'}
  };

  const resourceTypes = {
    food:{name:'Foodland', color:'#314629', yield:{food:16}},
    fiber:{name:'Fiberland', color:'#493f2e', yield:{fiber:14}},
    brood:{name:'Broodland', color:'#3d344b', yield:{brood:7}},
    mixed:{name:'Mixed Forage', color:'#334038', yield:{food:8,fiber:7}}
  };

  class Hivefall {
    constructor(){
      this.worldCanvas = $('#worldCanvas');
      this.nestCanvas = $('#nestCanvas');
      this.wctx = this.worldCanvas.getContext('2d');
      this.nctx = this.nestCanvas.getContext('2d');
      this.cols = 34; this.rows = 22;
      this.map = [];
      this.colonies = [];
      this.player = null;
      this.selectedSpecies = 'Ant';
      this.selectedCell = null;
      this.selectedBuild = 'nursery';
      this.view = 'world';
      this.sideTab = 'overview';
      this.year = 1;
      this.yearProgress = 0;
      this.speed = 1;
      this.paused = false;
      this.lastTime = performance.now();
      this.accum = 0;
      this.sound = true;
      this.audio = null;
      this.wars = [];
      this.tradeDeals = new Set();
      this.alliances = new Set();
      this.pacts = new Set();
      this.history = [];
      this.nestCols = 18; this.nestRows = 13;
      this.nest = Array.from({length:this.nestRows},()=>Array(this.nestCols).fill(null));
      this.hoverCell = null;
      this.hoverNest = null;
      this.camera = {x:0,y:0,zoom:1};
      this.dragging = false; this.dragStart=null;
      this.tutorialShown=false;
      this.bind();
      this.buildSpeciesCards();
      this.resize();
      requestAnimationFrame(t=>this.loop(t));
    }

    buildSpeciesCards(){
      const grid = $('#speciesGrid'); grid.innerHTML='';
      Object.entries(speciesDefs).forEach(([name,d])=>{
        const card = document.createElement('div');
        card.className='species-card'+(name===this.selectedSpecies?' selected':'');
        card.dataset.species=name;
        card.innerHTML=`<h3>${name}</h3><p>${d.desc}</p><div class="bonus">${d.bonus}</div>`;
        card.onclick=()=>{this.selectedSpecies=name; $$('.species-card').forEach(x=>x.classList.toggle('selected',x.dataset.species===name)); this.clickSound();};
        grid.appendChild(card);
      });
    }

    bind(){
      window.addEventListener('resize',()=>this.resize());
      $('#startGameBtn').onclick=()=>this.startNew();
      $('#loadGameBtn').onclick=()=>this.load();
      $('#pauseBtn').onclick=()=>{this.paused=!this.paused; $('#pauseBtn').textContent=this.paused?'▶':'II'; this.clickSound();};
      $('#soundBtn').onclick=()=>{this.sound=!this.sound; $('#soundBtn').textContent=this.sound?'SFX':'MUTE'; if(this.sound)this.clickSound();};
      $$('.speed-btn').forEach(btn=>btn.onclick=()=>{this.speed=+btn.dataset.speed; $$('.speed-btn').forEach(b=>b.classList.toggle('active',b===btn)); this.clickSound();});
      $$('.view-tab').forEach(btn=>btn.onclick=()=>this.setView(btn.dataset.view));
      $$('.side-tab').forEach(btn=>btn.onclick=()=>{this.sideTab=btn.dataset.side; $$('.side-tab').forEach(b=>b.classList.toggle('active',b===btn)); this.renderSide(); this.clickSound();});
      $('#clearHistoryBtn').onclick=()=>{this.history=[]; this.renderHistory();};
      $('#closeHelpBtn').onclick=()=>$('#helpModal').classList.add('hidden');

      this.worldCanvas.addEventListener('pointerdown',e=>this.worldPointerDown(e));
      this.worldCanvas.addEventListener('pointermove',e=>this.worldPointerMove(e));
      this.worldCanvas.addEventListener('pointerup',e=>this.worldPointerUp(e));
      this.worldCanvas.addEventListener('pointercancel',()=>{this.dragging=false});
      this.worldCanvas.addEventListener('wheel',e=>{e.preventDefault(); const old=this.camera.zoom; this.camera.zoom=clamp(this.camera.zoom*(e.deltaY<0?1.1:.9),.72,2.25); if(old!==this.camera.zoom)this.drawWorld();},{passive:false});
      this.nestCanvas.addEventListener('pointermove',e=>{this.hoverNest=this.getNestCell(e); this.drawNest();});
      this.nestCanvas.addEventListener('pointerdown',e=>{const c=this.getNestCell(e); if(c)this.placeStructure(c.x,c.y);});
    }

    initAudio(){
      if(this.audio) return;
      try{ this.audio = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){}
    }
    tone(freq=220,dur=.06,type='sine',gain=.025){
      if(!this.sound)return; this.initAudio(); if(!this.audio)return;
      const o=this.audio.createOscillator(), g=this.audio.createGain();
      o.type=type;o.frequency.value=freq;g.gain.value=gain;o.connect(g);g.connect(this.audio.destination);o.start();g.gain.exponentialRampToValueAtTime(.0001,this.audio.currentTime+dur);o.stop(this.audio.currentTime+dur);
    }
    clickSound(){this.tone(260,.045,'triangle',.018)}
    successSound(){this.tone(330,.08,'triangle',.03);setTimeout(()=>this.tone(440,.09,'triangle',.02),65)}
    warSound(){this.tone(120,.12,'sawtooth',.025)}

    startNew(){
      const name = ($('#colonyNameInput').value||'Blackroot').trim().slice(0,24);
      this.generateWorld(name,this.selectedSpecies);
      $('#startModal').classList.add('hidden');
      this.tutorialShown=true;
      setTimeout(()=>$('#helpModal').classList.remove('hidden'),250);
      this.successSound();
    }

    generateWorld(playerName,playerSpecies){
      this.year=1; this.yearProgress=0; this.wars=[];this.tradeDeals.clear();this.alliances.clear();this.pacts.clear();this.history=[];
      this.map = Array.from({length:this.rows},(_,y)=>Array.from({length:this.cols},(_,x)=>({
        x,y, type:Math.random()<.30?'food':Math.random()<.52?'fiber':Math.random()<.68?'brood':'mixed', owner:null, fort:0
      })));
      const names=['Blackroot','Stoneveil','Amberwing','Rotbloom','Silkgrave','Redmarch','Mirecoil','Goldhollow','Needleweb','Dustspire','Barkhold','Greenwake'];
      const species=['Ant','Termite','Bee','Fly','Spider'];
      const colors=['#bc604a','#c4a567','#ddbd4a','#76a26e','#906eb4','#5f89b3','#b27754','#6d9a8f'];
      const starts=[];
      const findStart=()=>{
        for(let tries=0;tries<500;tries++){
          const x=randi(3,this.cols-4),y=randi(3,this.rows-4);
          if(starts.every(p=>Math.hypot(p.x-x,p.y-y)>7)){starts.push({x,y});return {x,y};}
        }
        return {x:randi(2,this.cols-3),y:randi(2,this.rows-3)};
      };
      const pstart=findStart();
      this.player=this.makeColony(0,playerName,playerSpecies,speciesDefs[playerSpecies].color,pstart,true);
      this.colonies=[this.player];
      for(let i=1;i<7;i++){
        const sp=species[(i-1)%species.length]; const s=findStart();
        let nm=names[(i+2)%names.length]; if(nm===playerName)nm+=' Pact';
        this.colonies.push(this.makeColony(i,nm,sp,colors[i%colors.length],s,false));
      }
      this.colonies.forEach(c=>this.seedTerritory(c));
      this.nest=Array.from({length:this.nestRows},()=>Array(this.nestCols).fill(null));
      const cx=Math.floor(this.nestCols/2), cy=Math.floor(this.nestRows/2);
      this.nest[cy][cx]={type:'queen',level:1};
      this.nest[cy][cx-1]={type:'tunnel',level:1};
      this.nest[cy][cx+1]={type:'storage',level:1};
      this.addHistory(`The ${playerName} ${playerSpecies} colony was founded beneath an unclaimed frontier.`);
      this.updateAll(); this.save();
    }

    makeColony(id,name,species,color,start,isPlayer){
      return {
        id,name,species,color,start,isPlayer,
        territory:new Set(),
        food:isPlayer?320:randi(240,360),fiber:isPlayer?280:randi(220,330),brood:isPlayer?90:randi(60,110),
        population:isPlayer?75:randi(55,95),army:isPlayer?28:randi(20,38), influence:isPlayer?80:randi(45,90),
        stability:100, aggression:rand(.25,.85), ambition:rand(.35,.95), trust:{}, memory:{},
        armyMax:60, defense:10, economy:10, intel:0, recovery:0,
        lastAction:0, warWeariness:0, victories:0, losses:0
      };
    }

    seedTerritory(c){
      const {x,y}=c.start;
      [[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{const cell=this.cell(x+dx,y+dy); if(cell && cell.owner===null){cell.owner=c.id;c.territory.add(key(cell.x,cell.y));}});
    }

    cell(x,y){return (x>=0&&x<this.cols&&y>=0&&y<this.rows)?this.map[y][x]:null}
    neighbors(cell){return [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>this.cell(cell.x+dx,cell.y+dy)).filter(Boolean)}
    relationKey(a,b){return [Math.min(a,b),Math.max(a,b)].join(':')}
    atWar(a,b){return this.wars.some(w=>(w.a===a&&w.b===b)||(w.a===b&&w.b===a))}
    allied(a,b){return this.alliances.has(this.relationKey(a,b))}
    pact(a,b){return this.pacts.has(this.relationKey(a,b))}
    trading(a,b){return this.tradeDeals.has(this.relationKey(a,b))}

    addHistory(text){
      this.history.unshift({year:this.year,text});
      this.history=this.history.slice(0,70);this.renderHistory();
    }
    toast(text){
      const el=document.createElement('div');el.className='toast';el.textContent=text;$('#toastStack').appendChild(el);setTimeout(()=>el.remove(),3000);
    }

    loop(t){
      const dt=Math.min(.05,(t-this.lastTime)/1000);this.lastTime=t;
      if(this.player&&!this.paused){
        this.accum += dt*this.speed;
        while(this.accum>=.25){this.step(.25);this.accum-=.25;}
      }
      if(this.player){if(this.view==='world')this.drawWorld();else if(this.view==='nest')this.drawNest();}
      requestAnimationFrame(tt=>this.loop(tt));
    }

    step(dt){
      this.yearProgress += dt*.085;
      if(this.yearProgress>=1){this.yearProgress-=1;this.year++;this.yearTick();}
    }

    yearTick(){
      this.colonies.forEach(c=>this.economyTick(c));
      this.wars.slice().forEach(w=>this.warTick(w));
      this.colonies.filter(c=>!c.isPlayer&&c.territory.size>0).forEach(c=>this.aiTick(c));
      this.updateAll();
      if(this.year%2===0)this.save();
    }

    economyTick(c){
      const def=speciesDefs[c.species];
      let foodGain=0,fiberGain=0,broodGain=0;
      c.territory.forEach(k=>{const [x,y]=k.split(',').map(Number);const cell=this.cell(x,y);const yld=resourceTypes[cell.type].yield;foodGain+=yld.food||0;fiberGain+=yld.fiber||0;broodGain+=yld.brood||0;});
      if(c.isPlayer){
        const counts=this.structureCounts();
        foodGain += counts.farm*16;
        fiberGain += counts.storage*2;
        broodGain += counts.nursery*7;
        c.defense = Math.round(8 + counts.wall*9*def.defense + counts.watch*3);
        c.economy = Math.round(10 + counts.storage*5 + counts.farm*3);
        c.intel = counts.watch*2;
        c.recovery = counts.clinic*3 + counts.tunnel;
        c.armyMax = 45 + counts.barracks*28;
      } else {
        c.defense = Math.round(10 + c.territory.size*.55*def.defense);
        c.economy = Math.round(10 + c.territory.size*.65*def.economy);
        c.armyMax = 50 + c.territory.size*5;
      }
      const tradeCount=this.colonies.filter(o=>o.id!==c.id&&this.trading(c.id,o.id)).length;
      foodGain += tradeCount*6*def.economy; fiberGain += tradeCount*5*def.economy; c.influence += tradeCount*2;
      const upkeep = c.population*.10 + c.army*.16;
      c.food += foodGain*def.economy-upkeep;
      c.fiber += fiberGain*def.economy;
      c.brood += broodGain;
      if(c.food>0){
        const room=Math.max(0,c.brood);
        const growth=Math.min(room*.11, Math.max(0,c.food*.025))*def.growth;
        c.population+=growth;c.brood-=growth*.65;
      } else {c.food=0;c.population*=.975;c.stability-=2;}
      const targetArmy=Math.min(c.armyMax,c.population*.40);
      if(c.food>25&&c.army<targetArmy){const recruit=Math.min(targetArmy-c.army,1.2*def.military + (c.isPlayer?this.structureCounts().barracks*.45:.8));c.army+=recruit;c.food-=recruit*1.1;}
      c.army=Math.min(c.army,c.population*.55,c.armyMax);
      c.population=Math.max(2,c.population);c.stability=clamp(c.stability+.25-c.warWeariness*.03,25,100);c.warWeariness=Math.max(0,c.warWeariness-.25);
      c.influence=Math.min(999,c.influence+.5+c.territory.size*.04);
    }

    aiTick(c){
      c.lastAction++;
      const enemies=this.colonies.filter(o=>o.id!==c.id&&o.territory.size>0);
      const warEnemy=enemies.find(o=>this.atWar(c.id,o.id));
      if(warEnemy){
        if(c.army>8&&Math.random()<.62)this.aiAttack(c,warEnemy);
        if(c.warWeariness>28&&Math.random()<.20)this.tryPeace(c,warEnemy,true);
        return;
      }
      const frontier=this.frontierCells(c);
      const neutral=frontier.filter(cell=>cell.owner===null);
      if(neutral.length&&c.food>80&&c.influence>8&&Math.random()<.52*c.ambition){
        const cell=pick(neutral);this.claimCell(c,cell,true);return;
      }
      if(Math.random()<.08){
        const neighborColonies=[...new Set(frontier.filter(x=>x.owner!==null&&x.owner!==c.id).map(x=>x.owner))].map(id=>this.colonies[id]).filter(Boolean);
        if(neighborColonies.length){
          const target=pick(neighborColonies);const rel=this.relationScore(c,target);
          if(c.aggression>.62&&rel<5&&c.army>target.army*.75&&Math.random()<.5){this.declareWar(c,target,true);return;}
          if(rel>12&&Math.random()<.5)this.aiDiplomacy(c,target);
        }
      }
      if(Math.random()<.10){
        const target=pick(enemies);if(target)this.aiDiplomacy(c,target);
      }
    }

    aiDiplomacy(c,o){
      const k=this.relationKey(c.id,o.id);const rel=this.relationScore(c,o);
      if(rel>22&&!this.allied(c.id,o.id)&&!this.atWar(c.id,o.id)){this.alliances.add(k);this.pacts.add(k); if(c.isPlayer||o.isPlayer)this.addHistory(`${c.name} and ${o.name} formed an alliance.`);}
      else if(rel>8&&!this.trading(c.id,o.id)){this.tradeDeals.add(k); if(c.isPlayer||o.isPlayer)this.addHistory(`${c.name} opened a trade route with ${o.name}.`);}
      else if(rel>4&&!this.pact(c.id,o.id)){this.pacts.add(k);}
    }

    relationScore(a,b){
      const base=(a.trust[b.id]??0)+(b.trust[a.id]??0);
      let score=base;
      if(this.trading(a.id,b.id))score+=12;if(this.pact(a.id,b.id))score+=15;if(this.allied(a.id,b.id))score+=28;if(this.atWar(a.id,b.id))score-=60;
      return score;
    }

    frontierCells(c){
      const out=[];const seen=new Set();
      c.territory.forEach(k=>{const [x,y]=k.split(',').map(Number);this.neighbors(this.cell(x,y)).forEach(n=>{const nk=key(n.x,n.y);if(!seen.has(nk)&&n.owner!==c.id){seen.add(nk);out.push(n);}})});
      return out;
    }

    claimCell(c,cell,ai=false){
      if(cell.owner!==null)return false;
      const costFood=28*speciesDefs[c.species].expansion, costInf=7*speciesDefs[c.species].expansion;
      if(c.food<costFood||c.influence<costInf)return false;
      if(!this.neighbors(cell).some(n=>n.owner===c.id))return false;
      c.food-=costFood;c.influence-=costInf;cell.owner=c.id;c.territory.add(key(cell.x,cell.y));
      if(c.isPlayer){this.addHistory(`${c.name} claimed ${resourceTypes[cell.type].name.toLowerCase()} at sector ${cell.x+1}-${cell.y+1}.`);this.toast('Territory claimed.');this.successSound();}
      return true;
    }

    declareWar(a,b,ai=false){
      if(a.id===b.id||this.atWar(a.id,b.id)||a.territory.size===0||b.territory.size===0)return;
      const k=this.relationKey(a.id,b.id);this.alliances.delete(k);this.pacts.delete(k);this.tradeDeals.delete(k);
      this.wars.push({a:a.id,b:b.id,start:this.year,score:0,battles:0});a.trust[b.id]=(a.trust[b.id]||0)-45;b.trust[a.id]=(b.trust[a.id]||0)-55;
      this.addHistory(`${a.name} declared war on ${b.name}.`);this.toast(`${a.name} vs ${b.name}: war declared.`);this.warSound();this.updateAll();
    }

    tryPeace(a,b,ai=false){
      const w=this.wars.find(w=>(w.a===a.id&&w.b===b.id)||(w.a===b.id&&w.b===a.id));if(!w)return;
      const willingness=(a.warWeariness+b.warWeariness)+(Math.abs(w.score)*.7);
      if(ai||willingness>18){
        this.wars=this.wars.filter(x=>x!==w);a.warWeariness*=.35;b.warWeariness*=.35;this.pacts.add(this.relationKey(a.id,b.id));
        this.addHistory(`${a.name} and ${b.name} signed a peace settlement after ${this.year-w.start+1} years of war.`);this.toast('Peace treaty signed.');this.updateAll();
      } else this.toast(`${b.name} refuses peace for now.`);
    }

    aiAttack(c,target){
      const frontier=this.frontierCells(c).filter(cell=>cell.owner===target.id);if(!frontier.length)return;
      const cell=pick(frontier);this.resolveBattle(c,target,cell,true);
    }

    resolveBattle(attacker,defender,cell,ai=false){
      if(!this.atWar(attacker.id,defender.id))return;
      const aDef=speciesDefs[attacker.species], dDef=speciesDefs[defender.species];
      const aCommit=Math.min(attacker.army,Math.max(4,attacker.army*rand(.28,.48)));
      const capital = cell.x===defender.start.x&&cell.y===defender.start.y;
      const fort = (cell.fort||0) + defender.defense*(capital?1.35:.35);
      const dCommit=Math.min(defender.army,Math.max(3,defender.army*rand(.22,.42)));
      const aPower=aCommit*aDef.military*rand(.85,1.15);
      const dPower=(dCommit*dDef.defense + fort)*rand(.85,1.15);
      const win=aPower>dPower;
      const aLoss=Math.min(aCommit,(win?rand(.18,.38):rand(.42,.70))*dPower/Math.max(1,aPower)*aCommit);
      const dLoss=Math.min(dCommit,(win?rand(.45,.74):rand(.16,.34))*aPower/Math.max(1,dPower)*dCommit);
      attacker.army=Math.max(0,attacker.army-aLoss);defender.army=Math.max(0,defender.army-dLoss);attacker.population=Math.max(2,attacker.population-aLoss*.18);defender.population=Math.max(2,defender.population-dLoss*.18);
      attacker.warWeariness+=1.5;defender.warWeariness+=1.5;
      const w=this.wars.find(w=>(w.a===attacker.id&&w.b===defender.id)||(w.a===defender.id&&w.b===attacker.id));if(w)w.battles++;
      if(win){
        defender.territory.delete(key(cell.x,cell.y));attacker.territory.add(key(cell.x,cell.y));cell.owner=attacker.id;cell.fort=Math.max(0,(cell.fort||0)-1);attacker.victories++;defender.losses++;
        if(w)w.score += w.a===attacker.id ? 7 : -7;
        if(attacker.isPlayer||defender.isPlayer){this.addHistory(`${attacker.name} captured sector ${cell.x+1}-${cell.y+1} from ${defender.name}.`);this.toast(`${attacker.name} won the battle for sector ${cell.x+1}-${cell.y+1}.`);}
        if(capital){
          defender.stability-=18;attacker.influence+=18;
          if(attacker.isPlayer||defender.isPlayer)this.addHistory(`${defender.name}'s capital sector fell to ${attacker.name}.`);
        }
      }else{
        if(w)w.score += w.a===attacker.id ? -3 : 3;
        if(attacker.isPlayer||defender.isPlayer)this.toast(`${defender.name} held sector ${cell.x+1}-${cell.y+1}.`);
      }
      if(defender.territory.size===0)this.eliminateColony(defender,attacker);
      this.warSound();this.updateAll();
    }

    eliminateColony(loser,winner){
      this.addHistory(`${loser.name} ceased to exist as an independent colony. ${winner.name} absorbed its remaining forces.`);
      winner.population+=loser.population*.3;winner.influence+=30;loser.army=0;loser.population=0;
      this.wars=this.wars.filter(w=>w.a!==loser.id&&w.b!==loser.id);
    }

    structureCounts(){
      const c={nursery:0,farm:0,barracks:0,wall:0,storage:0,tunnel:0,clinic:0,watch:0,queen:1};
      this.nest.flat().forEach(s=>{if(s&&c[s.type]!==undefined)c[s.type]+=s.level||1});return c;
    }

    placeStructure(x,y){
      if(!this.player)return;
      const existing=this.nest[y][x];
      if(existing){
        if(existing.type==='queen'){this.toast('The queen chamber cannot be upgraded manually.');return;}
        const d=structureDefs[existing.type];
        if((existing.level||1)>=3){this.toast(`${d.name} is already level 3.`);return;}
        const next=(existing.level||1)+1;
        const buildMod=speciesDefs[this.player.species].build;
        const mult=.72*next;
        const cost={food:(d.cost.food||0)*buildMod*mult,fiber:(d.cost.fiber||0)*buildMod*mult};
        if(this.player.food<cost.food||this.player.fiber<cost.fiber){this.toast(`Need ${Math.ceil(cost.food)} food and ${Math.ceil(cost.fiber)} fiber to upgrade.`);return;}
        this.player.food-=cost.food;this.player.fiber-=cost.fiber;existing.level=next;
        this.addHistory(`${d.name} upgraded to level ${next}.`);this.successSound();this.updateAll();this.drawNest();return;
      }
      const d=structureDefs[this.selectedBuild];if(!d)return;
      const buildMod=speciesDefs[this.player.species].build;
      const cost={food:(d.cost.food||0)*buildMod,fiber:(d.cost.fiber||0)*buildMod};
      if(this.player.food<cost.food||this.player.fiber<cost.fiber){this.toast('Not enough resources.');return;}
      const adjacent=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>this.nest[y+dy]?.[x+dx]);
      if(!adjacent){this.toast('Build next to an existing chamber or tunnel.');return;}
      this.player.food-=cost.food;this.player.fiber-=cost.fiber;this.nest[y][x]={type:this.selectedBuild,level:1};
      this.addHistory(`${this.player.name} completed a new ${d.name.toLowerCase()}.`);this.successSound();this.updateAll();this.drawNest();
    }

    setView(view){
      this.view=view;$$('.view-tab').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
      this.worldCanvas.classList.toggle('hidden',view!=='world');this.nestCanvas.classList.toggle('hidden',view!=='nest');$('#mapLegend').classList.toggle('hidden',view!=='world');$('#relationsView').classList.toggle('hidden',view!=='relations');$('#selectionCard').classList.add('hidden');
      if(view==='relations')this.renderRelations();if(view==='nest')this.drawNest();this.clickSound();
    }

    resize(){
      const stage=$('#canvasStage');if(!stage)return;
      const rect=stage.getBoundingClientRect();const dpr=Math.min(2,window.devicePixelRatio||1);
      [this.worldCanvas,this.nestCanvas].forEach(c=>{c.width=Math.max(1,Math.floor(rect.width*dpr));c.height=Math.max(1,Math.floor(rect.height*dpr));c.style.width=rect.width+'px';c.style.height=rect.height+'px';});
      this.dpr=dpr;this.drawWorld();this.drawNest();
    }

    worldMetrics(){
      const w=this.worldCanvas.width/this.dpr,h=this.worldCanvas.height/this.dpr;
      const base=Math.min(w/this.cols,h/this.rows)*this.camera.zoom;
      const mw=this.cols*base,mh=this.rows*base;
      const ox=(w-mw)/2+this.camera.x,oy=(h-mh)/2+this.camera.y;
      return {w,h,base,ox,oy};
    }

    drawWorld(){
      if(!this.player)return;const ctx=this.wctx;const dpr=this.dpr||1;const {w,h,base,ox,oy}=this.worldMetrics();
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#0e130e';ctx.fillRect(0,0,w,h);
      for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++){
        const cell=this.map[y][x],px=ox+x*base,py=oy+y*base;
        const rt=resourceTypes[cell.type];ctx.fillStyle=rt.color;ctx.fillRect(px,py,base+.5,base+.5);
        if(cell.owner!==null){const c=this.colonies[cell.owner];if(c&&c.territory.size>0){ctx.globalAlpha=.58;ctx.fillStyle=c.color;ctx.fillRect(px+1,py+1,base-2,base-2);ctx.globalAlpha=1;}}
        ctx.strokeStyle='rgba(255,255,255,.055)';ctx.lineWidth=.55;ctx.strokeRect(px+.25,py+.25,base-.5,base-.5);
      }
      // Borders
      ctx.lineWidth=Math.max(1.3,base*.09);
      for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++){
        const cell=this.map[y][x];if(cell.owner===null)continue;const c=this.colonies[cell.owner];if(!c)continue;const px=ox+x*base,py=oy+y*base;ctx.strokeStyle=c.color;ctx.beginPath();
        if(!this.cell(x,y-1)||this.cell(x,y-1).owner!==cell.owner){ctx.moveTo(px,py);ctx.lineTo(px+base,py)}
        if(!this.cell(x+1,y)||this.cell(x+1,y).owner!==cell.owner){ctx.moveTo(px+base,py);ctx.lineTo(px+base,py+base)}
        if(!this.cell(x,y+1)||this.cell(x,y+1).owner!==cell.owner){ctx.moveTo(px+base,py+base);ctx.lineTo(px,py+base)}
        if(!this.cell(x-1,y)||this.cell(x-1,y).owner!==cell.owner){ctx.moveTo(px,py+base);ctx.lineTo(px,py)}ctx.stroke();
      }
      // Capitals and labels
      this.colonies.forEach(c=>{if(c.territory.size===0)return;const px=ox+(c.start.x+.5)*base,py=oy+(c.start.y+.5)*base;ctx.fillStyle='#0b0d0a';ctx.beginPath();ctx.arc(px,py,Math.max(3.5,base*.24),0,Math.PI*2);ctx.fill();ctx.strokeStyle=c.color;ctx.lineWidth=2;ctx.stroke();if(base>15){ctx.font=`700 ${clamp(base*.42,9,13)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillStyle='#f0f3ea';ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=3;ctx.fillText(c.name,px,py-base*.34);ctx.shadowBlur=0;}});
      // War front pulses
      this.wars.forEach(war=>{const a=this.colonies[war.a],b=this.colonies[war.b];if(!a||!b)return;const cells=this.frontierCells(a).filter(c=>c.owner===b.id);cells.forEach(c=>{const px=ox+(c.x+.5)*base,py=oy+(c.y+.5)*base;ctx.strokeStyle=`rgba(230,105,88,${.42+.18*Math.sin(performance.now()/250)})`;ctx.lineWidth=2;ctx.strokeRect(px-base*.32,py-base*.32,base*.64,base*.64);});});
      if(this.hoverCell){const c=this.hoverCell;ctx.strokeStyle='#f0f3e8';ctx.lineWidth=1.5;ctx.strokeRect(ox+c.x*base+1,oy+c.y*base+1,base-2,base-2)}
      if(this.selectedCell){const c=this.selectedCell;ctx.strokeStyle='#ffffff';ctx.lineWidth=2.5;ctx.strokeRect(ox+c.x*base+2,oy+c.y*base+2,base-4,base-4)}
    }

    getWorldCell(e){
      const rect=this.worldCanvas.getBoundingClientRect(),mx=e.clientX-rect.left,my=e.clientY-rect.top;const {base,ox,oy}=this.worldMetrics();const x=Math.floor((mx-ox)/base),y=Math.floor((my-oy)/base);return this.cell(x,y);
    }
    worldPointerDown(e){this.dragging=true;this.dragStart={x:e.clientX,y:e.clientY,cx:this.camera.x,cy:this.camera.y,moved:false};this.worldCanvas.setPointerCapture?.(e.pointerId)}
    worldPointerMove(e){
      this.hoverCell=this.getWorldCell(e);
      if(this.dragging&&this.dragStart){const dx=e.clientX-this.dragStart.x,dy=e.clientY-this.dragStart.y;if(Math.hypot(dx,dy)>5)this.dragStart.moved=true;if(this.dragStart.moved){this.camera.x=this.dragStart.cx+dx;this.camera.y=this.dragStart.cy+dy;}}
    }
    worldPointerUp(e){
      const moved=this.dragStart?.moved;this.dragging=false;if(!moved){const c=this.getWorldCell(e);if(c)this.selectWorldCell(c);}this.dragStart=null;
    }

    selectWorldCell(cell){
      this.selectedCell=cell;const owner=cell.owner===null?null:this.colonies[cell.owner];const mine=cell.owner===this.player.id;const adjacent=this.neighbors(cell).some(n=>n.owner===this.player.id);
      const card=$('#selectionCard');card.classList.remove('hidden');
      const resource=resourceTypes[cell.type];let html=`<h4>Sector ${cell.x+1}-${cell.y+1}</h4><p>${resource.name} · ${owner?`Controlled by <b style="color:${owner.color}">${owner.name}</b>`:'Unclaimed frontier'}</p>`;
      html+=`<p>Yield: ${Object.entries(resource.yield).map(([k,v])=>`${v} ${k}`).join(' · ')} per year${cell.fort?` · Fortification ${cell.fort}`:''}</p><div class="button-row">`;
      if(cell.owner===null&&adjacent){html+=`<button class="action-btn primary" id="claimBtn">Claim Territory</button>`;}
      else if(owner&&owner.id!==this.player.id&&adjacent){
        if(this.atWar(this.player.id,owner.id))html+=`<button class="action-btn danger" id="attackBtn">Attack Sector</button>`;
        else html+=`<button class="action-btn" id="inspectNationBtn">Open Diplomacy</button>`;
      } else if(mine){html+=`<button class="action-btn" id="fortifyBtn">Fortify (+1)</button>`;}
      html+=`<button class="action-btn" id="closeSelectionBtn">Close</button></div>`;card.innerHTML=html;
      $('#closeSelectionBtn')?.addEventListener('click',()=>card.classList.add('hidden'));
      $('#claimBtn')?.addEventListener('click',()=>{this.claimCell(this.player,cell);this.updateAll();this.selectWorldCell(cell)});
      $('#attackBtn')?.addEventListener('click',()=>{this.resolveBattle(this.player,owner,cell);this.selectWorldCell(cell)});
      $('#inspectNationBtn')?.addEventListener('click',()=>{this.setView('relations');setTimeout(()=>document.querySelector(`[data-rel-id="${owner.id}"]`)?.scrollIntoView({behavior:'smooth'}),50)});
      $('#fortifyBtn')?.addEventListener('click',()=>{if(this.player.fiber>=45){this.player.fiber-=45;cell.fort=(cell.fort||0)+1;this.addHistory(`Sector ${cell.x+1}-${cell.y+1} was fortified.`);this.successSound();this.updateAll();this.selectWorldCell(cell)}else this.toast('Need 45 fiber.');});
      this.clickSound();
    }

    drawNest(){
      if(!this.player)return;const ctx=this.nctx,dpr=this.dpr||1;const w=this.nestCanvas.width/dpr,h=this.nestCanvas.height/dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#17150f';ctx.fillRect(0,0,w,h);
      const cell=Math.min(w/this.nestCols,h/this.nestRows)*.88, gw=this.nestCols*cell,gh=this.nestRows*cell,ox=(w-gw)/2,oy=(h-gh)/2;
      // soil texture
      ctx.globalAlpha=.14;for(let i=0;i<220;i++){ctx.fillStyle=i%2?'#8f7651':'#5e4f38';ctx.fillRect(Math.random()*w,Math.random()*h,1.5,1.5)}ctx.globalAlpha=1;
      for(let y=0;y<this.nestRows;y++)for(let x=0;x<this.nestCols;x++){
        const px=ox+x*cell,py=oy+y*cell;ctx.strokeStyle='rgba(210,190,150,.07)';ctx.strokeRect(px,py,cell,cell);const s=this.nest[y][x];
        if(s){
          const d=s.type==='queen'?{name:'Queen Chamber',color:'#a58a60'}:structureDefs[s.type];ctx.fillStyle=d.color;ctx.beginPath();ctx.roundRect(px+3,py+3,cell-6,cell-6,Math.min(7,cell*.16));ctx.fill();ctx.strokeStyle='rgba(255,255,255,.18)';ctx.stroke();
          ctx.fillStyle='#f0eadd';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${clamp(cell*.19,8,11)}px system-ui`;const label=s.type==='queen'?'QUEEN':d.name.split(' ')[0].toUpperCase();ctx.fillText(label,px+cell/2,py+cell/2-(s.type==='queen'?0:2));if(s.type!=='queen'&&(s.level||1)>1){ctx.font=`800 ${clamp(cell*.15,7,9)}px system-ui`;ctx.fillStyle='rgba(255,255,255,.78)';ctx.fillText('L'+s.level,px+cell/2,py+cell*.68);}
        }
      }
      if(this.hoverNest){const {x,y}=this.hoverNest;ctx.strokeStyle='#f0f3e8';ctx.lineWidth=2;ctx.strokeRect(ox+x*cell+2,oy+y*cell+2,cell-4,cell-4)}
      this.nestMetrics={cell,ox,oy};
    }
    getNestCell(e){
      if(!this.nestMetrics)this.drawNest();const rect=this.nestCanvas.getBoundingClientRect(),mx=e.clientX-rect.left,my=e.clientY-rect.top,{cell,ox,oy}=this.nestMetrics||{};const x=Math.floor((mx-ox)/cell),y=Math.floor((my-oy)/cell);if(x<0||x>=this.nestCols||y<0||y>=this.nestRows)return null;return{x,y};
    }

    renderSide(){
      if(!this.player)return;const root=$('#sideContent');const c=this.player;
      if(this.sideTab==='overview'){
        const foodFlow=this.estimateFlow('food');
        root.innerHTML=`<div class="side-section"><h4>Colony Orders</h4><div class="command-list"><button class="action-btn" id="helpBtn">Field Manual</button><button class="action-btn" id="saveBtn">Save Game</button><button class="action-btn" id="centerBtn">Center Capital</button><button class="action-btn" id="autoFortBtn">Fortify Capital</button></div></div>
        <div class="side-section"><h4>Food Security</h4><div class="meter"><i style="width:${clamp(45+foodFlow*2,5,100)}%"></i></div><p class="tiny-label">Estimated food flow: ${foodFlow>=0?'+':''}${foodFlow.toFixed(1)} / year</p></div>
        <div class="side-section"><h4>Species Doctrine</h4><div class="military-card"><b>${c.species}: ${speciesDefs[c.species].trait}</b><p>${speciesDefs[c.species].bonus}</p></div></div>`;
        $('#helpBtn').onclick=()=>$('#helpModal').classList.remove('hidden');$('#saveBtn').onclick=()=>{this.save();this.toast('Game saved locally.');this.successSound()};$('#centerBtn').onclick=()=>{this.camera={x:0,y:0,zoom:1};this.setView('world')};$('#autoFortBtn').onclick=()=>{const cap=this.cell(c.start.x,c.start.y);if(c.fiber>=55){c.fiber-=55;cap.fort++;this.addHistory('The capital defenses were reinforced.');this.updateAll()}else this.toast('Need 55 fiber.');};
      } else if(this.sideTab==='build'){
        root.innerHTML=`<div class="side-section"><h4>Structures</h4><div class="build-list">${Object.entries(structureDefs).map(([id,d])=>`<button class="build-btn ${id===this.selectedBuild?'active':''}" data-build="${id}"><b>${d.name}</b><span>${d.desc}</span><small>${d.cost.food?d.cost.food+' food ':''}${d.cost.fiber?d.cost.fiber+' fiber':''}</small></button>`).join('')}</div></div>`;
        $$('.build-btn',root).forEach(b=>b.onclick=()=>{this.selectedBuild=b.dataset.build;this.renderSide();this.setView('nest');this.clickSound()});
      } else {
        const wars=this.wars.filter(w=>w.a===c.id||w.b===c.id);
        root.innerHTML=`<div class="side-section"><h4>Military Readiness</h4><div class="military-card"><b>${speciesDefs[c.species].unit}</b><p>${fmt(c.army)} active fighters · capacity ${fmt(c.armyMax)}</p></div><div class="military-card"><b>Local Defense</b><p>${c.defense} defense from nest structures and species traits.</p></div><div class="military-card"><b>Current Wars</b><p>${wars.length?wars.length+' active conflict(s)':'No active wars.'}</p></div></div><div class="side-section"><h4>Orders</h4><div class="command-list"><button class="action-btn" id="recruitBtn">Mobilize 10</button><button class="action-btn" id="standDownBtn">Stand Down 10</button></div><button class="action-btn" id="relationsBtn" style="margin-top:6px;width:100%">Open Relations Board</button></div>`;
        $('#relationsBtn').onclick=()=>this.setView('relations');
        $('#recruitBtn').onclick=()=>{const amount=Math.min(10,c.armyMax-c.army);if(amount<=0){this.toast('Army is already at capacity.');return;}const food=amount*2.2,brood=amount*.8;if(c.food<food||c.brood<brood){this.toast(`Need ${Math.ceil(food)} food and ${Math.ceil(brood)} brood.`);return;}c.food-=food;c.brood-=brood;c.army+=amount;this.addHistory(`${Math.floor(amount)} new fighters were mobilized.`);this.successSound();this.updateAll();};
        $('#standDownBtn').onclick=()=>{const amount=Math.min(10,c.army);if(amount<=0)return;c.army-=amount;c.food+=amount*.5;this.addHistory(`${Math.floor(amount)} fighters returned to civilian work.`);this.updateAll();};
      }
    }

    estimateFlow(type){
      let v=0;this.player.territory.forEach(k=>{const [x,y]=k.split(',').map(Number);v+=(resourceTypes[this.cell(x,y).type].yield[type]||0)});const counts=this.structureCounts();if(type==='food')v+=counts.farm*16;v*=speciesDefs[this.player.species].economy;if(type==='food')v-=this.player.population*.10+this.player.army*.16;return v;
    }

    renderHistory(){
      const root=$('#historyList');if(!root)return;root.innerHTML=this.history.length?this.history.map(h=>`<div class="history-item"><span class="history-year">Year ${h.year}</span><div>${h.text}</div></div>`).join(''):'<div class="tiny-label">No history recorded yet.</div>';
    }

    renderPowers(){
      const alive=this.colonies.filter(c=>c.territory.size>0).sort((a,b)=>this.powerScore(b)-this.powerScore(a));$('#worldStatus').textContent=`${alive.length} colonies`;
      $('#powerList').innerHTML=alive.map((c,i)=>`<div class="power-row ${c.isPlayer?'player':''}"><span class="rank">#${i+1}</span><div class="power-main"><div class="power-name"><span class="nation-dot" style="display:inline-block;width:7px;height:7px;background:${c.color};margin-right:5px"></span>${c.name}</div><div class="power-sub">${c.species} · ${c.territory.size} regions · ${fmt(c.population)} pop</div></div><div class="power-score">${fmt(this.powerScore(c))}</div></div>`).join('');
    }
    powerScore(c){return c.territory.size*20+c.population*.7+c.army*2+c.influence*.45+c.economy*2}

    renderWars(){
      const root=$('#warList');root.innerHTML=this.wars.length?this.wars.map(w=>{const a=this.colonies[w.a],b=this.colonies[w.b];return `<div class="war-card"><div class="war-title">${a.name} vs ${b.name}</div><div class="war-sub">Year ${w.start} · ${w.battles} battles · War score ${w.score>0?'+':''}${w.score} for ${a.name}</div></div>`}).join(''):'<div class="tiny-label">No active wars.</div>';
    }

    renderRelations(){
      if(!this.player)return;const root=$('#relationsView');const others=this.colonies.filter(c=>c.id!==this.player.id&&c.territory.size>0);
      root.innerHTML=`<div class="relations-grid">${others.map(o=>{
        const war=this.atWar(this.player.id,o.id), ally=this.allied(this.player.id,o.id), pact=this.pact(this.player.id,o.id),trade=this.trading(this.player.id,o.id),rel=this.relationScore(this.player,o);
        return `<div class="relation-card" data-rel-id="${o.id}"><div class="relation-head"><span class="nation-dot" style="background:${o.color}"></span><h3>${o.name}</h3></div><div class="relation-meta">${o.species} · ${o.territory.size} regions · ${fmt(o.army)} army · Relations ${Math.round(rel)}</div><div class="relation-tags">${war?'<span class="tag war">AT WAR</span>':''}${ally?'<span class="tag ally">ALLIANCE</span>':''}${pact?'<span class="tag">PACT</span>':''}${trade?'<span class="tag">TRADE</span>':''}</div><div class="button-grid"><button class="action-btn" data-act="trade" data-id="${o.id}" ${war||trade?'disabled':''}>Propose Trade</button><button class="action-btn" data-act="pact" data-id="${o.id}" ${war||pact?'disabled':''}>Non-Aggression</button><button class="action-btn" data-act="ally" data-id="${o.id}" ${war||ally?'disabled':''}>Alliance</button>${war?`<button class="action-btn" data-act="peace" data-id="${o.id}">Offer Peace</button>`:`<button class="action-btn danger" data-act="war" data-id="${o.id}">Declare War</button>`}</div></div>`;
      }).join('')}</div>`;
      $$('[data-act]',root).forEach(btn=>btn.onclick=()=>this.playerDiplomacy(btn.dataset.act,+btn.dataset.id));
    }

    playerDiplomacy(action,id){
      const o=this.colonies[id],p=this.player,k=this.relationKey(p.id,o.id);if(!o)return;
      const rel=this.relationScore(p,o);
      if(action==='war'){this.declareWar(p,o);}
      else if(action==='peace'){this.tryPeace(p,o);}
      else if(action==='trade'){
        const chance=clamp(.60+rel/120,0.20,.92);if(Math.random()<chance){this.tradeDeals.add(k);p.trust[o.id]=(p.trust[o.id]||0)+5;o.trust[p.id]=(o.trust[p.id]||0)+6;this.addHistory(`${p.name} and ${o.name} opened a trade route.`);this.successSound()}else this.toast(`${o.name} rejected the trade proposal.`);
      } else if(action==='pact'){
        const chance=clamp(.48+rel/100,0.12,.9);if(Math.random()<chance){this.pacts.add(k);p.trust[o.id]=(p.trust[o.id]||0)+7;o.trust[p.id]=(o.trust[p.id]||0)+8;this.addHistory(`${p.name} and ${o.name} signed a non-aggression pact.`);this.successSound()}else this.toast(`${o.name} refused the pact.`);
      } else if(action==='ally'){
        const chance=clamp(.26+rel/95,0.08,.82);if((this.pact(p.id,o.id)||this.trading(p.id,o.id))&&Math.random()<chance){this.alliances.add(k);this.pacts.add(k);p.trust[o.id]=(p.trust[o.id]||0)+12;o.trust[p.id]=(o.trust[p.id]||0)+12;this.addHistory(`${p.name} and ${o.name} formed a military alliance.`);this.successSound()}else this.toast(`${o.name} is not ready to form an alliance.`);
      }
      this.updateAll();this.renderRelations();
    }

    updateAll(){
      if(!this.player)return;const p=this.player;
      $('#foodValue').textContent=fmt(p.food);$('#fiberValue').textContent=fmt(p.fiber);$('#broodValue').textContent=fmt(p.brood);$('#popValue').textContent=fmt(p.population);$('#armyValue').textContent=fmt(p.army);$('#influenceValue').textContent=fmt(p.influence);$('#territoryValue').textContent=p.territory.size;$('#defenseValue').textContent=p.defense;$('#economyValue').textContent=p.economy;$('#stabilityValue').textContent=Math.round(p.stability)+'%';$('#playerName').textContent=p.name;$('#playerSpecies').textContent=`${p.species} Colony · ${speciesDefs[p.species].trait}`;$('#playerDot').style.background=p.color;$('#eraLabel').textContent=`Year ${this.year} · ${this.wars.length} active war${this.wars.length===1?'':'s'}`;
      this.renderSide();this.renderHistory();this.renderPowers();this.renderWars();if(this.view==='relations')this.renderRelations();
    }

    save(){
      if(!this.player)return;try{
        const data={version:1,year:this.year,yearProgress:this.yearProgress,map:this.map,colonies:this.colonies.map(c=>({...c,territory:[...c.territory]})),playerId:this.player.id,nest:this.nest,wars:this.wars,tradeDeals:[...this.tradeDeals],alliances:[...this.alliances],pacts:[...this.pacts],history:this.history};localStorage.setItem('hivefall-save',JSON.stringify(data));
      }catch(e){}
    }
    load(){
      try{
        const raw=localStorage.getItem('hivefall-save');if(!raw){this.toast('No saved colony found.');return;}const d=JSON.parse(raw);this.year=d.year||1;this.yearProgress=d.yearProgress||0;this.map=d.map;this.colonies=d.colonies.map(c=>({...c,territory:new Set(c.territory)}));this.player=this.colonies[d.playerId||0];this.nest=d.nest;this.wars=d.wars||[];this.tradeDeals=new Set(d.tradeDeals||[]);this.alliances=new Set(d.alliances||[]);this.pacts=new Set(d.pacts||[]);this.history=d.history||[];$('#startModal').classList.add('hidden');this.updateAll();this.resize();this.successSound();this.toast('Saved colony loaded.');
      }catch(e){this.toast('Save could not be loaded.');}
    }
  }

  window.hivefall = new Hivefall();
})();
