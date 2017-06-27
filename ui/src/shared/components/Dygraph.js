/* eslint-disable no-magic-numbers */
import React, {Component, PropTypes} from 'react'
import shallowCompare from 'react-addons-shallow-compare'

import _ from 'lodash'

import Dygraphs from 'src/external/dygraph'
import getRange from 'shared/parsing/getRangeForDygraph'

import {LINE_COLORS, multiColumnBarPlotter} from 'src/shared/graphs/helpers'

export default class Dygraph extends Component {
  constructor(props) {
    super(props)
    this.state = {
      isSynced: false,
    }

    // optional workaround for dygraph.updateOptions breaking legends
    // a la http://stackoverflow.com/questions/38371876/dygraph-dynamic-update-legend-values-disappear
    // this.lastMouseMoveEvent = null
    // this.isMouseOverGraph = false

    this.getTimeSeries = ::this.getTimeSeries
    this.handleSortLegend = ::this.handleSortLegend
    this.sync = ::this.sync
  }

  static defaultProps = {
    containerStyle: {},
    isGraphFilled: true,
    overrideLineColors: null,
  }

  getTimeSeries() {
    const {timeSeries} = this.props
    // Avoid 'Can't plot empty data set' errors by falling back to a
    // default dataset that's valid for Dygraph.
    return timeSeries.length ? timeSeries : [[0]]
  }

  componentDidMount() {
    const timeSeries = this.getTimeSeries()
    // dygraphSeries is a legend label and its corresponding y-axis e.g. {legendLabel1: 'y', legendLabel2: 'y2'};
    const {
      ranges,
      dygraphSeries,
      ruleValues,
      overrideLineColors,
      isGraphFilled,
      isBarGraph,
      options,
    } = this.props

    const graphContainerNode = this.graphContainer
    const legendContainerNode = this.legendContainer
    const legendContentsNode = this.legendContents
    let finalLineColors = overrideLineColors

    if (finalLineColors === null) {
      finalLineColors = LINE_COLORS
    }

    const defaultOptions = {
      plugins: [
        new Dygraphs.Plugins.Crosshair({
          direction: 'vertical',
        }),
      ],
      labelsSeparateLines: false,
      labelsDiv: legendContentsNode,
      labelsKMB: true,
      rightGap: 0,
      highlightSeriesBackgroundAlpha: 1.0,
      highlightSeriesBackgroundColor: 'rgb(41, 41, 51)',
      fillGraph: isGraphFilled,
      axisLineWidth: 2,
      gridLineWidth: 1,
      highlightCircleSize: 3,
      animatedZooms: true,
      hideOverlayOnMouseOut: false,
      colors: finalLineColors,
      series: dygraphSeries,
      axes: {
        y: {
          valueRange: getRange(timeSeries, ranges.y, ruleValues),
        },
        y2: {
          valueRange: getRange(timeSeries, ranges.y2),
        },
      },
      highlightSeriesOpts: {
        strokeWidth: 2,
        highlightCircleSize: 5,
      },
      unhighlightCallback: e => {
        const {
          top,
          bottom,
          left,
          right,
        } = legendContainerNode.getBoundingClientRect()

        const mouseY = e.clientY
        const mouseX = e.clientX

        const mouseInLegendY = mouseY <= bottom && mouseY >= top
        const mouseInLegendX = mouseX <= right && mouseX >= left
        const isMouseHoveringLegend = mouseInLegendY && mouseInLegendX

        if (!isMouseHoveringLegend) {
          legendContainerNode.className = 'container--dygraph-legend hidden' // hide
        }
      },
      highlightCallback: e => {
        // don't make visible yet, but render on DOM to capture position for calcs
        legendContainerNode.style.visibility = 'hidden'
        legendContainerNode.className = 'container--dygraph-legend'
        legendContainerNode.onmouseleave = () =>
          legendContainerNode.className = 'container--dygraph-legend hidden'

        // Move the Legend on hover
        const graphRect = graphContainerNode.getBoundingClientRect()
        const legendRect = legendContainerNode.getBoundingClientRect()
        const graphWidth = graphRect.width + 32 // Factoring in padding from parent
        const graphHeight = graphRect.height
        const graphBottom = graphRect.bottom
        const legendWidth = legendRect.width
        const legendHeight = legendRect.height
        const screenHeight = window.innerHeight
        const legendMaxLeft = graphWidth - legendWidth / 2
        const trueGraphX = e.pageX - graphRect.left

        let legendLeft = trueGraphX

        // Enforcing max & min legend offsets
        if (trueGraphX < legendWidth / 2) {
          legendLeft = legendWidth / 2
        } else if (trueGraphX > legendMaxLeft) {
          legendLeft = legendMaxLeft
        }

        // Disallow screen overflow of legend
        const isLegendBottomClipped = graphBottom + legendHeight > screenHeight

        const legendTop = isLegendBottomClipped
          ? graphHeight + 8 - legendHeight
          : graphHeight + 8

        legendContainerNode.style.visibility = 'visible' // show
        legendContainerNode.style.left = `${legendLeft}px`
        legendContainerNode.style.top = `${legendTop}px`

        // part of optional workaround for preventing updateOptions from breaking legend
        // this.isMouseOverGraph = true
        // this.lastMouseMoveEvent = e
      },
      drawCallback: () => {
        legendContainerNode.className = 'container--dygraph-legend hidden' // hide
      },
    }

    if (isBarGraph) {
      defaultOptions.plotter = multiColumnBarPlotter
    }

    this.dygraph = new Dygraphs(graphContainerNode, timeSeries, {
      ...defaultOptions,
      ...options,
    })

    const {w} = this.dygraph.getArea()
    this.props.setResolution(w)

    // Simple opt-out for now, if a graph should not be synced
    if (this.props.synchronizer) {
      this.sync()
    }
  }

  componentWillUnmount() {
    this.dygraph.destroy()
    delete this.dygraph
  }

  shouldComponentUpdate(nextProps, nextState) {
    const timeRangeChanged = !_.isEqual(
      nextProps.timeRange,
      this.props.timeRange
    )

    if (this.dygraph.isZoomed() && timeRangeChanged) {
      this.dygraph.resetZoom()
    }

    // Will cause componentDidUpdate to fire twice, currently. This could
    // be reduced by returning false from within the reset conditional above,
    // though that would be based on the assumption that props for timeRange
    // will always change before those for data.
    return shallowCompare(this, nextProps, nextState)
  }

  componentDidUpdate() {
    const {
      labels,
      ranges,
      options,
      dygraphSeries,
      ruleValues,
      isBarGraph,
    } = this.props
    const dygraph = this.dygraph
    if (!dygraph) {
      throw new Error(
        'Dygraph not configured in time; this should not be possible!'
      )
    }

    const timeSeries = this.getTimeSeries()

    const legendContainerNode = this.legendContainer
    legendContainerNode.className = 'container--dygraph-legend hidden' // hide

    dygraph.updateOptions({
      labels,
      file: timeSeries,
      axes: {
        y: {
          valueRange: getRange(timeSeries, ranges.y, ruleValues),
        },
        y2: {
          valueRange: getRange(timeSeries, ranges.y2),
        },
      },
      stepPlot: options.stepPlot,
      stackedGraph: options.stackedGraph,
      underlayCallback: options.underlayCallback,
      series: dygraphSeries,
      plotter: isBarGraph ? multiColumnBarPlotter : null,
    })
    // part of optional workaround for preventing updateOptions from breaking legend
    // if (this.lastMouseMoveEvent) {
    //   dygraph.mouseMove_(this.lastMouseMoveEvent)
    // }

    dygraph.resize()
    const {w} = this.dygraph.getArea()
    this.props.setResolution(w)
  }

  sync() {
    if (!this.state.isSynced) {
      this.props.synchronizer(this.dygraph)
      this.setState({isSynced: true})
    }
  }

  handleSortLegend() {
    const legend = this.legendContents
    const legendValues = legend.children
    const sortOrder = legend.getAttribute('data-sort')

    const list = []
    for (let i = 0; i < legendValues.length; i++) {
      list.push(legendValues[i])
    }

    list.sort((a, b) => {
      // const text = legendValues[i].textContent
      // const [string, number] = text.split(':')
      const [aText, aNum] = a.textContent.split(':')
      const [bText, bNum] = b.textContent.split(':')

      if (sortOrder === 'asc') {
        return +aNum - +bNum
      }

      if (sortOrder === 'desc') {
        return +bNum - +aNum
      }
    })

    for (let i = 0; i < legendValues.length; i++) {
      legend.appendChild(list[i])
    }

    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc'
    legend.setAttribute('data-sort', newOrder)
  }

  render() {
    return (
      <div className="dygraph-child">
        <div
          style={{userSelect: 'text'}}
          ref={r => {
            this.legendContainer = r
          }}
          className={'container--dygraph-legend hidden'}
        >
          <div className="dygraph-legend--header">
            <input className="form-control input-xs" type="text" />
            <button
              className="btn btn-primary btn-xs"
              onClick={this.handleSortLegend}
            >
              A-Z
            </button>
            <button
              className="btn btn-primary btn-xs"
              onClick={this.handleSortLegend}
            >
              0-9
            </button>
          </div>
          <div
            data-sort="asc"
            ref={r => {
              this.legendContents = r
            }}
            className="dygraph-legend--contents"
          />
        </div>
        <div
          ref={r => {
            this.graphContainer = r
          }}
          style={this.props.containerStyle}
          className="dygraph-child-container"
        />
      </div>
    )
  }
}

const {array, arrayOf, func, number, bool, shape, string} = PropTypes

Dygraph.propTypes = {
  ranges: shape({
    y: arrayOf(number),
    y2: arrayOf(number),
  }),
  timeSeries: array.isRequired,
  labels: array.isRequired,
  options: shape({}),
  containerStyle: shape({}),
  isGraphFilled: bool,
  isBarGraph: bool,
  overrideLineColors: array,
  dygraphSeries: shape({}).isRequired,
  ruleValues: shape({
    operator: string,
    value: string,
    rangeValue: string,
  }),
  timeRange: shape({
    lower: string.isRequired,
  }),
  synchronizer: func,
  setResolution: func,
}
