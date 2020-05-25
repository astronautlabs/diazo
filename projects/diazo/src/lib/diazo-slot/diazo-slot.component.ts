import { Component, Input, HostBinding, ElementRef, ViewChild, HostListener } from '@angular/core';
import { DiazoNodeContext, DiazoSlotContext, DiazoContext } from '../diazo-context';
import { SubSink } from 'subsink';

@Component({
    selector: 'dz-slot',
    templateUrl: './diazo-slot.component.html',
    styleUrls: ['./diazo-slot.component.scss'],
    providers: [ DiazoSlotContext ]
})
export class DiazoSlotComponent {
    constructor(
        private graphContext : DiazoContext,
        private nodeContext : DiazoNodeContext,
        private context : DiazoSlotContext,
        private element : ElementRef<HTMLElement>
    ) {
        this.context.type = 'input';
        this.context.node = nodeContext;
        this.context.getClientPosition = () => {
            let endpointEl = this.endpointRef.nativeElement;
            let pos = endpointEl.getBoundingClientRect();

            return { 
                top: pos.top    + endpointEl.offsetWidth / 2 + 1, 
                left: pos.left  + endpointEl.offsetHeight / 2
            };
        };
    }

    @ViewChild('endpoint')
    endpointRef : ElementRef<HTMLElement>;

    valueTypeLabel : string;

    @Input()
    label : string;

    @HostBinding('attr.title')
    get tooltip() {
        return `${this.label} (${this.valueTypeLabel || 'ANY'})`;
    }

    @Input()
    get id() {
        return this.context.id;
    }

    set id(value) {
        this.context.id = value;
    }

    @Input()
    get type() {
        return this.context.type;
    }

    set type(value) {
        this.context.type = value;
    }

    @Input()
    get value() {
        return this.context.value;
    }

    @Input()
    @HostBinding('class.hidden')
    hidden : boolean = false;

    @HostBinding('class.arrow')
    get isArrowShaped() {
        return this.slotShape === 'arrow';
    }

    @HostBinding('class.square')
    get isSquareShaped() {
        return this.slotShape === 'square';
    }

    get slotShape() {
        if (this.context.valueType) {
            if (this.context.valueType.getSlotShapeByContext)
                return this.context.valueType.getSlotShapeByContext(this.context);
            if (this.context.valueType.slotShape)
                return this.context.valueType.slotShape;
        }
        return 'circle';
    }

    color : string;

    set value(value) {
        this.context.value = value;
        this.context.valueType = null;

        if (value) {
            this.context.valueType = this.graphContext.getValueTypeById(value.type);
        }
    }

    @HostBinding('class.output')
    get isOutput() {
        return this.type === 'output';
    }

    @HostBinding('class.input')
    get isInput() {
        return this.type === 'input';
    }
    

    @HostBinding('class.attached')
    get isAttached() {
        return this.context.edges.length > 0;
    }

    private subsink = new SubSink();

    ngOnInit() {
        this.nodeContext.registerSlot(this.context);

        this.updateValueType();
        
        this.subsink.add(
            this.graphContext.valueTypesChanged.subscribe(() => {
                this.value = this.context.value;

                this.updateValueType();
            })
        );
    }

    updateValueType() {
        this.valueTypeLabel = null;
        this.color = 'white';

        if (this.context.valueType) {
            if (this.context.valueType.getColorByContext)
                this.color = this.context.valueType.getColorByContext(this.context);
            else if (this.context.valueType.color)
                this.color = this.context.valueType.color;

            if (this.context.valueType.getNameByContext)
                this.valueTypeLabel = this.context.valueType.getNameByContext(this.context);
            else
                this.valueTypeLabel = this.context.valueType.name;
        }
    }
    ngOnDestroy() {
        this.nodeContext.deregisterSlot(this.context);
        this.subsink.unsubscribe();
    }

    @HostListener('mousedown', ['$event'])
    startEdge(event : MouseEvent) {
        if (!this.nodeContext.readonly)
            this.nodeContext.startEdge(this.context, event);
    }

    @HostBinding('class.drafted')
    get isPartOfDraftedEdge() {
        if (!this.graphContext.draftEdge)
            return false;

        if (this.graphContext.draftEdge.fromNodeId === this.nodeContext.id && this.graphContext.draftEdge.fromSlotId === this.id)
            return true;

        if (this.graphContext.draftEdge.toNodeId === this.nodeContext.id && this.graphContext.draftEdge.toSlotId === this.id)
            return true;

        return false;
    }

    @HostListener('mouseenter', ['$event'])
    onMouseEnter(event : MouseEvent) {
        let drafted = this.graphContext.draftEdge;

        if (drafted && drafted.fromNodeId !== this.nodeContext.id) {
            // _we_ could be the connection for this
            console.log(`slot: allowing snap`);
            this.graphContext.draftEdgeSnap(this.context);
        }
    }

    @HostListener('mouseleave', ['$event'])
    onMouseLeave(event : MouseEvent) {
        if (this.graphContext.draftEdge)
            this.graphContext.draftEdgeUnsnap(this.context);
    }
}