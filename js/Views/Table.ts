import {MigrationData, MigrationNode, MigrationPatterns} from "../Data/MigrationPatterns";
import {RegionEnum} from "../Data/DataUtils"
import {ScaleLinear} from 'd3';
import {Selection} from 'd3-selection';
import {Dimensions} from "../Utils/svg-utils";
import {IView} from "./IView";
import * as d3 from "d3";


export class Table implements IView {

    /*
        Table state variables
     */
    private readonly lastSorted: string;

    private readonly parentSvg: Selection<any, any, any, any>;
    private readonly table: Selection<any, MigrationNode, any, MigrationNode>;
    private readonly header: Selection<any, any, any, any>;
    private readonly axisHeader: Selection<any, any, any, any>;
    private readonly titleHeader: Selection<any, any, any, any>;
    private readonly yearContainer: Selection<any, any, any, any>;
    private readonly tBody: Selection<any, MigrationNode, any, any>;
    private readonly flowScale: ScaleLinear<number, number>;
    private readonly migrationScale: ScaleLinear<number, number>;
    // TODO May just overlay these with total being the red/blue on the axis and the overlay being pruple
    private readonly headerLabels = ['Region', 'Total Flow', 'pop %', 'Pop. Growth %', 'Population'];

    public curYear: number;
    readonly currentData: MigrationData;

    /**
     * Table constants
     */
    private readonly FLOW_RECT_WIDTH = 150;
    private readonly GROWTH_RECT_WIDTH = 150;
    private readonly MIGRATION_RECT_WIDTH = 150;
    private readonly POP_RECT_WIDTH = 150;

    /**
     *
     * @param migrationPatterns
     * @param container HTML selection where the view will be placed in
     * @param svgDims dimensions of the SVG
     * @param startYear year to start the visualization
     */
    constructor(migrationPatterns: MigrationPatterns, container: Selection<any, any, any, any>,
                svgDims: Dimensions, startYear: number = 2017) {
        this.currentData = migrationPatterns.data;
        // TODO Create the data table objects
        // TODO Need to define columns and css classes for various states and objects
        console.debug(`Table SVG Dimensions are width: ${svgDims.width}; height: ${svgDims.height}`);
        this.flowScale = d3.scaleLinear<number, number>().range([0, this.FLOW_RECT_WIDTH])
            .domain([migrationPatterns.minSum, migrationPatterns.maxInflow]);
        this.migrationScale = d3.scaleLinear<number, number>().range([0, this.MIGRATION_RECT_WIDTH])
            .domain([-.1, .05]);
        this.yearContainer = container.append('div').classed('year', true).text(startYear);
        this.table = container.append('table');
        this.header = this.table.append('thead');
        this.axisHeader = this.header.append('tr');
        this.titleHeader = this.header.append('tr');
        for (const l of this.headerLabels) {
            this.axisHeader.append('th').text(l).on('click', this.labelListener);
        }
        this.tBody = this.table.append('tbody');
        this.loadTable(startYear);
    }

    /**
     * Class to refresh the data table for sorting, brush, or selections
     */
    loadTable(year) {
        console.debug(`Loading data table ${year}`);
        const data = this.currentData[year];
        console.log(data[0].year);
        //@ts-ignore
        const update = this.tBody.selectAll('tr').data(data, (d) => {
            const e: MigrationNode = <MigrationNode>d;
            return e.nodeId
        }).join(
            enter => {
                //enter.append('tr').classed('year', true);
                const rows = enter.append('tr');
                rows.append('td').append('text').text((d) => {
                    return RegionEnum[d.nodeId];
                });
                const tds = rows.append('td');
                tds.attr('class', 'svg');
                const svg = tds.append('svg').attr('width', this.FLOW_RECT_WIDTH).style('max-height', '100%')
                    .style('display', 'block');
                /**
                 * Create net rectangle.  Blue for net inflow, red for net outflow
                 */
                this.net(svg.append('rect').classed('net', true)
                            .selectAll('rect').classed('net', true)
                         , year);
                /**
                 * Create net rectangle.  Blue for net inflow, red for net outflow
                 */
                this.in(svg.append('rect').classed('in', true), year);


                /**
                 * Create difference rectangle.  Should be purple until it ends
                 */
                this.out(svg.append('rect').classed('out', true), year);

                this.pop(rows.append('td').classed('pop', true).append('text'), year);

                this.popGrowth(rows.append('td').classed('popGrowth', true).append('text'), year);

                this.popTotal(rows.append('td').classed('popTotal', true).append('text'), year);

            },
            update => {
                console.log(update);
                update = update.transition();
                this.net(update.selectAll('rect').filter('.net'), year);
                this.in(update.selectAll('rect').filter('.in'), year);
                this.out(update.selectAll('rect').filter('.out'), year);

                this.pop(update.selectAll('td').filter('.pop'), year);

                this.popGrowth(update.selectAll('td').filter('.popGrowth'), year);

                this.popTotal(update.selectAll('td').filter('.popTotal').select('text'), year)
            }
        );

    }

    /**
     *
     * @param join selection for updating/creating attributes
     * @param year current year for the view
     */
    net(join, year) {
        join.attr('x', (d) => {
            d = this.currentData[year][d.nodeId];
            if (d.netImmigrationFlow < 0) {
                return this.flowScale(d.netImmigrationFlow);
            }
            return this.flowScale(0);
        }).attr('y', 0).attr('height', 5).attr('width', (d) => {
            d = this.currentData[year][d.nodeId];
            const flow = this.flowScale(0) - this.flowScale(d.netImmigrationFlow);
            return flow < 0 ? 0 : flow;
        }).attr('fill', (d) => {
            d = this.currentData[year][d.nodeId];
            if (d.netImmigrationFlow < 0) {
                return 'red';
            } else {
                return 'blue';
            }
        });
    }

    /**
     *
     * @param join selection for updating/creating attributes
     * @param year current year for the view
     */
    in(join, year) {
        join.attr('x', (d) => {
            d = this.currentData[year][d.nodeId];
            if (d.netImmigrationFlow < 0) {
                return this.flowScale(0);
            }
            return this.flowScale(0);
        }).attr('y', 5).attr('height', 5).attr('width', (d) => {
            d = this.currentData[year][d.nodeId];
            const width = this.flowScale(d.totalCame) - this.flowScale(0);
            return width;
        }).attr('fill', 'blue');
    }

    /**
     *
     * @param join selection for updating/creating attributes
     * @param year current year for the view
     */
    out(join, year) {
        join.attr('x', (d) => {

            if (d.netImmigrationFlow < 0) {
                return this.flowScale(0)
            }
            return this.flowScale(d.netImmigrationFlow);
        }).attr('y', 10).attr('height', 5).attr('width', (d) => {
            let width;
            if (d.netImmigrationFlow < 0) {
                width = (this.flowScale(d.totalCame) - this.flowScale(0)) +
                    (this.flowScale(0) - this.flowScale(d.netImmigrationFlow)) - (this.flowScale(0) - this.flowScale(d.netImmigrationFlow));
            } else {
                width = (this.flowScale(d.totalCame) - this.flowScale(d.netImmigrationFlow));
            }
            return width;
        }).attr('fill', 'purple');
    }

    /**
     *
     * @param join selection for updating/creating attributes
     * @param year current year for the view
     */
    pop(join, year) {
        join.select('text').text((d) => {
            d = this.currentData[year][d.nodeId];
            return (Math.round((d.netImmigrationFlow / d.totalPopulation) * 100) / 100).toFixed(2);
        });
    }

    /**
     *
     * @param join selection for updating/creating attributes
     * @param year current year for the view
     */
    popGrowth(join, year){
       join.text((d) => {
            d = this.currentData[year][d.nodeId];
            if (year === 2015) {
                return 'N/A'
            }
            return (Math.round((d.totalPopulation / this.currentData[year - 1][d.nodeId].totalPopulation ) * 100) / 100).toFixed(2);
        });
    }

    /**
     *
     * @param join selection for updating/creating attributes
     * @param year current year for the view
     */
    popTotal(join, year) {
        join.text((d) => {
            d = this.currentData[year][d.nodeId];
            return d.totalPopulation;
        });
    }

    labelListener(l) {
        console.debug(`Clicked ${l} header`);
    }

    changeYear(year: number) {
        this.yearContainer.text(year);
        console.log(`Year: ${year}`);
        this.curYear = year;
        this.loadTable(year);
    }

}