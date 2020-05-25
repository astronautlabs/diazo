import { Component, ElementRef, ViewContainerRef, Input, HostListener, HostBinding, ViewChild } from "@angular/core";
import { DiazoContext, DiazoNode, Position } from '../diazo-context';
import { DiazoNodeContext } from '../diazo-context';
import { MatMenuTrigger } from '@angular/material/menu';

@Component({
    selector: 'dz-node',
    templateUrl: './diazo-node.component.html',
    styleUrls: ['./diazo-node.component.scss'],
    providers: [DiazoNodeContext]
})
export class DiazoNodeComponent {
    constructor(
        private context : DiazoContext,
        private nodeContext : DiazoNodeContext,
        private elementRef : ElementRef<HTMLElement>,
    ) {
        nodeContext.graph = context;

        // my subscriptions

        nodeContext.positionChanged.subscribe(pos => this.updatePosition());

        this.nodeContext.getSize = () => {
            let el = this.elementRef.nativeElement;
            return { 
                width: el.getBoundingClientRect().width,
                height: el.getBoundingClientRect().height
            };
        }

    }

    @Input()
    get ownState() {
        return this.nodeContext.ownState;
    }

    set ownState(value) {
        this.nodeContext.ownState = value;
    }
    
    // @Input()
    // get state() : DiazoNode {
    //     return this.nodeContext.state;
    // }

    // set state(value) {
    //     this.nodeContext.state = value;
    // }

    get state() {
        return this.nodeContext.state;
    }

    @HostBinding('class.slim')
    get isSlim() {
        if (!this.state)
            return false;

        return this.state.profile === 'slim';
    }

    @HostBinding('class.wide')
    get isWide() {
        if (!this.state)
            return false;

        return this.state.profile === 'wide';
    }

    @HostBinding('class.selected')
    get isSelected() {
        return this.nodeContext.selected;
    }

    @HostBinding('class.compact')
    get isCompact() {
        if (!this.state)
            return false;

        return this.state.style === 'compact';
    }

    @HostBinding('class.inline')
    get isInline() {
        if (!this.state)
            return false;

        return this.state.style === 'inline';
    }

    @HostBinding('class.reroute')
    get isReroute() {
        if (!this.state)
            return false;

        return this.state.style === 'reroute';
    }

    @Input() 
    get id() {
        return this.nodeContext.id;
    }

    set id(value) {
        this.nodeContext.id = value;
    }

    ngAfterViewInit() {
        this.updatePosition();
    }
    
    ngOnInit() {
        this.context.registerNode(this.nodeContext);
    }

    ngOnDestroy() {
        this.context.deregisterNode(this.nodeContext);
    }

    @HostListener('mousemove', ['$event'])
    onMouseMove(event : MouseEvent) {
        this.mousePosition = { top: event.offsetY, left: event.offsetX };
    }

    get readonly() {
        return this.context.readonly || this.nodeContext.readonly;
    }

    @ViewChild('graphMenuTrigger', { read: MatMenuTrigger })
    graphMenuTrigger : MatMenuTrigger;
    
    mousePosition : Position = { top: 0, left: 0 };

    @HostListener('contextmenu')
    onContextMenu() {

        this.graphMenuTrigger.openMenu();

        return false;
    }
    
    @HostListener('click', ['$event'])
    onClick(event : MouseEvent) {
        if (event.button === 2) {
            event.stopPropagation();
            event.preventDefault();
            return;
        }
    }

    isElementInSlot(element : HTMLElement): boolean {
        let el = element;
        while (el) {
            if (el.tagName.toLowerCase() === 'fg-slot')
                return true;
            el = el.parentElement;
        }

        return false;
    }

    @HostListener('mousedown', ['$event'])
    async startMoving(startEvent : MouseEvent) {
        if (startEvent.button === 2) {
            // panning
            // TODO: deduplicate (also present in diazo.component.ts)

            let startLeft = this.context.panX;
            let startTop = this.context.panY;

            let release = () => {
                document.removeEventListener('mouseup', release);
                document.removeEventListener('mousemove', move);
            };

            let move = (event : MouseEvent) => {
                this.context.setPan(
                    startLeft + (event.clientX - startEvent.clientX),
                    startTop + (event.clientY - startEvent.clientY)
                );
            };

            document.addEventListener('mouseup', release);
            document.addEventListener('mousemove', move);

            startEvent.stopPropagation();
            startEvent.preventDefault();

        } else if (startEvent.button === 0) {
            
            let touchedElement = <HTMLElement>startEvent.target;
            
            if (this.isElementInSlot(touchedElement))
                return;

            if (startEvent.ctrlKey) {
                if (!this.context.isNodeSelected(this.nodeContext))
                    this.context.addToSelection(this.nodeContext);
                else
                    this.context.removeFromSelection(this.nodeContext);
            } else {
                if (!this.context.isNodeSelected(this.nodeContext))
                    this.context.selectNode(this.nodeContext);
            }

            let el = this.elementRef.nativeElement;
            let startLeft = el.offsetLeft;
            let startTop = el.offsetTop;

            if (this.context.locked || this.nodeContext.locked)
                return;
            
            let movedSelection = (this.context.selectedNodes || []).slice();

            if (movedSelection.length === 0) {
                console.warn(`startMoving(): Empty selection! This is probably a bug.`);
                return;
            }

            let release = () => {
                document.removeEventListener('mouseup', release);
                document.removeEventListener('mousemove', move);

                this.context.commit('Move', graph => {
                    for (let node of movedSelection) {
                        let graphNode = graph.nodes.find(x => x.id === node.id);
                        graphNode.x += (this.state.positionDeltaX || 0);
                        graphNode.y += (this.state.positionDeltaY || 0);
                        graphNode.positionDeltaX = 0;
                        graphNode.positionDeltaY = 0;
                        
                        graphNode.x = Math.round(graphNode.x / this.context.gridSizeX) * this.context.gridSizeX;
                        graphNode.y = Math.round(graphNode.y / this.context.gridSizeY) * this.context.gridSizeY;

                        //node.commitDeltaPosition();
                    }
                });
                
            };

            let move = (event : MouseEvent) => {
            
                let dx = event.clientX - startEvent.clientX;
                let dy = event.clientY - startEvent.clientY;

                for (let node of movedSelection) {
                    node.changeDeltaPosition(dx / this.context.zoom, dy / this.context.zoom);
                    // node.setPositionOnGrid(
                    //     node.x + dx / this.context.zoom,
                    //     node.y + dy / this.context.zoom
                    // );
                }

                // this.setPosition(
                //     startLeft + (event.clientX - startEvent.clientX) / this.context.zoom,
                //     startTop + (event.clientY - startEvent.clientY) / this.context.zoom
                // );
            };

            document.addEventListener('mouseup', release);
            document.addEventListener('mousemove', move);
        }
    }

    setPosition(x : number, y : number) {
        this.nodeContext.setPositionOnGrid(x, y);
    }

    updatePosition() {

        if (!this.nodeContext.state)
            return;
        
        let el = this.elementRef.nativeElement;
        el.style.left = `${this.nodeContext.effectivePositionX}px`;
        el.style.top = `${this.nodeContext.effectivePositionY}px`;
    }
}