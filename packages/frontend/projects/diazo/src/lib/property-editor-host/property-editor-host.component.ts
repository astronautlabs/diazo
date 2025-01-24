import { Component, Input, 
    Injector, ViewContainerRef, ComponentRef,
    StaticProvider,
    inject} from '@angular/core';
import { DiazoPropertyContext, DiazoContext, DiazoProperty, 
    DiazoNode } from '@diazo/model';

/**
 * @category Component
 */
@Component({
    selector: 'dz-property-editor-host',
    template: ``,
    styles: [``]
})
export class PropertyEditorHostComponent {
    private injector = inject(Injector);
    private viewContainer = inject(ViewContainerRef);

    private _componentType : any;
    private _componentRef : ComponentRef<any>;

    @Input()
    get componentType() {
        return this._componentType;
    }

    set componentType(value) {
        this._componentType = value;
        setTimeout(() => this.initialize());
    }

    private _propertyContext = new DiazoPropertyContext();

    @Input()
    get graphContext() : DiazoContext {
        return this._propertyContext.graphContext;
    }

    set graphContext(value) {
        this._propertyContext.graphContext = value;
    }

    @Input()
    get property(): DiazoProperty {
        return this._propertyContext.property;
    }

    set property(value) {
        this._propertyContext.property = value;
    }

    @Input()
    get selectedNodes(): DiazoNode[] {
        return this._propertyContext.selectedNodes;
    }

    set selectedNodes(value) { 
        this._propertyContext.selectedNodes = value;
    }

    @Input()
    providers : StaticProvider[] = [];

    private initialize() {
        // Destroy any previously loaded component
        if (this._componentRef) {
            this._componentRef.destroy();
            this._componentRef = null;
        }

        this._componentRef = this.viewContainer.createComponent(this.componentType, { 
            injector: Injector.create({
                providers: (this.providers || []).concat([
                    { provide: DiazoPropertyContext, useValue: this._propertyContext }
                ]),
                parent: this.injector
            })
        });
    }
}