import { Engine, Renderer } from './engine';
import { GameplayScene } from './scenes/GameplayScene';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = new Renderer(canvas);

const engine = new Engine();
engine.sceneStack.push(new GameplayScene(renderer));
engine.start();
