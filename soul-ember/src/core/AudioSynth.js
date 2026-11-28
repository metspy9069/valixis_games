/** Original procedural audio only: no samples, downloads, or copyrighted recordings. */
class SoulAudio{
 constructor(){this.ctx=null;this.masterGain=null;this.musicGain=null;this.sfxGain=null;this.ambienceGain=null;this.scene='menu';this.step=0;this.timer=null;this.drone=null;this.mix={master:.75,music:.55,sfx:.8,ambience:.5};this.last={};}
 init(){if(this.ctx)return;try{const C=window.AudioContext||window.webkitAudioContext;this.ctx=new C();const compressor=this.ctx.createDynamicsCompressor();compressor.threshold.value=-12;compressor.ratio.value=5;compressor.connect(this.ctx.destination);this.masterGain=this.ctx.createGain();this.masterGain.connect(compressor);this.musicGain=this.ctx.createGain();this.sfxGain=this.ctx.createGain();this.ambienceGain=this.ctx.createGain();for(const bus of [this.musicGain,this.sfxGain,this.ambienceGain])bus.connect(this.masterGain);this.setMix(this.mix);this.startDrone();}catch(error){console.warn('Web Audio unavailable:',error);}}
 resume(){if(this.ctx?.state==='suspended')this.ctx.resume();}
 setMix(mix={}){this.mix={...this.mix,...mix};if(!this.ctx)return;const now=this.ctx.currentTime;for(const [gain,key] of [[this.masterGain,'master'],[this.musicGain,'music'],[this.sfxGain,'sfx'],[this.ambienceGain,'ambience']])gain.gain.setTargetAtTime(this.mix[key],now,.04);}
 setMuted(muted){this.setMix({master:muted?0:(this.mix.master||.75)});}
 setScene(scene){this.scene=scene;this.init();this.resume();this.startMusic();if(this.drone){const freq=scene==='boss'?46:scene==='menu'?55:scene==='danger'?49:41.2;this.drone.frequency.setTargetAtTime(freq,this.ctx.currentTime,.4);}}
 tone(freq,duration=.14,{type='triangle',gain=.18,bus=this.sfxGain,delay=0,slide=1,pan=0}={}){if(!this.ctx||!bus)return;const now=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain(),p=this.ctx.createStereoPanner?.();o.type=type;o.frequency.setValueAtTime(Math.max(20,freq),now);o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*slide),now+duration);g.gain.setValueAtTime(Math.max(.001,gain),now);g.gain.exponentialRampToValueAtTime(.001,now+duration);o.connect(g);if(p){p.pan.value=Math.max(-1,Math.min(1,pan));g.connect(p);p.connect(bus);}else g.connect(bus);o.start(now);o.stop(now+duration+.02);}
 noise(duration=.15,{gain=.16,frequency=700,bus=this.sfxGain,pan=0}={}){if(!this.ctx||!bus)return;const size=Math.ceil(this.ctx.sampleRate*duration),buffer=this.ctx.createBuffer(1,size,this.ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<size;i++)data[i]=(Math.random()*2-1)*(1-i/size);const source=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),g=this.ctx.createGain(),p=this.ctx.createStereoPanner?.();source.buffer=buffer;filter.type='bandpass';filter.frequency.value=frequency;g.gain.value=gain;source.connect(filter);filter.connect(g);if(p){p.pan.value=pan;g.connect(p);p.connect(bus);}else g.connect(bus);source.start();}
 play(event,params={}){if(!this.ctx)return;this.resume();const now=performance.now(),limit=event==='enemyCue'?70:20;if(now-(this.last[event]||0)<limit)return;this.last[event]=now;const pan=params.pan||0;
  if(event==='uiHover')this.tone(620,.035,{gain:.045,pan});
  else if(event==='uiClick')this.tone(920,.06,{gain:.1,slide:.72,pan});
  else if(event==='shoot'){const base={bolt:510,cleave:180,arrow:760,shard:680,spirit:420,chain:880,flask:230,wave:310}[params.kind]||440;this.tone(base,.11,{gain:.16,slide:.42,pan});}
  else if(event==='skill'){this.tone(params.slot?330:540,.28,{type:'sawtooth',gain:.22,slide:1.8,pan});this.noise(.12,{gain:.08,frequency:1300,pan});}
  else if(event==='hurt'){this.tone(115,.17,{type:'sawtooth',gain:.28,slide:.25});this.noise(.1,{gain:.18,frequency:240});}
  else if(event==='dash')this.noise(.18,{gain:.2,frequency:1100,pan});
  else if(event==='ultimate'){[110,220,330,440].forEach((f,i)=>this.tone(f,.65,{type:i?'triangle':'sawtooth',gain:.24,delay:i*.045,slide:.6}));}
  else if(event==='pickup')this.tone(params.kind==='gold'?1046:720,.18,{gain:.16,slide:1.3,pan});
  else if(event==='level')for(const [i,f] of [330,440,554,660].entries())this.tone(f,.3,{gain:.15,delay:i*.07});
  else if(event==='chest')for(const [i,f] of [392,523,659,784].entries())this.tone(f,.4,{gain:.17,delay:i*.06});
  else if(event==='perfectDodge'){this.tone(1320,.35,{type:'sine',gain:.22,slide:.5,pan});this.noise(.25,{gain:.15,frequency:2400,pan});}
  else if(event==='guardBreak'){this.tone(880,.2,{type:'sawtooth',gain:.25,slide:1.5,pan});this.tone(1760,.15,{type:'triangle',gain:.2,slide:.6,pan});this.noise(.12,{gain:.18,frequency:800,pan});}
  else if(event==='motePickup'){const f=params.kind==='crest'?1320:params.kind==='spark'?1180:params.kind==='aegis'?940:840;this.tone(f,.25,{type:'triangle',gain:.2,slide:1.4,pan});}
  else if(event==='enemyCue'){
   const boss=params.boss,attack=params.attack||'';
   if(attack.includes('golem-slam')){
    this.tone(45,.72,{type:'sawtooth',gain:.35,slide:.42,pan});
    this.noise(.38,{gain:.26,frequency:150,pan});
   }else if(attack.includes('hulk-slam')){
    this.tone(70,.65,{type:'sawtooth',gain:.32,slide:.38,pan});
    this.noise(.42,{gain:.28,frequency:180,pan});
   }else if(attack.includes('siren-scream')){
    this.tone(880,.55,{type:'sine',gain:.26,slide:1.5,pan});
    this.tone(1320,.45,{type:'sine',gain:.18,delay:.08,slide:.85,pan});
   }else if(attack.includes('siren-bolt')){
    this.tone(680,.2,{type:'triangle',gain:.2,slide:.5,pan});
    this.noise(.15,{gain:.14,frequency:1400,pan});
   }else if(attack.includes('shifter')){
    this.tone(90,.32,{type:'sawtooth',gain:.28,slide:1.5,pan});
    this.noise(.24,{gain:.22,frequency:420,pan});
   }else if(attack.includes('weaver-web')){
    this.tone(480,.38,{type:'sine',gain:.22,slide:.75,pan});
    this.noise(.28,{gain:.16,frequency:2200,pan});
   }else if(attack.includes('weaver-spore')){
    this.tone(260,.32,{type:'triangle',gain:.2,slide:.45,pan});
    this.noise(.2,{gain:.18,frequency:850,pan});
   }else if(attack.includes('priest')){
    this.tone(523,.42,{type:'triangle',gain:.22,slide:1.25,pan});
    this.tone(784,.32,{type:'sine',gain:.18,delay:.08,slide:.95,pan});
   }else{
    const base=boss?62:attack.includes('ring')?280:attack.includes('charge')?95:170;
    this.tone(base,(boss ? .65 : .24),{type:boss?'sawtooth':'triangle',gain:(boss ? .3 : .12),slide:(boss ? .55 : 1.4),pan});
   }
  }
  else if(event==='bossPhase'){
   [73.4,98,130.8,164.8,220].forEach((f,i)=>this.tone(f,1.1,{type:'sawtooth',gain:.28,delay:i*.06,slide:.62}));
   [261.6,329.6,392].forEach((f,i)=>this.tone(f,.9,{type:'triangle',gain:.18,delay:.1+i*.05,slide:1.05}));
   this.noise(.4,{gain:.2,frequency:650});
  }
  else if(event==='victory')for(const [i,f] of [220,330,440,554,660].entries())this.tone(f,1,{gain:.2,delay:i*.12,bus:this.musicGain});
  else if(event==='defeat'){this.tone(146,1.4,{type:'sawtooth',gain:.22,slide:.3,bus:this.musicGain});}
  else if(event==='shifterUnburrow'){
   this.tone(55,.45,{type:'sawtooth',gain:.34,slide:.35,pan});
   this.noise(.35,{gain:.28,frequency:320,pan});
  }
  else if(event==='altarPact'){
   [110,82,55].forEach((f,i)=>this.tone(f,.45,{type:'sawtooth',gain:.24,delay:i*.08,slide:.65,pan}));
   this.noise(.3,{gain:.15,frequency:180,pan});
  }
  else if(event==='trialStart'){
   this.tone(180,.5,{type:'sawtooth',gain:.28,slide:1.2,pan});
   this.tone(216,.5,{type:'triangle',gain:.22,delay:.1,slide:1.1,pan});
  }
  else if(event==='trialComplete'){
   [523,659,784,1046].forEach((f,i)=>this.tone(f,.48,{type:'triangle',gain:.2,delay:i*.07,pan}));
  }
  else if(event==='campfireRest'){
   this.tone(440,.35,{type:'sine',gain:.2,slide:1.15,pan});
   this.noise(.25,{gain:.12,frequency:850,pan});
  }
   else if(event==='comboRank'){
    const r=params.rank||'C';
    if(r==='C'||r==='B')this.tone(660,.12,{type:'triangle',gain:.16,slide:1.3});
    else if(r==='A'){this.tone(660,.1,{type:'triangle',gain:.18});this.tone(880,.18,{type:'triangle',gain:.22,delay:.08,slide:1.2});}
    else if(r==='S'){[587,880,1174].forEach((f,i)=>this.tone(f,.22,{type:'triangle',gain:.22,delay:i*.07,slide:1.15}));}
    else if(r==='SS'||r==='SSS'){[659,987,1318,1760].forEach((f,i)=>this.tone(f,.28,{type:'sine',gain:.25,delay:i*.06,slide:1.2}));this.noise(.15,{gain:.08,frequency:3200});}
   }
   else if(event==='bossAwaken'){
    // Procedural Cathedral Organ + Low Brass Entrance Chord Progression
    [36.7,55,73.4,110].forEach((f,i)=>this.tone(f,1.4,{type:'sawtooth',gain:.32,delay:i*.04,slide:.75}));
    [146.8,174.6,220,293.7].forEach((f,i)=>this.tone(f,1.2,{type:'triangle',gain:.16,delay:.06+i*.03,slide:.98}));
    this.noise(.85,{gain:.25,frequency:280});
    this.tone(45,1.0,{type:'sine',gain:.38,slide:.65});
    setTimeout(()=>{
     if(!this.ctx)return;
     [58.3,87.3,116.5,174.6,233].forEach((f,i)=>this.tone(f,1.3,{type:i%2?'triangle':'sawtooth',gain:.26,delay:i*.035,slide:.85}));
     this.noise(.5,{gain:.18,frequency:450});
    },480);
   }
 }
 startDrone(){if(!this.ctx||this.drone)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain(),filter=this.ctx.createBiquadFilter();o.type='sawtooth';o.frequency.value=55;filter.type='lowpass';filter.frequency.value=180;g.gain.value=.025;o.connect(filter);filter.connect(g);g.connect(this.ambienceGain);o.start();this.drone=o;}
 startMusic(){if(this.timer||!this.ctx)return;const tick=()=>{if(!this.ctx){this.timer=null;return;}const scene=this.scene,bpm=scene==='boss'?142:scene==='danger'?132:scene==='menu'?78:104,step=this.step++%16,roots=scene==='boss'?[41.2,46.25,49,55]:scene==='menu'?[55,65.4,61.7,49]:[41.2,49,55,46.25],root=roots[Math.floor(step/4)%4];if(step%4===0)this.tone(root,.38,{type:'sine',gain:.15,bus:this.musicGain,slide:.98});if((scene==='danger'||scene==='boss')&&step%4===0)this.tone(95,.09,{type:'sine',gain:.16,bus:this.musicGain,slide:.35});if(step%2===0){const scale=[1,1.2,1.5,1.8,2,1.5,1.2,1.8];this.tone(root*4*scale[step/2],.12,{type:'triangle',gain:scene==='menu'?.045:.075,bus:this.musicGain,slide:.99});}this.timer=setTimeout(tick,(60/bpm)*250);};tick();}
 stopMusic(){clearTimeout(this.timer);this.timer=null;}
 heartbeat(intensity=0.5){
  if(!this.ctx)return;
  const now=performance.now();
  if(now-(this.last.heartbeat||0)<650/(1+intensity*0.8))return;
  this.last.heartbeat=now;
  this.tone(60,.12,{type:'sine',gain:Math.min(.35,.15+intensity*.2),slide:.5});
  setTimeout(()=>{
   if(this.ctx)this.tone(48,.16,{type:'sine',gain:Math.min(.28,.1+intensity*.18),slide:.6});
  },140);
 }
 panFromPlayer(ex,ez,px,pz){
  const dx=Number(ex)-Number(px);
  return Math.max(-1,Math.min(1,(dx||0)/12));
 }
}

export const AudioSys=new SoulAudio();
