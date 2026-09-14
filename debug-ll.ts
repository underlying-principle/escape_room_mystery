import { createLoopState, queueInteract, step } from './src/loop/core/simulation';
import { SWITCH_ZONE } from './src/loop/core/constants';

const state = createLoopState();
state.player.x = SWITCH_ZONE.x + 40;
state.player.y = SWITCH_ZONE.y + 40;
queueInteract(state);
for (let i = 0; i < 5; i++) step(state, 1000 / 60);
console.log('loop1: switchOn =', state.playerSwitchOn, '| actions =', JSON.stringify(state.currentRecording.actions), '| t =', Math.round(state.t));
for (let i = 0; i < 3600; i++) step(state, 1000 / 60);
console.log('after loop: phase =', state.phase, '| loop =', state.loop, '| pastSelves =', state.pastSelves.length, '| ghosts =', state.ghosts.length);
for (let i = 0; i < 180; i++) step(state, 1000 / 60);
console.log('loop2 @3s: phase =', state.phase, '| t =', Math.round(state.t), '| ghostSwitchOn =', state.ghostSwitchOn, '| boxUnlocked =', state.boxUnlocked);
