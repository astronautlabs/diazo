import { DiazoNode } from "./node";
import { DiazoEdge } from "./edge";

/**
 * Represents the structure of a graph built within Diazo.
 * Consists of a set of {@linkcode nodes} with distinct IDs, where each node
 * defines a set of {@linkcode DiazoNode.slots | slots}, and a set of {@linkcode edges}.
 * 
 * @category Model
 */
export interface DiazoGraph {
    /**
     * Represents the set of nodes present in this Diazo.
     */
    nodes : DiazoNode[];

    /**
     * Represents the edges of a Diazo, that is, those that connect 
     * the {@linkcode DiazoNode.slots} of {@linkcode nodes} together.
     */
    edges : DiazoEdge[];
}
