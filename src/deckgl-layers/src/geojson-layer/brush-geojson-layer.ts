import {Layer, LayerExtension } from '@deck.gl/core';
import {LayerContext} from '@deck.gl/core/lib/layer';
import GL from '@luma.gl/constants';

import shaderModule from './brush-shader-module';

const defaultProps = {
  getCenter: {type: 'accessor', value: [0, 0]},
  enableBrushing: false,
  brushRectangle: [0, 0, 0, 0],
  brushPolygon: []
};

export type BrushGeoJsonExtensionProps = {
  getCenter?: () => [number, number];
  enableBrushing?: boolean;
  brushRectangle?: [number, number, number, number];
  brushPolygon?: number[];
};

// Write an extension to brush geojson layer using the drawn polygon:
// an instanced attribute 'instanceHighlighted' is added to the layer to indicate whether the feature is highlighted
// the shader module is modified to discard the feature if instanceHighlighted is 0
// the accessor getHighlighted is used to get the value of instanceHighlighted based on the search result in GeoJsonlayer
// From a test, gl deck: Updated attributes for 7314969 instances in azfyr45-polygons-fill in 162ms
export default class BrushGeoJsonExtension extends LayerExtension {
  static defaultProps = defaultProps;
  static extensionName = 'BrushGeoJsonExtension';

  getShaders(extension: any) {
    return {
      modules: [shaderModule],
      defines: {}
    };
  }

  initializeState(this: Layer<BrushGeoJsonExtensionProps>, context: LayerContext, extension: this) {
    const attributeManager = this.getAttributeManager();
    if (attributeManager) {
      attributeManager.add({
        center: {
          size: 2,
          accessor: 'getCenter',
          shaderAttributes: {
            center: {
              divisor: 0
            },
            instanceCenter: {
              divisor: 1
            }
          },
        }
      });
    }
  }
  updateState({
    props,
    oldProps
  }) {
  }
}
