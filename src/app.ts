import * as PIXI from "pixi.js";

const GAME_SIZE = 768;
const N_CELLS = 16; // 16 x 16 cells
const CELL_SIZE = GAME_SIZE / N_CELLS;
const PIECE_SIZE = CELL_SIZE - 12;

const UP = 0;
const RIGHT = 1;
const DOWN = 2;
const LEFT = 3;

let dr = [-1, 0, 1, 0];
let dc = [0, 1, 0, -1];

type GameCellState = {
  // borders[UP] = true if there is a border on the top of the cell
  borders: [boolean, boolean, boolean, boolean];
  piece: GamePieceState | null | "BLOCKED";
};

const COLORS = ["BLUE", "RED", "GREEN", "YELLOW"] as const;
const COLOR_HEX = {
  BLUE: 0x0000ff,
  RED: 0xff0000,
  GREEN: 0x00ff00,
  YELLOW: 0xf1bf00,
};
type GamePieceState = {
  color: (typeof COLORS)[number];
  location: [number, number];
};
type GameTargetState = {
  color: (typeof COLORS)[number];
  location: [number, number];
};

type MoveAction = {
  color: (typeof COLORS)[number];
  from: [number, number];
  to: [number, number];
};

type GameState = {
  board: Array<Array<GameCellState>>;
  pieces: { [key in (typeof COLORS)[number]]: GamePieceState };
  target: GameTargetState;
  activeColor: (typeof COLORS)[number] | null;

  moves: Array<MoveAction>;
  bestSolution: Array<MoveAction> | null;
};

type PixiPieceState = {
  sprite: PIXI.Graphics;
  locations: Array<{
    location: [number, number];
    animationStartTime: number;
  }>;
};

type PixiState = {
  board: PIXI.Container;
  boardCells: Array<Array<PIXI.Graphics>>;
  pieces: {
    [key in (typeof COLORS)[number]]: PixiPieceState;
  };
};

/**
 * Premade boards from the original board game.
 * Assume the upper right is the corner that connects to the center piece.
 * row 0, column 0 is the upper left.
 */
type PremadeBoard = {
  borders: Array<[number, number, number]>; // [row, col, dir]
};

// taken from ricochet-robots.vercel.app
const PREMADE_BOARDS: PremadeBoard[] = [
  // quadrant 0
  {
    borders: [
      [3, 0, DOWN],
      [1, 1, DOWN],
      [1, 1, RIGHT],
      [2, 4, LEFT],
      [2, 4, DOWN],
      [5, 5, UP],
      [5, 5, RIGHT],
      [6, 3, LEFT],
      [6, 3, UP],
      [7, 6, RIGHT],
    ],
  },
  // quadrant 1
  {
    borders: [
      [6, 0, UP],
      [3, 1, DOWN],
      [3, 1, LEFT],
      [6, 2, LEFT],
      [6, 2, UP],
      [1, 3, UP],
      [1, 3, RIGHT],
      [7, 5, RIGHT],
      [4, 6, RIGHT],
      [4, 6, DOWN],
    ],
  },
  // quadrant 2
  {
    borders: [
      [7, 4, LEFT],
      [6, 2, RIGHT],
      [6, 2, DOWN],
      [5, 6, LEFT],
      [5, 6, UP],
      [4, 0, UP],
      [2, 1, UP],
      [2, 1, RIGHT],
      [1, 4, DOWN],
      [1, 4, LEFT],
    ],
  },
  // quadrant 3
  {
    borders: [
      [0, 5, RIGHT],
      [0, 5, DOWN],
      [6, 6, DOWN],
      [6, 6, LEFT],
      [7, 5, LEFT],
      [5, 4, UP],
      [5, 4, LEFT],
      [2, 2, UP],
      [2, 2, RIGHT],
      [3, 0, DOWN],
    ],
  },
];

const addBorder = (board: Array<Array<GameCellState>>, row, col, dir) => {
  board[row][col].borders[dir] = true;
  if (dir === UP && row > 0) {
    board[row - 1][col].borders[DOWN] = true;
  } else if (dir === DOWN && row < N_CELLS - 1) {
    board[row + 1][col].borders[UP] = true;
  } else if (dir === LEFT && col > 0) {
    board[row][col - 1].borders[RIGHT] = true;
  } else if (dir === RIGHT && col < N_CELLS - 1) {
    board[row][col + 1].borders[LEFT] = true;
  }
};

const occupied = (cell: GameCellState) => {
  return cell.piece !== null || cell.piece === "BLOCKED";
};

const getFreeCell = (board: Array<Array<GameCellState>>): [number, number] => {
  while (true) {
    let row = Math.floor(Math.random() * N_CELLS);
    let col = Math.floor(Math.random() * N_CELLS);
    if (occupied(board[row][col])) continue;
    return [row, col];
  }
};

const numBorders = (cell: GameCellState) => {
  let count = 0;
  for (let i = 0; i < 4; i++) {
    if (cell.borders[i]) count++;
  }
  return count;
};

const getLegalTarget = (
  board: Array<Array<GameCellState>>
): GameTargetState => {
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];

  const possibleTargetLocations: Array<[number, number]> = [];
  for (let row = 0; row < N_CELLS; row++) {
    for (let col = 0; col < N_CELLS; col++) {
      if (!occupied(board[row][col]) && numBorders(board[row][col]) === 2) {
        possibleTargetLocations.push([row, col]);
      }
    }
  }
  if (possibleTargetLocations.length === 0) {
    console.error("no legal target locations", board);
    throw new Error("no legal target locations");
  }

  return {
    color,
    location:
      possibleTargetLocations[
        Math.floor(Math.random() * possibleTargetLocations.length)
      ],
  };
};

/**
 * Mutates the given board and adds random borders to it.
 * Relies on the center 4 squares being marked as blocked already.
 * Note that this has a tendency to generate really hard games
 * @param board the board to add random borders to
 */
const addRandomBorders = (board: Array<Array<GameCellState>>) => {
  // for each 8x8 quadrant, add 2 random borders along the edges
  // one in each axis
  for (let quadrant_row = 0; quadrant_row < 2; quadrant_row++) {
    for (let quadrant_col = 0; quadrant_col < 2; quadrant_col++) {
      let row = quadrant_row * (N_CELLS - 1);
      let col = quadrant_col * (N_CELLS - 1);

      let row_offset =
        Math.floor(Math.random() * 6) + 1 + (quadrant_row * N_CELLS) / 2;
      let col_offset =
        Math.floor(Math.random() * 6) + 1 + (quadrant_col * N_CELLS) / 2;

      addBorder(board, row_offset, col, UP);
      addBorder(board, row, col_offset, LEFT);
    }
  }

  // for every quadrant, add 4 L shapes
  for (let quadrant_row = 0; quadrant_row < 2; quadrant_row++) {
    for (let quadrant_col = 0; quadrant_col < 2; quadrant_col++) {
      let row_offset = (quadrant_row * N_CELLS) / 2;
      let col_offset = (quadrant_col * N_CELLS) / 2;

      let N_LS_PER_QUADRANT = 4;
      for (let i = 0; i < N_LS_PER_QUADRANT; i++) {
        while (true) {
          let row =
            row_offset + Math.floor(Math.random() * 7) + 1 - quadrant_row;
          let col =
            col_offset + Math.floor(Math.random() * 7) + 1 - quadrant_col;

          let dir = Math.floor(Math.random() * 4);

          // check if we can place the L shape
          let adjOverlap = false;
          for (let d1 = 0; d1 < 4; d1++) {
            if (
              board[row + dr[d1]][col + dc[d1]].borders[0] ||
              board[row + dr[d1]][col + dc[d1]].borders[1] ||
              board[row + dr[d1]][col + dc[d1]].borders[2] ||
              board[row + dr[d1]][col + dc[d1]].borders[3]
            ) {
              adjOverlap = true;
            }
          }

          if (
            !adjOverlap &&
            !board[row][col].borders[dir] &&
            !board[row][col].borders[(dir + 1) % 4] &&
            !board[row][col].borders[(dir + 2) % 4] &&
            !board[row][col].borders[(dir + 3) % 4]
          ) {
            addBorder(board, row, col, dir);
            addBorder(board, row, col, (dir + 1) % 4);
            break;
          }
        }
      }
    }
  }
};

/**
 * Mutates the given board and adds premade borders to it, based
 * off the boards in the original game
 * @param board the board to add borders to
 */
const addPremadeBorders = (board: Array<Array<GameCellState>>) => {
  // quadrant starts on bottom left, goes clockwise
  // boards are meant for quadrant 0. need to rotate boards for other quadrants
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    let premadeBoard = PREMADE_BOARDS[quadrant];

    for (let border of premadeBoard.borders) {
      let [row, col, dir] = border;
      for (let numRotations = 0; numRotations < quadrant; numRotations++) {
        [row, col] = [col, N_CELLS / 2 - 1 - row];
        dir = (dir + 1) % 4;
      }
      if (quadrant === 0 || quadrant === 3) {
        row += N_CELLS / 2;
      }
      if (quadrant === 2 || quadrant === 3) {
        col += N_CELLS / 2;
      }

      addBorder(board, row, col, dir);
    }
  }
};

const makeGameBoardState = () => {
  const board: Array<Array<GameCellState>> = [];

  for (let row = 0; row < N_CELLS; row++) {
    board[row] = [];
    for (let col = 0; col < N_CELLS; col++) {
      board[row][col] = {
        borders: [false, false, false, false],
        piece: null,
      };
    }
  }

  // borders along the middle 2x2 of the board
  addBorder(board, 7, 7, UP);
  addBorder(board, 7, 7, LEFT);
  addBorder(board, 7, 8, UP);
  addBorder(board, 7, 8, RIGHT);
  addBorder(board, 8, 7, LEFT);
  addBorder(board, 8, 7, DOWN);
  addBorder(board, 8, 8, RIGHT);
  addBorder(board, 8, 8, DOWN);
  board[7][7].piece = "BLOCKED";
  board[7][8].piece = "BLOCKED";
  board[8][7].piece = "BLOCKED";
  board[8][8].piece = "BLOCKED";

  addPremadeBorders(board);

  const pieces = {};
  for (let color of COLORS) {
    let [row, col] = getFreeCell(board);
    let piece: GamePieceState = {
      color,
      location: [row, col],
    };
    board[row][col].piece = piece;
    pieces[color] = piece;
  }

  const state: GameState = {
    board,
    pieces: pieces as any,
    target: getLegalTarget(board),
    activeColor: null,
    moves: [],
    bestSolution: null,
  };

  return state;
};

const getMaxTravelDistance = (
  gameState: GameState,
  location: [number, number],
  dir: number
) => {
  const [row, col] = location;
  for (let steps = 1; steps <= N_CELLS; steps++) {
    let [newRow, newCol] = [row + dr[dir] * steps, col + dc[dir] * steps];

    if (
      newRow < 0 ||
      newRow >= N_CELLS ||
      newCol < 0 ||
      newCol >= N_CELLS ||
      gameState.board[newRow][newCol].borders[(dir + 2) % 4] ||
      occupied(gameState.board[newRow][newCol])
    ) {
      return steps - 1;
    }
  }
  throw new Error("shouldn't happen");
};

const updateUI = (gameState: GameState, pixiState: PixiState) => {
  const activePiece = gameState.activeColor
    ? gameState.pieces[gameState.activeColor]
    : null;

  for (let row = 0; row < N_CELLS; row++) {
    for (let col = 0; col < N_CELLS; col++) {
      pixiState.boardCells[row][col].alpha = 0;
    }
  }

  for (let color of COLORS) {
    if (color === gameState.activeColor) continue;
    let piece = pixiState.pieces[color];
    piece.sprite.width = PIECE_SIZE;
    piece.sprite.height = PIECE_SIZE;
  }

  if (activePiece) {
    let [row, col] = activePiece.location;
    for (let dir = 0; dir < 4; dir++) {
      let maxDist = getMaxTravelDistance(gameState, [row, col], dir);
      for (let steps = 0; steps <= maxDist; steps++) {
        let [newRow, newCol] = [row + dr[dir] * steps, col + dc[dir] * steps];

        pixiState.boardCells[newRow][newCol].tint =
          COLOR_HEX[activePiece.color];
        pixiState.boardCells[newRow][newCol].alpha = 0.2;

        if (steps == maxDist) {
          pixiState.boardCells[newRow][newCol].alpha = 0.4;
        }
      }
    }
  }

  let targetCell =
    pixiState.boardCells[gameState.target.location[0]][
      gameState.target.location[1]
    ];
  targetCell.tint = COLOR_HEX[gameState.target.color];
  targetCell.alpha = 0.5;

  document.getElementById("moves")!.innerText =
    "Moves: " + gameState.moves.length;
  if (gameState.bestSolution !== null)
    document.getElementById("bestSolution")!.innerText =
      "Best solution: " + gameState.bestSolution.length + " moves";
  else
    document.getElementById("bestSolution")!.innerText = "Best solution: none";
};

const executeMove = (
  gameState: GameState,
  pixiState: PixiState,
  move: MoveAction
) => {
  const piece = gameState.pieces[move.color];
  pixiState.pieces[move.color].locations.push({
    location: move.to,
    animationStartTime: -1,
  });
  piece.location = [move.to[0], move.to[1]];
  gameState.board[move.from[0]][move.from[1]].piece = null;
  gameState.board[move.to[0]][move.to[1]].piece = piece;
};

const clearPendingAnimations = (pixiState: PixiState) => {
  for (let piece of Object.values(pixiState.pieces)) {
    piece.locations = [
      {
        location: piece.locations[piece.locations.length - 1].location,
        animationStartTime: -1,
      },
    ];
    piece.sprite.x =
      (piece.locations[0].location[1] + 1) * CELL_SIZE - CELL_SIZE / 2;
    piece.sprite.y =
      (piece.locations[0].location[0] + 1) * CELL_SIZE - CELL_SIZE / 2;
  }
};

(async () => {
  const app = new PIXI.Application({
    background: "#1099bb",
    width: GAME_SIZE,
    height: GAME_SIZE,
    resolution: window.devicePixelRatio,
    autoDensity: true,
  });

  window.addEventListener("resize", () => {
    let width = window.innerWidth;
    if (width < GAME_SIZE) {
      app.renderer.view.style.width = width + "px";
      app.renderer.view.style.height = width + "px";
    } else if (parseInt(app.renderer.view.style.width, 10) < GAME_SIZE) {
      app.renderer.view.style.width = GAME_SIZE + "px";
      app.renderer.view.style.height = GAME_SIZE + "px";
    }
  });

  // this is 2x2 cell
  const boardTexture = await PIXI.Assets.load(
    new URL("board.jpg", import.meta.url).toString()
  );
  const verticalBorderTexture = await PIXI.Assets.load(
    new URL("single_border.png", import.meta.url).toString()
  );
  // width of vertical border
  const SINGLE_BORDER_WIDTH =
    (CELL_SIZE * verticalBorderTexture.width) / verticalBorderTexture.height;
  const crop = new PIXI.Rectangle(
    verticalBorderTexture.frame.x,
    verticalBorderTexture.frame.y,
    verticalBorderTexture.frame.width,
    verticalBorderTexture.frame.height
  );
  const trim = crop;
  let horizontalBorderTexture = new PIXI.Texture(
    verticalBorderTexture,
    verticalBorderTexture.frame,
    crop,
    trim,
    6
  );
  const robotRedTexture = await PIXI.Assets.load(
    new URL("robot_red.png", import.meta.url).toString()
  );
  const robotGreenTexture = await PIXI.Assets.load(
    new URL("robot_green.png", import.meta.url).toString()
  );
  const robotBlueTexture = await PIXI.Assets.load(
    new URL("robot_blue.png", import.meta.url).toString()
  );
  const robotYellowTexture = await PIXI.Assets.load(
    new URL("robot_yellow.png", import.meta.url).toString()
  );
  const robotTextures = {
    RED: robotRedTexture,
    GREEN: robotGreenTexture,
    BLUE: robotBlueTexture,
    YELLOW: robotYellowTexture,
  };

  document.getElementById("game")!.appendChild(app.view);

  const initializePixiState = (gameBoard: GameState): PixiState => {
    const container = new PIXI.Container();

    // draw the tiled board
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

    // draw the center piece
    // const centerPiece = new PIXI.Graphics();
    // centerPiece.beginFill(0x9e8d5c);
    // centerPiece.drawRect(0, 0, CELL_SIZE * 2 + 1, CELL_SIZE * 2 + 1);
    // centerPiece.endFill();
    // centerPiece.x = CELL_SIZE * 7 - 1;
    // centerPiece.y = CELL_SIZE * 7 - 1;
    // container.addChild(centerPiece);

    // draw borders
    for (let row = 0; row < N_CELLS; row++) {
      for (let col = 0; col < N_CELLS; col++) {
        for (let dir = 0; dir < 4; dir++) {
          if (gameBoard.board[row][col].borders[dir]) {
            // const border = new PIXI.Graphics();
            // const borderThickness = 2;
            // border.beginFill(0x000000);
            // switch (dir) {
            //   case UP:
            //     border.drawRect(
            //       0,
            //       0,
            //       CELL_SIZE + borderThickness,
            //       borderThickness
            //     );
            //     border.x = col * CELL_SIZE;
            //     border.y = row * CELL_SIZE;
            //     break;
            //   case DOWN:
            //     border.drawRect(
            //       0,
            //       0,
            //       CELL_SIZE + borderThickness,
            //       borderThickness
            //     );
            //     border.x = col * CELL_SIZE;
            //     border.y = (row + 1) * CELL_SIZE - borderThickness;
            //     break;
            //   case LEFT:
            //     border.drawRect(
            //       0,
            //       0,
            //       borderThickness,
            //       CELL_SIZE + borderThickness
            //     );
            //     border.x = col * CELL_SIZE;
            //     border.y = row * CELL_SIZE;
            //     break;
            //   case RIGHT:
            //     border.drawRect(
            //       0,
            //       0,
            //       borderThickness,
            //       CELL_SIZE + borderThickness
            //     );
            //     border.x = (col + 1) * CELL_SIZE - borderThickness;
            //     border.y = row * CELL_SIZE;
            //     break;
            // }
            // border.endFill();
            // container.addChild(border);

            if (dir === UP) {
              const singleBorder = new PIXI.Sprite(horizontalBorderTexture);
              singleBorder.x = col * CELL_SIZE;
              singleBorder.y = row * CELL_SIZE - SINGLE_BORDER_WIDTH / 2;
              singleBorder.width = CELL_SIZE;
              singleBorder.height = SINGLE_BORDER_WIDTH;
              singleBorder.anchor.set(0);
              container.addChild(singleBorder);
            } else if (dir === RIGHT) {
              const singleBorder = new PIXI.Sprite(verticalBorderTexture);
              singleBorder.x = (col + 1) * CELL_SIZE - SINGLE_BORDER_WIDTH / 2;
              singleBorder.y = row * CELL_SIZE;
              singleBorder.width = SINGLE_BORDER_WIDTH;
              singleBorder.height = CELL_SIZE;
              singleBorder.anchor.set(0);
              container.addChild(singleBorder);
            }
          }
        }
      }
    }

    // draw pieces
    const pixiPieces = {};
    for (let piece of Object.values(gameBoard.pieces)) {
      // let pieceSprite = new PIXI.Graphics();
      // pieceSprite.beginFill(COLOR_HEX[piece.color]);
      // pieceSprite.drawCircle(0, 0, PIECE_SIZE / 2);
      // // add a border
      // pieceSprite.lineStyle(3, 0x000000);
      // pieceSprite.drawCircle(0, 0, PIECE_SIZE / 2 + 1);
      // pieceSprite.endFill();
      let pieceSprite = new PIXI.Sprite(robotTextures[piece.color]);
      pieceSprite.x = (piece.location[1] + 1) * CELL_SIZE - CELL_SIZE / 2;
      pieceSprite.y = (piece.location[0] + 1) * CELL_SIZE - CELL_SIZE / 2;
      pieceSprite.height = PIECE_SIZE;
      pieceSprite.width = PIECE_SIZE;
      pieceSprite.anchor.set(0.5);

      let pieceState: PixiPieceState = {
        sprite: pieceSprite,
        locations: [
          {
            location: piece.location,
            animationStartTime: -1,
          },
        ],
      };
      pixiPieces[piece.color] = pieceState;
    }

    // add placeholders for board cells
    const boardCells: Array<Array<PIXI.Graphics>> = [];
    for (let row = 0; row < N_CELLS; row++) {
      boardCells.push([]);
      for (let col = 0; col < N_CELLS; col++) {
        const boardCell = new PIXI.Graphics();
        boardCell.beginFill(0xffffff);
        boardCell.drawRect(0, 0, CELL_SIZE, CELL_SIZE);
        boardCell.endFill();
        boardCell.x = col * CELL_SIZE;
        boardCell.y = row * CELL_SIZE;
        boardCell.alpha = 0;
        boardCells[row].push(boardCell);
        container.addChild(boardCell);
      }
    }

    return {
      board: container,
      pieces: pixiPieces as any,
      boardCells: boardCells,
    };
  };

  const gameState = makeGameBoardState();
  const pixiState = initializePixiState(gameState);
  updateUI(gameState, pixiState);

  app.stage.addChild(pixiState.board);

  for (let color of COLORS) {
    let piece = pixiState.pieces[color as (typeof COLORS)[number]];
    app.stage.addChild(piece.sprite);
    piece.sprite.eventMode = "static";

    piece.sprite.cursor = "pointer";

    piece.sprite.on("pointerdown", () => {
      gameState.activeColor = color as (typeof COLORS)[number];
      updateUI(gameState, pixiState);
    });
  }

  // add keyboard handler for up / down / left / right / WASD
  const keyMap = {
    ArrowUp: UP,
    ArrowRight: RIGHT,
    ArrowDown: DOWN,
    ArrowLeft: LEFT,
    w: UP,
    d: RIGHT,
    s: DOWN,
    a: LEFT,
  };
  document.addEventListener("keydown", (e) => {
    const dir = keyMap[e.key];
    if (dir === undefined) return;

    if (gameState.activeColor !== null) {
      let piece = gameState.pieces[gameState.activeColor];

      let [row, col] = piece.location;
      const travelDist = getMaxTravelDistance(gameState, [row, col], dir);
      if (travelDist === 0) return;
      let [newRow, newCol] = [
        row + dr[dir] * travelDist,
        col + dc[dir] * travelDist,
      ];

      const moveAction: MoveAction = {
        color: gameState.activeColor,
        from: [row, col],
        to: [newRow, newCol],
      };
      executeMove(gameState, pixiState, moveAction);
      gameState.moves.push(moveAction);

      if (
        gameState.target.location[0] === newRow &&
        gameState.target.location[1] === newCol &&
        gameState.target.color === gameState.activeColor
      ) {
        if (
          gameState.bestSolution === null ||
          gameState.bestSolution.length > gameState.moves.length
        ) {
          gameState.bestSolution = gameState.moves.slice();
        }
        gameState.activeColor = null;
      }

      updateUI(gameState, pixiState);
    }
  });

  document.getElementById("resetRound")!.addEventListener("click", () => {
    while (gameState.moves.length > 0) {
      const move = gameState.moves[gameState.moves.length - 1];
      executeMove(gameState, pixiState, {
        color: move.color,
        from: move.to,
        to: move.from,
      });
      gameState.moves.pop();
    }
    gameState.activeColor = null;

    clearPendingAnimations(pixiState);
    updateUI(gameState, pixiState);
  });

  document.getElementById("newRound")!.addEventListener("click", () => {
    while (gameState.moves.length > 0) {
      const move = gameState.moves[gameState.moves.length - 1];
      executeMove(gameState, pixiState, {
        color: move.color,
        from: move.to,
        to: move.from,
      });
      gameState.moves.pop();
    }
    if (gameState.bestSolution) {
      for (let move of gameState.bestSolution!) {
        executeMove(gameState, pixiState, move);
      }
    }
    gameState.bestSolution = null;
    gameState.activeColor = null;
    gameState.target = getLegalTarget(gameState.board);

    clearPendingAnimations(pixiState);
    updateUI(gameState, pixiState);
  });

  app.ticker.add(() => {
    if (gameState.activeColor !== null) {
      let piece = pixiState.pieces[gameState.activeColor];
      let scale = 1 + 0.075 * Math.sin(app.ticker.lastTime / 150);
      piece.sprite.width = scale * PIECE_SIZE;
      piece.sprite.height = scale * PIECE_SIZE;
    }
    for (let piece of Object.values(pixiState.pieces)) {
      if (piece.locations.length > 1) {
        if (piece.locations[0].animationStartTime === -1) {
          piece.locations[0].animationStartTime = app.ticker.lastTime;
        }
        let totalAnimationTime = 100;

        let [oldRow, oldCol] = piece.locations[0].location;
        let [newRow, newCol] = piece.locations[1].location;
        let oldX = (oldCol + 1) * CELL_SIZE - CELL_SIZE / 2;
        let oldY = (oldRow + 1) * CELL_SIZE - CELL_SIZE / 2;
        let newX = (newCol + 1) * CELL_SIZE - CELL_SIZE / 2;
        let newY = (newRow + 1) * CELL_SIZE - CELL_SIZE / 2;

        let percentage = Math.min(
          1,
          (app.ticker.lastTime - piece.locations[0].animationStartTime) /
            totalAnimationTime
        );
        // from https://easings.net/#easeInOutSine
        let easeInOutPercentage = -(Math.cos(Math.PI * percentage) - 1) / 2;
        piece.sprite.x = (newX - oldX) * easeInOutPercentage + oldX;
        piece.sprite.y = (newY - oldY) * easeInOutPercentage + oldY;

        if (
          app.ticker.lastTime - piece.locations[0].animationStartTime >=
          totalAnimationTime
        ) {
          piece.sprite.x = newX;
          piece.sprite.y = newY;
          piece.locations.splice(0, 1);
        }
      }
    }
  });
})();
