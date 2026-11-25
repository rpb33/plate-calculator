import './style.css';
import { calculateSets } from './calculator';
import type { Mode, StageResult } from './calculator';
import { INVENTORY } from './inventory';
import type { Diameter } from './inventory';
import { formatGrams, formatWeight, parseKg, validateWeight } from './weight';

const form = document.querySelector<HTMLFormElement>('#controls')!;
const target = document.querySelector<HTMLInputElement>('#target')!;
const bar = document.querySelector<HTMLInputElement>('#bar')!;
const results = document.querySelector<HTMLDivElement>('#results')!;
const context = document.querySelector<HTMLParagraphElement>('#weight-context')!;
const announcement = document.querySelector<HTMLParagraphElement>('#announcement')!;
const STORAGE_KEY = 'plate-calculator:v1';
let announceTimer: ReturnType<typeof setTimeout>;

function selection(): { mode: Mode; diameter: Diameter } {
  return {
    mode: form.querySelector<HTMLInputElement>('input[name="mode"]:checked')!.value as Mode,
    diameter: Number(form.querySelector<HTMLInputElement>('input[name="diameter"]:checked')!.value) as Diameter,
  };
}

function restore(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return;
    const values = saved as Record<string, unknown>;
    // Preserve the smaller-diameter selection from earlier releases.
    if (values.diameter === 25 || values.diameter === '25') values.diameter = 30;
    if (typeof values.target === 'string' && !validateWeight(values.target, true)) target.value = values.target;
    if (typeof values.bar === 'string' && !validateWeight(values.bar, false)) bar.value = values.bar;
    for (const name of ['mode', 'diameter'] as const) {
      const allowed = name === 'mode' ? ['barbell', 'dumbbell'] : ['30', '50'];
      if (allowed.includes(String(values[name]))) {
        form.querySelector<HTMLInputElement>(`input[name="${name}"][value="${String(values[name])}"]`)!.checked = true;
      }
    }
  } catch { /* Storage can be unavailable or contain stale data. Defaults still work. */ }
}

function renderStage(stage: StageResult, mode: Mode): string {
  const possible = stage.actualG !== null;
  const exact = stage.differenceUnits === 0;
  const label = mode === 'barbell' ? 'Per side' : 'Per end';
  const badges = stage.loading.map(({ plate, count }) =>
    `<span class="plate plate--${plate.color}" aria-label="${count} × ${formatGrams(plate.weightG)} kg, ${plate.color}">${count > 1 ? `${count} × ` : ''}${formatGrams(plate.weightG)}</span>`,
  ).join('');
  return `<article class="set-card${stage.percent === 100 ? ' set-card--target' : ''}${!possible ? ' set-card--unavailable' : ''}" aria-label="${stage.percent}% set">
    <div class="set-top">
      <h3><span class="percentage">${stage.percent}%</span><span class="reps">${stage.reps}</span></h3>
      <p class="achieved${!possible ? ' achieved--unavailable' : ''}">${possible ? `${formatGrams(stage.actualG!)}<span class="kg">kg</span>` : 'Not achievable'}</p>
    </div>
    <div class="set-meta"><span>Requested ${formatWeight(stage.requestedUnits)} kg</span>${possible ? `<span class="difference${exact ? ' difference--exact' : ''}">${exact ? 'Exact' : `−${formatWeight(stage.differenceUnits!)} kg`}</span>` : ''}</div>
    <div class="loading">${possible ? `<span class="loading-label">${label}</span><div class="plates">${badges || '<span class="empty-bar">Empty bar</span>'}</div>` : '<span class="unavailable-reason">Bar is heavier than this set’s target.</span>'}</div>
  </article>`;
}

function update(): void {
  const { mode, diameter } = selection();
  context.textContent = mode === 'barbell'
    ? 'Total includes one bar. Load both sides equally.'
    : 'Weights are for one dumbbell. Load a matched pair equally.';
  let valid = true;
  const errors: string[] = [];
  for (const [input, isTarget] of [[target, true], [bar, false]] as const) {
    const error = validateWeight(input.value, isTarget);
    const message = document.getElementById(`${input.id}-error`)!;
    message.textContent = error;
    message.hidden = !error;
    input.setAttribute('aria-invalid', String(!!error));
    if (error) { valid = false; errors.push(error); }
  }
  clearTimeout(announceTimer);
  if (!valid) {
    results.innerHTML = '<div class="results-placeholder">Enter valid weights to see your four sets.</div>';
    announceTimer = setTimeout(() => { announcement.textContent = errors.join(' '); }, 250);
    return;
  }
  const stages = calculateSets(parseKg(target.value)!, parseKg(bar.value)!, mode, diameter, INVENTORY);
  results.innerHTML = stages.map((stage) => renderStage(stage, mode)).join('');
  announceTimer = setTimeout(() => {
    announcement.textContent = stages.map((stage) => `${stage.percent}%: ${stage.actualG === null ? 'not achievable' : `${formatGrams(stage.actualG)} kg`}`).join('. ') + `; plates shown ${mode === 'barbell' ? 'per side' : 'per end of one dumbbell'}.`;
  }, 250);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ target: target.value, bar: bar.value, mode, diameter })); }
  catch { /* Remembering settings is optional. */ }
}

restore();
form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', update);
update();
