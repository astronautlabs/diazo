/**
 * @category Model
 */
export interface DiazoValue {
    type : string;
    params : Record<string,any>;
}

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

/**
 * @category Model
 */
export interface DiazoNode {
    id? : string;

    /**
     * Specifies the category of node this is.
     * Examples of classifications could include "input", "output", "filter"
     * but the meaning of this field is not defined within the Diazo editor
     * except that if you wish to use a custom node view, this field determines
     * which custom node view that will be displayed. 
     */
    type? : string;

    /**
     * Specify the label to show on this node (if the style settings are such that
     * labels are to be shown) as well as in the New Node menu if this is a template
     * node.
     */
    label? : string;

    /**
     * Dictate that this node is readonly, and cannot be edited. This disallows
     * editing via the Properties sidebar, and disallows adding new edges. The 
     * user can still move the node around. If you wish to prevent that, set 
     * `locked` instead.
     */
    readonly? : boolean;

    /**
     * Like `locked`, but the user also cannot move the node.
     */
    locked? : boolean;

    /**
     * Specify an icon to be shown in the New Node menu. Currently this 
     * must be an icon included in the Material Icons font.
     */
    icon? : string;
    
    /**
     * Specify the X position of the node within the graph canvas.
     */
    x? : number;

    /**
     * Specify the Y position of the node within the graph canvas.
     */
    y? : number;

    /**
     * Specify the style of this node. 
     * - `normal` -- Shown with a "titlebar" where the label lives, with the 
     *   node view (if any) and the slot handles in the "main" portion of the node.
     * - `compact` -- Shown as a uniform rounded rectangle with a slightly larger
     *   label (compared to `normal`).
     * - `inline` -- Shown like `compact`, but the label is shown inline with the
     *   input/output slots with the three columns aligned at the top.
     * - `reroute` -- Shown without any UI. Assumes a single slot is present on 
     *   the node. This is used specifically for special reroute nodes created 
     *   within the editor.
     */
    style? : 'normal' | 'compact' | 'inline' | 'reroute';

    /**
     * Control the width behavior of the node when shown in the editor.
     * - `normal` -- Provide a sensible minimum width, expand as necessary to 
     *   fit content. Shows labels on slots.
     * - `slim` -- Provide a smaller sensible minimum width, but still expands
     *   as necessary to fit content. Hides labels on slots.
     * - `wide` -- Assume the node is best presented with a larger minimum width.
     *   Does not expand as necessary so that inner content can nicely wrap into
     *   the available space. Shows labels on slots.
     */
    profile? : 'normal' | 'slim' | 'wide';
    
    /**
     * This is used by the Diazo editor to keep track of where the node is 
     * being moved to. It should be ignored or set to zero otherwise.
     * @todo move to context layer
     */
    positionDeltaX? : number;

    /**
     * This is used by the Diazo editor to keep track of where the node is 
     * being moved to. It should be ignored or set to zero otherwise.
     * @todo move to context layer
     */
    positionDeltaY? : number;

    /**
     * This property should be an object whose keys represent the custom 
     * metadata you are interested in for this node. Usually user-editable
     * properties will reference data within this structure. 
     * 
     * There are some somewhat "special" properties in this object:
     * - `unit` typically specifies the subtype of the node (where {@link `DiazoNode.type`
     *   indicates the primary categorization) 
     */
    data? : any;

    /**
     * The set of connectable input/output "slots" that are part of this node. 
     * These are rendered in the Diazo editor as labelled circular 
     * connection handles which can be connected to one or more other slots on 
     * other nodes.
     */
    slots? : DiazoSlot[];

    // Flywheel

    /**
     * When true, this type of node is considered to be "alpha" by the 
     * {@link DiazoEditorComponent | Diazo editor}. The New Node menu 
     * will show the Alpha designation to the user.
     */
    alpha? : boolean;

    /**
     * When true, this type of node is considered to be "beta" by the 
     * {@link DiazoEditorComponent | Diazo editor}. The New Node menu will show the Beta designation to
     * the user.
     */
    beta? : boolean;

    /**
     * Specifies the set of user-editable properties that exist for this node.
     * The {@link DiazoEditorComponent | Diazo editor} will show these 
     * in the Properties sidebar.
     */
    properties? : DiazoPropertySet[];

    /**
     * Specifies a set of defaults for the other properties of this node. 
     * Each key of this map is an object path. When the value within the node 
     * of the given path evaluates to the string `"∅"`, the default value will be 
     * used instead. 
     * 
     * String values here are special. You can use a handlebar-like template syntax
     * to dynamically generate the value that should be used based on the values 
     * of other properties within the node. 
     * 
     * For example, you could specify a node like so:
     * ```typescript
     * let node : DiazoNode = {
     *   label: 'JSON Value',
     *   data: { 
     *     type: 'input',
     *     value: '∅'
     *   },
     *   defaults: {
     *     label: `{{data.value|JSON Value}}`
     *   },
     *   properties: [
     *     {
     *       id: 'json-value',
     *       label: 'JSON Value',
     *       properties: [
     *         {
     *           label: "Value",
     *           type: "json",
     *           path: "data.value"
     *         }
     *       ]
     *     }
     *   ]
     * };
     * ```
     * 
     * Here the label shown within the editor will be "JSON Value" when `data.value`
     * is falsey. Otherwise the label shown will be the value found in `data.value` 
     * within the node.
     */
    defaults? : Record<string, any>;

    /**
     * Here you can specify one or more rules to dynamically control the 
     * `slots` defined on this node. You can use a value from a property elsewhere
     * in the node to define how many copies of a templated node should be 
     * on the node. As that value changes, the `slots` are dynamically rewritten
     * to match.
     */
    rules? : DiazoNodeRules;
}

/**
 * @category Model
 */
export interface DiazoNodeSet {
    id? : string;
    tags? : string[];
    label : string;
    nodes : DiazoNode[];
}

/**
 * @category Model
 */
export interface DiazoPropertySet {
    id : string;
    label : string;
    description? : string;
    properties : DiazoProperty[];
}

/**
 * @category Model
 */
export interface DiazoNodeRules {
    slots? : DiazoSlotRule;
    inputs? : DiazoSlotRule;
    outputs? : DiazoSlotRule;
}

/**
 * @category Model
 */
export interface DiazoSlotRule {
    placement? : 'append' | 'prepend';
    count : string;
    template : DiazoSlot;
}

/**
 * @category Model
 */
export interface DiazoProperty {
    label? : string;
    path? : string;
    description? : string;
    readonly? : boolean;
    slottable? : boolean;
    slotValue? : DiazoValue;
    allowAnnotation? : boolean;
    
    type : 'number' | 'text' | 'bitmask' | 'json'
            | 'textarea' | 'select' | 'flags' | 'position' 
            | 'boolean' | 'matrix' | 'inline-matrix' | string;
    typeOptions? : any;
    inlineMatrix? : DiazoPropertyInlineMatrix;
    matrix? : DiazoPropertyMatrix;
    bitmask? : DiazoPropertyBitmask;
    options? : DiazoPropertyOption[];
    optionSource? : string;
}

/**
 * @category Model
 */
export interface DiazoPropertyOption {
    value : string;
    label : string;
}

/**
 * @category Model
 */
export interface DiazoPropertyOptionGroup {
    label : string;
    options : DiazoPropertyOption[];
}

/**
 * @category Model
 */
export interface DiazoPropertyInlineMatrix {
    width : number;
    height : number;
}

/**
 * @category Model
 */
export interface DiazoPropertyBitmask {
    labels? : string[];
}

/**
 * @category Model
 */
export interface DiazoPropertyMatrix {
    width : number;
    height : number;
    cells : DiazoPropertyCell[];
}

/**
 * @category Model
 */
export interface DiazoPropertyCell {
    path : string;
    label? : string;
    description? : string;
}

/**
 * Represents a registered custom property type view. This is used 
 * to convey the list of custom property type views from the consumer of the 
 * library to the {@link DiazoEditorComponent | Diazo editor}.
 * 
 * @category Model
 */
export interface DiazoCustomPropertyType {
    namespace : string;
    id : string;
    component : any;
}