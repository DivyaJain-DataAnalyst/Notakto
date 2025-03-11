// ai.ts
import type { BoardState, DifficultyLevel, BoardSize } from './types';

// Optimization: Cache win patterns for different board sizes
const winPatternsCache = new Map<number, number[][]>();

const getWinPatterns = (size: number) => {
  if (winPatternsCache.has(size)) {
    return winPatternsCache.get(size)!;
  }

  const patterns: number[][] = [];
  const sizeSq = size * size;

  // Rows and columns
  for (let i = 0; i < size; i++) {
    const row = Array.from({ length: size }, (_, j) => i * size + j);
    const col = Array.from({ length: size }, (_, j) => i + j * size);
    patterns.push(row, col);
  }

  // Diagonals
  const diag1 = Array.from({ length: size }, (_, i) => i * (size + 1));
  const diag2 = Array.from({ length: size }, (_, i) => (i + 1) * (size - 1));
  patterns.push(diag1, diag2);

  winPatternsCache.set(size, patterns);
  return patterns;
};

// Optimization: Pre-calculate cell strategic values
const cellValueCache = new Map<number, Map<number, number>>();

const getCellValue = (cellIndex: number, boardSize: number) => {
  if (!cellValueCache.has(boardSize)) {
    const size = boardSize;
    const values = new Map<number, number>();
    const center = (size - 1) / 2;
    
    for (let i = 0; i < size * size; i++) {
      const row = Math.floor(i / size);
      const col = i % size;
      values.set(i, -Math.abs(row - center) - Math.abs(col - center));
    }
    
    cellValueCache.set(boardSize, values);
  }
  
  return cellValueCache.get(boardSize)!.get(cellIndex)!;
};

const isBoardDead = (board: BoardState, boardSize: number) => {
  const patterns = getWinPatterns(boardSize);
  for (const pattern of patterns) {
    if (pattern.every(i => board[i] === 'X')) return true;
  }
  return false;
};

const heuristic = (boards: BoardState[], boardSize: number) => {
  let score = 0;
  const patterns = getWinPatterns(boardSize);
  const sizeMinus1 = boardSize - 1;

  for (const board of boards) {
    if (isBoardDead(board, boardSize)) continue;

    let boardScore = 0;
    for (const pattern of patterns) {
      let xCount = 0;
      for (const i of pattern) {
        if (board[i] === 'X') xCount++;
      }
      
      if (xCount === sizeMinus1) {
        boardScore -= 10;
        break; // Highest threat found, skip remaining patterns
      } else if (xCount === sizeMinus1 - 1) {
        boardScore -= 1;
      }
    }
    score += boardScore;
  }
  
  return score;
};

const getValidMoves = (boards: BoardState[], boardSize: number) => {
  const moves: { boardIndex: number; cellIndex: number }[] = [];
  
  for (let boardIndex = 0; boardIndex < boards.length; boardIndex++) {
    const board = boards[boardIndex];
    if (isBoardDead(board, boardSize)) continue;
    
    for (let cellIndex = 0; cellIndex < board.length; cellIndex++) {
      if (board[cellIndex] === '') {
        moves.push({ boardIndex, cellIndex });
      }
    }
  }

  // Sort moves by strategic value (center first)
  moves.sort((a, b) => {
    return getCellValue(b.cellIndex, boardSize) - getCellValue(a.cellIndex, boardSize);
  });

  return moves;
};

const updateBoards = (boards: BoardState[], move: { boardIndex: number; cellIndex: number }) => {
  const newBoards = boards.slice();
  newBoards[move.boardIndex] = [...boards[move.boardIndex]];
  newBoards[move.boardIndex][move.cellIndex] = 'X';
  return newBoards;
};

// Optimization: Dynamic depth calculation
const getMaxDepth = (boardSize: BoardSize, numberOfBoards: number, difficulty: DifficultyLevel) => {
  const complexity = boardSize * numberOfBoards;
  if (complexity <= 9) return Math.min(5, difficulty + 2);  // 3x3 with 3 boards
  if (complexity <= 16) return Math.min(4, difficulty + 1); // 4x4 with 4 boards
  return Math.min(3, difficulty); // Larger configurations
};

const minimax = (
  boards: BoardState[],
  depth: number,
  isMaximizing: boolean,
  boardSize: BoardSize,
  alpha: number,
  beta: number
): number => {
  // Terminal state check
  let allDead = true;
  for (const board of boards) {
    if (!isBoardDead(board, boardSize)) {
      allDead = false;
      break;
    }
  }
  if (allDead) return isMaximizing ? -Infinity : Infinity;

  if (depth === 0) return heuristic(boards, boardSize);

  const moves = getValidMoves(boards, boardSize);
  let bestValue = isMaximizing ? -Infinity : Infinity;

  for (const move of moves) {
    const newBoards = updateBoards(boards, move);
    const value = minimax(newBoards, depth - 1, !isMaximizing, boardSize, alpha, beta);

    if (isMaximizing) {
      bestValue = Math.max(bestValue, value);
      alpha = Math.max(alpha, value);
    } else {
      bestValue = Math.min(bestValue, value);
      beta = Math.min(beta, value);
    }

    if (beta <= alpha) break;
  }

  return bestValue;
};

export const findBestMove = (
  boards: BoardState[],
  difficulty: DifficultyLevel,
  boardSize: BoardSize,
  numberOfBoards: number
) => {
  const moves = getValidMoves(boards, boardSize);
  if (moves.length === 0) return null;

  const maxDepth = getMaxDepth(boardSize, numberOfBoards, difficulty);
  let bestScore = -Infinity;
  let bestMoves: typeof moves = [];

  // Evaluate moves with pruning of clearly bad options
  for (const move of moves) {
    const newBoards = updateBoards(boards, move);
    const moveScore = minimax(newBoards, maxDepth, false, boardSize, -Infinity, Infinity);

    if (moveScore > bestScore) {
      bestScore = moveScore;
      bestMoves = [move];
    } else if (moveScore === bestScore) {
      bestMoves.push(move);
    }

    // Early exit if perfect score found
    if (moveScore === Infinity) break;
  }

  // Return random move from equally good options
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
};