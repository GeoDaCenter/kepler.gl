import {project} from '@deck.gl/core';

import type {BrushGeoJsonExtensionProps} from './brush-geojson-layer';

const vs = ``;

const fs = ``;

const inject = {
  'vs:#decl': `
    attribute float instanceHighlighted;
    varying float vHighlighted;
  `,
  'vs:#main-end': `
    if (instanceHighlighted == 0.) {
      gl_Position = vec4(0.);
    }
    vHighlighted = instanceHighlighted;
  `,
  'fs:#decl': `
    varying float vHighlighted;
  `,
  'fs:DECKGL_FILTER_COLOR': `
    if (vHighlighted == 0.) {
      discard;
    }
  `
};

export default {
  name: 'brush-geojson',
  dependencies: [project],
  vs,
  fs,
  inject,
  getUniforms: (opts?: BrushGeoJsonExtensionProps): Record<string, any> => {
    if (!opts) {
      return {};
    }
    return {};
  }
}
