import {repairText} from './contract.ts';

export type NameLabelProps = Readonly<{name: string; role?: string; position: 'left' | 'right'}>;
export const nameLabelTextLimits = {name: {minWords: 1, maxWords: 6, maxChars: 64}, role: {minWords: 1, maxWords: 8, maxChars: 80}} as const;
export const nameLabelDuration = {minSeconds: 2, maxSeconds: 8};
export const repairNameLabel = (input: unknown): NameLabelProps | null => {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const name = repairText(value.name, nameLabelTextLimits.name);
  if (!name || (value.position !== 'left' && value.position !== 'right')) return null;
  const role = repairText(value.role, nameLabelTextLimits.role);
  return {name, ...(role ? {role} : {}), position: value.position};
};
