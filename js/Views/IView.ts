import {MigrationData} from "../Data/MigrationPatterns";


export interface IView {

    readonly curYear: number;
    readonly currentData: MigrationData;

}