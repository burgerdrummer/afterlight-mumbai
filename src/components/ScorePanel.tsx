import { scoreLabel } from '../core/scoring';
import { dataQuality } from '../core/presentation';
import type { JourneyRoute } from '../core/types';
export function ScorePanel({route}:{route:JourneyRoute}){
  const s=route.score;
  return <section className="score-panel" aria-label="Afterlight Score breakdown"><div className="score-head"><div><span className="eyebrow">AFTERLIGHT SCORE</span><h3>{scoreLabel(s)}</h3><p>{dataQuality(s)} · {Math.round(s.coverage)}% of weighted evidence recorded</p></div></div><p className="score-explanation">A mapped-support score, not a probability of safety. Missing observations add no points. The recommendation is the highest score within your extra-time limit; tied scores favour the shorter journey.</p><div className="score-factors">{s.factors.filter(f=>f.weight>.01).map(f=><div key={f.key}><div><strong>{f.label}</strong><span>{f.earned.toFixed(1)} / {f.weight.toFixed(0)} pts</span></div><div className="factor-track"><i style={{width:`${f.weight?f.earned/f.weight*100:0}%`}}/><em style={{width:`${f.weight?(f.weight-f.known)/f.weight*100:0}%`}}/></div><p>{f.detail}</p></div>)}</div><p className="fine-print">Fixed citywide weights · {s.period} preset · {s.version}. Active weights total 100. Lighting is excluded in daylight. A lower score can reflect less mapping.</p></section>;
}
