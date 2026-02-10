/**
 * Core type definitions for the decompression compare app.
 */

export interface DiveStop {
  depth: number;
  time: number;
}

export interface DivePhase {
  depth: number;
  duration: number;
  runTime: number;
  action: 'Descend' | 'Ascend' | 'Stay' | 'Deco Stop' | 'Gas Switch' | 'Safety Stop';
  gas?: string;
}

export interface DiveProfile {
  points: ProfilePoint[];
  phases: DivePhase[];
  lastStopEnd?: number;
  lastDepth?: number;
  totalTime?: number;
}

export interface ProfilePoint {
  time: number;
  depth: number;
}

export interface DecoStop {
  depth: number;
  time: number;
  gas?: string;
  gasSwitch?: boolean;
  safetyStop?: boolean;
}

export interface DecoResult {
  decoStops: DecoStop[];
  firstStopDepth: number;
  tissueLoading: number[];
  heLoading: number[] | null;
  ceiling: number;
  noDecoLimit: boolean;
  variant?: string;
  compartmentCount?: number;
  halfTimes?: number[];
  mValues?: number[];
  aValues?: number[];
  bValues?: number[];
}

export interface AlgorithmOptions {
  fO2: number;
  fHe?: number;
  gfLow?: number;
  gfHigh?: number;
  ascentRate?: number;
  decoAscentRate?: number;
  gasSwitches?: GasSwitch[];
  lastStopDepth?: number;
}

export interface GasSwitch {
  depth: number;
  fO2: number;
  fHe?: number;
}

export type AlgorithmFn = (phases: DivePhase[], options: AlgorithmOptions) => DecoResult;

export interface DiveSettings {
  algorithm: string;
  fO2: number;
  fHe: number;
  gfLow: number;
  gfHigh: number;
  descentRate: number;
  ascentRate: number;
  decoAscentRate: number;
  ppO2Max: number;
  ppO2Deco: number;
  decoGas1: { fO2: number } | null;
  decoGas2: { fO2: number } | null;
  gasSwitchTime: boolean;
  lastStopDepth: number;
  sacRate: number;
  tankSize: number;
  tankPressure: number;
  reservePressure: number;
}

export interface CNSResult {
  totalCNS: number;
  perPhase: { cns: number; runningCNS: number }[];
}

export interface OTUResult {
  totalOTU: number;
  perPhase: { otu: number; runningOTU: number }[];
}

export interface GasConsumptionResult {
  totalLiters: number;
  perPhase: { liters: number; runningLiters: number }[];
}

export interface RockBottomResult {
  liters: number;
  bars: number;
  reserveBar: number;
  maxDepth?: number;
}

export interface TurnPressureResult {
  turnPressure: number;
  thirdUsable: number;
  availableLiters: number;
  plannedBars: number;
  startPressure: number;
  sufficient: boolean;
  totalRequired: number;
}

export interface NDLResult {
  ndl: number;
  inDeco: boolean;
  maxDepth?: number;
}
