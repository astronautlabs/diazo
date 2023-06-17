import { DiazoNode } from "./node";

/**
 * @category Model
 */
export interface DiazoNodeSet {
    id? : string;
    tags? : string[];
    label : string;
    nodes : DiazoNode[];
}