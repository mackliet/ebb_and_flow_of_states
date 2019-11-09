import {IView} from "./IView";
import {MigrationData, MigrationNodeId} from "../Data/MigrationPatterns";


class HeatMap implements IView {

    readonly curYear: number;
    readonly currentData: MigrationData;

    constructor(data: MigrationData) {

        this.currentData = data;

    }

    showFullMap() {

    }

    focusNode(migrationNode: MigrationNodeId) {

    }

}