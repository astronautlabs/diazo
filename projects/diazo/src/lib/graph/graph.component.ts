import { Component, HostListener, ViewChild, ElementRef, 
    Input, Output } from "@angular/core";
import { BehaviorSubject, Subject } from 'rxjs';
import * as uuid from 'uuid/v4';
import { MatMenuTrigger } from '@angular/material/menu';
import { CdkDrag } from '@angular/cdk/drag-drop';
import { DiazoGraph, DiazoNode, DiazoEdge } from '@diazo/model';
import { Position, pointOnLine, 
    DiazoContext, WildcardType } from '@diazo/model';

/**
 * @category Component
 */
@Component({
    selector: 'dz-container',
    templateUrl: './graph.component.html',
    styleUrls: ['./graph.component.scss'],
    providers: [ DiazoContext ]
})
export class GraphComponent {
    constructor(
        private context : DiazoContext,
        private elementRef : ElementRef<HTMLElement>
    ) {
        context.registerValueType(WildcardType);
    }
    
    ngOnInit() {
        if (!this.context)
            throw new Error(`Error: No context available on this graph (BUG)`);

        this.contextChanged.next(this.context);
        this.context.panChanged.subscribe(pos => this.updatePan());
        this.context.zoomChanged.subscribe(zoom => this.updateZoom());
        this.context.graphChanged.subscribe(graph => this.graphChanged.next(graph));
        this.elementRef.nativeElement.setAttribute('tabindex', '-1');
        this.context.edgeCancelled.subscribe(edge => {
            if (!edge.fromNodeId || !edge.toNodeId)
                this.showNodeMenu();
            
            this.context.bufferedEdge = edge;
        });
    }

    ngAfterViewInit() {
        this.startRendering();
    }

    ngOnDestroy() {

    }

    private canvasContext : CanvasRenderingContext2D;
    private canvas : HTMLCanvasElement;
    private lastFrameTime : number;
    private otherEdgeOpacity = 1;
    private pulseCycle = 0;
    private panTouch : Touch = null;
    private zoomTouch : Touch = null;
    private startPan : Position = null;
    private startZoom : number;
    private startPanZoom : number;
    private touchActive = false;
    private onTouchStartListener;
    private onTouchMoveListener;
    private onTouchEndListener;

    private eligibleForContextMenu = false;

    menuPosition : any = { y: 0, x: 0 };

    @ViewChild('graphMenuTrigger', { read: MatMenuTrigger })
    graphMenuTrigger : MatMenuTrigger;

    @ViewChild('menuContents')
    menuContents : ElementRef<HTMLElement>;
    
    @ViewChild('nodeMenu', { read: CdkDrag })
    nodeMenu : CdkDrag;

    @ViewChild('nodeMenu')
    nodeMenuEl : ElementRef<HTMLElement>;

    @Output()
    graphChanged = new BehaviorSubject<DiazoGraph>({ nodes: [], edges: [] });
    
    @Output()
    nodeMenuPositionChanged = new BehaviorSubject<Position>({ top: 0, left: 0 });

    @ViewChild('plate')
    plateRef : ElementRef<HTMLElement>;
    
    @Input()
    get nodeTypeMap() {
        return this.context.nodeTypeMap;
    }

    get zoom() {
        return this.context.zoom;
    }

    set nodeTypeMap(map) {
        this.context.nodeTypeMap = map;
    }
    
    @Input()
    get graph() {
        return this.context.graph;
    }

    set graph(value) {
        this.context.graph = value;
    }

    @ViewChild('canvas')
    canvasRef : ElementRef<HTMLCanvasElement>;

    @Output()
    contextChanged = new BehaviorSubject(null);

    @HostListener('mouseenter', ['$event'])
    onMouseEnter(event : MouseEvent) {
        this.context.mouseInside = true;
    }

    @HostListener('mouseleave', ['$event'])
    onMouseLeave(event : MouseEvent) {
        this.context.mouseInside = false;
    }

    @HostListener('mousemove', ['$event'])
    onMouseMove(event : MouseEvent) {
        this.mousePosition = this.screenToLocal({ top: event.clientY, left: event.clientX });

        if (this.context.draftNode) {

            this.nodeMenuVisible = false;
            let state = this.context.getNodeByState(this.context.draftNode);
            if (state) {
                state.setPosition(
                    (this.mousePosition.left - this.context.panX) / this.context.zoom , 
                    (this.mousePosition.top - this.context.panY) / this.context.zoom
                );
            }
        }
    }

    mousePosition : Position = { top: 0, left: 0 };

    private updateZoom() {
        if (!this.plateRef)
            return;
        
        this.plateRef.nativeElement.style.transform = `scale(${this.context.zoom})`;
    }

    private updatePan() {
        if (!this.plateRef)
            return;
        
        let el = this.plateRef.nativeElement;
        el.style.left = `${this.context.panX}px`;
        el.style.top = `${this.context.panY}px`;
    }

    private screenToLocal(position : Position): Position {
        let canvas = this.canvasRef.nativeElement;
        let pos = canvas.getBoundingClientRect();

        return { 
            top: position.top - pos.top,
            left: position.left - pos.left
        };
    }

    private getPositionOfSlot(nodeId : string, slotId : string): Position {
        if (!this.context) {
            return;
        }

        let node = this.context.getNodeById(nodeId);

        if (!node)
            return;

        let slot = node.getSlotById(slotId);
        
        if (!slot)
            return;

        return this.screenToLocal(
            slot.getClientPosition()
        );
    }

    get draftNode() {
        return this.context.draftNode;
    }

    nodeMenuVisible = false;

    @Input()
    get readonly() {
        return this.context.readonly;
    }

    set readonly(value) {
        this.context.readonly = value;
    }

    @Input()
    get locked() {
        return this.context.locked;
    }

    set locked(value) {
        this.context.locked = value;
    }

    @Output()
    saveRequested = new Subject<void>();

    @Input()
    active : boolean = undefined;

    private startRendering() {    
        this.canvas = this.canvasRef.nativeElement; 
        this.canvasContext = this.canvas.getContext('2d');
        this.lastFrameTime = Date.now();
        
        let drawFrame = () => (this.drawFrame(), requestAnimationFrame(drawFrame));

        drawFrame();
    }

    private drawFrame() {
        let canvas = this.canvas;
        let context = this.canvasContext;
        let now = Date.now();
        let deltaTime = (now - this.lastFrameTime) / 1000.0;
        this.lastFrameTime = now;
        
        this.pulseCycle += deltaTime * 55;
        this.pulseCycle = this.pulseCycle % 1000;

        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;

        context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        let edgeUnderCursor = this.context.edgeUnderCursor;
        let otherEdgeOpacityTarget = edgeUnderCursor ? 0.1 : 1;
        this.otherEdgeOpacity += (otherEdgeOpacityTarget - this.otherEdgeOpacity) * 2 * deltaTime;

        this.context.edgeUnderCursor = null;

        for (let edge of this.context.edges) {
            let startPos = this.getPositionOfSlot(edge.fromNodeId, edge.fromSlotId);
            let endPos = this.getPositionOfSlot(edge.toNodeId, edge.toSlotId);
            let lineWidth = 2;

            if (!startPos || !endPos)
                continue;

            context.strokeStyle = `white`;
            context.lineCap = 'round';
            context.globalAlpha = this.otherEdgeOpacity;

            // set the edge color based on the value type
            let sourceSlot = this.context.getSlotByIds(edge.fromNodeId, edge.fromSlotId);

            let color = 'white';

            if (sourceSlot && sourceSlot.valueType) {
                color = sourceSlot.valueType.color;
                

                if (sourceSlot.valueType.lineWidth)
                    lineWidth = sourceSlot.valueType.lineWidth;

                if (sourceSlot.valueType.getColorByContext) {
                    color = sourceSlot.valueType.getColorByContext(sourceSlot);
                }
            }

            if (!edge.valid)
                color = 'red';
            
            context.lineWidth = lineWidth;
            context.strokeStyle = color;

            if (this.context.edgeUnderCursor === null) {
                if (pointOnLine(this.mousePosition, startPos, endPos)) {
                    context.globalAlpha = 1;
                    context.lineWidth = 4;
                    this.context.edgeUnderCursor = edge;
                }
            }

            if (this.context.edgesAreEqual(this.context.edgeBeingReplaced, edge)) {
                context.lineWidth = 3;
                context.setLineDash([10,5]);
                context.strokeStyle = 'maroon';
            }

            this.drawEdge(context, startPos, endPos);

            if (edge.active || this.active === true) {
                context.setLineDash([2, 30]);
                context.lineDashOffset = -this.pulseCycle;
                context.lineWidth = 12;

                this.drawEdge(context, startPos, endPos);
            }

            context.globalAlpha = 1;
        }

        if (this.context.draftEdge) {
            let edge = this.context.draftEdge;
            let startPos = this.mousePosition;
            let endPos = this.mousePosition;

            if (edge.fromSlotId)
                startPos = this.getPositionOfSlot(edge.fromNodeId, edge.fromSlotId);

            if (edge.toSlotId)
                endPos = this.getPositionOfSlot(edge.toNodeId, edge.toSlotId);

            context.setLineDash([10,5])
            context.strokeStyle = "white";
            
            let sourceSlot = this.context.getSlotByIds(edge.fromNodeId, edge.fromSlotId);

            
            let color = 'white';
            let width = 3;

            if (sourceSlot && sourceSlot.valueType) {
                color = sourceSlot.valueType.color;

                if (sourceSlot.valueType.lineWidth)
                    width = sourceSlot.valueType.lineWidth;

                if (sourceSlot.valueType.getColorByContext) {
                    color = sourceSlot.valueType.getColorByContext(sourceSlot);
                }
            }

            if (!edge.valid)
                color = 'red';
            
            context.strokeStyle = color;

            context.globalAlpha = 0.5;
            context.lineCap = 'round';
            context.lineWidth = width;
    
            this.drawEdge(context, startPos, endPos);
            context.globalAlpha = 1;
        }

        if (this.context.selectionBoxStart) {
            let selectBox = this.context.selectionBoxStart;

            context.setLineDash([10,10]);
            context.strokeStyle = "#ff7100";
            context.lineWidth = 5;
            context.strokeRect(
                selectBox.left, 
                selectBox.top, 
                this.mousePosition.left - selectBox.left,
                this.mousePosition.top - selectBox.top
            );
        }
    }

    private drawEdge(context : CanvasRenderingContext2D, startPos : Position, endPos : Position) {
        
        if (!startPos || !endPos)
            return;

        context.beginPath();
        context.moveTo(startPos.left, startPos.top);

        context.bezierCurveTo(
            startPos.left + (endPos.left - startPos.left) * 0.5, 
            startPos.top, 
            
            endPos.left - (endPos.left - startPos.left) * 0.5, 
            endPos.top, 
            
            endPos.left, 
            endPos.top
        );
        context.stroke();
    }

    @HostListener('keydown', ['$event'])
    onKeyDown(event : KeyboardEvent) {
        console.log(event.key);

        let targetEl = <HTMLElement>event.target;
        if (targetEl.nodeName === 'INPUT') {
            return;
        }

        if (event.key === 'Delete') {
            if (!this.context.readonly)
                this.context.removeSelectedNodes();
        } else if (event.key === 'Escape') {
            
            this.nodeMenuVisible = false;
            this.context.draftEdge = null;
            this.context.draftNode = null;

        } else if (event.key === ' ') {
            this.showNodeMenu();
        } else if (event.key === 'z' && event.ctrlKey) {
            // undo
            if (!this.context.readonly)
                this.context.undo();
        } else if (event.key === 'Z' && event.ctrlKey) {
            // redo
            if (!this.context.readonly)
                this.context.redo();
        } else if (event.key === 'a' && event.ctrlKey) {
            this.context.selectAll();
            event.stopPropagation();
            event.preventDefault();
        } else if (event.key === 'c' && event.ctrlKey) {
            this.context.copy();
        } else if (event.key === 's' && event.ctrlKey) {
            this.saveRequested.next();
            event.preventDefault();
        } else if (event.key === 'v' && event.ctrlKey) {
            if (!this.context.readonly)
                this.context.paste(this.context.screenToGraph(this.mousePosition));
        }
    }

    isElementInNodeMenu(element : HTMLElement): boolean {
        let el = element;
        while (el) {
            if (el.classList.contains('node-menu'))
                return true;
            el = el.parentElement;
        }

        return false;
    }

    @HostListener('wheel', ['$event'])
    onMouseWheel(event : WheelEvent) {
        
        if (this.isElementInNodeMenu(<any>event.target)) {
            return;
        }
        
        event.stopPropagation();
        event.preventDefault();

        let oldZoom = this.context.zoom;
        let zoom = this.context.zoom + -0.1 * (event.deltaY / 146.0);
        zoom = this.context.clampZoom(zoom);

        let changeFactor = zoom - oldZoom;
        
        if (this.mousePosition) {
            let panX = this.context.panX;
            let panY = this.context.panY;
            
            panX -= (this.mousePosition.left - panX)*changeFactor / oldZoom;
            panY -= (this.mousePosition.top - panY)*changeFactor / oldZoom;

            this.context.setPan(panX, panY);
        }

        this.context.setZoom(zoom);
    }

    onContextMenu() {
        this.showNodeMenu();
        return false;
    }

    updateNodeMenuHeight() {
        
        let el = this.nodeMenuEl.nativeElement;
        let container = el.parentElement;

        let height = container.offsetHeight;
        let rect = el.getBoundingClientRect();
        let containerRect = container.getBoundingClientRect();
        
        let pane : HTMLElement = el.querySelector('.scroll-pane');
        let pr = pane.getBoundingClientRect()
        let prY = pr.y - rect.y;

        pane.style.maxHeight = `${containerRect.y + containerRect.height - rect.y - prY - 40}px`;
        
        this.nodeMenuPositionChanged.next({ 
            top: rect.y - containerRect.y, 
            left: rect.x - containerRect.x, 
        });
    }

    hideNodeMenu() {
        this.nodeMenuVisible = false;
    }

    showNodeMenu() {
        if (this.context.readonly)
            return;
        
        this.context.bufferedEdge = null;
        setTimeout(() => {        
            if (!this.eligibleForContextMenu)
                return;

            this.nodeMenuVisible = true;

            this.menuPosition = { 
                y: (this.mousePosition.top), 
                x: (this.mousePosition.left)
            };

            this.nodeMenuPositionChanged.next({ top: this.menuPosition.y, left: this.menuPosition.x });

            setTimeout(() => {
                this.updateNodeMenuHeight();

                let searchBox : HTMLInputElement = this.menuContents.nativeElement.querySelector('.search-box');
                if (searchBox) {
                    searchBox.focus();
                    searchBox.select();
                }
            });
        });
    }
    
    onDoubleClick(event : MouseEvent) {
        if (this.context.edgeUnderCursor) {

            if (this.context.readonly)
                return;
            
            console.log("Adding reroute node...");
            
            let pos = this.context.screenToGraph(this.mousePosition);
            let splitEdge = this.context.edgeUnderCursor;

            this.context.commit('Add reroute node', graph => {
                
                // create reroute node
                let node : DiazoNode = {
                    id: uuid(),
                    data: {
                        type: 'passthrough',
                        unit: 'reroute'
                    },
                    style: 'reroute',
                    x: pos.left - 10,
                    y: pos.top - 10,
                    slots: [
                        { id: 'passthrough', type: 'passthrough', label: '', value: WildcardType.named('a') }
                    ]
                };
    
                graph.nodes.push(node);

                let preEdge : DiazoEdge = {
                    fromNodeId: splitEdge.fromNodeId,
                    fromSlotId: splitEdge.fromSlotId,
                    toNodeId: node.id,
                    toSlotId: 'passthrough',
                    valid: splitEdge.valid
                };
    
                let postEdge : DiazoEdge = {
                    fromNodeId: node.id,
                    fromSlotId: 'passthrough',
                    toNodeId: splitEdge.toNodeId,
                    toSlotId: splitEdge.toSlotId,
                    valid: splitEdge.valid
                };
    
                let index = graph.edges.findIndex(x => this.context.edgesAreEqual(x, splitEdge));
    
                if (index >= 0)
                    graph.edges.splice(index, 1);
    
                graph.edges.push(preEdge, postEdge);
            });


        }
    }

    onClick(event : MouseEvent) {
        this.nodeMenuVisible = false;

        if (event.button === 0 && event.altKey) {
            if (this.context.edgeUnderCursor) {

                if (!this.context.readonly)
                    this.context.removeEdge(this.context.edgeUnderCursor);
            }
        }
    }

    onTouchStart(event : TouchEvent) {
        if (!this.touchActive) {
            this.touchActive = true;
            document.addEventListener('touchstart', this.onTouchStartListener = event => this.onNewTouch(event));
            document.addEventListener('touchmove', this.onTouchMoveListener = event => this.onTouchMove(event));
            document.addEventListener('touchend', this.onTouchEndListener = event => this.onTouchEnd(event));
            this.onNewTouch(event);
        }
    }

    onNewTouch(event : TouchEvent) {
        let touch = event.changedTouches[0];

        if (this.panTouch && this.panTouch.identifier === touch.identifier)
            return;
        if (this.zoomTouch && this.zoomTouch.identifier === touch.identifier)
            return;
        
        if (!this.panTouch) {
            this.startPan = { top: this.context.panY, left: this.context.panX };
            this.startPanZoom = this.context.zoom;
            this.panTouch = touch;
        } else if (!this.zoomTouch) {
            this.startZoom = this.context.zoom;
            this.zoomTouch = touch;
        }

        event.preventDefault();
    }

    onTouchMove(event : TouchEvent) {
        let newPanTouch = Array.from(event.touches).find(x => x.identifier === this.panTouch.identifier);
        if (this.panTouch && !this.zoomTouch) {

            if (newPanTouch) {
                let pos : Position = { 
                    left: newPanTouch.clientX - this.panTouch.clientX, 
                    top: newPanTouch.clientY - this.panTouch.clientY 
                };
                this.context.setPan(this.startPan.left + pos.left, this.startPan.top + pos.top);
            }
        }
        
        if (this.zoomTouch && this.panTouch) {
            let newZoomTouch = Array.from(event.touches).find(x => x.identifier === this.zoomTouch.identifier);
            if (newZoomTouch) {

                let originalDistance = Math.sqrt(
                    (this.panTouch.clientX - this.zoomTouch.clientX)**2 
                    + (this.panTouch.clientY - this.zoomTouch.clientY)**2
                );

                let newDistance = Math.sqrt(
                    (newPanTouch.clientX - newZoomTouch.clientX)**2 
                    + (newPanTouch.clientY - newZoomTouch.clientY)**2
                );


                let travel = newDistance / originalDistance;
                let oldZoom = this.context.zoom;
                let newZoom = this.startZoom * travel;
                let changeFactor = newZoom - oldZoom;
                
                let zoomOrigin = {
                    left: (newPanTouch.clientX + newZoomTouch.clientX) / 2,
                        top: (newPanTouch.clientY + newZoomTouch.clientY) / 2
                };
                let zoomOriginLocal = this.screenToLocal(zoomOrigin);

                let oZoomOrigin = this.zoomOrigin || zoomOrigin;
                this.zoomOrigin = zoomOrigin;
                
                let oZoomOriginLocal = this.screenToLocal(oZoomOrigin);

                let panX = this.startPan.left * this.startPanZoom / newZoom;
                let panY = this.startPan.top * this.startPanZoom / newZoom;

                // OLD
                panX = this.context.panX;
                panY = this.context.panY;

                panX -= (zoomOriginLocal.left - panX)*changeFactor / oldZoom;
                panY -= (zoomOriginLocal.top - panY)*changeFactor / oldZoom;
    
                panX += (zoomOrigin.left - oZoomOrigin.left) * newZoom;
                panY += (zoomOrigin.top - oZoomOrigin.top) * newZoom;

                this.context.setPan(panX, panY);
                this.context.setZoom(newZoom);
            }
        }

        event.stopPropagation();
        event.preventDefault();
    }

    zoomOrigin : Position;

    onTouchEnd(event : TouchEvent) {
        
        let touch = event.changedTouches[0];
        
        if (this.panTouch && !this.zoomTouch) {
            let threshold = 10;
            if (Math.abs(this.panTouch.clientX - touch.clientX) < threshold && Math.abs(this.panTouch.clientY - touch.clientY) < threshold) {
                this.context.unselectAll();
            }
        }

        if (this.zoomTouch && this.zoomTouch.identifier === touch.identifier) {
            this.zoomTouch = null;
        }
        
        if (this.panTouch && this.panTouch.identifier === touch.identifier) {
            this.panTouch = this.zoomTouch ? Array.from(event.touches).find(x => x.identifier === this.zoomTouch.identifier) : null;
            this.zoomTouch = null;
            this.startPan = { top: this.context.panY, left: this.context.panX };
        }

        if (event.touches.length === 0) {
            this.touchActive = false;
            document.removeEventListener('touchstart', this.onTouchStartListener);
            document.removeEventListener('touchmove', this.onTouchMoveListener);
            document.removeEventListener('touchend', this.onTouchEndListener);
        }
    }
    
    componentForNode(node : DiazoNode) {
        if (!node || !node.type || !this.context.nodeTypeMap)
            return null;
        
        let klass = this.context.nodeTypeMap[node.type];
        if (!klass)
            throw new Error(`Cannot find node component for type '${node.type}'`);

        return klass;
    }

    onMouseDown(startEvent : MouseEvent) {
        if (startEvent.button === 0) {
            // start selection
            this.context.startSelectionAt(this.mousePosition, startEvent.ctrlKey);
            
            let move = () => {
                this.context.setSelectionBoxEnd(this.mousePosition);
            };
            
            let release = () => {
                document.removeEventListener('mouseup', release);
                document.removeEventListener('mousemove', move);
                this.context.commitSelectionBox();
            };
            
            
            document.addEventListener('mouseup', release);
            document.addEventListener('mousemove', move);
        } else if (startEvent.button === 2) {
            let startLeft = this.context.panX;
            let startTop = this.context.panY;
            
            this.eligibleForContextMenu = true;

            let release = () => {
                document.removeEventListener('mouseup', release);
                document.removeEventListener('mousemove', move);
            };

            let move = (event : MouseEvent) => {
                if (Math.abs(event.clientX - startEvent.clientX) > 5 
                    || Math.abs(event.clientY - startEvent.clientY) > 5) {
                        this.eligibleForContextMenu = false;
                        this.nodeMenuVisible = false;
                    }

                this.context.setPan(
                    startLeft + (event.clientX - startEvent.clientX),
                    startTop + (event.clientY - startEvent.clientY)
                );
            };

            document.addEventListener('mouseup', release);
            document.addEventListener('mousemove', move);
        }   
    }
    
    nodeIdentity(index : number, node : DiazoNode) {
        return node.id;
    }
}