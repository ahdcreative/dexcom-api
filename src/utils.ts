// src/utils.ts

export type DexcomTrendType =
    | 'DoubleDown'
    | 'SingleDown'
    | 'FortyFiveDown'
    | 'Flat'
    | 'FortyFiveUp'
    | 'SingleUp'
    | 'DoubleUp'
    | 'NotComputable';

export type DexcomDataType = {
    WT: string;
    ST: string;
    DT: string;
    Value: number;
    Trend: DexcomTrendType;
};

export type CGMDataType = {
    date: Date;
    value: number;
    converted: number;
    trend: DexcomTrendType;
};

const UNIT_CONVERT = 18.018018018;
export const toMmol = (value: number) => value / UNIT_CONVERT;
export const toMgDl = (value: number) => value * UNIT_CONVERT;
export const isMgDl = (value: number) => toMmol(value) > 1;

export const transform = (input: DexcomDataType): CGMDataType => {
    const { Value: value, Trend: trend } = input;
    const parsedDate = input.WT.match(/Date\(([0-9]*)\)/);

    if (!parsedDate || !Array.isArray(parsedDate) || !parsedDate[1]) {
        throw new Error('Unable to parse dexcom object WT Date format');
    }

    return {
        date: new Date(Number.parseInt(parsedDate[1], 10)),
        value,
        trend,
        converted: isMgDl(value) ? toMmol(value) : toMgDl(value),
    };
};

export const getLogger = (debug: boolean) => (msg: string) => {
    if (debug) {
        // biome-ignore lint/suspicious/noConsoleLog: This is an intentional debug logger
        console.log(msg);
    }
};