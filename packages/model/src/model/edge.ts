
/**
 * Defines the structure of an edge within the {@linkcode Diazo.edges | edges} property of a {@linkcode Diazo}
 * object.
 * 
 * @category Model
 */
export interface DiazoEdge {
    fromNodeId : string;
    fromSlotId : string;
    toNodeId : string;
    toSlotId : string;
    active? : boolean;
    valid? : boolean;
}