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
     * Optional place to put arbitrary data.
     */
    data?: Record<string, any>;

    /**
     * Whether this slot is part of the template that this node was created from.
     * When true, Diazo will not delete the slot when the user uses "Remove Slot" 
     * from the Property Sheets UI, but instead mark it as disabled. This enables 
     * automatic upgrade features for Diazo applications by ensuring that intentionally
     * removed slots are not re-added during the upgrade process.
     */
    default?: boolean;

    /**
     * When true, this slot is not shown on the graph. This is set by Diazo automatically
     * if the slot is default and the user removes it via the Property Sheet. It is set to true
     * by Diazo if the user adds a slot via Property Sheet and the slot's ID matches what would
     * be created.
     * 
     * This is distinct from `hidden` which is just not visually shown (and can even maintain edges
     * when hidden).
     */
    disabled?: boolean;

    /**
     * When true, this slot is shown as invalid (red). This is useful as a way to indicate to the user that 
     * something about the slot or the way its used makes the graph invalid within the business rules of the 
     * particular Diazo application. One application is for marking a slot which is no longer part of a node 
     * (ie as part of an upgrade process). If you are using it for this purpose, also see removeWhenEmpty.
     */
    invalid?: boolean;

    /**
     * When true, this slot is removed when all edges to it are removed. This has multiple uses, but its most useful
     * in tandem with the "invalid" property when upgraded versions of nodes remove slots.
     */
    removeWhenEmpty?: boolean;

    /**
     * Optional place to put behaviorial information about this node.
     * May be elided in the frontend.
     */
    behavior?: Record<string, any>;

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
     * 
     * Edges on hidden slots are maintained, they are just not shown. 
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
