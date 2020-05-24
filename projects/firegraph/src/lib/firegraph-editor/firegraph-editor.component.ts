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

    private windowResizeHandler;

    ngOnDestroy() {
        window.removeEventListener('resize', this.windowResizeHandler);
    }

    @Input()
    readonly = false;

    @Input()
    locked = false;

    @Input()
    providers : Provider[] = [];

    menuProp : FiregraphProperty;
    nodeMenuPosition: Position;
    newNodePosition: Position;

    setNewNodePosition(position : Position) {
        if (!this.graphContext)
            return;
        
        this.nodeMenuPosition = position;
        this.newNodePosition = {
            left: position.left - this.graphContext.panX - 20,
            top: position.top - this.graphContext.panY - 20
        };
    }

    @ViewChild('container')
    container : FiregraphComponent;

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

    private _propertySearch = '';
    private _nodeSearch = '';

    propertyManipulator : any;
    graphContext : FiregraphContext;
    selectedNodeContext : FiregraphNodeContext;
    selectedNodeContexts : FiregraphNodeContext[] = [];

    isCustomPropertyType(type : string) {
        return !!this.getCustomPropertyType(type);
    }

    errorSearchQuery : string = '';

    getCustomPropertyType(type : string) {
        return this.customPropertyTypes.find(x => type === `${x.namespace}:${x.id}`);
    }

    numericRange(min, max, step = 1) {
        let array = [];

        for (let i = min; i < max; i += step)
            array.push(i);

        return array;
    }

    get MULTIPLE_VALUES() {
        return MULTIPLE_VALUES;
    }
    
    get selectedNode() {
        return this.selectedNodeContext.state;
    }

    get selectedNodes() {
        return this.selectedNodeContexts.map(x => x.state).filter(x => x);
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

    @Output()
    contextChanged = new Subject<FiregraphContext>();

    @Output() 
    graphChanged = new Subject<Firegraph>();

    onGraphChanged(graph : Firegraph) {
        this.graphChanged.next(graph);
    }
    
    @Input()
    universalPropertySets : FiregraphPropertySet[] = [];
    selectedPropertySets : FiregraphPropertySet[] = [];

    @Input()
    active : boolean = undefined;

    _availableNodes : FiregraphNodeSet[] = [];

    @Input()
    get availableNodes() {
        return this._availableNodes;
    }

    set availableNodes(value) {
        this._availableNodes = value;
        if (this._graph)
            this.inflateGraph(this._graph);
    }

    @Input()
    optionSources : Record<string, Record<string, FiregraphPropertyOptionGroup[]>>;
    
    @Input()
    nodeTypeMap : Record<string, any>;

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

    @Input()
    customPropertyTypes : FiregraphCustomPropertyType[] = [];

    @Input()
    valueTypes : { new() : FiregraphValueType; }[] = [];

    _graph : Firegraph = {
        nodes: [],
        edges: []
    };

    @Input()
    get graph() {
        return this._graph;
    }

    set graph(value) {
        this._graph = value;
        if (this._graph)
            this.inflateGraph(this._graph);
    }

    @Output()
    saveRequested = new Subject<void>();

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

    accessor = new Accessor();
    
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

    labelCache = new WeakMap<FiregraphNode, string>();
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

    matchingNodeSets : FiregraphNodeSet[];
    matchingNodes : FiregraphNode[];

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

    private _showProperties : boolean = undefined;
    private _showPropertiesByDefault = true;

    get showProperties() {
        if (this._showProperties === undefined)
            return this._showPropertiesByDefault;
        return this._showProperties;
    }

    set showProperties(value) {
        this._showProperties = value;
    }
}