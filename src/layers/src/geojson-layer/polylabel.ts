// disable ts lint on this file
// @ts-nocheck

// TinyQueue is a small footprint binary heap priority queue
class TinyQueue {
  data: never[];
  length: any;
  compare: (a: any, b: any) => 0 | 1 | -1;
  constructor(data = [], compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0)) {
    this.data = data;
    this.length = this.data.length;
    this.compare = compare;
    if (this.length > 0) {
      for (let i = (this.length >> 1) - 1; i >= 0; i--) {
        this._down(i);
      }
    }
  }

  push(item) {
    this.data.push(item);
    this._up(this.length++);
  }

  pop() {
    if (this.length === 0) {
      return undefined;
    }
    const top = this.data[0];
    const bottom = this.data.pop();
    if (--this.length > 0) {
      this.data[0] = bottom;
      this._down(0);
    }
    return top;
  }

  peek() {
    return this.data[0];
  }

  _up(pos) {
    const {data, compare} = this;
    const item = data[pos];

    while (pos > 0) {
      const parent = (pos - 1) >> 1;
      const current = data[parent];
      if (compare(item, current) >= 0) {
        break;
      }
      data[pos] = current;
      pos = parent;
    }

    data[pos] = item;
  }

  _down(pos) {
    const {data, compare} = this;
    const halfLength = this.length >> 1;
    const item = data[pos];

    while (pos < halfLength) {
      let bestChild = (pos << 1) + 1; // initially it is the left child
      const right = bestChild + 1;
      if (right < this.length && compare(data[right], data[bestChild]) < 0) {
        bestChild = right;
      }
      if (compare(data[bestChild], item) >= 0) {
        break;
      }
      data[pos] = data[bestChild];
      pos = bestChild;
    }
    data[pos] = item;
  }
}

function arrayDepth(v) {
  return Array.isArray(v) ? 1 + Math.max(0, ...v.map(arrayDepth)) : 0;
}

// Squared distance from a point to a segment
function getSegDistSq(px, py, a, b) {
  let [x, y] = [a[0], a[1]];
  let [dx, dy] = [b[0] - x, b[1] - y];

  if (dx !== 0 || dy !== 0) {
    const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = px - x;
  dy = py - y;
  return dx * dx + dy * dy;
}

// Signed distance from a point to a polygon boundary (-ve if outside):
function pointToPolygonDist(x, y, polygon) {
  let inside = false;
  let minDistSq = Infinity;

  for (let k = 0; k < polygon.length; k++) {
    const ring = polygon[k];

    for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
      const [a, b] = [ring[i], ring[j]];
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) {
        inside = !inside;
      }
      minDistSq = Math.min(minDistSq, getSegDistSq(x, y, a, b));
    }
  }
  return minDistSq === 0 ? 0 : (inside ? 1 : -1) * Math.sqrt(minDistSq);
}

class Cell {
  x: number;
  y: number;
  h: number;
  d: number;
  max: number;

  constructor(x: number, y: number, h: number, polygon: number[][] | number[][][] | number[][][][]) {
    this.x = x; // cell center x
    this.y = y; // cell center y
    this.h = h; // half the cell size
    this.d = pointToPolygonDist(x, y, polygon); // distance from cell center to polygon
    this.max = this.d + this.h * Math.SQRT2; // max distance to polygon within a cell
  }
}

// Cell containing the polygon centroid
function getCentroidCell(polygon) {
  let [area, x, y] = [0, 0, 0];
  const points = polygon[0];

  for (let i = 0, len = points.length, j = len - 1; i < len; j = i++) {
    const [a, b] = [points[i], points[j]];
    const f = a[0] * b[1] - b[0] * a[1];
    x += (a[0] + b[0]) * f;
    y += (a[1] + b[1]) * f;
    area += f * 3;
  }
  if (area === 0) {
    return new Cell(points[0][0], points[0][1], 0, polygon);
  }
  return new Cell(x / area, y / area, 0, polygon);
}

export function polylabel(poly, precision = 1, debug = false) {
  let polygon = poly;
  const depth = arrayDepth(poly);

  if (depth < 2) {
    // No polygon provided.
    return null;
  } else if (depth == 2) {
    // Single polygon.
    polygon = [poly];
  } else {
    // List of polygons.
    let bestpoint = polylabel(polygon[0], precision, debug);
    for (let p = 1; p < polygon.length; p++) {
      const thispoint = polylabel(polygon[p], precision, debug);
      if (thispoint[2] > bestpoint[2]) {
        bestpoint = thispoint;
      }
    }
    return bestpoint;
  }

  // find the bounding box of the outer ring
  let minX, minY, maxX, maxY;
  for (let i = 0; i < polygon[0].length; i++) {
    const p = polygon[0][i];
    if (!i || p[0] < minX) {
      minX = p[0];
    }
    if (!i || p[1] < minY) {
      minY = p[1];
    }
    if (!i || p[0] > maxX) {
      maxX = p[0];
    }
    if (!i || p[1] > maxY) {
      maxY = p[1];
    }
  }

  const [width, height] = [maxX - minX, maxY - minY];
  const cellSize = Math.min(width, height);
  let h = cellSize / 2;

  if (cellSize === 0) {
    const degeneratePoleOfInaccessibility = [minX, minY];
    degeneratePoleOfInaccessibility.distance = 0;
    return degeneratePoleOfInaccessibility;
  }

  // Priority queue of cells in order of their "potential" (max distance to polygon)
  const cellQueue = new TinyQueue(undefined, (a, b) => b.max - a.max);

  // Cover polygon with initial cells
  for (let x = minX; x < maxX; x += cellSize) {
    for (let y = minY; y < maxY; y += cellSize) {
      cellQueue.push(new Cell(x + h, y + h, h, polygon));
    }
  }

  // Take centroid as the first best guess
  let bestCell = getCentroidCell(polygon);

  // Special case for rectangular polygons
  const bboxCell = new Cell(minX + width / 2, minY + height / 2, 0, polygon);
  if (bboxCell.d > bestCell.d) {
    bestCell = bboxCell;
  }

  let numProbes = cellQueue.length;

  while (cellQueue.length) {
    // Pick the most promising cell from the queue
    const cell = cellQueue.pop();

    // Update the best cell if we found a better one
    if (cell.d > bestCell.d) {
      bestCell = cell;
      if (debug) {
        console.log('found best %d after %d probes', Math.round(1e4 * cell.d) / 1e4, numProbes);
      }
    }

    // Do not drill down further if there's no chance of a better solution
    if (cell.max - bestCell.d <= precision) {
      continue;
    }
    // Split the cell into four cells
    h = cell.h / 2;
    cellQueue.push(new Cell(cell.x - h, cell.y - h, h, polygon));
    cellQueue.push(new Cell(cell.x + h, cell.y - h, h, polygon));
    cellQueue.push(new Cell(cell.x - h, cell.y + h, h, polygon));
    cellQueue.push(new Cell(cell.x + h, cell.y + h, h, polygon));
    numProbes += 4;
  }

  if (debug) {
    console.log('num probes: ' + numProbes);
    console.log('best distance: ' + bestCell.d);
    console.log('best point: [' + bestCell.x + ', ' + bestCell.y + ']');
    console.log(polygon);
  }

  return [bestCell.x, bestCell.y, bestCell.d];
}
