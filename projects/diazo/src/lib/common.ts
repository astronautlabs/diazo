
/**
 * Represents a position within a view.
 */
export interface Position {
    top : number;
    left : number;
}

/**
 * Represents the extends of a rectangle within the {@link DiazoContext | context} layer 
 * layer.
 */
export interface Size {
    width : number;
    height : number;
}

/**
 * @hidden
 */
export interface Constructor<T> {
    new() : T;
}

export function pointOnLine (p : Position, a : Position, b : Position) {
    if (!p || !a || !b)
        return false;

    let tColinear = 1000;
    let t = 0;

    // ensure points are collinear
    var zero = (b.left - a.left) * (p.top - a.top) - (p.left - a.left) * (b.top - a.top);
    if (zero > tColinear || zero < -tColinear) 
        return false;

    // check if x-coordinates are not equal
    if (a.left - b.left > t || b.left - a.left > t)
        // ensure x is between a.x & b.x (use tolerance)
        return a.left > b.left
            ? p.left + t > b.left && p.left - t < a.left
            : p.left + t > a.left && p.left - t < b.left;

    // ensure y is between a.y & b.y (use tolerance)
    return a.top > b.top
        ? p.top + t > b.top && p.top - t < a.top
        : p.top + t > a.top && p.top - t < b.top;
}
