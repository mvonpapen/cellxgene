/*
https://bl.ocks.org/mbostock/4341954
https://bl.ocks.org/mbostock/34f08d5e11952a80609169b7917d4172
https://bl.ocks.org/SpaceActuary/2f004899ea1b2bd78d6f1dbb2febf771
*/
// jshint esversion: 6
import React from "react";
import _ from "lodash";
import { Button, ButtonGroup, Tooltip } from "@blueprintjs/core";
import { connect } from "react-redux";
import * as d3 from "d3";
import memoize from "memoize-one";
import * as globals from "../../globals";
import actions from "../../actions";
import finiteExtent from "../../util/finiteExtent";

@connect(state => ({
  world: state.controls.world,
  scatterplotXXaccessor: state.controls.scatterplotXXaccessor,
  scatterplotYYaccessor: state.controls.scatterplotYYaccessor,
  crossfilter: state.controls.crossfilter,
  differential: state.differential,
  colorAccessor: state.controls.colorAccessor,
  obsAnnotations: _.get(state.controls.world, "obsAnnotations", null)
}))
class HistogramBrush extends React.Component {
  calcHistogramCache = memoize((obsAnnotations, field, rangeMin, rangeMax) => {
    const { world } = this.props;
    const histogramCache = {};

    histogramCache.y = d3
      .scaleLinear()
      .range([this.height - this.marginBottom, 0]);

    if (obsAnnotations.hasCol(field)) {
      // recalculate expensive stuff
      const allValuesForContinuousFieldAsArray = obsAnnotations
        .col(field)
        .asArray();

      histogramCache.x = d3
        .scaleLinear()
        .domain([rangeMin, rangeMax])
        .range([0, this.width]);

      histogramCache.bins = d3
        .histogram()
        .domain(histogramCache.x.domain())
        .thresholds(40)(allValuesForContinuousFieldAsArray);

      histogramCache.numValues = allValuesForContinuousFieldAsArray.length;
    } else if (world.varData.hasCol(field)) {
      const varValues = world.varData.col(field).asArray();

      histogramCache.x = d3
        .scaleLinear()
        .domain(
          finiteExtent(varValues)
        ) /* replace this if we have ranges for genes back from server like we do for annotations on cells */
        .range([0, this.width]);

      histogramCache.bins = d3
        .histogram()
        .domain(histogramCache.x.domain())
        .thresholds(40)(varValues);

      histogramCache.numValues = varValues.length;
    }

    return histogramCache;
  });

  constructor(props) {
    super(props);

    this.width = 340;
    this.height = 100;
    this.marginBottom = 20;
  }

  componentDidMount() {
    const { field } = this.props;
    const { x, y, bins, numValues, svgRef } = this._histogram;

    this.renderAxesBrushBins(x, y, bins, numValues, svgRef, field);
  }

  componentDidUpdate(prevProps) {
    const { field, obsAnnotations } = this.props;
    const { x, y, bins, numValues, svgRef } = this._histogram;

    if (obsAnnotations !== prevProps.obsAnnotations) {
      this.renderAxesBrushBins(x, y, bins, numValues, svgRef, field);
    }
  }

  onBrush(selection, x) {
    return () => {
      const { dispatch, field, isObs, isUserDefined, isDiffExp } = this.props;

      if (d3.event.selection) {
        dispatch({
          type: "continuous metadata histogram brush",
          selection: field,
          continuousNamespace: {
            isObs,
            isUserDefined,
            isDiffExp
          },
          range: [x(d3.event.selection[0]), x(d3.event.selection[1])]
        });
      } else {
        dispatch({
          type: "continuous metadata histogram brush",
          selection: field,
          continuousNamespace: {
            isObs,
            isUserDefined,
            isDiffExp
          },
          range: null
        });
      }
    };
  }

  onBrushEnd(selection, x) {
    return () => {
      const { dispatch, field, isObs, isUserDefined, isDiffExp } = this.props;
      const { brushX } = this.state;
      const minAllowedBrushSize = 10;
      const smallAmountToAvoidInfiniteLoop = 0.1;

      if (d3.event.selection) {
        let _range;

        if (
          d3.event.selection[1] - d3.event.selection[0] >
          minAllowedBrushSize
        ) {
          _range = [x(d3.event.selection[0]), x(d3.event.selection[1])];
        } else {
          /* the user selected range is too small and will be hidden #587, so take control of it procedurally */
          /* https://stackoverflow.com/questions/12354729/d3-js-limit-size-of-brush */

          const procedurallyResizedBrushWidth =
            d3.event.selection[0] +
            minAllowedBrushSize +
            smallAmountToAvoidInfiniteLoop; //

          _range = [x(d3.event.selection[0]), x(procedurallyResizedBrushWidth)];

          d3.event.target.move(brushX, [
            d3.event.selection[0],
            procedurallyResizedBrushWidth
          ]);
        }

        dispatch({
          type: "continuous metadata histogram brush",
          selection: field,
          continuousNamespace: {
            isObs,
            isUserDefined,
            isDiffExp
          },
          range: _range
        });
      } else {
        dispatch({
          type: "continuous metadata histogram brush",
          selection: field,
          continuousNamespace: {
            isObs,
            isUserDefined,
            isDiffExp
          },
          range: null
        });
      }
    };
  }

  drawHistogram(svgRef) {
    const { obsAnnotations, field, ranges } = this.props;
    const histogramCache = this.calcHistogramCache(
      obsAnnotations,
      field,
      ranges.min,
      ranges.max
    );

    const { x, y, bins, numValues } = histogramCache;

    this._histogram = { x, y, bins, numValues, svgRef };
  }

  handleColorAction() {
    const { obsAnnotations, dispatch, field, world, ranges } = this.props;

    if (obsAnnotations.hasCol(field)) {
      dispatch({
        type: "color by continuous metadata",
        colorAccessor: field,
        rangeForColorAccessor: ranges
      });
    } else if (world.varData.hasCol(field)) {
      dispatch(actions.requestSingleGeneExpressionCountsForColoringPOST(field));
    }
  }

  removeHistogram() {
    const {
      dispatch,
      field,
      colorAccessor,
      scatterplotXXaccessor,
      scatterplotYYaccessor
    } = this.props;
    dispatch({
      type: "clear user defined gene",
      data: field
    });
    if (field === colorAccessor) {
      dispatch({
        type: "reset colorscale"
      });
    }
    if (field === scatterplotXXaccessor) {
      dispatch({
        type: "set scatterplot x",
        data: null
      });
    }
    if (field === scatterplotYYaccessor) {
      dispatch({
        type: "set scatterplot y",
        data: null
      });
    }
  }

  handleSetGeneAsScatterplotX() {
    return () => {
      const { dispatch, field } = this.props;
      dispatch({
        type: "set scatterplot x",
        data: field
      });
    };
  }

  handleSetGeneAsScatterplotY() {
    return () => {
      const { dispatch, field } = this.props;
      dispatch({
        type: "set scatterplot y",
        data: field
      });
    };
  }

  renderAxesBrushBins(x, y, bins, numValues, svgRef, field) {
    /* Remove everything */
    d3.select(svgRef)
      .selectAll("*")
      .remove();

    /* BINS */
    d3.select(svgRef)
      .insert("g", "*")
      .attr("fill", "#bbb")
      .selectAll("rect")
      .data(bins)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.x0) + 1)
      .attr("y", d => y(d.length / numValues))
      .attr("width", d => Math.abs(x(d.x1) - x(d.x0) - 1))
      .attr("height", d => y(0) - y(d.length / numValues));

    /* BRUSH */
    const brushX = d3
      .select(svgRef)
      .append("g")
      .attr("class", "brush")
      .attr("data-testid", `${svgRef.id}-brush`)
      .call(
        d3
          .brushX()
          .on("brush", this.onBrush(field, x.invert).bind(this))
          .on("end", this.onBrushEnd(field, x.invert).bind(this))
      );

    /* AXIS */
    d3.select(svgRef)
      .append("g")
      .attr("class", "axis axis--x")
      .attr("transform", `translate(0,${this.height - this.marginBottom})`)
      .call(d3.axisBottom(x).ticks(5));

    d3.select(svgRef)
      .selectAll(".axis--x text")
      .style("fill", "rgb(80,80,80)");

    d3.select(svgRef)
      .selectAll(".axis--x path")
      .style("stroke", "rgb(230,230,230)");

    d3.select(svgRef)
      .selectAll(".axis--x line")
      .style("stroke", "rgb(230,230,230)");

    this.setState({ brushX });
  }

  render() {
    const {
      field,
      colorAccessor,
      isUserDefined,
      isDiffExp,
      logFoldChange,
      pval,
      pvalAdj,
      scatterplotXXaccessor,
      scatterplotYYaccessor,
      zebra
    } = this.props;

    return (
      <div
        id={`histogram_${field}`}
        data-testid={`histogram-${field}`}
        data-testclass={isDiffExp ? `histogram-diffexp` : ""}
        style={{
          padding: globals.leftSidebarSectionPadding,
          backgroundColor: zebra ? globals.lightestGrey : "white"
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          {isDiffExp || isUserDefined ? (
            <span>
              <span
                style={{ marginRight: 7 }}
                className="bp3-icon-standard bp3-icon-scatter-plot"
              />
              <ButtonGroup style={{ marginRight: 7 }}>
                <Button
                  onClick={this.handleSetGeneAsScatterplotX(field).bind(this)}
                  active={scatterplotXXaccessor === field}
                  intent={scatterplotXXaccessor === field ? "primary" : "none"}
                >
                  plot x
                </Button>
                <Button
                  onClick={this.handleSetGeneAsScatterplotY(field).bind(this)}
                  active={scatterplotYYaccessor === field}
                  intent={scatterplotYYaccessor === field ? "primary" : "none"}
                >
                  plot y
                </Button>
              </ButtonGroup>
            </span>
          ) : null}
          {isUserDefined ? (
            <Button
              minimal
              onClick={this.removeHistogram.bind(this)}
              style={{
                color: globals.blue,
                cursor: "pointer",
                marginLeft: 7
              }}
            >
              remove
            </Button>
          ) : null}
          <Tooltip content="Use as color scale" position="bottom">
            <Button
              onClick={this.handleColorAction.bind(this)}
              active={colorAccessor === field}
              intent={colorAccessor === field ? "primary" : "none"}
              icon="tint"
            />
          </Tooltip>
        </div>
        <svg
          width={this.width}
          height={this.height}
          id={`histogram_${field}_svg`}
          data-testclass="histogram-svg"
          data-testid={`histogram_${field}_svg`}
          ref={svgRef => {
            this.drawHistogram(svgRef);
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "center"
          }}
        >
          <span
            data-testclass="brushable-histogram-field-name"
            style={{ fontStyle: "italic" }}
          >
            {field}
          </span>
        </div>

        {isDiffExp ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "baseline"
            }}
          >
            <span>
              <strong>log fold change:</strong>
              {` ${logFoldChange.toPrecision(4)}`}
            </span>
            <span
              style={{
                marginLeft: 7,
                padding: 2
              }}
            >
              <strong>p-value (adj):</strong>
              {pvalAdj < 0.0001 ? " < 0.0001" : ` ${pvalAdj.toFixed(4)}`}
            </span>
          </div>
        ) : null}
      </div>
    );
  }
}

export default HistogramBrush;
