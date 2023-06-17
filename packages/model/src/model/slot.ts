import { DiazoValue } from "./value";

/**
 * Represents a slot on a node.
 * @see {@linkcode DiazoNode.slots}
 * @category Model
 */
export interface DiazoSlot {
    /**
     * The ID of this slot. This must be unique among all slots
     * on the same node.
     */
    id : string;

    /**
     * The label for this slot. It is shown on the node (unless {@linkcode profile}
     * `== slim`) as well as in tooltips.
     */
    label : string;

    /**
     * The type of slot this is. 
     * - `input` - Accepts incoming connections from other nodes
     * - `output` - Accepts outgoing connections to other nodes
     * - `passthrough` - Slot accepts both input and output. This is used
     *   to implement `reroute` nodes within the editor.
     */
    type : 'input' | 'output' | 'passthrough';

    /**
     * If true, this slot will not be shown on the node within the editor.
     * This is controlled in the "Slots" section of the Properties sidebar,
     * and can be included in a template node to have a slot hidden by default.
     */
    hidden? : boolean;

    /**
     * The value associated with this slot.
     * 
     * Conceptually, the value of a slot defines the type of content that 
     * is "transported" by edges that connect to it. Practically, this 
     * lets the editor ensure that the user cannot connect incompatible 
     * slots to each other.
     * 
     * 
     * Values are also the mechanism by which the presentational elements of 
     * edges in the graph (ie color, width, labels) are customized. 
     * 
     * Each `value` consists of a {@link DiazoValueType | value type} 
     * and a set of _parameters_.
     * Most simple value types do not depend on the parameters included within
     * the actual `value` declared on a `slot`, but some do. The parameters 
     * of a value may impact whether the editor allows a connection from one
     * slot to another.
     * 
     * Value types are referenced via a registered ID. See 
     * {@link DiazoEditorComponent.valueTypes}
     * for information about providing these to the editor.
     * 
     * For more about value types, see {@link DiazoValueType}
     * 
     */
    value? : DiazoValue;

    /**
     * True when this slot was created dynamically by the editor. You should not
     * specify custom slots with this property.
     */
    dynamic? : boolean;
}
