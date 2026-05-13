import { Engine, Renderer } from './engine';
import { GameplayScene } from './scenes/GameplayScene';
import { TEST_LEVEL_DESCRIPTOR } from './scenes/TestLevel';
import { CASTLE_LEVEL_DESCRIPTOR } from './scenes/CastleLevel';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = new Renderer(canvas);

const engine = new Engine();
engine.sceneStack.push(new GameplayScene(renderer, TEST_LEVEL_DESCRIPTOR));
engine.start();

// Level switching: 1 = TestLevel, 2 = Castle
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.code === 'Digit1') {
    engine.sceneStack.replace(new GameplayScene(renderer, TEST_LEVEL_DESCRIPTOR));
  } else if (e.code === 'Digit2') {
    engine.sceneStack.replace(new GameplayScene(renderer, CASTLE_LEVEL_DESCRIPTOR));
  }
});
