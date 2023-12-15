import * as PIXI from 'pixi.js';

(async () => {

  const GAME_SIZE = 640;

  const app = new PIXI.Application({ background: '#1099bb', width: GAME_SIZE, height: GAME_SIZE });

  // this is 2x2 cell
  const boardTexture = await PIXI.Assets.load(new URL('board.jpg', import.meta.url).toString());

  document.body.appendChild(app.view);

  const makeGameBoardContainer = () => {
    const container = new PIXI.Container();

    let N_CELLS = 16; // 16 x 16 cells
    let CELL_SIZE = GAME_SIZE / N_CELLS;

    for (let row = 0; row < N_CELLS; row += 2) {
      for (let col = 0; col < N_CELLS; col += 2) {
        const boardCell = new PIXI.Sprite(boardTexture);
        boardCell.height = CELL_SIZE * 2;
        boardCell.width = CELL_SIZE * 2;

        boardCell.x = col * CELL_SIZE;
        boardCell.y = row * CELL_SIZE;
        boardCell.anchor.set(0);

        container.addChild(boardCell);
      }
    }

    const centerPiece = new PIXI.Graphics();
    centerPiece.beginFill(0x9E8D5C);
    centerPiece.drawRect(0, 0, CELL_SIZE * 2 + 1, CELL_SIZE * 2 + 1);
    centerPiece.endFill();
    centerPiece.x = CELL_SIZE * 7 - 1;
    centerPiece.y = CELL_SIZE * 7 - 1;
    container.addChild(centerPiece);

    return container;
  }


  const gameBoardContainer = makeGameBoardContainer();

  app.stage.addChild(gameBoardContainer);

})();