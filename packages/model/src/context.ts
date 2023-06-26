import * as uuid from 'uuid';

import { Observable, BehaviorSubject, Subject, ReplaySubject } from 'rxjs';
import { SubSink } from 'subsink';
import { Accessor } from './accessor';
import { Position, Size } from './common';
import { DiazoGraph, DiazoSlot, DiazoValue, DiazoNode, 
    DiazoProperty, DiazoEdge } from './model';

/**
 * Represents a single slot on a single node within a Diazo. 
 * This handles ephemeral state and accessing logic around the representation
 * of a slot within the Diazo user interface.
 * @category Editor
 */
export class DiazoSlotContext {
    id : string;
    type : string;
    node : DiazoNodeContext;
    value : DiazoValue;
    valueType : DiazoValueType;
    getClientPosition? : () => Position;
    validateEdge? : (edge : DiazoEdge) => boolean;

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

    getOtherSlotOfEdge(edge : DiazoEdge) {
        if (edge.fromNodeId === this.node.id && edge.fromSlotId === this.id) {
            return this.graph.getSlotByIds(edge.toNodeId, edge.toSlotId);
        } else {
            return this.graph.getSlotByIds(edge.fromNodeId, edge.fromSlotId);
        }
    }
}

/**
 * Used to represent a text notification that should be shown in the UI.
 * This is used by the {@link DiazoContext | context} layer to signal the
 * {@link DiazoEditorComponent | Diazo editor} to show a message 
 * via the snack bar (floating notifications shown along the bottom of 
 * the viewport). 
 * @category Editor
 */
export interface DiazoEditorNotification {
    message : string;
}

/**
 * Represents a saved Undo/Redo state within the {@link DiazoContext | context} layer.
 * @category Editor
 */
export interface DiazoUndoState {
    /**
     * Performs the edit itself. This is called when the action first happens and when 
     * the action is redone.
     * @param editor 
     * @returns 
     */
    forward: (editor: GraphEditor) => void;

    /**
     * Called when the edit is undone.
     * @returns 
     */
    rollback: () => void;

    graphBefore : DiazoGraph;
    graphAfter : DiazoGraph;
    cause : string;
}

/**
 * @category Editor
 */
export class DiazoPropertyContext {
    constructor() {
        this._accessor = new Accessor();
        this._manipulator = new Proxy({}, {
            set: (target, key, value) => {

                this.graphContext.edit('Edit properties', editor => {
                    let graph = editor.graph;
                    let nodes = this.selectedNodes
                        .map(x => graph.nodes.find(y => y.id === x.id))
                    ;

                    let changed = this.accessor.set(
                        nodes, 
                        <string>key, 
                        value
                    );

                    if (!changed) {
                        editor.abort(true);
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

    graphContext : DiazoContext;
    selectedNodes : DiazoNode[];
    property : DiazoProperty;

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
 * Represents the context for a specific node within a Diazo.
 * This provides ephemeral state, convenient access, and interaction logic
 * around the user interface representation of a Diazo node.
 * @category Editor
 */
export class DiazoNodeContext {
    constructor() {

    }

    ownState : DiazoNode;
    id : string;
    slots : DiazoSlotContext[] = [];
    graph : DiazoContext;

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
    
    involvedInEdge(edge : DiazoEdge) {
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
                    this.updatePosition();
                })
            })
        );
    }

    private _positionChanged = new BehaviorSubject<Position>({ top: 0, left: 0 });

    get positionChanged() : Observable<Position> {
        return this._positionChanged;
    }

    /**
     * Visit all nodes in an edit transaction. 
     * @deprecated Use editAllNodes() instead
     * @param cause 
     * @param callback 
     */
    modify(cause : string, callback : (node : DiazoNode) => void) {
        this.editAllNodes(cause, (node, editor) => callback(node));
    }

    editAllNodes(cause : string, callback : (node : DiazoNode, editor: GraphEditor) => void) {
        this.graph.edit(cause, editor => {
            callback(editor.graph.nodes.find(x => x.id === this.id), editor);
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

    registerSlot(slotContext : DiazoSlotContext) {
        this.slots.push(slotContext);
    }

    deregisterSlot(slotContext : DiazoSlotContext) {
        let index = this.slots.findIndex(x => x === slotContext);
        if (index >= 0)
            this.slots.splice(index, 1);
    }

    startEdge(slot : DiazoSlotContext, event : MouseEvent) {
        if (this.graph.readonly)
            return;

        this.graph.startEdge(this, slot, event);
    }
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
 * For instance, {@linkcode DiazoTypeBase} provides an easy way to implement
 * this interface, providing validation based on the inheritance heirarchy of 
 * the classes involved. For most applications of value types this is the 
 * obvious solution, and the low-level `isCompatible()` API is provided as an 
 * escape hatch to implement a wide variety of possible connection validation
 * strategies. We use this within the Diazo editor to implement 
 * {@linkcode WildcardType} for example.
 * 
 * @category Editor
 */
export interface DiazoValueType {

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
        output : DiazoSlotContext,
        input : DiazoSlotContext
    ) : boolean;

    /**
     * Specifies the registered ID for this value type.
     * This must be distinct across the editor where this 
     * value type is loaded. A slot will reference this ID
     * in its `value` definition:
     * 
     * ```typescript
     * let slot : DiazoSlot = {
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
    getNameByContext?(slot : DiazoSlotContext) : string;

    /**
     * When defined, the editor will call this function to determine what color
     * to use for edges of this value type within the editor, passing in the slot
     * related to the request. This can be used to customize the color used for 
     * this value type based on the context of where it appears.
     */
    getColorByContext?(slot : DiazoSlotContext) : string;

    /**
     * When defined, the editor will call this function to determine what shape
     * to use for the editor handles of slots which have values of this type.
     * @param slot 
     */
    getSlotShapeByContext?(slot : DiazoSlotContext) : "circle" | "square" | "arrow";
}

/**
 * Manages the runtime state of the Diazo editor including logic around
 * user interactions.
 * 
 * @category Editor
 */
export class DiazoContext {
    constructor() {
    }

    get graph() : DiazoGraph {
        return this._graph;
    }

    set graph(value) {
        this._graph = value;
        setTimeout(() => this.graphChanged.next(this._graph));
    }

    undoStates : DiazoUndoState[] = [];
    redoStates : DiazoUndoState[] = [];
    committing = false;
    readonly = false;
    locked = false;

    getEntryNodes() {
        let nodes : DiazoNodeContext[] = [];

        for (let node of this.nodes) {
            if (node.incomingEdges.length === 0) {
                nodes.push(node);
            }
        }

        return nodes;
    }

    onNodeAdded(node : DiazoNode) {    
        this.applyNodeRules(node);
    }

    onNodeUpdated(node : DiazoNode) {
        this.applyNodeRules(node);
    }
    
    applyNodeRules(node : DiazoNode) {
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
                let outputs : DiazoSlot[] = [];

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
    
    addNodeToSubgraph(subgraph : DiazoGraph, node : DiazoNode) {
        if (subgraph.nodes.some(x => x.id === node.id))
            return;

        subgraph.nodes.push(this.clone(node));
    }

    addEdgeToSubgraph(subgraph : DiazoGraph, edge : DiazoEdge) {
        if (subgraph.edges.some(x => this.edgesAreEqual(x, edge)))
            return;

        subgraph.edges.push(this.clone(edge));
    }

    collectSubgraph(entryNode : DiazoNodeContext, subgraph : DiazoGraph) {
        if (subgraph.nodes.some(x => x.id === entryNode.id))
            return;

        this.addNodeToSubgraph(subgraph, entryNode.state);
        for (let edge of entryNode.outgoingEdges) {
            this.addEdgeToSubgraph(subgraph, edge);
            let endNode = this.getNodeById(edge.toNodeId);
            this.collectSubgraph(endNode, subgraph);
        }
    }

    /**
     * Commit a change to this graph. Creates an undo entry when successful. Use abort() to abort the commit 
     * and discard all changes to the graph. The graph provided to the callback is a copy of the current graph, so 
     * it is safe to abort even if it has been changed.
     * 
     * @deprecated Use edit() instead
     * @param cause 
     * @param callback 
     * @returns 
     */
    commit(cause : string, callback : (graph : DiazoGraph, abort : (silently? : boolean) => void) => void) {
        this.edit(cause, editor => callback(editor.graph, editor.abort));
    }

    edit(cause: string, callback: (editor: GraphEditor) => void) {
        if (this.committing)
            throw new Error(`Edit already in progress`);
        
        this.committing = true;

        let graphBefore = this.clone(this.graph);

        // Clear all delta positions on nodes in graphBefore
        for (let node of graphBefore.nodes) {
            node.positionDeltaX = 0;
            node.positionDeltaY = 0;
        }

        let graphAfter = this.clone(this.graph) as DiazoGraph;
        graphAfter.edges ??= [];
        graphAfter.nodes ??= [];

        let rollbacks: (() => void)[] = [];
        let editor = <GraphEditor>{
            whenUndone: (callback) => rollbacks.push(callback),
            graph: graphAfter,
            abort: (silently? : boolean) => { throw new Error(silently? `revert:silently` : `revert`); },
            getNodeById: id => graphAfter.nodes.find(x => x.id === id),
            addNode: (node) => graphAfter.nodes.push(node),
            addEdge: edge => graphAfter.edges.push(edge),
            removeEdge: edge => {
                let fromNode = graphAfter.nodes.find(x => x.id === edge.fromNodeId);
                let fromSlot = fromNode?.slots?.find(x => x.id === edge.fromSlotId);
                let toNode = graphAfter.nodes.find(x => x.id === edge.toNodeId);
                let toSlot = toNode?.slots?.find(x => x.id === edge.toSlotId);

                graphAfter.edges = graphAfter.edges.filter(x => !this.edgesAreEqual(x, edge));

                if (toSlot?.removeWhenEmpty && graphAfter.edges.filter(x => x.toNodeId === toNode.id && x.toSlotId === toSlot.id).length === 0) {
                    toNode.slots = toNode.slots.filter(x => x !== toSlot);
                }

                if (fromSlot?.removeWhenEmpty && graphAfter.edges.filter(x => x.fromNodeId === fromNode.id && x.fromSlotId === fromSlot.id).length === 0) {
                    fromNode.slots = fromNode.slots.filter(x => x !== fromSlot);
                }
            },
            removeNode: (node) => {
                let affectedEdges = graphAfter.edges
                    .filter(x => [x.fromNodeId, x.toNodeId].includes(node.id))
                    .slice()
                ;

                for (let edge of affectedEdges) {
                    if (edge.fromNodeId === node.id || edge.toNodeId === node.id) {
                        this.removeEdgeFromGraph(graphAfter, edge);
                    }
                }

                let index = graphAfter.nodes.findIndex(x => x.id === node.id);

                if (index < 0) {
                    console.warn(`Cannot remove node context that is not registered`);
                    return;
                }

                graphAfter.nodes.splice(index, 1);
            },
        }

        try {
            callback(editor);
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

        this.cleanupGraph(editor);

        console.warn(`COMMIT: Committing: ${cause}`);
        this.committing = false;

        this.undoStates.push({
            cause,
            forward: callback,
            rollback: () => rollbacks.forEach(cb => cb()),
            graphBefore,
            graphAfter
        });

        this.redoStates = [];
        this.graph = this.clone(graphAfter);
    }

    /**
     * Remove unused edges and other post-edit cleanup.
     * @param graph 
     */
    private cleanupGraph(editor: GraphEditor) {
        let removedEdges: DiazoEdge[] = [];

        for (let edge of editor.graph.edges) {
            let fromNode = editor.getNodeById(edge.fromNodeId);
            let fromSlot = fromNode?.slots?.find(x => x.id === edge.fromSlotId);
            let toNode = editor.getNodeById(edge.toNodeId);
            let toSlot = toNode?.slots?.find(x => x.id === edge.toSlotId);

            if (!fromSlot || !toSlot)
                removedEdges.push(edge);
        }

        for (let edge of removedEdges) {
            let index = editor.graph.edges.indexOf(edge);
            if (index >= 0) {
                editor.graph.edges.splice(index, 1);
            }
        }
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

        state.rollback();

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
        if (!state)
            return;
        
        this.edit(state.cause, state.forward);
        this.notificationMessage.next({ message: `Redo: ${state.cause}` });
    }


    nodeTypeMap : Record<string,any> = {};

    private _valueTypesChanged = new Subject<void>();

    public get valueTypesChanged() : Observable<void> {
        return this._valueTypesChanged;
    }

    private valueTypes = new Map<string,DiazoValueType>();

    registerValueType<T extends { new() : DiazoValueType }>(type : T) {
        let typeInstance : DiazoValueType = new type();
        this.valueTypes.set(typeInstance.id, typeInstance);
        this._valueTypesChanged.next();
    }

    allValueTypes() {
        return Array.from(this.valueTypes.values());
    }

    getValueTypeById(id : string) {
        return this.valueTypes.get(id);
    }

    notificationMessage = new Subject<DiazoEditorNotification>();

    valuesCompatible(a : DiazoValue, b : DiazoValue) {
        if (a === b) {
            return true;
        }

        if (!a && !b)
            return true;
        
        let aType = this.getValueTypeById(a.type);
        let bType = this.getValueTypeById(b.type);

        let virtualNode = new DiazoNodeContext();
        virtualNode.graph = this;

        let virtualSlotA = new DiazoSlotContext();
        let virtualSlotB = new DiazoSlotContext();

        virtualSlotA.node = virtualNode;
        virtualSlotB.node = virtualNode;

        virtualSlotA.value = a;
        virtualSlotA.valueType = aType;
        virtualSlotB.value = b;
        virtualSlotB.valueType = bType;


        if (aType.isCompatible(virtualSlotA, virtualSlotB) || bType.isCompatible(virtualSlotA, virtualSlotB)) {
            return true;
        }

        return false;
    }

    private _graph : DiazoGraph = { nodes: [], edges: [] };
    graphChanged = new ReplaySubject<DiazoGraph>(1);

    nodes : DiazoNodeContext[] = [];
    edgeUnderCursor : DiazoEdge;
    minZoom = 0.3;
    maxZoom = 2;
    gridSizeX = 15;
    gridSizeY = 15;
    panX = 0;
    panY = 0;
    mouseInside = false;

    draftNode : DiazoNode;

    draftEdge : DiazoEdge;
    startDraftEdge : DiazoEdge;
    draftEdgeSourceEvent : MouseEvent;
    zoom = 1;

    private _panChanged = new BehaviorSubject<Position>({ top: 0, left: 0 });
    private _zoomChanged = new BehaviorSubject<number>(1);

    removeEdgesForNode(node : DiazoNodeContext) {
        for (let edge of this.edges.slice()) {
            if (edge.fromNodeId === node.id || edge.toNodeId === node.id) {
                this.removeEdge(edge);
            }
        }
    }

    removeNode(node : DiazoNodeContext) {
        this.unselectNode(node);
        this.edit('Remove node', editor => editor.removeNode(node));
    }

    edgesAreEqual(a : DiazoEdge, b : DiazoEdge) {
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

    unselectNode(node : DiazoNodeContext) {
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
        
        this.edit('Delete nodes', editor => {
            let graph = editor.graph;
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

        this.edit('Add node', editor => {
            editor.addNode(candidate);
            this.onNodeAdded(candidate);
            if (candidateEdge)
                editor.addEdge(candidateEdge);
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

    get edges() : DiazoEdge[] {
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

    selectedNodes : DiazoNodeContext[];

    _selectionChanged = new BehaviorSubject<DiazoNodeContext[]>([]);

    get selectionChanged() : Observable<DiazoNodeContext[]> {
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

    isNodeSelected(node : DiazoNodeContext) {

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

    addToSelection(node : DiazoNodeContext) {
        if (!this.selectedNodes)
            this.selectedNodes = [];
        this.selectedNodes.push(node);
        this.notifySelectionChanged();
    }

    removeFromSelection(node : DiazoNodeContext) {
        if (!this.selectedNodes)
            return;

        let index = this.selectedNodes.findIndex(x => x === node);

        if (index >= 0) {
            this.selectedNodes.splice(index, 1);
            this.notifySelectionChanged();
        }
    }

    selectNode(node : DiazoNodeContext) {
        this.selectedNodes = [ node ];
        this.notifySelectionChanged();
    }

    startSelectionAt(pos : Position, additive : boolean) {
        this.selectionBoxStart = { left: pos.left, top: pos.top };
        this.nodesInSelectionBox = [];

        if (!additive) {
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

    nodesInSelectionBox : DiazoNodeContext[];

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
    }

    getSlotByIds(nodeId : string, slotId : string) {
        let node = this.getNodeById(nodeId);

        if (!node)
            return null;

        return node.getSlotById(slotId);
    }

    getNodeByState(state : DiazoNode) {
        return this.nodes.find(x => x.state === state);
    }

    getNodeById(id : string) {
        return this.nodes.find(x => x.id === id);
    }

    registerNode(nodeContext : DiazoNodeContext) {
        this.nodes.push(nodeContext);
        nodeContext.onCreated();
    }

    deregisterNode(nodeContext : DiazoNodeContext) {
        let index = this.nodes.findIndex(x => x === nodeContext);
        if (index >= 0)
            this.nodes.splice(index, 1);

        nodeContext.onDestroyed();
    }

    findIdenticalEdge(edge : DiazoEdge) {
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

    private removeEdgeFromGraph(graph : DiazoGraph, edge : DiazoEdge) {
        let index = graph.edges.findIndex(x => this.edgesAreEqual(x, edge));
        if (index >= 0)
            graph.edges.splice(index, 1);
    }

    removeEdge(edge : DiazoEdge) {
        this.edit('Remove edge', editor => editor.removeEdge(edge));
    }

    findEdgeToReplace(edge : DiazoEdge): DiazoEdge {
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

    isValid(edge : DiazoEdge, checkValue = true) {
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

    draftEdgeSnap(slot : DiazoSlotContext) {

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

    edgeBeingReplaced : DiazoEdge;

    draftEdgeUnsnap(slot : DiazoSlotContext) {
        if (this.startDraftEdge) {
            this.draftEdge = this.startDraftEdge;
            this.startDraftEdge = null;
            this.edgeBeingReplaced = null;
        }
    }

    bufferedEdge : DiazoEdge = null;

    cancelEdge() {
        this._edgeCancelled.next(this.draftEdge);
        this.draftEdge = null;
        this.edgeBeingReplaced = null;
    }

    private _edgeCancelled = new Subject<DiazoEdge>();

    get edgeCancelled(): Observable<DiazoEdge> {
        return this._edgeCancelled;
    }
    startEdge(startNode : DiazoNodeContext, startSlot : DiazoSlotContext, event : MouseEvent) {
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

                if (canPlace) {
                    let fromNode = this.getNodeById(this.draftEdge.fromNodeId);
                    let toNode = this.getNodeById(this.draftEdge.toNodeId);

                    if (fromNode && fromNode.readonly)
                        canPlace = false;
                    if (toNode && toNode.readonly)
                        canPlace = false;
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

    finishEdge(removedEdge? : DiazoEdge) {
        if (!this.draftEdge)
            return;
        
        // this.draftEdge.toNodeId = endSlot.node.id;
        // this.draftEdge.toSlotId = endSlot.id;

        this.edit('Add edge', editor => {
            if (removedEdge)
                editor.removeEdge(removedEdge);
            editor.addEdge(this.draftEdge);
        });

        console.dir(this.edges);
        this.draftEdge = null;
    }

    copiedGraph : DiazoGraph;

    copy() {
        let graph : DiazoGraph = {
            nodes: [],
            edges: []
        };

        let idMap = new Map<string,string>();

        for (let node of this.selectedNodes) {
            let nodeId = uuid.v4();

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

    createCopy(graph : DiazoGraph) {
        
        let idMap = new Map<string,string>();
        let newGraph : DiazoGraph = { nodes: [], edges: [] };

        for (let node of graph.nodes) {
            let nodeId = uuid.v4();

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

        
        this.edit('Paste', editor => {
            let graph = editor.graph;
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

export interface GraphEditor {
    graph: DiazoGraph;

    getNodeById(id: string): DiazoNode;
    addNode(node: DiazoNode);
    removeNode(node: DiazoNode | DiazoNodeContext);
    addEdge(edge: DiazoEdge);
    removeEdge(edge: DiazoEdge);

    /**
     * Specify a callback which will run when the edit is undone.
     * @param callback 
     */
    whenUndone(callback: () => void);

    abort(silently?: boolean): void;
}