// The legend's "Bring in front of …" restacking on the price pane: what paints directly
// in front of an overlay indicator, and the key that steps it in front of that layer while
// every other layer keeps its own.
import { describe, it, expect } from 'vitest';
import { layerAbove, layerBelow, loweredZ, priceStack, raisedZ, type StackEntry } from '../src/renderers/native/core/overlayStack';

/** The default mount order: each new indicator goes to the bottom, under the candles at 0. */
const DEFAULT: StackEntry[] = [
    { id: 'gaps', z: -3 },
    { id: 'ema', z: -2 },
    { id: 'sma', z: -1 },
];

describe('priceStack', () => {
    it('slots the candles at their key, before an indicator sharing it', () => {
        expect(priceStack(DEFAULT, 0).map((e) => e.id)).toEqual(['gaps', 'ema', 'sma', null]);
        expect(priceStack([{ id: 'a', z: -1 }, { id: 'b', z: 0 }, { id: 'c', z: 2 }], 0).map((e) => e.id)).toEqual(['a', null, 'b', 'c']);
        expect(priceStack([], 0)).toEqual([{ id: null, z: 0 }]);
    });
});

describe('layerAbove', () => {
    const stack = priceStack([...DEFAULT, { id: 'front', z: 1 }], 0);

    it('names the indicator directly in front', () => {
        expect(layerAbove(stack, 'gaps')).toEqual({ indicator: 'ema' });
        expect(layerAbove(stack, 'ema')).toEqual({ indicator: 'sma' });
    });

    it('names the price for the top indicator behind the candles', () => {
        expect(layerAbove(stack, 'sma')).toBe('price');
    });

    it('has nothing above the top of the stack, nor for an indicator outside it', () => {
        expect(layerAbove(stack, 'front')).toBeNull();
        expect(layerAbove(stack, 'volume')).toBeNull();
    });
});

/** Apply a step's key and read the new back-to-front order. */
function apply(indicators: StackEntry[], id: string, z: number | null, candleZ = 0): Array<string | null> {
    expect(z).not.toBeNull();
    const next = indicators.map((e) => (e.id === id ? { ...e, z: z! } : e)).sort((a, b) => a.z - b.z);
    return priceStack(next, candleZ).map((e) => e.id);
}

describe('layerBelow', () => {
    const stack = priceStack([...DEFAULT, { id: 'front', z: 1 }], 0);

    it('names the price for the bottom indicator in front of the candles', () => {
        expect(layerBelow(stack, 'front')).toBe('price');
    });

    it('names the indicator directly behind', () => {
        expect(layerBelow(stack, 'sma')).toEqual({ indicator: 'ema' });
        expect(layerBelow(stack, 'ema')).toEqual({ indicator: 'gaps' });
    });

    it('has nothing behind the bottom of the stack, nor for an indicator outside it', () => {
        expect(layerBelow(stack, 'gaps')).toBeNull();
        expect(layerBelow(stack, 'volume')).toBeNull();
    });
});

describe('loweredZ', () => {
    const lower = (indicators: StackEntry[], id: string): Array<string | null> => apply(indicators, id, loweredZ(priceStack(indicators, 0), id));

    it('sends an indicator behind the one directly behind it, and no further', () => {
        expect(lower(DEFAULT, 'sma')).toEqual(['gaps', 'sma', 'ema', null]);
    });

    it('sends an indicator in front of the candles back behind the price', () => {
        expect(lower([...DEFAULT, { id: 'front', z: 1 }], 'front')).toEqual(['gaps', 'ema', 'sma', 'front', null]);
    });

    it('sends the bottom indicator in front of the price behind it, at the bottom of the stack', () => {
        expect(lower([{ id: 'a', z: 1 }, { id: 'b', z: 2 }], 'a')).toEqual(['a', null, 'b']);
    });

    it('is the inverse of a step forward', () => {
        const stack = priceStack(DEFAULT, 0);
        const up = apply(DEFAULT, 'gaps', raisedZ(stack, 'gaps'));
        expect(up).toEqual(['ema', 'gaps', 'sma', null]);
        const moved = DEFAULT.map((e) => (e.id === 'gaps' ? { ...e, z: raisedZ(stack, 'gaps')! } : e)).sort((a, b) => a.z - b.z);
        expect(apply(moved, 'gaps', loweredZ(priceStack(moved, 0), 'gaps'))).toEqual(['gaps', 'ema', 'sma', null]);
    });

    it('is null with nothing below', () => {
        expect(loweredZ(priceStack(DEFAULT, 0), 'gaps')).toBeNull();
        expect(loweredZ(priceStack(DEFAULT, 0), 'missing')).toBeNull();
    });
});

describe('raisedZ', () => {
    /** Apply the step and read the new back-to-front order. */
    function step(indicators: StackEntry[], id: string, candleZ = 0): Array<string | null> {
        const z = raisedZ(priceStack(indicators, candleZ), id);
        expect(z).not.toBeNull();
        const next = indicators.map((e) => (e.id === id ? { ...e, z: z! } : e)).sort((a, b) => a.z - b.z);
        return priceStack(next, candleZ).map((e) => e.id);
    }

    it('steps an indicator in front of the one above it, and no further', () => {
        expect(step(DEFAULT, 'gaps')).toEqual(['ema', 'gaps', 'sma', null]);
    });

    it('brings the top indicator in front of the price', () => {
        expect(step(DEFAULT, 'sma')).toEqual(['gaps', 'ema', null, 'sma']);
    });

    it('lands between the price and an indicator already in front of it', () => {
        expect(step([...DEFAULT, { id: 'front', z: 1 }], 'sma')).toEqual(['gaps', 'ema', null, 'sma', 'front']);
    });

    it('steps in front of the top indicator, past the candles', () => {
        expect(step([{ id: 'a', z: 1 }, { id: 'b', z: 2 }], 'a')).toEqual([null, 'b', 'a']);
    });

    it('leaves every other key as it was', () => {
        const stack = priceStack(DEFAULT, 0);
        const z = raisedZ(stack, 'gaps')!;
        expect(z).toBeGreaterThan(-2);
        expect(z).toBeLessThan(-1);
    });

    it('takes the shared key when the next two layers share one, still in front of the candles', () => {
        // The candles and an indicator both at 0: no room between them.
        expect(raisedZ(priceStack([{ id: 'a', z: -1 }, { id: 'b', z: 0 }], 0), 'a')).toBe(0);
    });

    it('is null with nothing above', () => {
        expect(raisedZ(priceStack(DEFAULT, 0), 'missing')).toBeNull();
        expect(raisedZ(priceStack([{ id: 'top', z: 1 }], 0), 'top')).toBeNull();
    });
});
