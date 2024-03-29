import * as d3 from "d3";
import {ScaleLinear, ScaleSequential} from "d3";
import {Selection} from 'd3-selection';
import * as topojson from 'topojson';
import {Feature} from 'geojson';
import {IView} from "./IView";
import {MigrationData, MigrationNode, MigrationPatterns} from "../Data/MigrationPatterns";
import {RegionEnum} from "../Data/DataUtils"
import {Dimensions} from "../Utils/svg-utils";
import {createTooltip, removeTooltip, updateTooltip, ViewState} from "./ViewUtils";

const stateId = (name: string) => {
    name = name.replace(/\s/g, "");
    return `state${name}`;
};

export class HeatMap implements IView {

    readonly migrationPatterns: MigrationPatterns;
    readonly currentData: MigrationData;
    readonly svg: Selection<any, any, any, any>;
    public curYear: number;
    private readonly path;
    private readonly geoLegend: string;
    private colorScale: ScaleLinear<number, number>;
    private legendScale: ScaleSequential<string>;
    private currentRegion: RegionEnum;
    private dataSelection;
    private us;
    private g: Selection<any, any, any, any>;
    private features: Array<Feature>;
    public state: ViewState = ViewState.net;
    highlightCallback: (RegionEnum) => void;
    clearCallback: () => void;


    constructor(patterns: MigrationPatterns, container: Selection<any, any, any, any>,
                svgDims: Dimensions, startYear: number = 2011) {
        this.curYear = startYear;
        this.migrationPatterns = patterns;
        this.currentData = patterns.data;
        this.svg = container.append('svg').attr('height', svgDims.height).attr('width', svgDims.width);
        d3.select('.geoLegendContainer').append('div').attr('id', 'geoLegend').attr('width', 80).attr('height', 100);
        this.geoLegend = '#geoLegend';
        this.path = d3.geoPath();
        this.setColorScale();
        d3.json("https://d3js.org/us-10m.v2.json").then((us) => {
            this.us = us;
            /**
             * Adapted from https://bl.ocks.org/mbostock/4090848
             */
            this.g = this.svg.append('g');
            this.features = (topojson.feature(this.us,  this.us.objects.states )as any).features;
            this.drawMap(null);
            // Borders
            this.svg.append("path")
                .attr("class", "state-borders")
                .attr("d", this.path(topojson.mesh(us, us.objects.states, function (a, b) {
                    return a !== b;
                })))
        });

    }

    setHighlightCallback(callback: (RegionEnum)=>void)
    {
        this.highlightCallback = callback;
    }

    setClearCallback(callback: ()=>void)
    {
        this.clearCallback = callback;
    }

    highlightState(state: RegionEnum)
    {
        this.focusNode(this.features.find(d => d.properties.name == state));
        const highlighted = this.currentRegion !== null;
        return highlighted;
    }

    clearHighlightedState()
    {
        this.focusNode(this.currentData[this.curYear][`${this.currentRegion}`]);
    }

    drawMap(stateSelected: RegionEnum) {
        this.currentRegion = stateSelected;
        this.setColorScale();
        this.updateLegend();
        // States
        this.dataSelection = this.g.selectAll('path')
        //@ts-ignore
            .data<Feature>(this.features);
        const enter = this.dataSelection.enter()
            .append('path').attr('d', this.path).attr("class", "states")
            .attr('id', (d) => {
                return stateId(d.properties.name)
            })
            .style('fill', (d) => {
                return this.stateFill(d, stateSelected)
            })
            .on('mouseover', (d) => {
                const id = stateId(d.properties.name);
                const hoveredState = d3.select(`#${id}`).style('fill', 'darkgray');
                this.handleTooltip(d, hoveredState, createTooltip)
            })
            .on('mousemove', (d) => 
            {
                const id = stateId(d.properties.name);
                const hoveredState = d3.select(`#${id}`).style('fill', 'darkgray');
                this.handleTooltip(d, hoveredState, updateTooltip);
            })
            .on('mouseout', (d) => {
                removeTooltip(this.svg);
            const id = stateId(d.properties.name);
            d3.select(`#${id}`).style('fill', this.stateFill(d, this.currentRegion));
        }).on('click', (d) => this.highlightCallback(d.properties.name));

        this.dataSelection.merge(enter).transition().style('fill', (d) => {
            return this.stateFill(d, stateSelected)
        });

        this.dataSelection.exit(enter).remove();

    }

    focusNode(feature: Feature) {
        if (this.state !== ViewState.net &&
            this.state as ViewState !== ViewState.in &&
            this.state as ViewState !== ViewState.out ){
            this.currentRegion = null;
            return
        }
        let region = RegionEnum[feature.properties.name];
        //@ts-ignore
        if (region === this.currentRegion) {
            region = null;
        }
        d3.select('.region-select').attr('text', feature.properties.name);
        //@ts-ignore
        this.drawMap(region);
    }

    stateFill(d: Feature, stateSelection: RegionEnum) {
        const name = d.properties.name;
        const nodeId = RegionEnum[name];
        let curYear;
        let lastYear;
        let flowData: number;
        if (stateSelection === null) {
            switch (this.state) {
                case ViewState.out:
                    flowData = this.currentData[this.curYear][nodeId].totalLeft;
                    break;
                case ViewState.in:
                    flowData = this.currentData[this.curYear][nodeId].totalCame;
                    break;
                case ViewState.growth:
                    curYear = <MigrationNode>this.currentData[this.curYear][nodeId];
                    lastYear = <MigrationNode>this.currentData[this.curYear - 1][nodeId];
                    flowData = curYear.totalPopulation / lastYear.totalPopulation - 1;
                    break;
                case ViewState.flow:
                    curYear = <MigrationNode>this.currentData[this.curYear][nodeId];
                    lastYear = <MigrationNode>this.currentData[this.curYear - 1][nodeId];
                    flowData = curYear.totalPopulation / lastYear.totalPopulation - 1;
                    break;
                case ViewState.gdp:
                    flowData = (<MigrationNode>this.currentData[this.curYear][nodeId]).GDPPerCapita;
                    break;
                case ViewState.pop:
                    flowData = (<MigrationNode>this.currentData[this.curYear][nodeId]).totalPopulation;
                    break;
                default:
                    flowData = this.currentData[this.curYear][nodeId].netImmigrationFlow;
            }

        } else {
            switch (this.state) {
                case ViewState.out:
                    if (this.currentData[this.curYear][nodeId].toEdges.hasOwnProperty(stateSelection)) {
                        flowData = this.currentData[this.curYear][nodeId].toEdges[stateSelection].estimate;
                    } else {
                        return 'darkgray';
                    }
                    break;
                case ViewState.in:
                    if (this.currentData[this.curYear][nodeId].fromEdges.hasOwnProperty(stateSelection)) {
                        flowData = this.currentData[this.curYear][nodeId].fromEdges[stateSelection].estimate;
                    } else {
                        return 'darkgray';
                    }
                    break;
                default:
                    if (this.currentData[this.curYear][nodeId].toEdges.hasOwnProperty(stateSelection)) {
                        flowData = this.currentData[this.curYear][nodeId].fromEdges[stateSelection].estimate -
                            this.currentData[this.curYear][nodeId].toEdges[stateSelection].estimate;
                    } else {
                        return 'darkgray';
                    }
            }

            if (flowData === undefined) {

                throw new Error(`Was not able to find a suitable edge from node ${d.properties.name} to ${RegionEnum[stateSelection]}`)
            }
        }

        return this.getInterpolate()(this.colorScale(flowData));

    }

    getInterpolate() {
        switch(this.state) {
            case ViewState.out:
                return d3.interpolateReds;
            case ViewState.gdp:
            case ViewState.in:
            case ViewState.pop:
                return d3.interpolateBlues;
            default:
                return d3.interpolateRdBu
        }
    }

    setColorScale() {
        let maxValue;
        let domain;
        switch(this.state) {
            case ViewState.out:
                if (this.currentRegion != null) {
                    maxValue = this.migrationPatterns.stateRanges[this.currentRegion].maxEdgeTo;
                } else {
                    maxValue = this.migrationPatterns.maxOutflow
                }
                domain = [0,maxValue];
                this.colorScale = d3.scaleLinear().domain(domain).range([0,1]);
                this.legendScale = d3.scaleSequential(this.getInterpolate()).domain(domain);
                break;
            case ViewState.in:
                if (this.currentRegion != null) {
                    maxValue = this.migrationPatterns.stateRanges[this.currentRegion].maxEdgeFrom;
                } else {
                    maxValue = this.migrationPatterns.maxInflow
                }
                domain = [0,maxValue];
                this.colorScale = d3.scaleLinear().domain([0,maxValue]).range([0,1]);
                this.legendScale = d3.scaleSequential(this.getInterpolate()).domain([0,maxValue]);
                break;
            case ViewState.growth:
                this.colorScale = d3.scaleLinear().domain([-0.04, 0.04]).range([0,1]);
                this.legendScale = d3.scaleSequential(this.getInterpolate()).domain([-0.04, 0.04]);
                break;
            case ViewState.gdp:
                // District of Columbia is a bit of an outlier
                this.colorScale = d3.scaleLinear().domain([37000, 72000]).range([0,1]);
                this.legendScale = d3.scaleSequential(this.getInterpolate()).domain([37000, 72000]);
                break;
            case ViewState.flow:
                // District of Columbia is a bit of an outlier
                this.colorScale = d3.scaleLinear().domain([-0.08, 0.04]).range([0,1]);
                this.legendScale = d3.scaleSequential(this.getInterpolate()).domain([-0.08, 0.04]);
                break;
            case ViewState.pop:
                // District of Columbia is a bit of an outlier
                this.colorScale = d3.scaleLinear().domain([5e5, 40e6]).range([0,1]);
                this.legendScale = d3.scaleSequential(this.getInterpolate()).domain([5e5, 40e6]);
                break;
            default:
                if (this.currentRegion != null) {
                    maxValue = this.migrationPatterns.stateRanges[this.currentRegion].maxEdgeNet;
                    domain = [-maxValue,maxValue];
                    this.colorScale = d3.scaleLinear().domain([-maxValue,maxValue]).range([0,1]);
                    this.legendScale = d3.scaleSequential(this.getInterpolate()).domain(domain);
                } else {
                    const domain: number[] = [-1e5,1e5];
                    this.colorScale = d3.scaleLinear().domain([-1e5,1e5]).range([0,1]);
                    this.legendScale = d3.scaleSequential(this.getInterpolate()).domain([-1e5,1e5]);
                }

        }
    }

    private handleTooltip(feature: Feature, 
                          hoveredState: Selection<any, any, any, any>, 
                          tooltipFunc: typeof createTooltip)
    {
        let tooltipTextLines: string[] = [];

        const name = feature.properties.name;
        const nodeId = RegionEnum[name];
        const stateSelection = this.currentRegion;

        if (stateSelection === null) 
        {
            const tooltipStatFunc = 
            (selectedStat) =>
            {
                const d = <MigrationNode>this.currentData[this.curYear][nodeId];
                switch(selectedStat)
                {
                    case ViewState.out:
                        return `Total left: ${d.totalLeft}`;
                    case ViewState.in:
                        return `Total came: ${d.totalCame}`;
                    case ViewState.pop:
                        return `Total population: ${d.totalPopulation}`;
                    case ViewState.flow:
                        const flow = (d.netImmigrationFlow / d.totalPopulation * 100).toFixed(2);
                        return `% pop migrated: ${flow}%`;
                    case ViewState.gdp:
                        return `GDPPC: ${d.GDPPerCapita}`;
                    case ViewState.growth:
                        if (this.curYear === 2015) return 'Growth: N/A';
                        const pop = d.totalPopulation / this.currentData[this.curYear - 1][nodeId].totalPopulation;
                        const g = (( pop - 1)* 100).toFixed(2);
                        return `Growth: ${g}%`;
                    case ViewState.net:
                    default:
                        break;
                }
                return `Net immigration: ${this.currentData[this.curYear][nodeId].netImmigrationFlow}`;
            };
            tooltipTextLines = [name, 
                               tooltipStatFunc(this.state)]
        }
        else if(RegionEnum[stateSelection] === name)
        {
            const tooltipStatFunc = 
            (selectedStat) =>
            {
                switch(selectedStat)
                {
                    case ViewState.out:
                        return `Total from other states: ${this.currentData[this.curYear][nodeId].totalCame}`;
                    case ViewState.in:
                        return `Total to other states: ${this.currentData[this.curYear][nodeId].totalLeft}`;
                    case ViewState.net:
                    default:
                        break;
                }
                return `Net immigration: ${this.currentData[this.curYear][nodeId].netImmigrationFlow}`;
            };
            tooltipTextLines = [name, 
                               tooltipStatFunc(this.state)]
        }
        else 
        {
            const stateSelectionName:string = RegionEnum[stateSelection]
            const tooltipStatFunc = 
            (selectedStat) =>
            {
                switch(selectedStat)
                {
                    case ViewState.out:
                        return `To ${stateSelectionName}: ${this.currentData[this.curYear][nodeId].toEdges[stateSelection].estimate}`;
                    case ViewState.in:
                        return `From ${stateSelectionName}: ${this.currentData[this.curYear][nodeId].fromEdges[stateSelection].estimate}`;
                    case ViewState.net:
                    default:
                        break;
                }
                return `Net immigration to ${stateSelectionName}: ${this.currentData[this.curYear][nodeId].toEdges[stateSelection].estimate -
                    this.currentData[this.curYear][nodeId].fromEdges[stateSelection].estimate}`;
            };
            tooltipTextLines = [name, 
                               tooltipStatFunc(this.state)]
        }
        
        tooltipFunc(this.svg, d3.mouse(this.svg.node()), tooltipTextLines);
    }

    private updateLegend() {
        continuous(this.geoLegend, this.legendScale)
    }

    public toggleMigrationStatistic(viewState: ViewState) {
        this.state = viewState;
        this.drawMap(this.currentRegion);
    }

    public changeYear(year: number) {
        this.curYear = year;
        this.drawMap(this.currentRegion);
    }

    public toggleGeoState(state: ViewState) {
        this.state = state;
        this.currentRegion = null;
        this.drawMap(this.currentRegion);
    }
}

/**
 * Lifted from http://bl.ocks.org/syntagmatic/e8ccca52559796be775553b467593a9f
 * @param selectorId
 * @param colorScale
 */
function continuous(selectorId, colorScale) {
    let legendHeight = 200,
        legendWidth = 80,
        margin = {top: 10, right: 60, bottom: 10, left: 2};
    d3.select(selectorId).select('canvas').remove();
    let canvas = d3.select(selectorId)
        .style("height", legendHeight + "px")
        .style("width", legendWidth + "px")
        .style("position", "relative")
        .append("canvas")
        .attr("height", legendHeight - margin.top - margin.bottom)
        .attr("width", 1)
        .style("height", (legendHeight - margin.top - margin.bottom) + "px")
        .style("width", (legendWidth - margin.left - margin.right) + "px")
        .style("border", "1px solid #000")
        .style("position", "absolute")
        .style("top", (margin.top) + "px")
        .style("left", (margin.left) + "px")
        .node();
    let ctx = canvas.getContext("2d");

    let legendScale = d3.scaleLinear()
        .range([1, legendHeight - margin.top - margin.bottom])
        .domain(colorScale.domain());

    // image data hackery based on http://bl.ocks.org/mbostock/048d21cf747371b11884f75ad896e5a5
    let image = ctx.createImageData(1, legendHeight);
    d3.range(legendHeight).forEach(function(i) {
        let c = d3.rgb(colorScale(legendScale.invert(i)));
        image.data[4*i] = c.r;
        image.data[4*i + 1] = c.g;
        image.data[4*i + 2] = c.b;
        image.data[4*i + 3] = 255;
    });
    ctx.putImageData(image, 0, 0);

    // A simpler way to do the above, but possibly slower. keep in mind the legend width is stretched because the width attr of the canvas is 1
    // See http://stackoverflow.com/questions/4899799/whats-the-best-way-to-set-a-single-pixel-in-an-html5-canvas
    /*
    d3.range(legendHeight).forEach(function(i) {
      ctx.fillStyle = colorScale(legendScale.invert(i));
      ctx.fillRect(0,i,1,1);
    });
    */

    let legendAxis = d3.axisRight(legendScale).tickSize(6).ticks(8);
    d3.select(selectorId).select('svg').remove();
    let svg = d3.select(selectorId).append("svg")
        .attr("height", (legendHeight) + "px")
        .attr("width", (legendWidth) + "px")
        .style("position", "absolute")
        .style("left", "0px")
        .style("top", "0px")

    svg
        .append("g")
        .attr("class", "axis")
        .attr("transform", "translate(" + (legendWidth - margin.left - margin.right + 3) + "," + (margin.top) + ")")
        .call(legendAxis);
}
