import {project} from '@deck.gl/core';

import type {BrushGeoJsonExtensionProps} from './brush-geojson-layer';

const vs = `
  #ifdef NON_INSTANCED_MODEL
    #define BRUSH_GEOJSON_ATTRIB center
  #else
    #define BRUSH_GEOJSON_ATTRIB instanceCenter
  #endif

  attribute vec2 BRUSH_GEOJSON_ATTRIB;
  uniform vec4 brush_rectangle;
  uniform vec2 brush_polygon[516];
  uniform int brush_polygon_length;
  uniform bool brushing_enabled;

  float center_in_polygon(vec2 point, vec2 poly[516]) {
    float inside = 0.;
    float x = point.x, y = point.y;
    // for (int i = 0, j = brush_polygon_length - 1; i < brush_polygon_length; j = i++) {
    //   float xi = poly[i].x;
    //   float yi = poly[i].y;
    //   float xj = poly[j].x;
    //   float yj = poly[j].y;
    //   if ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
    //     inside = 1. - inside;
    //   }
    // }
    return inside;
  }

  float center_in_rectangle(vec2 point, vec4 rectangle) {
    if (point.x >= rectangle.x && point.x <= rectangle.z && point.y >= rectangle.y && point.y <= rectangle.w) {
      return 1.;
    }
    return 0.;
  }
`;

const fs = ``;

const inject = {
  'vs:#decl': `
    varying float is_visible;
  `,
  'vs:#main-end': `
    is_visible = 0.;
    if (brushing_enabled) {
      is_visible = center_in_rectangle(BRUSH_GEOJSON_ATTRIB, brush_rectangle);
      // // if (brush_polygon_length > 0 && is_visible == 1.) {
      // //   is_visible = center_in_polygon(BRUSH_GEOJSON_ATTRIB, brush_polygon);
      // // }
      // // position the current vertex out of screen
      // if (is_visible == 0.) {
      //   gl_Position = vec4(0.);
      // }
    }
  `,
  'fs:#decl': `
    varying float is_visible;
    uniform bool brushing_enabled;
  `,
  'fs:DECKGL_FILTER_COLOR': `
    // abandon the fragments if brush_enabled and it is not highlighted
    if (brushing_enabled && is_visible == 0.) {
      discard;
    }
  `
};

export default {
  name: 'brush-geojson',
  dependencies: [project],
  vs: vs,
  fs: fs,
  inject: inject,
  getUniforms: (opts?: BrushGeoJsonExtensionProps): Record<string, any> => {
    if (!opts || !('extensions' in opts)) {
      return {};
    }
    const {
      enableBrushing = false,
      brushRectangle = [0, 0, 0, 0],
      brushPolygon = []
    } = opts;

    return {
      brushing_enabled: enableBrushing,
      brush_rectangle: brushRectangle,
      brush_polygon: brushPolygon,
      brush_polygon_length: brushPolygon ? brushPolygon.length : 0
    };
  }
}
