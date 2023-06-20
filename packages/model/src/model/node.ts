import { DiazoNodeRules } from "./node-rules";
import { DiazoPropertySet } from "./property-set";
import { DiazoSlot } from "./slot";

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
    data? : Record<string, any>;

    /**
     * Optional place to put behaviorial information about this node.
     * May be elided in the frontend.
     */
    behavior?: Record<string, any>;

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
