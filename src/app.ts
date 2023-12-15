import * as PIXI from "pixi.js";

const GAME_SIZE = 768;
const N_CELLS = 16; // 16 x 16 cells
const CELL_SIZE = GAME_SIZE / N_CELLS;
const PIECE_SIZE = CELL_SIZE - 16;

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

type PixiState = {
  board: PIXI.Container;
  boardCells: Array<Array<PIXI.Graphics>>;
  pieces: { [key in (typeof COLORS)[number]]: PIXI.Graphics };
};

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

  return {
    color,
    location:
      possibleTargetLocations[
        Math.floor(Math.random() * possibleTargetLocations.length)
      ],
  };
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
  if (gameState.bestSolution)
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
  pixiState.pieces[move.color].x = (move.to[1] + 1) * CELL_SIZE - CELL_SIZE / 2;
  pixiState.pieces[move.color].y = (move.to[0] + 1) * CELL_SIZE - CELL_SIZE / 2;
  piece.location = [move.to[0], move.to[1]];
  gameState.board[move.from[0]][move.from[1]].piece = null;
  gameState.board[move.to[0]][move.to[1]].piece = piece;
};

(async () => {
  const app = new PIXI.Application({
    background: "#1099bb",
    width: GAME_SIZE,
    height: GAME_SIZE,
    resolution: window.devicePixelRatio,
    autoDensity: true,
  });

  // this is 2x2 cell
  const boardTexture = await PIXI.Assets.load(
    new URL("board.jpg", import.meta.url).toString()
  );

  document.body.appendChild(app.view);

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
    const centerPiece = new PIXI.Graphics();
    centerPiece.beginFill(0x9e8d5c);
    centerPiece.drawRect(0, 0, CELL_SIZE * 2 + 1, CELL_SIZE * 2 + 1);
    centerPiece.endFill();
    centerPiece.x = CELL_SIZE * 7 - 1;
    centerPiece.y = CELL_SIZE * 7 - 1;
    container.addChild(centerPiece);

    // draw borders
    for (let row = 0; row < N_CELLS; row++) {
      for (let col = 0; col < N_CELLS; col++) {
        for (let dir = 0; dir < 4; dir++) {
          if (gameBoard.board[row][col].borders[dir]) {
            const border = new PIXI.Graphics();
            const borderThickness = 2;
            border.beginFill(0x000000);
            switch (dir) {
              case UP:
                border.drawRect(
                  0,
                  0,
                  CELL_SIZE + borderThickness,
                  borderThickness
                );
                border.x = col * CELL_SIZE;
                border.y = row * CELL_SIZE;
                break;
              case DOWN:
                border.drawRect(
                  0,
                  0,
                  CELL_SIZE + borderThickness,
                  borderThickness
                );
                border.x = col * CELL_SIZE;
                border.y = (row + 1) * CELL_SIZE - borderThickness;
                break;
              case LEFT:
                border.drawRect(
                  0,
                  0,
                  borderThickness,
                  CELL_SIZE + borderThickness
                );
                border.x = col * CELL_SIZE;
                border.y = row * CELL_SIZE;
                break;
              case RIGHT:
                border.drawRect(
                  0,
                  0,
                  borderThickness,
                  CELL_SIZE + borderThickness
                );
                border.x = (col + 1) * CELL_SIZE - borderThickness;
                border.y = row * CELL_SIZE;
                break;
            }
            border.endFill();
            container.addChild(border);
          }
        }
      }
    }

    // draw pieces
    const pixiPieces = {};
    for (let piece of Object.values(gameBoard.pieces)) {
      let pieceSprite = new PIXI.Graphics();

      pieceSprite.beginFill(COLOR_HEX[piece.color]);
      pieceSprite.drawCircle(0, 0, PIECE_SIZE / 2);
      // add a border
      pieceSprite.lineStyle(3, 0x000000);
      pieceSprite.drawCircle(0, 0, PIECE_SIZE / 2 + 1);
      pieceSprite.endFill();

      pieceSprite.x = (piece.location[1] + 1) * CELL_SIZE - CELL_SIZE / 2;
      pieceSprite.y = (piece.location[0] + 1) * CELL_SIZE - CELL_SIZE / 2;

      pixiPieces[piece.color] = pieceSprite;
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

  for (let color of Object.keys(pixiState.pieces)) {
    let piece = pixiState.pieces[color];
    app.stage.addChild(piece);
    piece.eventMode = "static";

    piece.cursor = "pointer";

    piece.on("pointerdown", () => {
      gameState.activeColor = color as (typeof COLORS)[number];
      for (let color of Object.keys(pixiState.pieces)) {
        if (color === gameState.activeColor) continue;
        let piece = pixiState.pieces[color];
        piece.scale.x = 1;
        piece.scale.y = 1;
      }
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
    gameState.bestSolution = [];
    gameState.activeColor = null;
    gameState.target = getLegalTarget(gameState.board);

    updateUI(gameState, pixiState);
  });

  app.ticker.add(() => {
    if (gameState.activeColor !== null) {
      let piece = pixiState.pieces[gameState.activeColor];
      piece.scale.x = 1 + 0.075 * Math.sin(app.ticker.lastTime / 200);
      piece.scale.y = 1 + 0.075 * Math.sin(app.ticker.lastTime / 200);
    }
  });
})();
