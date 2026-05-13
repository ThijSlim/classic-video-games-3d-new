import { Engine, Renderer } from './engine';
import { GameplayScene } from './scenes/GameplayScene';
import { TEST_LEVEL_DESCRIPTOR } from './scenes/TestLevel';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = new Renderer(canvas);

const engine = new Engine();
engine.sceneStack.push(new GameplayScene(renderer, TEST_LEVEL_DESCRIPTOR));
engine.start();
