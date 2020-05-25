import { Injectable, InjectionToken } from '@angular/core';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { SubSink } from 'subsink';
import * as uuid from 'uuid';
import { Accessor } from './accessor';

/**
 * Represents a position within a view.
 */
export interface Position {
    top : number;
    left : number;
}

/**
 * @hidden
 */
export interface Constructor<T> {
    new() : T;
}

/**
 * Used to represent a text notification that should be shown in the UI.
 * This is used by the {@link FiregraphContext | context} layer to signal the
 * {@link FiregraphEditorComponent | Firegraph editor} to show a message 
 * via the snack bar (floating notifications shown along the bottom of 
 * the viewport). 
 */
export interface FiregraphEditorNotification {
    message : string;
}

/**
 * Represents a single slot on a single node within a Firegraph. 
 * This handles ephemeral state and accessing logic around the representation
 * of a slot within the Firegraph user interface.
 */
export class FiregraphSlotContext {
    id : string;
    type : string;
    node : FiregraphNodeContext;
    value : FiregraphValue;
    valueType : FiregraphValueType;
    getClientPosition? : () => Position;
    validateEdge? : (edge : FiregraphEdge) => boolean;

    get incomingEdges() {
        return this.node.graph.edges.filter(x => x.toNodeId === this.node.id && x.toSlotId === this.id);
    }

    get outgoingEdges() {
        return this.node.graph.edges.filter(x => x.fromNodeId === this.node.id && x.fromSlotId === this.id);
    }

    get edges() {
        return this.node.graph.edges.filter(
            x => (x.fromNodeId === this.node.id && x.fromSlotId === this.id)
                || (x.toNodeId === this.node.id && x.toSlotId === this.id)
        );
    }

    get graph() {
        return this.node.graph;
    }

    getOtherSlotOfEdge(edge : FiregraphEdge) {
        if (edge.fromNodeId === this.node.id && edge.fromSlotId === this.id) {
            return this.graph.getSlotByIds(edge.toNodeId, edge.toSlotId);
        } else {
            return this.graph.getSlotByIds(edge.fromNodeId, edge.fromSlotId);
        }
    }
}

/**
 * Represents the extends of a rectangle within the {@link FiregraphContext | context} layer 
 * layer.
 */
export interface Size {
    width : number;
    height : number;
}

/**
 * Represents a saved Undo/Redo state within the {@link FiregraphContext | context} layer.
 */
export interface FiregraphUndoState {
    graphBefore : Firegraph;
    graphAfter : Firegraph;
    cause : string;
}

export class FiregraphPropertyContext {
    constructor() {
        this._accessor = new Accessor();
        this._manipulator = new Proxy({}, {
            set: (target, key, value) => {

                this.graphContext.commit('Edit properties', (graph, revert) => {
                    let nodes = this.selectedNodes
                        .map(x => graph.nodes.find(y => y.id === x.id))
                    ;

                    let changed = this.accessor.set(
                        nodes, 
                        <string>key, 
                        value
                    );

                    if (!changed) {
                        revert(true);
                        return;
                    }

                    for (let node of nodes)
                        this.graphContext.onNodeUpdated(node);

                    console.dir(
                        this.selectedNodes
                            .map(x => graph.nodes.find(y => y.id === x.id))
                    );
                });

                return true;
            },

            get: (target, key) => {
                return this.accessor.get(this.selectedNodes, key.toString());
            }
        });
    }

    graphContext : FiregraphContext;
    selectedNodes : FiregraphNode[];
    property : FiregraphProperty;

    private _accessor : Accessor;
    private _manipulator : any;

    get accessor() {
        return this._accessor;
    }

    get manipulator() {
        return this._manipulator;
    }
}

/**
 * Represents a registered custom property type view. This is used 
 * to convey the list of custom property type views from the consumer of the 
 * library to the {@link FiregraphEditorComponent | Firegraph editor}.
 */
export interface FiregraphCustomPropertyType {
    namespace : string;
    id : string;
    component : any;
}

/**
 * Represents the context for a specific node within a Firegraph.
 * This provides ephemeral state, convenient access, and interaction logic
 * around the user interface representation of a Firegraph node.
 */
@Injectable()
export class FiregraphNodeContext {
    constructor() {

    }

    ownState : FiregraphNode;
    id : string;
    slots : FiregraphSlotContext[] = [];
    graph : FiregraphContext;

    get readonly() {
        return this.locked || !!this.state.readonly || this.graph.readonly;
    }

    get locked() {
        return !!this.state.locked || this.graph.locked;
    }

    get state() {
        if (this.ownState)
            return this.ownState;

        if (!this.graph || !this.graph.graph || !this.graph.graph.nodes)
            return undefined;
        
        return this.graph.graph.nodes.find(x => x.id === this.id);
    }

    get edges() {
        return this.graph.graph.edges.filter(x => this.involvedInEdge(x))
    }

    get incomingEdges() {
        return this.edges.filter(x => x.toNodeId === this.id);
    }

    get outgoingEdges() {
        return this.edges.filter(x => x.fromNodeId === this.id);
    }
    
    involvedInEdge(edge : FiregraphEdge) {
        return (edge.toNodeId === this.id || edge.fromNodeId === this.id);
    }

    get x() : number {
        return this.state.x;
    }

    set x(value) {
        this.state.x = value;
    }

    get y() : number {
        return this.state.y;
    }

    set y(value) {
        this.state.y = value;
    }

    get selected() {
        return this.graph.isNodeSelected(this);
    }

    onDestroyed() {
        this.subscriptions.unsubscribe();
    }

    subscriptions = new SubSink();

    onCreated() {
        this.subscriptions.add(
            this.graph.graphChanged.subscribe(() => {
                setTimeout(() => {
                    if (!this.state)
                        return;
                    //console.log(`UPDATING POSITION ${this.x}, ${this.y}`);
                    this.updatePosition();
                })
            })
        );
    }

    private _positionChanged = new BehaviorSubject<Position>({ top: 0, left: 0 });

    get positionChanged() : Observable<Position> {
        return this._positionChanged;
    }

    modify(cause : string, callback : (node : FiregraphNode) => void) {
        this.graph.commit(cause, graph => {
            callback(graph.nodes.find(x => x.id === this.id));
        });
    }

    getSize?: () => Size;

    alignToGrid() {
        this.x = Math.round(this.x / this.graph.gridSizeX) * this.graph.gridSizeX;
        this.y = Math.round(this.y / this.graph.gridSizeY) * this.graph.gridSizeY;
        this._positionChanged.next({ top: this.x, left: this.y });
    }

    setPosition(x : number, y : number) {
        this.x = x;
        this.y = y;

        this.updatePosition();
    }

    get effectivePositionX() {
        return this.x + this.positionDeltaX;
    }

    get effectivePositionY() {
        return this.y + this.positionDeltaY;
    }
    
    get positionDeltaX() {
        return this.state.positionDeltaX || 0;
    }

    get positionDeltaY() {
        return this.state.positionDeltaY || 0;
    }

    private updatePosition() {
        if (!this.state)
            return;

        this._positionChanged.next({ top: this.x, left: this.y });
    }

    changeDeltaPosition(x : number, y : number) {
        // this.state.positionDeltaX = x;
        // this.state.positionDeltaY = y;

        let gridX = Math.round((this.state.x + x) / this.graph.gridSizeX) * this.graph.gridSizeX;
        let gridY = Math.round((this.state.y + y) / this.graph.gridSizeY) * this.graph.gridSizeY;

        this.state.positionDeltaX = gridX - this.state.x;
        this.state.positionDeltaY = gridY - this.state.y;

        this.updatePosition();
    }

    commitDeltaPosition() {

        this.modify('Moved node', node => {
            node.x += (this.state.positionDeltaX || 0);
            node.y += (this.state.positionDeltaY || 0);
            node.positionDeltaX = 0;
            node.positionDeltaY = 0;
        });
    }

    setPositionOnGrid(x : number, y : number) {
        this.x = x;
        this.y = y;
        this.alignToGrid();
    }

    getSlotById(id : string) {
        return this.slots.find(x => x.id === id);
    }

    registerSlot(slotContext : FiregraphSlotContext) {
        this.slots.push(slotContext);
    }

    deregisterSlot(slotContext : FiregraphSlotContext) {
        let index = this.slots.findIndex(x => x === slotContext);
        if (index >= 0)
            this.slots.splice(index, 1);
    }

    startEdge(slot : FiregraphSlotContext, event : MouseEvent) {
        if (this.graph.readonly)
            return;

        this.graph.startEdge(this, slot, event);
    }
}

/**
 * Defines the structure of an edge within the {@linkcode Firegraph.edges | edges} property of a {@linkcode Firegraph}
 * object.
 */
export interface FiregraphEdge {
    fromNodeId : string;
    fromSlotId : string;
    toNodeId : string;
    toSlotId : string;
    active? : boolean;
    valid? : boolean;
}

export interface FiregraphPropertyOption {
    value : string;
    label : string;
}

export interface FiregraphPropertyOptionGroup {
    label : string;
    options : FiregraphPropertyOption[];
}

export interface FiregraphProperty {
    label? : string;
    path? : string;
    description? : string;
    readonly? : boolean;
    slottable? : boolean;
    slotValue? : FiregraphValue;
    allowAnnotation? : boolean;
    
    type : 'number' | 'text' | 'bitmask' | 'json'
            | 'textarea' | 'select' | 'flags' | 'position' 
            | 'boolean' | 'matrix' | 'inline-matrix' | string;
    typeOptions? : any;
    inlineMatrix? : FiregraphPropertyInlineMatrix;
    matrix? : FiregraphPropertyMatrix;
    bitmask? : FiregraphPropertyBitmask;
    options? : FiregraphPropertyOption[];
    optionSource? : string;
}

export interface FiregraphPropertyInlineMatrix {
    width : number;
    height : number;
}

export interface FiregraphPropertyBitmask {
    labels? : string[];
}

export interface FiregraphPropertyMatrix {
    width : number;
    height : number;
    cells : FiregraphPropertyCell[];
}

export interface FiregraphPropertyCell {
    path : string;
    label? : string;
    description? : string;
}

export interface FiregraphNodeSet {
    id? : string;
    tags? : string[];
    label : string;
    nodes : FiregraphNode[];
}

export interface FiregraphPropertySet {
    id : string;
    label : string;
    description? : string;
    properties : FiregraphProperty[];
}

export interface FiregraphNode {
    id? : string;

    /**
     * Specifies the category of node this is.
     * Examples of classifications could include "input", "output", "filter"
     * but the meaning of this field is not defined within the Firegraph editor
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
     * This is used by the Firegraph editor to keep track of where the node is 
     * being moved to. It should be ignored or set to zero otherwise.
     * @todo move to context layer
     */
    positionDeltaX? : number;

    /**
     * This is used by the Firegraph editor to keep track of where the node is 
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
     * - `unit` typically specifies the subtype of the node (where {@link `FiregraphNode.type`
     *   indicates the primary categorization) 
     */
    data? : any;

    /**
     * The set of connectable input/output "slots" that are part of this node. 
     * These are rendered in the Firegraph editor as labelled circular 
     * connection handles which can be connected to one or more other slots on 
     * other nodes.
     */
    slots? : FiregraphSlot[];

    // Flywheel

    /**
     * When true, this type of node is considered to be "alpha" by the 
     * {@link FiregraphEditorComponent | Firegraph editor}. The New Node menu 
     * will show the Alpha designation to the user.
     */
    alpha? : boolean;

    /**
     * When true, this type of node is considered to be "beta" by the 
     * {@link FiregraphEditorComponent | Firegraph editor}. The New Node menu will show the Beta designation to
     * the user.
     */
    beta? : boolean;

    /**
     * Specifies the set of user-editable properties that exist for this node.
     * The {@link FiregraphEditorComponent | Firegraph editor} will show these 
     * in the Properties sidebar.
     */
    properties? : FiregraphPropertySet[];

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
     * let node : FiregraphNode = {
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
    rules? : FiregraphNodeRules;
}

export interface FiregraphNodeRules {
    slots? : FiregraphSlotRule;
    inputs? : FiregraphSlotRule;
    outputs? : FiregraphSlotRule;
}

export interface FiregraphSlotRule {
    placement? : 'append' | 'prepend';
    count : string;
    template : FiregraphSlot;
}

/**
 * Value types define the appearance and behavior of node slots within a graph.
 * Types are cooperatively convertible. This means that when a user is creating
 * an edge between two slots with different value types:
 * - If either the source or destination value type allows an 
 *   implicit conversion
 *   * Then, the conversion is allowed and the connection
 *     is created.
 * 
 * All edges are validated using this simple type system. From this simple 
 * interface we can construct a large number of possible schemes for validating
 * a connection between two slots in the graph.
 * 
 * For instance, {@linkcode FiregraphTypeBase} provides an easy way to implement
 * this interface, providing validation based on the inheritance heirarchy of 
 * the classes involved. For most applications of value types this is the 
 * obvious solution, and the low-level `isCompatible()` API is provided as an 
 * escape hatch to implement a wide variety of possible connection validation
 * strategies. We use this within the Firegraph editor to implement 
 * {@linkcode WildcardType} for example.
 * 
 */
export interface FiregraphValueType {

    /**
     * This function should analyze a pair of slots, represented 
     * as editor context objects, and determine if a connection is 
     * allowed between them. The graph state at this point does not 
     * reflect the new connection between the two, only edges existing
     * before the new edge was added will be present. 
     * 
     * It is guaranteed that at least one of the `output` and/or `input` 
     * slots have specified a value of this type. This method is only 
     * called for interactions which involve this value type.
     * 
     * Implementations could:
     * - Consider what existing edges already exist between the slots
     * - Consider the `value` of the input and the output slots
     * - Consider the state of the graph as a whole 
     * - Consider the state of the containing application
     * - Anything else inferrable given the context of your domain
     * 
     * @param output 
     * @param input 
     */
    isCompatible(
        output : FiregraphSlotContext,
        input : FiregraphSlotContext
    ) : boolean;

    /**
     * Specifies the registered ID for this value type.
     * This must be distinct across the editor where this 
     * value type is loaded. A slot will reference this ID
     * in its `value` definition:
     * 
     * ```typescript
     * let slot : FiregraphSlot = {
     *   // ...
     *   value: { type: 'IDHERE' }
     * }
     * ```
     */
    id : string;

    /**
     * The HTML/CSS color which should be used to render edges 
     * which have a value of this type.
     */
    color : string;

    /**
     * The name of this value, this will be used in tooltips and 
     * other hints in the UI.
     */
    name : string;

    /**
     * A short description for this value type
     */
    description : string;

    /**
     * The shape that should be used for the slot handle on the node within
     * the editor.
     */
    slotShape? : "circle" | "square" | "arrow";

    /**
     * The line width for edges that have a value of this type
     */
    lineWidth? : number;

    /**
     * When true, the editor will consider edges where the source slot is 
     * already connected to be valid. Otherwise such edges will be considered
     * invalid.
     */
    splittable? : boolean;

    /**
     * When true, the editor will consider edges where the destination slot is
     * already connected to be valid. Otherwise such edges will be considered
     * invalid.
     */
    mergeable? : boolean;

    /**
     * When defined, the editor will call this function to determine what name
     * to show within the editor, passing in the slot related to the request.
     * This can be used to customize the name shown for this value type based
     * on the context of where it appears.
     */
    getNameByContext?(slot : FiregraphSlotContext) : string;

    /**
     * When defined, the editor will call this function to determine what color
     * to use for edges of this value type within the editor, passing in the slot
     * related to the request. This can be used to customize the color used for 
     * this value type based on the context of where it appears.
     */
    getColorByContext?(slot : FiregraphSlotContext) : string;

    /**
     * When defined, the editor will call this function to determine what shape
     * to use for the editor handles of slots which have values of this type.
     * @param slot 
     */
    getSlotShapeByContext?(slot : FiregraphSlotContext) : "circle" | "square" | "arrow";
}

/**
 * Provides an abstract base class for new Firegraph value types that provides
 * heirarchical compatibility by default.
 * 
 * Custom value types which inherit from `FiregraphTypeBase` will automatically
 * grant implicit conversions which broaden the "value" of the edge and deny
 * conversions which narrow the "value of the edge.
 * 
 * Given:
 * 
 * ```typescript
 * export class TypeA extends FiregraphTypeBase {}
 * export class TypeB extends TypeA {}
 * ```
 * 
 * - A connection from an output slot of `TypeB` **can be assigned** to an input slot of 
 * `TypeA`
 * - A connection from an output slot of `TypeA` **cannot be assigned** to an input slot of `TypeB`
 * 
 * This may or may not be the behavior you want from your custom value types.
 * You can override the {@linkcode isCompatible} method to change this behavior,
 * or implement {@linkcode FiregraphValueType} directly instead. 
 */
export class FiregraphTypeBase implements Partial<FiregraphValueType> {
    isCompatible(
        output : FiregraphSlotContext,
        input : FiregraphSlotContext
    ) {
        return (output.valueType === input.valueType
                || output.valueType instanceof input.valueType.constructor ) 
            && this.isExpressionCompatible(output, input)
        ;
    }

    public static value<T extends typeof FiregraphTypeBase>(this : T, params? : any): FiregraphValue {
        let x : FiregraphValueType = new (<any>this)();
        return { type: x.id, params };
    }

    isExpressionCompatible(
        output : FiregraphSlotContext,
        input : FiregraphSlotContext
    ) {
        return true;
    }
}

/**
 * Provides a special value type that works by inference. You create 
 * named wildcard values within your slots using {@link WildcardType.named()}
 * and the Firegraph editor will automatically infer what value the slot really
 * is by analyzing other existing edges in the graph. You can use this if the 
 * node can take any value in, but the output should follow what the input edge 
 * is. Note that this works in any direction. If you attach an edge to the 
 * wildcard output on your node, the corresponding input(s) will immediately 
 * reflect that inference.
 * 
 * So for example:
 * ```typescript
 * <FiregraphNode>{
 *      label: 'My Node',
 *      slots: [
 *          {
 *              id: 'input1',
 *              type: 'input',
 *              value: WildcardType.named('T')
 *          },
 *          {
 *              id: 'output1',
 *              type: 'output',
 *              value: WildcardType.named('T')
 *          },
 *      ]
 * }
 * ```
 * 
 * If you connect an edge to either the `input1` or `output1` slots, the other
 * slot will immediately reflect the value type of that edge.
 * 
 */
export class WildcardType extends FiregraphTypeBase implements FiregraphValueType {
    id = 'wildcard';
    color = 'pink';
    description = 'Works for any value';
    name = 'Wildcard';
    splittable = true;

    isCompatible(
        output : FiregraphSlotContext,
        input : FiregraphSlotContext
    ) {
        return this.isExpressionCompatible(output, input);
    }

    getColorByContext(slot : FiregraphSlotContext) {
        let value = this.resolveSlotType(slot);

        if (value) {
            let type = slot.graph.getValueTypeById(value.type);
            if (type) {
                if (type.getColorByContext)
                    return type.getColorByContext(slot);
                if (type.color)
                    return type.color;
            }
        }

        return `white`;
    }

    getNameByContext(slot : FiregraphSlotContext) {

        let value = this.resolveSlotType(slot);

        if (value) {
            return `Wildcard (Bound: ${value.type})`;
        }

        return `Wildcard (Unbound)`;
    }

    resolveSlotType(slot : FiregraphSlotContext, visitedSlots : FiregraphSlotContext[] = []): FiregraphValue {

        if (!slot.value)
            return null;

        if (slot.value.type === 'wildcard') {
            let wildcardType = slot.value.params.templateName;

            // Find incoming edges on this slot and see if any of them can be resolved

            for (let edge of slot.edges) {
                let otherSlot = slot.getOtherSlotOfEdge(edge);
                if (visitedSlots.includes(otherSlot))
                    continue;

                let otherValue = this.resolveSlotType(otherSlot, visitedSlots.concat([ slot ]));

                if (otherValue)
                    return otherValue;
            }

            // If we couldn't resolve this type via incoming edges to _this_ slot, attempt 
            // to resolve the type by looking at other slots on this node with the same wildcard
            // templateName

            let unvisitedSlots = slot.node.slots
                .filter(x => !visitedSlots.includes(x) && x.value.type === 'wildcard' && x.value.params.templateName === wildcardType)
            ;

            for (let otherSlot of unvisitedSlots) {
                let otherValue = this.resolveSlotType(otherSlot, visitedSlots.concat([ slot ]));
                if (otherValue)
                    return otherValue;
            }

            // wildcard unbound

            return null;
        }

        return slot.value;
    }

    isExpressionCompatible(
        output : FiregraphSlotContext,
        input : FiregraphSlotContext
    ) {
        let outputValue = this.resolveSlotType(output);
        let inputValue = this.resolveSlotType(input);

        if (output.value && output.value.type === 'wildcard' && !outputValue) {
            return true;
        }

        if (input.value && input.value.type === 'wildcard' && !inputValue) {
            return true;
        }

        // console.log(`Checking compat:`);
        // console.dir(outputValue);
        // console.dir(inputValue);

        return output.graph.valuesCompatible(outputValue, inputValue);
    }

    public static named(templateName : string): FiregraphValue {
        return WildcardType.value({ templateName });
    }
}

export interface FiregraphValue {
    type : string;
    params : Record<string,any>;
}

export interface FiregraphSlot {
    id : string;
    label : string;
    type : 'input' | 'output' | 'passthrough';
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
     * Each `value` consists of a {@link FiregraphValueType | value type} 
     * and a set of _parameters_.
     * Most simple value types do not depend on the parameters included within
     * the actual `value` declared on a `slot`, but some do. The parameters 
     * of a value may impact whether the editor allows a connection from one
     * slot to another.
     * 
     * Value types are referenced via a registered ID. See 
     * {@link FiregraphEditorComponent.valueTypes}
     * for information about providing these to the editor.
     * 
     * For more about value types, see {@link FiregraphValueType}
     * 
     */
    value? : FiregraphValue;
    dynamic? : boolean;
}

/**
 * Represents the structure of a graph built within Firegraph.
 * Consists of a set of {@linkcode nodes} with distinct IDs, where each node
 * defines a set of {@linkcode FiregraphNode.slots | slots}, and a set of {@linkcode edges}.
 */
export interface Firegraph {
    /**
     * Represents the set of nodes present in this Firegraph.
     */
    nodes : FiregraphNode[];

    /**
     * Represents the edges of a Firegraph, that is, those that connect 
     * the {@linkcode FiregraphNode.slots} of {@linkcode nodes} together.
     */
    edges : FiregraphEdge[];
}

@Injectable()
export class FiregraphContext {
    constructor() {
        this.registerValueType(WildcardType);
    }

    get graph() : Firegraph {
        return this._graph;
    }

    set graph(value) {
        this._graph = value;
        setTimeout(() => this.graphChanged.next(this._graph));
    }

    undoStates : FiregraphUndoState[] = [];
    redoStates : FiregraphUndoState[] = [];
    committing = false;
    readonly = false;
    locked = false;

    getEntryNodes() {
        let nodes : FiregraphNodeContext[] = [];

        for (let node of this.nodes) {
            if (node.incomingEdges.length === 0) {
                nodes.push(node);
            }
        }

        return nodes;
    }

    onNodeAdded(node : FiregraphNode) {    
        this.applyNodeRules(node);
    }

    onNodeUpdated(node : FiregraphNode) {
        this.applyNodeRules(node);
    }
    
    applyNodeRules(node : FiregraphNode) {
        let accessor = new Accessor();

        if (!node.rules)
            return;

        if (node.rules.inputs) {

            let rawCount = accessor.get([node], node.rules.inputs.count);
            let max : number = parseInt(rawCount);

            if (isNaN(max)) {
                console.error(`Cannot apply inputs rule: Expression '${node.rules.inputs.count}' is not a number, value was ${rawCount}`);

            } else {
                let inputs = node.slots.filter(x => x.type === 'input' && !x.dynamic);
                
                for (let i = 0; i < max; ++i) {
                    let input = this.clone(node.rules.inputs.template);
                    let state = {
                        I: i, 
                        N: i + 1
                    };

                    input.dynamic = true;
                    input.id = accessor.substitute(input.id, state);
                    input.label = accessor.substitute(input.label, state);

                    inputs.push(input);
                }


                node.slots = node.slots.filter(x => !x.dynamic || x.type !== 'input');
                node.slots = inputs.concat(node.slots);
            }
        }

        if (node.rules.outputs) {
            // TODO

            let rawCount = accessor.get([node], node.rules.outputs.count);
            let max : number = parseInt(rawCount);

            if (isNaN(max)) {
                console.error(`Cannot apply outputs rule: Expression '${node.rules.outputs.count}' is not a number, value was ${rawCount}`);

            } else {
                let outputs : FiregraphSlot[] = [];

                for (let i = 0; i < max; ++i) {
                    let input = this.clone(node.rules.outputs.template);
                    let state = {
                        I: i, 
                        N: i + 1
                    };

                    input.dynamic = true;
                    input.id = accessor.substitute(input.id, state);
                    input.label = accessor.substitute(input.label, state);

                    outputs.push(input);
                }


                node.slots = node.slots.filter(x => !x.dynamic || x.type !== 'output');
                node.slots = node.slots.concat(outputs);
            }
        }
    }
    
    addNodeToSubgraph(subgraph : Firegraph, node : FiregraphNode) {
        if (subgraph.nodes.some(x => x.id === node.id))
            return;

        subgraph.nodes.push(this.clone(node));
    }

    addEdgeToSubgraph(subgraph : Firegraph, edge : FiregraphEdge) {
        if (subgraph.edges.some(x => this.edgesAreEqual(x, edge)))
            return;

        subgraph.edges.push(this.clone(edge));
    }

    collectSubgraph(entryNode : FiregraphNodeContext, subgraph : Firegraph) {
        if (subgraph.nodes.some(x => x.id === entryNode.id))
            return;

        this.addNodeToSubgraph(subgraph, entryNode.state);
        for (let edge of entryNode.outgoingEdges) {
            this.addEdgeToSubgraph(subgraph, edge);
            let endNode = this.getNodeById(edge.toNodeId);
            this.collectSubgraph(endNode, subgraph);
        }
    }

    commit(cause : string, callback : (graph : Firegraph, revert : (silently? : boolean) => void) => void) {
        if (this.committing)
            throw new Error(`Cannot commit a graph state: Already committing a graph state`);
        
        this.committing = true;

        let graphBefore = this.clone(this.graph);

        // Clear all delta positions on nodes in graphBefore
        for (let node of graphBefore.nodes) {
            node.positionDeltaX = 0;
            node.positionDeltaY = 0;
        }

        let graphAfter = this.clone(this.graph);
        try {
            callback(graphAfter, (silently? : boolean) => { throw new Error(silently? `revert:silently` : `revert`); });
        } catch (e) {
            if (e.message === 'revert') {
                console.warn(`REVERT: No changes during: ${cause}`);
            } else if (e.message !== 'revert:silently') {
                console.error(`REVERT: Caught exception while committing to graph:`);
                console.error(e);
            }

            this.committing = false;
            return;
        }

        console.warn(`COMMIT: Committing: ${cause}`);
        this.committing = false;

        this.undoStates.push({
            cause,
            graphBefore,
            graphAfter
        });

        this.redoStates = [];
        this.graph = this.clone(graphAfter);
    }

    clone(object) {
        // Just return by-value primitives
        
        if (['undefined', 'string', 'boolean', 'number'].includes(typeof object))
            return object;

        // Functions cannot be cloned

        if (typeof object === 'function') {
            throw new Error(`Cannot clone function ${object.name}`);
        }
        
        let str : string;
        
        try {
            str = JSON.stringify(object);
        } catch (e) {
            console.error(`Failed to convert object to JSON during cloning:`);
            console.error(e);
            console.error(`Object was:`);
            console.dir(object);
            throw e;
        }

        try {
            return JSON.parse(str);
        } catch (e) {
            let formatted = JSON.stringify(object, undefined, 2);

            console.error(`Failed to parse JSON during cloning:`);
            console.error(e);
            console.error(`String [formatted] was:`);
            console.dir(formatted);
        }
    }

    undo() {
        let state = this.undoStates.pop();

        if (!state) {
            //console.warn(`UNDO: Nothing to undo.`);
            return;
        }

        this.graph = this.clone(state.graphBefore);
        this.redoStates.push(state);
        // TODO: show a cookie message at bottom saying "Undo: <cause>"

        this.notificationMessage.next({
            message: `Undo: ${state.cause}`
        });
        
        console.warn(`Undo: ${state.cause}`);
    }

    redo() {
        let state = this.redoStates.pop();

        if (!state) {
            //console.warn(`REDO: Nothing to redo.`);
            return;
        }
        
        this.graph = this.clone(state.graphAfter);
        this.undoStates.push(state);
        // TODO: show a cookie message at bottom saying: "Redo: <cause>"
        
        this.notificationMessage.next({
            message: `Redo: ${state.cause}`
        });

        console.warn(`REDO: ${state.cause}`);
    }


    nodeTypeMap : Record<string,any> = {};

    private _valueTypesChanged = new Subject<void>();

    public get valueTypesChanged() : Observable<void> {
        return this._valueTypesChanged;
    }

    private valueTypes = new Map<string,FiregraphValueType>();

    registerValueType<T extends { new() : FiregraphValueType }>(type : T) {
        let typeInstance : FiregraphValueType = new type();
        this.valueTypes.set(typeInstance.id, typeInstance);
        this._valueTypesChanged.next();
    }

    allValueTypes() {
        return Array.from(this.valueTypes.values());
    }

    getValueTypeById(id : string) {
        return this.valueTypes.get(id);
    }

    notificationMessage = new Subject<FiregraphEditorNotification>();

    valuesCompatible(a : FiregraphValue, b : FiregraphValue) {
        if (a === b) {
            console.log(`Virtual slot compat check: PASS [trivial]`);
            return true;
        }

        if (!a && !b)
            return true;
        
        let aType = this.getValueTypeById(a.type);
        let bType = this.getValueTypeById(b.type);

        let virtualNode = new FiregraphNodeContext();
        virtualNode.graph = this;

        let virtualSlotA = new FiregraphSlotContext();
        let virtualSlotB = new FiregraphSlotContext();

        virtualSlotA.node = virtualNode;
        virtualSlotB.node = virtualNode;

        virtualSlotA.value = a;
        virtualSlotA.valueType = aType;
        virtualSlotB.value = b;
        virtualSlotB.valueType = bType;


        if (aType.isCompatible(virtualSlotA, virtualSlotB) || bType.isCompatible(virtualSlotA, virtualSlotB)) {
            console.log(`Virtual slot compat check: GOOD`);
            console.dir(aType);
            console.dir(bType);

            return true;
        }

        console.log(`Virtual slot compat check: FAIL`);

        return false;
    }

    private _graph : Firegraph = { nodes: [], edges: [] };
    graphChanged = new BehaviorSubject<Firegraph>(null);

    nodes : FiregraphNodeContext[] = [];
    edgeUnderCursor : FiregraphEdge;
    minZoom = 0.3;
    maxZoom = 2;
    gridSizeX = 15;
    gridSizeY = 15;
    panX = 0;
    panY = 0;
    mouseInside = false;

    draftNode : FiregraphNode;

    draftEdge : FiregraphEdge;
    startDraftEdge : FiregraphEdge;
    draftEdgeSourceEvent : MouseEvent;
    zoom = 1;

    private _panChanged = new BehaviorSubject<Position>({ top: 0, left: 0 });
    private _zoomChanged = new BehaviorSubject<number>(1);

    removeEdgesForNode(node : FiregraphNodeContext) {
        for (let edge of this.edges.slice()) {
            if (edge.fromNodeId === node.id || edge.toNodeId === node.id) {
                this.removeEdge(edge);
            }
        }
    }

    private removeNodeFromGraph(graph : Firegraph, node : FiregraphNodeContext) {
        let affectedEdges = graph.edges
            .filter(x => [x.fromNodeId, x.toNodeId].includes(node.id))
            .slice()
        ;

        for (let edge of affectedEdges) {
            if (edge.fromNodeId === node.id || edge.toNodeId === node.id) {
                this.removeEdgeFromGraph(graph, edge);
            }
        }

        let index = graph.nodes.findIndex(x => x.id === node.id);

        if (index < 0) {
            console.warn(`Cannot remove node context that is not registered`);
            return;
        }

        graph.nodes.splice(index, 1);
    }

    removeNode(node : FiregraphNodeContext) {
        this.unselectNode(node);
        this.commit('Remove node', graph => {
            this.removeNodeFromGraph(graph, node);
        });
    }

    edgesAreEqual(a : FiregraphEdge, b : FiregraphEdge) {
        if (a === b)
            return true;

        if (!a || !b)
            return false;

        return (
            a.fromNodeId === b.fromNodeId 
            && a.fromSlotId === b.fromSlotId 
            && a.toNodeId === b.toNodeId
            && a.toSlotId === b.toSlotId
        );
    }

    unselectNode(node : FiregraphNodeContext) {
        let index = this.selectedNodes.indexOf(node);
        if (index >= 0)
            this.selectedNodes.splice(index, 1);

        if (this.selectionBoxEnd)
            this.updateNodesInSelectionBox();

        this._selectionChanged.next(this.selectedNodes);
    }

    removeSelectedNodes() {
        if (this.readonly)
            return;
        
        this.commit('Delete nodes', graph => {
            for (let selectedNode of this.selectedNodes.slice()) {
                this.unselectNode(selectedNode);

                // remove edges 

                for (let edge of graph.edges.slice()) {
                    if (edge.fromNodeId === selectedNode.id || edge.toNodeId === selectedNode.id) {
                        let index = graph.edges.findIndex(x => this.edgesAreEqual(edge, x));
                        if (index >= 0)
                            graph.edges.splice(index, 1);
                    }
                }
                
                // remove the node

                let index = graph.nodes.findIndex(x => x.id === selectedNode.id);

                if (index < 0) {
                    console.warn(`Cannot remove node context that is not registered`);
                    return;
                }

                graph.nodes.splice(index, 1);
            }

        });
        
    }

    releaseDraftNode() {
        if (!this.draftNode)
            return;
        
        let candidate = this.draftNode;
        this.draftNode = null;

        let candidateEdge = this.draftEdge;
        this.draftEdge = null;

        if (document.visibilityState !== 'visible')
            return;

        if (!this.mouseInside)
            return;

        console.log(`Adding node ${JSON.stringify(candidate)}`);

        this.commit('Add node', graph => {
            graph.nodes.push(candidate);
            this.onNodeAdded(candidate);

            if (candidateEdge) {
                graph.edges.push(candidateEdge);
            }
        });
    }

    get zoomChanged(): Observable<number> {
        return this._zoomChanged;
    }

    get panChanged(): Observable<Position> {
        return this._panChanged;
    }

    setPan(x : number, y : number) {
        this.panX = x;
        this.panY = y;
        this._panChanged.next({ left: x, top: y });
    }

    get edges() : FiregraphEdge[] {
        if (!this.graph)
            return [];
        
        return this.graph.edges;
    }

    set edges(value) {
        this.graph.edges = value;
    }

    clampZoom(value) {    
        if (value < this.minZoom)
            value = this.minZoom;
        else if (value > this.maxZoom)
            value = this.maxZoom;

        return value;
    }

    setZoom(value) {
        value = this.clampZoom(value);
        
        this.zoom = value;
        this._zoomChanged.next(value);
    }

    selectedNodes : FiregraphNodeContext[];

    _selectionChanged = new BehaviorSubject<FiregraphNodeContext[]>([]);

    get selectionChanged() : Observable<FiregraphNodeContext[]> {
        return this._selectionChanged;
    }

    private notifySelectionChanged() {
        this._selectionChanged.next(this.selectedNodes);
    }

    selectAll() {
        this.selectedNodes = this.nodes.slice();
        this.notifySelectionChanged();
    }

    unselectAll() {
        this.selectedNodes = [];
        this.notifySelectionChanged();
    }

    isNodeSelected(node : FiregraphNodeContext) {

        let isSelected = false;

        if (this.selectedNodes && this.selectedNodes.includes(node))
            isSelected = true;

        if (this.selectionBoxStart) {
            if (this.nodesInSelectionBox && this.nodesInSelectionBox.includes(node)) {
                isSelected = !isSelected;
            }
        }

        return isSelected;
    }

    addToSelection(node : FiregraphNodeContext) {
        if (!this.selectedNodes)
            this.selectedNodes = [];
        this.selectedNodes.push(node);
        this.notifySelectionChanged();
    }

    removeFromSelection(node : FiregraphNodeContext) {
        if (!this.selectedNodes)
            return;

        let index = this.selectedNodes.findIndex(x => x === node);

        if (index >= 0) {
            this.selectedNodes.splice(index, 1);
            this.notifySelectionChanged();
        }
    }

    selectNode(node : FiregraphNodeContext) {
        this.selectedNodes = [ node ];
        this.notifySelectionChanged();
    }

    startSelectionAt(pos : Position, additive : boolean) {
        this.selectionBoxStart = { left: pos.left, top: pos.top };
        this.nodesInSelectionBox = [];

        if (!additive) {
            console.log(`not additive, clearing`);
            this.selectedNodes = [];
            this.notifySelectionChanged();
        }
    }

    commitSelectionBox() {
        let selected = this.selectedNodes || [];
        let originalCount = selected.length;
        let boxCount = this.nodesInSelectionBox.length;
        
        for (let node of this.nodesInSelectionBox) {
            let index = selected.indexOf(node);

            if (index >= 0)
                selected.splice(index, 1);
            else
                selected.push(node);
        }

        console.log(`Committed selection box: ${selected.length} now selected (originally=${originalCount})`);
        this.selectedNodes = selected;
        this.clearSelectionBox();

        if (boxCount === 0)
            this.selectedNodes = [];
        this.notifySelectionChanged();
    }

    clearSelectionBox() {
        this.selectionBoxStart = null;
        this.nodesInSelectionBox = [];
    }

    selectionBoxStart : Position;
    selectionBoxEnd : Position;

    screenToGraph(pos : Position) {
        if (!pos)
            return null;
        
        return { 
            left: (pos.left - this.panX) / this.zoom, 
            top: (pos.top - this.panY) / this.zoom
        };
    }

    setSelectionBoxEnd(pos : Position) {
        this.selectionBoxEnd = { left: pos.left, top: pos.top };
        this.updateNodesInSelectionBox();
    }

    nodesInSelectionBox : FiregraphNodeContext[];

    private pointInCornerBox(point : Position, corner1 : Position, corner2 : Position) {
        let startPosX = Math.min(corner1.left, corner2.left);
        let startPosY = Math.min(corner1.top, corner2.top);
        let endPosX = Math.max(corner1.left, corner2.left);
        let endPosY = Math.max(corner1.top, corner2.top);

        return (startPosX < point.left && point.left < endPosX 
            && startPosY < point.top && point.top < endPosY)
        ;
    }

    private getPointsOfCornerBox(a : Position, b : Position) {
        let startPosX = Math.min(a.left, b.left);
        let startPosY = Math.min(a.top, b.top);
        let endPosX = Math.max(a.left, b.left);
        let endPosY = Math.max(a.top, b.top);

        return [
            { left: startPosX, top: startPosY },
            { left: endPosX, top: startPosY },
            { left: endPosX, top: endPosY },
            { left: startPosX, top: endPosY }
        ]
    }

    private overlap1d(i1a, i1b, i2a, i2b) {
        let i1min = Math.min(i1a, i1b);
        let i1max = Math.max(i1a, i1b);
        let i2min = Math.min(i2a, i2b);
        let i2max = Math.max(i2a, i2b);
        return i1max >= i2min && i2max >= i1min;
    }

    private boxesOverlap(box1a : Position, box1b : Position, box2a : Position, box2b : Position) {
        return this.overlap1d(box1a.left, box1b.left, box2a.left, box2b.left)
            && this.overlap1d(box1a.top, box1b.top, box2a.top, box2b.top);
    }

    private updateNodesInSelectionBox() {

        if (!this.selectionBoxStart || !this.selectionBoxEnd)
            return;
        
        let startPos = this.screenToGraph(this.selectionBoxStart);
        let endPos = this.screenToGraph(this.selectionBoxEnd);

        let startPosX = Math.min(startPos.left, endPos.left);
        let startPosY = Math.min(startPos.top, endPos.top);
        let endPosX = Math.max(startPos.left, endPos.left);
        let endPosY = Math.max(startPos.top, endPos.top);
        let selected = [];

        for (let node of this.nodes) {
            let nodePos = { left: node.x, top: node.y };
            let nodeCorner = nodePos;

            if (node.getSize) {
                let size = node.getSize();
                nodeCorner = { left: node.x + size.width, top: node.y + size.height };
            }

            //if (startPosX < node.x && node.x < endPosX && startPosY < node.y && node.y < endPosY) {
            if (this.boxesOverlap(startPos, endPos, nodePos, nodeCorner)) {
                // selected
                selected.push(node);
            }
        }

        this.nodesInSelectionBox = selected;
        //console.log(`Nodes in box: ${selected.length}`);
    }

    getSlotByIds(nodeId : string, slotId : string) {
        let node = this.getNodeById(nodeId);

        if (!node)
            return null;

        return node.getSlotById(slotId);
    }

    getNodeByState(state : FiregraphNode) {
        return this.nodes.find(x => x.state === state);
    }

    getNodeById(id : string) {
        return this.nodes.find(x => x.id === id);
    }

    registerNode(nodeContext : FiregraphNodeContext) {
        this.nodes.push(nodeContext);
        nodeContext.onCreated();
    }

    deregisterNode(nodeContext : FiregraphNodeContext) {
        let index = this.nodes.findIndex(x => x === nodeContext);
        if (index >= 0)
            this.nodes.splice(index, 1);

        nodeContext.onDestroyed();
    }

    findIdenticalEdge(edge : FiregraphEdge) {
        for (let otherEdge of this.edges) {
            let identical = 
                otherEdge.fromNodeId === edge.fromNodeId
                && otherEdge.fromSlotId === edge.fromSlotId 
                && otherEdge.toNodeId === edge.toNodeId
                && otherEdge.toSlotId === edge.toSlotId
            ;

            if (identical)
                return otherEdge;
        }

        return null;
    }

    private removeEdgeFromGraph(graph : Firegraph, edge : FiregraphEdge) {
        let index = graph.edges.findIndex(x => this.edgesAreEqual(x, edge));
        if (index >= 0)
            graph.edges.splice(index, 1);
    }

    removeEdge(edge : FiregraphEdge) {
        this.commit('Remove edge', graph => this.removeEdgeFromGraph(graph, edge));
        
    }

    findEdgeToReplace(edge : FiregraphEdge): FiregraphEdge {
        let fromSlot = this.getSlotByIds(edge.fromNodeId, edge.fromSlotId);
        let toSlot = this.getSlotByIds(edge.toNodeId, edge.toSlotId);
        
        if (toSlot.valueType) {
            if (toSlot.incomingEdges.length > 0 && !toSlot.valueType.mergeable) {
                return toSlot.incomingEdges[0];
            }
        }

        if (fromSlot.valueType) {
            if (fromSlot.outgoingEdges.length > 0 && !toSlot.valueType.splittable) {
                return fromSlot.outgoingEdges[0];
            }
        }

        return null; // no edge needs to be replaced
    }

    isValid(edge : FiregraphEdge, checkValue = true) {
        let fromSlot = this.getSlotByIds(edge.fromNodeId, edge.fromSlotId);
        let toSlot = this.getSlotByIds(edge.toNodeId, edge.toSlotId);

        if (!fromSlot || !toSlot) {
            return false;
        }

        if (fromSlot.type === toSlot.type && fromSlot.type !== 'passthrough') {
            return false;
        }

        if (checkValue) {
            if (fromSlot.valueType && toSlot.valueType) {
                if (!fromSlot.valueType.isCompatible(fromSlot, toSlot) && !toSlot.valueType.isCompatible(fromSlot, toSlot))
                    return false;
            } else if (fromSlot.valueType || toSlot.valueType) {
                // if one slot has a specified value type and the other does not,
                // then they are incompatible
                return false;
            }

            // if (toSlot.valueType) {
            //     if (toSlot.incomingEdges.length > 0 && !toSlot.valueType.mergeable) {
            //         return false;
            //     }
            // }

            // if (fromSlot.valueType) {
            //     if (fromSlot.outgoingEdges.length > 0 && !toSlot.valueType.splittable) {
            //         return false;
            //     }
            // }

            // if (toSlot.type === 'input' || toSlot.type === 'passthrough') {
            //     // Input and passthrough slots can have exactly one incoming edge
            //     if (toSlot.incomingEdges.length > 0)
            //         return false;
            // }
    
        }

        if (fromSlot.validateEdge && !fromSlot.validateEdge(edge))
            return false;

        if (toSlot.validateEdge && !toSlot.validateEdge(edge))
            return false;

        return true;
    }

    draftEdgeSnap(slot : FiregraphSlotContext) {

        // if the edge is already complete, don't change that

        if (this.isValid(this.draftEdge)) {
            console.warn(`Drafted edge is already valid. Not modifying it.`);
            return;
        }

        // slots on a node can never connect to other slots on the same node
        // (or itself)

        if (this.draftEdge.fromNodeId === slot.node.id) {
            console.warn(`Destination slot not valid for this edge (cannot connect to same node)`);
            return;
        }

        this.startDraftEdge = this.draftEdge;
        let fullEdge = Object.assign({}, this.draftEdge);

        if (!fullEdge.toSlotId) {
            fullEdge.toNodeId = slot.node.id;
            fullEdge.toSlotId = slot.id;
        } else if (!fullEdge.fromSlotId) {
            fullEdge.fromNodeId = slot.node.id;
            fullEdge.fromSlotId = slot.id;
        }

        let startSlot = this.getSlotByIds(fullEdge.fromNodeId, fullEdge.fromSlotId);
        let endSlot = this.getSlotByIds(fullEdge.toNodeId, fullEdge.toSlotId);

        if (startSlot.type === 'passthrough') {
            // if the startSlot is an output, reverse the order
            if (endSlot.type === 'output') {
                console.log('Reversing edge order (output -> passthrough)');
                fullEdge.fromNodeId = endSlot.node.id;
                fullEdge.fromSlotId = endSlot.id;
                fullEdge.toNodeId = startSlot.node.id;
                fullEdge.toSlotId = startSlot.id;
            }
        }

        fullEdge.valid = this.isValid(fullEdge);

        if (this.isValid(fullEdge, false)) {
            this.draftEdge = fullEdge;
        }

        this.edgeBeingReplaced = this.findEdgeToReplace(fullEdge);
    }

    edgeBeingReplaced : FiregraphEdge;

    draftEdgeUnsnap(slot : FiregraphSlotContext) {
        console.log('UNSNAP');
        if (this.startDraftEdge) {
            this.draftEdge = this.startDraftEdge;
            this.startDraftEdge = null;
            this.edgeBeingReplaced = null;
        }
    }

    bufferedEdge : FiregraphEdge = null;

    cancelEdge() {
        this._edgeCancelled.next(this.draftEdge);
        this.draftEdge = null;
        this.edgeBeingReplaced = null;
    }

    private _edgeCancelled = new Subject<FiregraphEdge>();

    get edgeCancelled(): Observable<FiregraphEdge> {
        return this._edgeCancelled;
    }
    startEdge(startNode : FiregraphNodeContext, startSlot : FiregraphSlotContext, event : MouseEvent) {
        this.draftEdgeSourceEvent = event;
        this.draftEdge = {
            fromNodeId: null,
            fromSlotId: null,
            toNodeId: null,
            toSlotId: null,
            valid: true
        };
        this.edgeBeingReplaced = null;
        this.startDraftEdge = null;

        if (startSlot.type === 'input') {
            this.draftEdge.toNodeId = startSlot.node.id;
            this.draftEdge.toSlotId = startSlot.id;
        } else if (startSlot.type === 'output') {
            this.draftEdge.fromNodeId = startSlot.node.id;
            this.draftEdge.fromSlotId = startSlot.id;
        } else if (startSlot.type === 'passthrough') {
            this.draftEdge.fromNodeId = startSlot.node.id;
            this.draftEdge.fromSlotId = startSlot.id;
        } else {
            console.warn(`Unknown slot type ${startSlot.type}`);
            return;
        }

        console.warn(`Drafting edge from start slot, type=${startSlot.type}: ${JSON.stringify(this.draftEdge)}`);
        //console.dir(this.draftEdge);

        let mouseReleased = () => {
            if (this.draftEdge) {

                let canPlace = !this.readonly;

                console.log(`Global canPlace: ${canPlace}`);
                if (canPlace) {
                    let fromNode = this.getNodeById(this.draftEdge.fromNodeId);
                    let toNode = this.getNodeById(this.draftEdge.toNodeId);

                    if (fromNode && fromNode.readonly)
                        canPlace = false;
                    if (toNode && toNode.readonly)
                        canPlace = false;
                    
                    console.log(`Per-node canPlace: ${canPlace}`);
                }

                let isValid = this.isValid(this.draftEdge) && !this.findIdenticalEdge(this.draftEdge);

                if (canPlace && isValid) {
                    this.finishEdge(this.findEdgeToReplace(this.draftEdge));
                } else {
                    this.cancelEdge();
                }
            }

            document.removeEventListener('mouseup', mouseReleased);
        };

        document.addEventListener('mouseup', mouseReleased);

    }

    finishEdge(removedEdge? : FiregraphEdge) {
        if (!this.draftEdge)
            return;
        
        // this.draftEdge.toNodeId = endSlot.node.id;
        // this.draftEdge.toSlotId = endSlot.id;

        this.commit('Add edge', graph => {
            if (removedEdge)
                graph.edges = graph.edges.filter(x => !this.edgesAreEqual(x, removedEdge));
            
            graph.edges.push(this.draftEdge);
        });

        console.dir(this.edges);
        this.draftEdge = null;
    }

    copiedGraph : Firegraph;

    copy() {
        let graph : Firegraph = {
            nodes: [],
            edges: []
        };

        let idMap = new Map<string,string>();

        for (let node of this.selectedNodes) {
            let nodeId = uuid();

            idMap.set(node.state.id, nodeId);

            graph.nodes.push(
                Object.assign(
                    this.clone(node.state),
                    { id: nodeId }
                )
            );
        }

        for (let node of this.selectedNodes) {
            for (let edge of node.edges) {
                let newEdge = this.clone(edge);

                newEdge.fromNodeId = idMap.get(newEdge.fromNodeId);
                newEdge.toNodeId = idMap.get(newEdge.toNodeId);

                if (!newEdge.fromNodeId || !newEdge.toNodeId)
                    continue;
                
                if (graph.edges.find(x => this.edgesAreEqual(newEdge, x)))
                    continue;

                graph.edges.push(newEdge);
            }
        }

        this.copiedGraph = graph;
    }

    createCopy(graph : Firegraph) {
        
        let idMap = new Map<string,string>();
        let newGraph : Firegraph = { nodes: [], edges: [] };

        for (let node of graph.nodes) {
            let nodeId = uuid();

            idMap.set(node.id, nodeId);

            newGraph.nodes.push(
                Object.assign(
                    this.clone(node),
                    { id: nodeId }
                )
            );
        }

        for (let edge of graph.edges) {
            let newEdge = this.clone(edge);

            newEdge.fromNodeId = idMap.get(newEdge.fromNodeId);
            newEdge.toNodeId = idMap.get(newEdge.toNodeId);

            if (!newEdge.fromNodeId || !newEdge.toNodeId)
                continue;
            
            if (graph.edges.find(x => this.edgesAreEqual(newEdge, x)))
                continue;

            newGraph.edges.push(newEdge);
        }

        return newGraph;
    }

    paste(position : Position) {
        if (this.readonly)
            return;
        
        if (!this.copiedGraph)
            return;

        
        this.commit('Paste', graph => {
            console.log(`Pasting at ${position.left},${position.top}`);
            let subgraph = this.createCopy(this.copiedGraph);

            let minX : number, maxX : number, minY : number, maxY : number;

            for (let node of subgraph.nodes) {
                minX = minX === undefined ? node.x : Math.min(minX, node.x);
                maxX = maxX === undefined ? node.x : Math.max(maxX, node.x);
                minY = minY === undefined ? node.y : Math.min(minY, node.y);
                maxY = maxY === undefined ? node.y : Math.max(maxY, node.y);
            }

            let width = maxX - minX;
            let height = maxY - minY;

            let midPointX = (minX + maxX) / 2;
            let midPointY = (minY + maxY) / 2;

            for (let node of subgraph.nodes) {
                node.x = node.x - midPointX + position.left;
                node.y = node.y - midPointY + position.top;
            }

            graph.nodes.push(...subgraph.nodes);
            graph.edges.push(...subgraph.edges);
        });

    }
}