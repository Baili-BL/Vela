// The price pane's draw stack as the legend restacks it, one step forward or back: the
// indicators painted inside the data canvas, ordered by z, with the candles as one more
// entry at `candleZ`. Pure and unit-tested; the renderer feeds it the scene's keys and
// applies the z it returns.

/** One layer of the stack: an indicator by id, or the candles (`id: null`). */
export interface StackEntry {
    id: string | null;
    z: number;
}

/**
 * Order the price pane's layers back to front. `indicators` comes in the scene's own
 * paint order (z, then mount order); the candles paint before an indicator sharing their
 * key, as the backends draw them.
 */
export function priceStack(indicators: readonly StackEntry[], candleZ: number): StackEntry[] {
    const out = [...indicators];
    const at = out.findIndex((e) => e.z >= candleZ);
    out.splice(at < 0 ? out.length : at, 0, { id: null, z: candleZ });
    return out;
}

/** What paints directly in front of `id`: the candles, another indicator, or nothing. */
export function layerAbove(stack: readonly StackEntry[], id: string): 'price' | { indicator: string } | null {
    const i = stack.findIndex((e) => e.id === id);
    if (i < 0 || i === stack.length - 1) return null;
    const above = stack[i + 1]!;
    return above.id === null ? 'price' : { indicator: above.id };
}

/**
 * The z that puts `id` directly in front of the layer above it, behind whatever comes
 * next: halfway to the next key, or one past the layer above at the top of the stack.
 * Null when nothing is above. Every other layer keeps its key. When the next layer
 * shares the key of the one above, there is no room between them: `id` takes that key
 * too, which still puts it in front of the candles (they paint first on a shared key).
 */
export function raisedZ(stack: readonly StackEntry[], id: string): number | null {
    const i = stack.findIndex((e) => e.id === id);
    if (i < 0 || i === stack.length - 1) return null;
    const above = stack[i + 1]!;
    const next = stack[i + 2];
    if (!next) return above.z + 1;
    if (next.z === above.z) return above.z;
    return (above.z + next.z) / 2;
}

/** What paints directly behind `id`: the candles, another indicator, or nothing. */
export function layerBelow(stack: readonly StackEntry[], id: string): 'price' | { indicator: string } | null {
    const i = stack.findIndex((e) => e.id === id);
    if (i <= 0) return null;
    const below = stack[i - 1]!;
    return below.id === null ? 'price' : { indicator: below.id };
}

/**
 * The z that puts `id` directly behind the layer below it, in front of whatever comes
 * before: halfway to the previous key, or one under the layer below at the bottom of
 * the stack. Null when nothing is below. Every other layer keeps its key. Only two
 * indicators can share a key with no room between them (the candles never do with what
 * paints behind them): `id` then takes that key too.
 */
export function loweredZ(stack: readonly StackEntry[], id: string): number | null {
    const i = stack.findIndex((e) => e.id === id);
    if (i <= 0) return null;
    const below = stack[i - 1]!;
    const prev = stack[i - 2];
    if (!prev) return below.z - 1;
    if (prev.z === below.z) return below.z;
    return (prev.z + below.z) / 2;
}
