import { Component, Input, Output, Provider, ViewChild, ElementRef } from "@angular/core";
import { Firegraph, FiregraphContext, FiregraphNode, FiregraphPropertySet, FiregraphValueType, FiregraphNodeContext, FiregraphNodeSet, FiregraphSlot, FiregraphCustomPropertyType, FiregraphPropertyOption, FiregraphPropertyOptionGroup, FiregraphProperty, Position } from '../firegraph-context';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { Accessor, MULTIPLE_VALUES } from '../accessor';
import { moveItemInArray } from '@angular/cdk/drag-drop';
import { FiregraphComponent } from '../firegraph/firegraph.component';
import * as uuid from 'uuid/v4';

@Component({
    selector: 'fg-editor',
    templateUrl: './firegraph-editor.component.html',
    styleUrls: ['./firegraph-editor.component.scss']
})
export class FiregraphEditorComponent {
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

    ngOnInit() {
        this.windowResizeHandler = () => {
            this._showPropertiesByDefault = (window.innerWidth > 500);
        };

        window.addEventListener('resize', this.windowResizeHandler);
    }

    ngOnDestroy() {
        window.removeEventListener('resize', this.windowResizeHandler);
    }

    private windowResizeHandler;
    private _propertySearch = '';
    private _nodeSearch = '';
    private _showProperties : boolean = undefined;
    private _showPropertiesByDefault = true;
    private _graph : Firegraph = {
        nodes: [],
        edges: []
    };

    accessor = new Accessor();
    menuProp : FiregraphProperty;
    nodeMenuPosition: Position;
    newNodePosition: Position;
    propertyManipulator : any;
    graphContext : FiregraphContext;
    selectedNodeContext : FiregraphNodeContext;
    selectedNodeContexts : FiregraphNodeContext[] = [];
    errorSearchQuery : string = '';
    _availableNodes : FiregraphNodeSet[] = [];
    selectedPropertySets : FiregraphPropertySet[] = [];
    labelCache = new WeakMap<FiregraphNode, string>();
    matchingNodeSets : FiregraphNodeSet[];
    matchingNodes : FiregraphNode[];

    get propertySearch() {
        return this._propertySearch;
    }

    set propertySearch(value) {
        this._propertySearch = value;
        setTimeout(() => this.updateSelectedPropertySets());
    }

    get nodeSearch() {
        return this._nodeSearch;
    }

    set nodeSearch(value) {
        this._nodeSearch = value;
        setTimeout(() => this.updateSelectedNodeSets());
    }

    get showProperties() {
        if (this._showProperties === undefined)
            return this._showPropertiesByDefault;
        return this._showProperties;
    }

    set showProperties(value) {
        this._showProperties = value;
    }

    monacoOptions = {
        theme: 'vs-dark', 
        language: 'json',
        automaticLayout: true
    };

    markdownMonacoOptions = {
        theme: 'vs-dark', 
        language: 'markdown',
        automaticLayout: true
    };

    tsMonacoOptions = {
        theme: 'vs-dark', 
        language: 'typescript',
        automaticLayout: true
    };

    /**
     * Fired when the FiregraphContext has been acquired from the underlying
     * Firegraph component. FiregraphContext represents the operating state 
     * (model) of the Firegraph editor.
     */
    @Output()
    contextChanged = new Subject<FiregraphContext>();

    /**
     * Fired when the graph has been changed by the user. More technically
     * this is fired when a change transaction is "committed" to the Firegraph
     * Context. These change transactions underpin Firegraph's support for Undo/Redo.
     */
    @Output() 
    graphChanged = new Subject<Firegraph>();

    /**
     * If true, the Firegraph editor will be placed in Read Only mode. The user 
     * can still move nodes around, but new nodes cannot be created, existing nodes
     * cannot be removed, and edges cannot be changed.
     */
    @Input()
    readonly = false;

    /**
     * If true, the Firegraph editor will allow no changes to the graph whatsoever.
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

    @ViewChild('container')
    container : FiregraphComponent;

    /**
     * Specify an array of PropertySets which will be shown for all nodes that
     * exist in the graph. These PropertySets will be shown after the ones defined
     * on the node itself.
     */
    @Input()
    universalPropertySets : FiregraphPropertySet[] = [];

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
     * The Firegraph editor will automatically populate these options into the select
     * box in the Properties panel.
     */
    @Input()
    optionSources : Record<string, Record<string, FiregraphPropertyOptionGroup[]>>;
    
    /**
     * Specify a set of custom components that will be used to render specific types of 
     * nodes. The key of this map should match the "$.type" property of a node you wish
     * to use a custom component with. The value is the Angular component class.
     * 
     * The custom component can inject the `FiregraphNodeContext` instance in order 
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
    customPropertyTypes : FiregraphCustomPropertyType[] = [];

    /**
     * Specify a set of "value types" which are used to declare the types of 
     * edges that can be created within the graph. The value type system 
     * supports compatibility by class heirarchy by default, and custom value
     * type classes can even redefine the notion of compatibility however they want.
     * Compatibility here refers to whether a slot with one "value" is allowed to be 
     * connected to a slot with another "value".
     * 
     * Value types also define the color and appearance of the edge when rendered
     * within Firegraph.
     */
    @Input()
    valueTypes : { new() : FiregraphValueType; }[] = [];

    /**
     * Specify the Firegraph object that this editor should work with.
     * The object is passed by reference here, and the object will be 
     * modified by the Firegraph editor *in place*. Note that you can 
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
     * (Firegraph Editor does not do anything special with a Save 
     * request by default, that is up to the consumer). This fires
     * when the user presses Ctrl+S / Cmd+S.
     */
    @Output()
    saveRequested = new Subject<void>();

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
     */
    get MULTIPLE_VALUES() {
        return MULTIPLE_VALUES;
    }

    /**
     * Get the currently selected FiregraphNode (the first one if there are multiple
     * nodes selected)
     */
    get selectedNode() {
        return this.selectedNodeContext.state;
    }

    /**
     * Get the currently selected FiregraphNodes.
     */
    get selectedNodes() {
        return this.selectedNodeContexts.map(x => x.state).filter(x => x);
    }

    setNewNodePosition(position : Position) {
        if (!this.graphContext)
            return;
        
        this.nodeMenuPosition = position;
        this.newNodePosition = {
            left: position.left - this.graphContext.panX - 20,
            top: position.top - this.graphContext.panY - 20
        };
    }

    hideNodeMenu() {
        if (this.container)
            this.container.hideNodeMenu();
    }

    insertSelectedNode() {
        let template = this.matchingNodes[this.selectedMatchingNodeIndex];

        this.graphContext.draftNode = Object.assign(
            {}, 
            template,
            <Partial<FiregraphNode>>{ 
                id: uuid(),
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

    isCustomPropertyType(type : string) {
        return !!this.getCustomPropertyType(type);
    }

    getCustomPropertyType(type : string) {
        return this.customPropertyTypes.find(x => type === `${x.namespace}:${x.id}`);
    }

    numericRange(min, max, step = 1) {
        let array = [];

        for (let i = min; i < max; i += step)
            array.push(i);

        return array;
    }

    onGraphChanged(graph : Firegraph) {
        this.graphChanged.next(graph);
    }
    
    getOptionsFromSource(sourceDescriptor : string): FiregraphPropertyOptionGroup[] {
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

    propertyNeedsMenu(prop : FiregraphProperty) {
        return prop.allowAnnotation !== false || prop.slottable;
    }

    inflateGraph(graph : Firegraph) {
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

    findTemplateNode(node : FiregraphNode) {
        if (!node.data || !node.data.unit)
            return null;
        
        for (let set of this.availableNodes) {
            let templateNode : FiregraphNode;

            templateNode = set.nodes.find(x => x.data.variant && x.data.variant === node.data.variant);
            if (!templateNode)
                templateNode = set.nodes.find(x => x.data.unit === node.data.unit);

            if (templateNode)
                return templateNode;
        }

        return null;
    }

    labelForNode(node : FiregraphNode) {
        if (this.labelCache.has(node))
            return this.labelCache.get(node);
        
        let label = this.accessor.get([ node ], '$.label');
        this.labelCache.set(node, label);

        return label;
    }

    nodeMenuKeyboardMode = false;
    selectedMatchingNodeIndex = 0;

    getIndexOfMatchingNode(node : FiregraphNode) {
        return this.matchingNodes.indexOf(node);
    }

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

    updateSelectedNodeSets() {
        let sets = this.availableNodes.slice();
        sets = sets.map(x => Object.assign({}, x));

        sets.forEach(set => set.nodes = set.nodes.filter(x => JSON.stringify(x).toLowerCase().includes(this.nodeSearch)));
        sets = sets.filter(set => set.nodes.length > 0);

        this.matchingNodeSets = sets;
        this.matchingNodes = [].concat(...sets.map(x => x.nodes));
    }

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

    path(v) {
        return v.path;
    }

    identity(v) {
        return v.id;
    }

    value(v) {
        return v.value;
    }

    acquireGraphContext(context : FiregraphContext) {
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

    reorderSlots(event) {
        moveItemInArray(this.selectedNodes[0].slots, event.previousIndex, event.currentIndex);
    }

    isPropSlotted(prop : FiregraphProperty) {
        return this.selectedNodes.some(node => node.slots.some(x => x.id === `property:${prop.path}`))
    }
    
    removePropertySlot(property : FiregraphProperty) {
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

    createPropertySlot(property : FiregraphProperty) {
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