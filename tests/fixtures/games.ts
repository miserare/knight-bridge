export const normal =
  '[Event "Friendly"]\n[White "Zoë 棋手"]\n[Black "B"]\n[Result "1-0"]\n[WhiteElo "1500"]\n[TimeControl "600"]\n[Link "https://www.chess.com/game/live/123"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 1-0';
export const draw = '[Result "1/2-1/2"]\n\n1. Nf3 Nf6 2. Ng1 Ng8 1/2-1/2';
export const enPassant = '[Result "1-0"]\n\n1. e4 a6 2. e5 d5 3. exd6 1-0';
export const promotion =
  '[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n[Result "1-0"]\n\n1. a8=Q+ 1-0';
export const variations =
  '[Result "*"]\n\n1. e4 {hello 棋手} (1. d4 d5 (1... Nf6)) e5 2. Nf3 $1 *';
export const blackStart =
  '[SetUp "1"]\n[FEN "7k/8/8/8/8/8/p7/7K b - - 0 15"]\n[Result "*"]\n\n15... a1=Q+ *';
export const position = "r3k2r/8/8/3pP3/8/8/8/R3K2R w KQkq d6 0 15";
export const timeout =
  '[Termination "won on time"]\n[Result "0-1"]\n\n1. e4 e5 0-1';
