import { Component, Input, ComponentFactoryResolver, ReflectiveInjector, Injector, ViewContainerRef, ComponentRef, Provider } from '@angular/core';
import { FiregraphPropertyContext, FiregraphProperty, FiregraphNode, FiregraphContext } from '../firegraph-context';

@Component({
    selector: 'fg-custom-property-editor',
    template: ``,
    styles: [``]
})
export class CustomPropertyEditorHostComponent {
    constructor(
        private factoryResolver : ComponentFactoryResolver,
        private injector : Injector,
        private viewContainer : ViewContainerRef
    ) {

    }
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

    private _propertyContext = new FiregraphPropertyContext();

    @Input()
    get graphContext() : FiregraphContext {
        return this._propertyContext.graphContext;
    }

    set graphContext(value) {
        this._propertyContext.graphContext = value;
    }

    @Input()
    get property(): FiregraphProperty {
        return this._propertyContext.property;
    }

    set property(value) {
        this._propertyContext.property = value;
    }

    @Input()
    get selectedNodes(): FiregraphNode[] {
        return this._propertyContext.selectedNodes;
    }

    set selectedNodes(value) { 
        this._propertyContext.selectedNodes = value;
    }

    @Input()
    providers : Provider[] = [];

    private initialize() {
        
        // Destroy any previously loaded component
        if (this._componentRef) {
            this._componentRef.destroy();
            this._componentRef = null;
        }

        let fac = this.factoryResolver.resolveComponentFactory(this.componentType);
        let injector = ReflectiveInjector.resolveAndCreate(
            (this.providers || []).concat([
                { provide: FiregraphPropertyContext, useValue: this._propertyContext }
            ]), 
            this.injector
        );

        this._componentRef = this.viewContainer.createComponent(fac, undefined, injector);
    }
}