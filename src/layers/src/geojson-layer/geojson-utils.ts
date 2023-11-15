// Copyright (c) 2023 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import {Feature, BBox} from 'geojson';
import normalize from '@mapbox/geojson-normalize';
import bbox from '@turf/bbox';
import {parseSync} from '@loaders.gl/core';
import {WKBLoader, WKTLoader} from '@loaders.gl/wkt';
import {binaryToGeometry} from '@loaders.gl/gis';
import {DataContainerInterface, getSampleData} from '@kepler.gl/utils';

import {GeojsonLayerMetaProps} from '../layer-utils';

export type GetFeature = (d: any) => Feature;
export type GeojsonDataMaps = Array<Feature | null>;

/* eslint-disable */
// TODO: Re-enable eslint when we upgrade to handle enums and type maps
export enum FeatureTypes {
  Point = 'Point',
  MultiPoint = 'MultiPoint',
  LineString = 'LineString',
  MultiLineString = 'MultiLineString',
  Polygon = 'Polygon',
  MultiPolygon = 'MultiPolygon'
}

/* eslint-enable */

type RawArrowFeature = {
  encoding?: string;
  data: any;
};

export function parseGeoJsonRawFeature(rawFeature: {} | Feature | RawArrowFeature): Feature | null {
  if (rawFeature && typeof rawFeature === 'object') {
    if ('encoding' in rawFeature && rawFeature.encoding?.startsWith('geoarrow')) {
      // Support GeoArrow data
      return parseGeometryFromArrow(rawFeature);
    }
    // Support GeoJson feature as object
    // probably need to normalize it as well
    const normalized = normalize(rawFeature);
    if (!normalized || !Array.isArray(normalized.features)) {
      // fail to normalize GeoJson
      return null;
    }

    return normalized.features[0];
  } else if (typeof rawFeature === 'string') {
    return parseGeometryFromString(rawFeature);
  } else if (Array.isArray(rawFeature)) {
    // Support GeoJson  LineString as an array of points
    return {
      type: 'Feature',
      geometry: {
        // why do we need to flip it...
        coordinates: rawFeature.map(pts => [pts[1], pts[0]]),
        type: 'LineString'
      },
      properties: {}
    };
  }

  return null;
}

export function getGeojsonLayerMeta({
  dataContainer,
  getFeature
}: {
  dataContainer: DataContainerInterface;
  getFeature: GetFeature;
}): GeojsonLayerMetaProps {
  const dataToFeature = getGeojsonDataMaps(dataContainer, getFeature);
  // get bounds from features
  const bounds = getGeojsonBounds(dataToFeature);
  // if any of the feature has properties.radius set to be true
  const fixedRadius = Boolean(dataToFeature.find(d => d && d.properties && d.properties.radius));

  // keep a record of what type of geometry the collection has
  const featureTypes = getGeojsonFeatureTypes(dataToFeature);

  return {
    dataToFeature,
    bounds,
    fixedRadius,
    featureTypes
  };
}

/**
 * Parse raw data to GeoJson feature
 * @param dataContainer
 * @param getFeature
 * @returns {{}}
 */
export function getGeojsonDataMaps(dataContainer: any, getFeature: GetFeature): GeojsonDataMaps {
  const acceptableTypes = [
    'Point',
    'MultiPoint',
    'LineString',
    'MultiLineString',
    'Polygon',
    'MultiPolygon',
    'GeometryCollection'
  ];

  const dataToFeature: GeojsonDataMaps = [];

  for (let index = 0; index < dataContainer.numRows(); index++) {
    const feature = parseGeoJsonRawFeature(getFeature({index}));

    if (feature && feature.geometry && acceptableTypes.includes(feature.geometry.type)) {
      const cleaned = {
        ...feature,
        // store index of the data in feature properties
        properties: {
          ...feature.properties,
          index
        }
      };

      dataToFeature[index] = cleaned;
    } else {
      dataToFeature[index] = null;
    }
  }

  return dataToFeature;
}

/**
 * Parse geojson from string
 * @param {String} geoString
 * @returns {null | Object} geojson object or null if failed
 */
export function parseGeometryFromString(geoString: string): Feature | null {
  let parsedGeo;

  // try parse as geojson string
  // {"type":"Polygon","coordinates":[[[-74.158491,40.83594]]]}
  try {
    parsedGeo = JSON.parse(geoString);
  } catch (e) {
    // keep trying to parse
  }

  // try parse as wkt using loaders.gl WKTLoader
  if (!parsedGeo) {
    try {
      parsedGeo = parseSync(geoString, WKTLoader);
    } catch (e) {
      return null;
    }
  }

  // try parse as wkb using loaders.gl WKBLoader
  if (!parsedGeo) {
    try {
      const buffer = Buffer.from(geoString, 'hex');
      const binaryGeo = parseSync(buffer, WKBLoader);
      // @ts-expect-error
      parsedGeo = binaryToGeometry(binaryGeo);
    } catch (e) {
      return null;
    }
  }

  // try parse as wkb using loaders.gl WKBLoader
  if (!parsedGeo) {
    try {
      const buffer = Buffer.from(geoString, 'hex');
      const binaryGeo = parseSync(buffer, WKBLoader);
      parsedGeo = binaryToGeometry(binaryGeo);
    } catch (e) {
      return null;
    }
  }

  if (!parsedGeo) {
    return null;
  }

  const normalized = normalize(parsedGeo);

  if (!normalized || !Array.isArray(normalized.features)) {
    // fail to normalize geojson
    return null;
  }

  return normalized.features[0];
}

export function getGeojsonBounds(features: GeojsonDataMaps = []): BBox | null {
  // 70 ms for 10,000 polygons
  // here we only pick couple
  const maxCount = 10000;
  const samples = features.length > maxCount ? getSampleData(features, maxCount) : features;

  const nonEmpty = samples.filter(
    d => d && d.geometry && d.geometry.coordinates && d.geometry.coordinates.length
  );

  try {
    return bbox({
      type: 'FeatureCollection',
      features: nonEmpty
    });
  } catch (e) {
    return null;
  }
}

export const featureToDeckGlGeoType = {
  Point: 'point',
  MultiPoint: 'point',
  LineString: 'line',
  MultiLineString: 'line',
  Polygon: 'polygon',
  MultiPolygon: 'polygon'
};

export type DeckGlGeoTypes = {
  point: boolean;
  line: boolean;
  polygon: boolean;
};

/**
 * Parse geojson from string
 * @param {Array<Object>} allFeatures
 * @returns {Object} mapping of feature type existence
 */
export function getGeojsonFeatureTypes(allFeatures: GeojsonDataMaps): DeckGlGeoTypes {
  // @ts-expect-error some test cases only have 1 geotype
  const featureTypes: DeckGlGeoTypes = {};
  for (let f = 0; f < allFeatures.length; f++) {
    const feature = allFeatures[f];
    if (feature) {
      const geoType = featureToDeckGlGeoType[feature.geometry && feature.geometry.type];
      if (geoType) {
        featureTypes[geoType] = true;
      }
    }
  }

  return featureTypes;
}

/**
 * convert Arrow MultiPolygon to geojson Feature
 */
function arrowMultiPolygonToFeature(arrowMultiPolygon: ListVector): MultiPolygon {
  const multiPolygon: Position[][][] = [];
  for (let m = 0; m < arrowMultiPolygon.length; m++) {
    const arrowPolygon = arrowMultiPolygon.get(m);
    const polygon: Position[][] = [];
    for (let i = 0; arrowPolygon && i < arrowPolygon?.length; i++) {
      const arrowRing = arrowPolygon?.get(i);
      const ring: Position[] = [];
      for (let j = 0; arrowRing && j < arrowRing.length; j++) {
        const arrowCoord = arrowRing.get(j);
        const coord: Position = Array.from(arrowCoord);
        ring.push(coord);
      }
      polygon.push(ring);
    }
    multiPolygon.push(polygon);
  }
  const geometry: MultiPolygon = {
    type: 'MultiPolygon',
    coordinates: multiPolygon
  };
  return geometry;
}

/**
 * convert Arrow Polygon to geojson Feature
 */
function arrowPolygonToFeature(arrowPolygon: ListVector): Polygon {
  const polygon: Position[][] = [];
  for (let i = 0; arrowPolygon && i < arrowPolygon.length; i++) {
    const arrowRing = arrowPolygon.get(i);
    const ring: Position[] = [];
    for (let j = 0; arrowRing && j < arrowRing.length; j++) {
      const arrowCoord = arrowRing.get(j);
      const coords: Position = Array.from(arrowCoord);
      ring.push(coords);
    }
    polygon.push(ring);
  }
  const geometry: Polygon = {
    type: 'Polygon',
    coordinates: polygon
  };
  return geometry;
}

/**
 * convert Arrow MultiPoint to geojson MultiPoint
 */
function arrowMultiPointToFeature(arrowMultiPoint: ListVector): MultiPoint {
  const multiPoint: Position[] = [];
  for (let i = 0; arrowMultiPoint && i < arrowMultiPoint.length; i++) {
    const arrowPoint = arrowMultiPoint.get(i);
    if (arrowPoint) {
      const coord: Position = Array.from(arrowPoint);
      multiPoint.push(coord);
    }
  }
  const geometry: MultiPoint = {
    type: 'MultiPoint',
    coordinates: multiPoint
  };
  return geometry;
}

/**
 * convert Arrow Point to geojson Point
 */
function arrowPointToFeature(arrowPoint: FloatVector): Point {
  const point: Position = Array.from(arrowPoint.values);
  const geometry: Point = {
    type: 'Point',
    coordinates: point
  };
  return geometry;
}

/**
 * convert Arrow MultiLineString to geojson MultiLineString
 */
function arrowMultiLineStringToFeature(arrowMultiLineString: ListVector): MultiLineString {
  const multiLineString: Position[][] = [];
  for (let i = 0; arrowMultiLineString && i < arrowMultiLineString.length; i++) {
    const arrowLineString = arrowMultiLineString.get(i);
    const lineString: Position[] = [];
    for (let j = 0; arrowLineString && j < arrowLineString.length; j++) {
      const arrowCoord = arrowLineString.get(j);
      if (arrowCoord) {
        const coords: Position = Array.from(arrowCoord);
        lineString.push(coords);
      }
    }
    multiLineString.push(lineString);
  }
  const geometry: MultiLineString = {
    type: 'MultiLineString',
    coordinates: multiLineString
  };
  return geometry;
}

/**
 * convert Arrow LineString to geojson LineString
 */
function arrowLineStringToFeature(arrowLineString: ListVector): LineString {
  const lineString: Position[] = [];
  for (let i = 0; arrowLineString && i < arrowLineString.length; i++) {
    const arrowCoord = arrowLineString.get(i);
    if (arrowCoord) {
      const coords: Position = Array.from(arrowCoord);
      lineString.push(coords);
    }
  }
  const geometry: LineString = {
    type: 'LineString',
    coordinates: lineString
  };
  return geometry;
}

/**
 * convert Arrow wkb to geojson Geometry
 */
function arrowWkbToFeature(arrowWkb: BinaryVector): Feature | null {
  const binaryGeo = parseSync(arrowWkb.values, WKBLoader);
  const geometry = binaryToGeometry(binaryGeo);
  const normalized = normalize(geometry);

  if (!normalized || !Array.isArray(normalized.features)) {
    // fail to normalize geojson
    return null;
  }

  return normalized.features[0];
}

/**
 * convert Arrow wkt to geojson Geometry
 */
function arrowWktToFeature(arrowWkt: Utf8Vector): Feature | null {
  const geometry = parseSync(arrowWkt.get(0) || '', WKTLoader);
  const normalized = normalize(geometry);

  if (!normalized || !Array.isArray(normalized.features)) {
    // fail to normalize geojson
    return null;
  }

  return normalized.features[0];
}

/**
 * parse geometry from arrow data that is returned from processArrowData()
 *
 * @param rawData the raw geometry data returned from processArrowData, which is an object with two properties: encoding and data
 * @see processArrowData
 * @returns
 */
export function parseGeometryFromArrow(rawData: RawArrowFeature): Feature | null {
  const encoding = rawData.encoding;
  const data = rawData.data;
  if (!encoding || !data) return null;

  let geometry;

  switch (encoding) {
    case 'geoarrow.multipolygon':
      geometry = arrowMultiPolygonToFeature(data);
      break;
    case 'geoarrow.polygon':
      geometry = arrowPolygonToFeature(data);
      break;
    case 'geoarrow.multipoint':
      geometry = arrowMultiPointToFeature(data);
      break;
    case 'geoarrow.point':
      geometry = arrowPointToFeature(data);
      break;
    case 'geoarrow.multilinestring':
      geometry = arrowMultiLineStringToFeature(data);
      break;
    case 'geoarrow.linestring':
      geometry = arrowLineStringToFeature(data);
      break;
    case 'geoarrow.wkb': {
      // convert to wkb
      return arrowWkbToFeature(data);
    }
    case 'geoarrow.wkt': {
      // convert to wkt
      return arrowWktToFeature(data);
    }
    default: {
      // encoding is not supported, skip
      Console.error('GeoArrow encoding not supported');
      return null;
    }
  }
  return {
    type: 'Feature',
    geometry,
    properties: {}
  };
}
