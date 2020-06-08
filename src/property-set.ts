import { DiazoProperty } from "./property";

/**
 * @category Model
 */
export interface DiazoPropertySet {
    id : string;
    label : string;
    description? : string;
    properties : DiazoProperty[];
}
