import {Layer, LayerExtension } from '@deck.gl/core';
import {LayerContext} from '@deck.gl/core/lib/layer';

import shaderModule from './brush-shader-module';

const defaultProps = {
};

export type BrushGeoJsonExtensionProps = {
};

// Write an extension to brush geojson layer using the drawn polygon:
// an instanced attribute 'instanceHighlighted' is added to the layer to indicate whether the feature is highlighted
// the shader module is modified to discard the feature if instanceHighlighted is 0
// the accessor getHighlighted is used to get the value of instanceHighlighted based on the search result in GeoJsonlayer
// From a test, deck: Updated attributes for 7314969 instances in azfyr45-polygons-fill in 162ms
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
      attributeManager.addInstanced({
        instanceHighlighted: {
          size: 1,
          accessor: 'getHighlighted'
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
