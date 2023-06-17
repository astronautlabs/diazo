import { DiazoPropertyCell } from "./property-cell";

/**
 * @category Model
 */
export interface DiazoPropertyMatrix {
    width : number;
    height : number;
    cells : DiazoPropertyCell[];
}
