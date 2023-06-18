import { Component, Input, Output, Provider, 
    ViewChild, ElementRef } from "@angular/core";
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { DiazoContext, DiazoNodeContext, DiazoValueType, 
    Accessor, MULTIPLE_VALUES, Position } from '@diazo/model';
import { moveItemInArray } from '@angular/cdk/drag-drop';
import { GraphComponent } from '../graph/graph.component';
import * as uuid from 'uuid';
import { DiazoGraph, DiazoNodeSet, DiazoNode, DiazoPropertySet, 
    DiazoPropertyOptionGroup, DiazoCustomPropertyType, 
    DiazoProperty } from '@diazo/model';

/**
 * Provides a full-featured Diazo editor, including a searchable 
 * New Node list and a powerful property sheet implementation.
 * 
 * ```html
 * <dz-editor [graph]="myGraph" [availableNodes]="myDefinedNodes"></dz-editor>
 * ```
 * 
 * Here,
 * - `[graph]` is the graph that should be rendered. Any changes made by the user will 
 *   be applied to the bound object.
 * - `[availableNodes]` is an array of {@linkcode DiazoNode} objects made available
 *   to the user in the New Node menu
 * 
 * See More
 * - {@linkcode DiazoGraph} - Represents a graph, composed of its nodes and edges
 * - {@linkcode DiazoValueType} - Edges are "values", and their types are represented by "value types"
 * - {@linkcode DiazoContext} - Most useful instrumentation of the Diazo editor is done 
 *   via the Context layer
 * 
 * @category Entrypoint
 */
@Component({
    selector: 'dz-editor',
    templateUrl: './editor.component.html',
    styleUrls: ['./editor.component.scss']
})
export class EditorComponent {
    /**
     * @hidden
     */
    constructor(
        private matSnackBar : MatSnackBar,
        private elementRef : ElementRef<HTMLElement>
    ) {
        
        this.propertyManipulator = new Proxy({}, {
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
        })
    }

    /**
     * @hidden
     */
    ngOnInit() {
        this.windowResizeHandler = () => {
            this._showPropertiesByDefault = (window.innerWidth > 500);
        };

        window.addEventListener('resize', this.windowResizeHandler);
    }

    /**
     * @hidden
     */
    ngOnDestroy() {
        window.removeEventListener('resize', this.windowResizeHandler);
    }

    private windowResizeHandler;
    private _propertySearch = '';
    private _nodeSearch = '';
    private _showProperties : boolean = undefined;
    private _showPropertiesByDefault = true;
    private _graph : DiazoGraph = {
        nodes: [],
        edges: []
    };
    private _availableNodes : DiazoNodeSet[] = [];
    private accessor = new Accessor();
    private labelCache = new WeakMap<DiazoNode, string>();

    nodeMenuPosition: Position;
    newNodePosition: Position;

    /**
     * A proxy object which is capable of getting or setting property 
     * values across the nodes that are currently selected in the editor.
     * The keys of this object are interpreted as either JSONPath (when the 
     * key starts with '$') or Diazo's custom object path format (otherwise).
     */
    propertyManipulator : any;
    
    /**
     * Stores the current graph context object. This represents the state 
     * logic for the graph being edited within the Diazo editor
     */
    graphContext : DiazoContext;

    /**
     * Get the currently selected node context (the first one
     * if multiple nodes are currently selected)
     */
    selectedNodeContext : DiazoNodeContext;

    /**
     * Get the currently selected node-contexts
     */
    selectedNodeContexts : DiazoNodeContext[] = [];

    /**
     * Provides the PropertySets which are currently visible 
     * subject to the search query entered by the user.
     */
    selectedPropertySets : DiazoPropertySet[] = [];

    /**
     * Provides the NodeSets which are currently visible 
     * in the New Node menu, subject to the search query 
     * entered by the user.
     */
    matchingNodeSets : DiazoNodeSet[];

    /**
     * Provides the Nodes which are currently visible 
     * in the New Node menu, subject to the search query 
     * entered by the user. This is a flattening of the nodes
     * found in `matchingNodeSets`.
     */
    matchingNodes : DiazoNode[];

    /**
     * When true, the Node Menu is in keyboard mode, and certain
     * keystrokes (up/down/enter) can be used to select and insert
     * a node visible in the menu, This works in concert with 
     * `matchingNodes`.
     */
    nodeMenuKeyboardMode = false;

    /**
     * The index of a node in the New Node menu that the user has 
     * selected via Keyboard Mode.
     */
    selectedMatchingNodeIndex = 0;

    /**
     * The text the user has entered into the Property Sheet's 
     * Search box.
     */
    get propertySearch() {
        return this._propertySearch;
    }

    set propertySearch(value) {
        this._propertySearch = value;
        setTimeout(() => this.updateSelectedPropertySets());
    }

    /**
     * The text the user has entered into the Node Menu's
     * Search box.
     */
    get nodeSearch() {
        return this._nodeSearch;
    }

    set nodeSearch(value) {
        this._nodeSearch = value;
        setTimeout(() => this.updateSelectedNodeSets());
    }

    /**
     * True when the user has made the Properties sidebar visible.
     * False when the user has hidden it. This also has special behavior
     * if the user has not yet shown/hidden the sidebar -- if the 
     * screen size is small enough to be considered "mobile", then this
     * will return false. Otherwise it will be true.
     */
    get showProperties() {
        if (this._showProperties === undefined)
            return this._showPropertiesByDefault;
        return this._showProperties;
    }

    set showProperties(value) {
        this._showProperties = value;
    }

    /**
     * Options used for Monaco when editing JSON.
     */
    jsonMonacoOptions = {
        theme: 'vs-dark', 
        language: 'json',
        automaticLayout: true
    };

    /**
     * Options used for Monaco when editing Markdown.
     */
    markdownMonacoOptions = {
        theme: 'vs-dark', 
        language: 'markdown',
        automaticLayout: true
    };

    /**
     * Options used for Monaco when editing TypeScript.
     */
    tsMonacoOptions = {
        theme: 'vs-dark', 
        language: 'typescript',
        automaticLayout: true
    };

    /**
     * Fired when the DiazoContext has been acquired from the underlying
     * Diazo component. DiazoContext represents the operating state 
     * (model) of the Diazo editor.
     */
    @Output()
    contextChanged = new Subject<DiazoContext>();

    /**
     * Fired when the graph has been changed by the user. More technically
     * this is fired when a change transaction is "committed" to the Diazo
     * Context. These change transactions underpin Diazo's support for Undo/Redo.
     */
    @Output() 
    graphChanged = new Subject<DiazoGraph>();

    /**
     * If true, the Diazo editor will be placed in Read Only mode. The user 
     * can still move nodes around, but new nodes cannot be created, existing nodes
     * cannot be removed, and edges cannot be changed.
     */
    @Input()
    readonly = false;

    /**
     * If true, the Diazo editor will allow no changes to the graph whatsoever.
     * When this is true, `readonly` is also considered to be true. The difference
     * between `locked` and `readonly` is mainly that the nodes cannot be moved around
     * by the user.
     */
    @Input()
    locked = false;

    /**
     * Allows the consumer to pass in a set of dependency injection providers 
     * which will be used whenever a custom property editor or custom node is 
     * created. Use this to pass in services needed by your custom controls.
     */
    @Input()
    providers : Provider[] = [];

    /**
     * Provides access to the underlying <dz-container> component which 
     * implements the Diazo renderer.
     */
    @ViewChild('container')
    container : GraphComponent;

    /**
     * Specify an array of PropertySets which will be shown for all nodes that
     * exist in the graph. These PropertySets will be shown after the ones defined
     * on the node itself.
     */
    @Input()
    universalPropertySets : DiazoPropertySet[] = [];

    /**
     * When true, the edges of the graph will be rendered with a flow animation.
     * Use this to indicate that the graph is currently "running".
     */
    @Input()
    active : boolean = undefined;

    /**
     * Allows the consumer to pass in the set of nodes that will be available 
     * for the user to add to the graph via the New Node menu (right click).
     */
    @Input()
    get availableNodes() {
        return this._availableNodes;
    }
    set availableNodes(value) {
        this._availableNodes = value;
        this.updateSelectedNodeSets();
        if (this._graph)
            this.inflateGraph(this._graph);
    }

    /**
     * Allows the consumer to specify dynamic option sources for use with 
     * properties of type "select". Since properties are static declarations,
     * it is generally not possible to dynamically populate the options of a 
     * "select" property. The "optionSources" system provides a good way to 
     * do this. To use it, define a property such as {type: "select", optionSource: "mySource"}
     * and specify "optionSources" as { mySource: { option1: "Option 1", option2: "Option 2"}}.
     * The Diazo editor will automatically populate these options into the select
     * box in the Properties panel.
     */
    @Input()
    optionSources : Record<string, Record<string, DiazoPropertyOptionGroup[]>>;
    
    /**
     * Specify a set of custom components that will be used to render specific types of 
     * nodes. The key of this map should match the "$.type" property of a node you wish
     * to use a custom component with. The value is the Angular component class.
     * 
     * The custom component can inject the `DiazoNodeContext` instance in order 
     * to interact with the node state.
     */
    @Input()
    nodeTypeMap : Record<string, any>;

    /**
     * Specify a set of custom components that will be used to render specific types of
     * properties. Each custom property type specifies a "namespace" and an "id". 
     * You use this custom type in the `properties` declaration on a node (or via 
     * universalPropertySets) by specifying `property.type = "namespace:id"` 
     * (for example).
     */
    @Input()
    customPropertyTypes : DiazoCustomPropertyType[] = [];

    /**
     * Specify a set of "value types" which are used to declare the types of 
     * edges that can be created within the graph. The value type system 
     * supports compatibility by class heirarchy by default, and custom value
     * type classes can even redefine the notion of compatibility however they want.
     * Compatibility here refers to whether a slot with one "value" is allowed to be 
     * connected to a slot with another "value".
     * 
     * Value types also define the color and appearance of the edge when rendered
     * within Diazo.
     */
    @Input()
    valueTypes : { new() : DiazoValueType; }[] = [];

    /**
     * Specify the Diazo object that this editor should work with.
     * The object is passed by reference here, and the object will be 
     * modified by the Diazo editor *in place*. Note that you can 
     * also receive immutable snapshots of the graph via the 
     * `graphChanged` event.
     */
    @Input()
    get graph() {
        return this._graph;
    }

    set graph(value) {
        this._graph = value;
        if (this._graph)
            this.inflateGraph(this._graph);
    }

    /**
     * Bind to this event to receive Save events from the user
     * (Diazo Editor does not do anything special with a Save 
     * request by default, that is up to the consumer). This fires
     * when the user presses Ctrl+S / Cmd+S.
     */
    @Output()
    saveRequested = new Subject<void>();

    /**
     * This is true if the selection of nodes is considered "readonly".
     * The selection is considered readonly if any selected node is 
     * marked as "readonly".
     */
    get selectionReadOnly() {
        if (this.readonly)
            return true;

        let readonly = false;

        for (let node of this.selectedNodes) {
            if (!node) {
                console.warn(`selectedNodes contains null entry!`);
            }
            if (node.readonly) {
                readonly = true;
                break;
            }
        }

        return readonly;
    }

    /**
     * Provides (for convenience) the "MULTIPLE_VALUES" special token
     * value. This is used to represent that among the nodes selected 
     * within the editor, the values of a specific property differ between
     * them. In the editor, this will show up as "Multiple values" in the 
     * property sheet, which typically prevents you from editing the property.
     * @hidden
     */
    get MULTIPLE_VALUES() {
        return MULTIPLE_VALUES;
    }

    /**
     * Get the currently selected DiazoNode (the first one if there are multiple
     * nodes selected)
     */
    get selectedNode() {
        return this.selectedNodeContext.state;
    }

    /**
     * Get the currently selected DiazoNodes.
     */
    get selectedNodes() {
        return this.selectedNodeContexts.map(x => x.state).filter(x => x);
    }

    /**
     * Specify where a new node should be inserted. This is used 
     * by the New Node menu to determine where a node should be 
     * placed when it is not dragged into the view.
     * @hidden
     */
    setNewNodePosition(position : Position) {
        if (!this.graphContext)
            return;
        
        this.nodeMenuPosition = position;
        this.newNodePosition = {
            left: position.left - this.graphContext.panX - 20,
            top: position.top - this.graphContext.panY - 20
        };
    }

    /**
     * Hide the node menu if it is currently visible.
     */
    hideNodeMenu() {
        if (this.container)
            this.container.hideNodeMenu();
    }

    /**
     * Show the node menu if it is not currently visible.
     */
    showNodeMenu() {
        if (this.container)
            this.container.showNodeMenu();
    }

    /**
     * Insert the node that is currently selected in the New Node menu.
     * This is used by the Keyboard Mode of the node menu to insert the 
     * node upon pressing "Enter".
     * @hidden
     */
    insertSelectedNode() {
        let template = this.matchingNodes[this.selectedMatchingNodeIndex];

        this.graphContext.draftNode = Object.assign(
            {}, 
            template,
            <Partial<DiazoNode>>{ 
                id: uuid.v4(),
                x: (this.newNodePosition || {}).left || 0,
                y: (this.newNodePosition || {}).top || 0
            }
        );
        this.graphContext.draftEdge = null;
        
        if (this.graphContext.bufferedEdge) {
            let edge = this.graphContext.bufferedEdge;

            if (!edge.toNodeId) {
                edge.toNodeId = this.graphContext.draftNode.id;
                edge.toSlotId = this.graphContext.draftNode.slots.filter(x => x.type === 'input')[0].id;
            } else {
                edge.fromNodeId = this.graphContext.draftNode.id;
                edge.fromSlotId = this.graphContext.draftNode.slots.filter(x => x.type === 'output')[0].id;
            }
            
            this.graphContext.draftEdge = edge;
        }

        this.graphContext.releaseDraftNode();
        this.hideNodeMenu();
    }

    /**
     * Return true if the given Property Type is a custom type.
     * This is determined by looking up the type using the `customPropertyTypes`
     * field.
     * @hidden
     */
    isCustomPropertyType(type : string) {
        return !!this.getCustomPropertyType(type);
    }

    /**
     * Get a custom property type from the `customPropertyTypes` field.
     * The passed string should be in the form "namespace:id"
     * @hidden
     */
    getCustomPropertyType(type : string) {
        return this.customPropertyTypes.find(x => type === `${x.namespace}:${x.id}`);
    }

    /**
     * @hidden
     */
    numericRange(min, max, step = 1) {
        let array = [];

        for (let i = min; i < max; i += step)
            array.push(i);

        return array;
    }

    /**
     * @hidden
     */
    onGraphChanged(graph : DiazoGraph) {
        this.graphChanged.next(graph);
    }
    
    /**
     * Locate the given dynamic option source with the given name from `optionSources`.
     * Used to support dynamic options sources for "select" properties.
     * @hidden
     */
    getOptionsFromSource(sourceDescriptor : string): DiazoPropertyOptionGroup[] {
        let set = sourceDescriptor;
        let key = 'default';

        let match = sourceDescriptor.match(/^([^\[\]]+)\[([^\[\]]+)\]$/);
        if (match) {
            let propIndex = match[2];

            set = match[1];
            key = this.propertyManipulator[propIndex];
        }

        return this.optionSources[set][key];
    }

    /**
     * Returns true if the given property would have any enabled options within
     * the standard property menu (shown to the right of the property view).
     * If false, the editor will hide the menu entirely.
     * @hidden
     */
    propertyNeedsMenu(prop : DiazoProperty) {
        return prop.allowAnnotation !== false || prop.slottable;
    }

    /**
     * Annotate all nodes in the given graph with the properties specified 
     * within the `availableNodes` setting. It is typical for consumers of 
     * Diazo to strip the `properties` part of all nodes in a graph for 
     * space efficiency, because for some domains the amount of properties 
     * on a node can be substantial. Furthermore, the properties specified 
     * within `availableNodes` may have changed since the graph object was 
     * originally created. This inflation process automatically 
     * re-adds the necessary property definitions onto the graph nodes 
     * ensuring that the available properties are always up to date with
     * those defined by your application.
     * @hidden
     */
    inflateGraph(graph : DiazoGraph) {
        for (let node of graph.nodes) {
            if (node.data && node.data.unit === 'reroute')
                continue;
            
            let templateNode = this.findTemplateNode(node);
            if (templateNode) {
                node.properties = templateNode.properties;
            } else {
                if (node.properties) {
                    console.warn(`Node already has docs, but could not refresh them:`);
                    console.dir(node);                    
                } else if (this.availableNodes.length > 0) {
                    //debugger;
                    console.warn(`Could not locate documentation for graph node:`);
                    console.dir(node);
                }
            }
        }
    }

    /**
     * Find a node within `availableNodes` which matches the given node.
     * This is used to implement graph inflation (see `inflateGraph`) whereby 
     * we update the `properties` section of all nodes in the graph.
     * @hidden
     */
    findTemplateNode(node : DiazoNode) {
        if (!node.data?.unit)
            return null;
        
        for (let set of this.availableNodes) {
            let templateNode : DiazoNode;

            templateNode = set.nodes.find(x => x.data?.variant && x.data?.variant === node.data?.variant);
            if (!templateNode)
                templateNode = set.nodes.find(x => x.data?.unit === node.data?.unit);

            if (templateNode)
                return templateNode;
        }

        return null;
    }

    /**
     * Determine the label to use for the given node.
     * @hidden
     */
    labelForNode(node : DiazoNode) {
        if (this.labelCache.has(node))
            return this.labelCache.get(node);
        
        let label = this.accessor.get([ node ], '$.label');
        this.labelCache.set(node, label);

        return label;
    }

    /**
     * Get the index of the given node within the `matchingNodes` array.
     * This is used to annotate the DOM nodes found within the Node Menu
     * in support of its keyboard selection mode.
     * @hidden
     */
    getIndexOfMatchingNode(node : DiazoNode) {
        return this.matchingNodes.indexOf(node);
    }

    /**
     * Special handling for keyboard input when the user is focused on the Search
     * box in the New Node menu.
     * @hidden
     */
    onNodeMenuSearchKeyDown(event : KeyboardEvent) {
        if (event.key === 'ArrowDown') {
            this.selectedMatchingNodeIndex += 1;
        } else if (event.key === 'ArrowUp') {
            this.selectedMatchingNodeIndex -= 1;
        }

        if (this.selectedMatchingNodeIndex < 0)
            this.selectedMatchingNodeIndex = 0;

        if (this.selectedMatchingNodeIndex >= this.matchingNodes.length) {
            this.selectedMatchingNodeIndex = this.matchingNodes.length - 1;
        }

        let el = this.elementRef.nativeElement;
        let button = el.querySelector(`[data-matched-node-index="${this.selectedMatchingNodeIndex}"]`);

        if (button)
            button.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * Update the set of visible node sets based on the search query entered 
     * into the New Node menu's Search box by the user (`nodeSearch`).
     * @hidden
     */
    updateSelectedNodeSets() {
        let sets = this.availableNodes.slice();
        sets = sets.map(x => Object.assign({}, x));

        sets.forEach(set => set.nodes = set.nodes.filter(x => JSON.stringify(x).toLowerCase().includes(this.nodeSearch)));
        sets = sets.filter(set => set.nodes.length > 0);

        this.matchingNodeSets = sets;
        this.matchingNodes = [].concat(...sets.map(x => x.nodes));
    }

    /**
     * Update the set of visible property sets based on the search query
     * entered into the Properties sidebar Search box by the user (`propertySearch`)
     * @hidden
     */
    updateSelectedPropertySets() {
        let sets = [];
        
        if (this.selectedNodes.length === 1) {
            // TODO: introduce this for multi-selection

            if (this.selectedNode.properties) {
                sets.push(...this.selectedNode.properties);
            }
        }

        sets.push(...this.universalPropertySets.slice());

        // ----------
        
        sets = sets.map(x => Object.assign({}, x));

        sets.forEach(set => set.properties = set.properties.filter(x => (x.label || '').toLowerCase().includes(this.propertySearch)));
        sets = sets.filter(set => set.properties.length > 0);

        this.selectedPropertySets = sets;
    }

    /**
     * trackBy v.path
     * @hidden
     */
    path(v) {
        return v.path;
    }

    /**
     * trackBy v.id
     * @hidden
     */
    identity(v) {
        return v.id;
    }

    /**
     * trackBy v.value
     * @hidden
     */
    value(v) {
        return v.value;
    }

    /**
     * Bound to <dz-container>'s `contextChanged` event
     * @hidden
     */
    acquireGraphContext(context : DiazoContext) {
        if (!context)
            return;
        
        setTimeout(() => {
            this.graphContext = context;
            this.contextChanged.next(context);

            for (let type of this.valueTypes) {
                context.registerValueType(type);
            }

            // reload the graph once now that value types are registered
            this.graph = this.graph;
    
    
            this.graphContext.selectionChanged.subscribe(nodes => {
                setTimeout(() => {
                    this.selectedNodeContexts = nodes.filter(x => x.state.style !== 'reroute');
                    this.selectedNodeContext = this.selectedNodeContexts[0];
                    this.updateSelectedPropertySets();
                    this.updateSelectedNodeSets();
                });
            });

            this.graphContext.notificationMessage.subscribe(notif => {
                this.matSnackBar.open(notif.message, undefined, {
                    duration: 1000,
                    politeness: "polite"
                });             
            });
        });
    }

    /**
     * Used with cdkDrag to implement reorderable slots within the Properties sidebar.
     * @hidden
     */
    reorderSlots(event) {
        moveItemInArray(this.selectedNodes[0].slots, event.previousIndex, event.currentIndex);
    }

    /**
     * Returns true if the given property has been converted into a 
     * Property Slot.
     * @hidden
     */
    isPropSlotted(prop : DiazoProperty) {
        return this.selectedNodes.some(node => node.slots.some(x => x.id === `property:${prop.path}`))
    }
    
    /**
     * Removes property slots related to the given property from the 
     * nodes that are currently selected.
     * @hidden
     */
    removePropertySlot(property : DiazoProperty) {
        let nodeIds = this.selectedNodes.map(x => x.id);

        this.graphContext.commit('Remove property slot', (graph, revert) => {

            let nodes = nodeIds.map(id => graph.nodes.find(x => x.id === id));
            this.accessor.set(nodes, property.path, '∅');

            for (let node of nodes) {
                if (node.slots) {
                    let slotId = `property:${property.path}`;
                    node.slots = node.slots.filter(x => x.id !== slotId);
                    graph.edges = graph.edges.filter(x => !(x.toNodeId === node.id && x.toSlotId === slotId));
                }
            }

        });
    }

    /**
     * Creates new property slots related to the given property on all selected
     * nodes.
     * @hidden
     */
    createPropertySlot(property : DiazoProperty) {
        let nodeIds = this.selectedNodes.map(x => x.id);

        this.graphContext.commit('Create property slot', (graph, revert) => {
            let nodes = nodeIds.map(id => graph.nodes.find(x => x.id === id));
            this.accessor.set(nodes, property.path, { $edge: `property:${property.path}` });

            for (let node of nodes) {
                if (!node.slots)
                    node.slots = [];

                node.slots.push({
                    id: `property:${property.path}`,
                    label: property.label,
                    value: property.slotValue,
                    type: 'input',
                    dynamic: true,
                    hidden: false
                })
            }
        });
    }
}